"""Count the cache clears of one identity save, before (round 5) and after (round 6) the targeted clears.

    python3 count_clears.py <site>      (run from the bench's sites folder, as the bench user)

For each variant of `identity_sync._clear_website_caches` the script saves `system_name` through the settings
document, commits, and records every call of `frappe.clear_cache` (whole site, per user, per doctype) and of
`clear_routing_cache`, split into the save (before the commit) and the commit (the after-commit callbacks). It
restores the site afterwards. Nothing else is patched: the spies call through.
"""

from __future__ import annotations

import sys

import frappe
import frappe.website.router
import frappe.website.utils

SITE = sys.argv[1]
DOCTYPE = "Institutional Theme Settings"


def round5_clear() -> None:
	"""The code of round 5, verbatim (`identity_sync.py` at 786badf, `_clear_website_caches`)."""
	frappe.clear_cache(user="Guest")
	frappe.website.utils.clear_cache()
	frappe.clear_cache()


def kind(args: tuple, kwargs: dict) -> str:
	if kwargs.get("user") or (args and args[0]):
		return "user"
	if kwargs.get("doctype"):
		return "doctype"
	return "WHOLE SITE"


def measure(label: str, clear) -> None:
	from institutional_theme.institutional_theme.doctype.institutional_theme_settings import identity_sync

	phase = ["save"]
	calls: list[tuple[str, str]] = []
	real_clear = frappe.clear_cache
	real_routing = frappe.website.router.clear_routing_cache

	def spy_clear(*args, **kwargs):
		calls.append((phase[0], kind(args, kwargs)))
		return real_clear(*args, **kwargs)

	def spy_routing(*args, **kwargs):
		calls.append((phase[0], "routing"))
		return real_routing(*args, **kwargs)

	original = identity_sync._clear_website_caches
	identity_sync._clear_website_caches = clear
	frappe.clear_cache = spy_clear
	frappe.website.router.clear_routing_cache = spy_routing
	try:
		doc = frappe.get_doc(DOCTYPE)
		doc.system_name = f"Count {label}"
		doc.save()
		phase[0] = "commit"
		frappe.db.commit()
	finally:
		frappe.clear_cache = real_clear
		frappe.website.router.clear_routing_cache = real_routing
		identity_sync._clear_website_caches = original
		doc = frappe.get_doc(DOCTYPE)
		doc.system_name = ""
		doc.save()
		frappe.db.commit()
	for when in ("save", "commit"):
		counts = {}
		for ph, what in calls:
			if ph == when:
				counts[what] = counts.get(what, 0) + 1
		print(f"{label:8} {when:7} {counts}")


def main() -> int:
	from institutional_theme.institutional_theme.doctype.institutional_theme_settings import identity_sync

	frappe.init(SITE)
	frappe.connect()
	frappe.set_user("Administrator")
	new = identity_sync._clear_website_caches
	measure("round5", round5_clear)
	measure("round6", new)
	frappe.db.delete("Singles", {"doctype": DOCTYPE})
	frappe.clear_document_cache(DOCTYPE, DOCTYPE)
	frappe.db.commit()
	frappe.destroy()
	return 0


sys.exit(main())
