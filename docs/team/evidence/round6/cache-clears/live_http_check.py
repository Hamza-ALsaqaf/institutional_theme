"""Live check of the targeted identity clears across two processes (round 6, item 2).

The web server is one process, this script is another. It logs in over HTTP as Administrator, reads the desk
page (`<title>` is `app_name`, `frappe.boot.app_logo_url` comes from the cached boot payload) and the login page,
then saves an identity through the app's own settings document in THIS process (the same code path as the form),
and reads the web server's pages again. Then it restores and reads a third time. Every step prints one line.

    python3 live_http_check.py <site> <base-url>      (run from the bench's sites folder, as the bench user)

Exit 0 only when every page showed the new values after the save and the old ones after the restore.
"""

from __future__ import annotations

import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

import frappe
import frappe.website.utils

SITE, BASE = sys.argv[1], sys.argv[2].rstrip("/")
NAME = "Live Check Authority"
DOCTYPE = "Institutional Theme Settings"
PNG = b"\x89PNG\r\n\x1a\n\x81\x90" + bytes([42]) * 40


def opener() -> urllib.request.OpenerDirector:
	jar = http.cookiejar.CookieJar()
	op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
	data = urllib.parse.urlencode({"usr": "Administrator", "pwd": "admin"}).encode()
	with op.open(urllib.request.Request(f"{BASE}/api/method/login", data=data), timeout=60) as r:
		assert r.status == 200, r.status
	return op


def get(op: urllib.request.OpenerDirector, path: str) -> str:
	with op.open(urllib.request.Request(f"{BASE}{path}", headers={"Host": SITE}), timeout=120) as r:
		return r.read().decode("utf-8", "replace")


def desk(op: urllib.request.OpenerDirector) -> tuple[str, str, str]:
	html = get(op, "/desk")
	title = re.search(r"<title>(.*?)</title>", html, re.S)
	# The boot payload has `app_logo_url` at the top level and one per app inside `apps_data`: collect them all.
	logo_all = re.findall(r'"app_logo_url":\s*"([^"]*)"', html)
	navbar = re.search(r'"navbar_settings":\s*\{.*?"app_logo":\s*(null|"[^"]*")', html, re.S)
	return (
		title.group(1).strip() if title else "?",
		",".join(sorted(set(logo_all))),
		navbar.group(1) if navbar else "?",
	)


def login_page(op: urllib.request.OpenerDirector) -> tuple[bool, str]:
	html = get(urllib.request.build_opener(), "/login")
	logo = re.search(r'<img[^>]+class="[^"]*app-logo[^"]*"[^>]+src="([^"]*)"', html) or re.search(
		r'src="([^"]*)"[^>]+class="[^"]*app-logo', html
	)
	return NAME in html, logo.group(1) if logo else "?"


def login_page_reader(op):
	return lambda: login_page(op)


def settle(read, wanted, seconds: float = float(os.environ.get("INS_SETTLE_SECONDS", "10"))):
	"""Read until `wanted(value)` holds, for at most `seconds`. Returns (value, seconds waited).

	Another process learns of a changed cache key through Redis' invalidation message, which core documents as
	not instant (`frappe/utils/redis_wrapper.py`, `ClientCache`: "Do not expect sub-second invalidation guarantees
	across processes"); the old whole-site clear had the same property. The wait is printed, never hidden.
	"""
	started = time.monotonic()
	while True:
		value = read()
		waited = time.monotonic() - started
		if wanted(value) or waited >= seconds:
			return value, waited
		time.sleep(0.25)


def main() -> int:
	from institutional_theme.institutional_theme.doctype.institutional_theme_settings import identity_sync

	frappe.init(SITE)
	frappe.connect()
	frappe.set_user("Administrator")
	if os.environ.get("INS_ROUND5_CLEAR") == "1":
		# Control: the clear of round 5, to compare what the other process sees with the targeted clears.
		def round5_clear() -> None:
			frappe.clear_cache(user="Guest")
			frappe.website.utils.clear_cache()
			frappe.clear_cache()

		identity_sync._clear_website_caches = round5_clear
		print("CONTROL: identity_sync._clear_website_caches is the round-5 code")
	identity_sync.restore()
	frappe.db.commit()
	file = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": "ins-live-check.png",
			"content": PNG,
			"is_private": 0,
			"attached_to_doctype": DOCTYPE,
			"attached_to_name": DOCTYPE,
		}
	).insert(ignore_permissions=True)
	frappe.db.commit()
	logo = file.file_url
	ok = True
	try:
		op = opener()
		before = desk(op)
		print("before  desk title / app_logo_url / navbar app_logo:", before)
		print("before  desk again (served from the cached boot payload):", desk(op))
		print("before  login page shows the new name:", login_page(op)[0])

		doc = frappe.get_doc(DOCTYPE)
		doc.system_name = NAME
		doc.emblem = logo
		doc.save()
		frappe.db.commit()
		print("saved   system_name and emblem through the settings document, committed")

		after, waited_after = settle(
			lambda: desk(op), lambda v: v[0] == NAME and logo in v[1] and logo in v[2]
		)
		print(f"after   desk fresh after {waited_after:.2f} s")
		print("after   desk title / app_logo_url / navbar app_logo:", after)
		(shown, login_logo), waited_login = settle(login_page_reader(op), lambda v: v[0] and v[1] == logo)
		print(f"after   login fresh after {waited_login:.2f} s")
		print("after   login page shows the new name:", shown, "| login logo:", login_logo)
		ok &= after[0] == NAME and logo in after[1] and logo in after[2] and shown and login_logo == logo

		doc = frappe.get_doc(DOCTYPE)
		doc.system_name = ""
		doc.emblem = ""
		doc.save()
		frappe.db.commit()
		print("cleared system_name and emblem through the settings document, committed")
		restored, waited_restore = settle(lambda: desk(op), lambda v: v == before)
		print(f"cleared desk fresh after {waited_restore:.2f} s")
		(shown_after_restore, _), _waited = settle(login_page_reader(op), lambda v: not v[0])
		print("cleared desk title / app_logo_url / navbar app_logo:", restored)
		print("cleared login page still shows the new name:", shown_after_restore)
		ok &= restored == before and not shown_after_restore
	finally:
		identity_sync.restore()
		identity_sync.delete_attachments()
		frappe.db.delete("Singles", {"doctype": DOCTYPE})
		frappe.clear_document_cache(DOCTYPE, DOCTYPE)
		if frappe.db.exists("File", file.name):
			frappe.delete_doc("File", file.name, force=True, ignore_permissions=True)
		frappe.db.commit()
		frappe.destroy()
	print(json.dumps({"result": "PASS" if ok else "FAIL"}))
	return 0 if ok else 1


sys.exit(main())
