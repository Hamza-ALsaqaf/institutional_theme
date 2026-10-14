"""State seeding and residue check for the install/uninstall gate.

	python gate_state.py seed    SITE STATE.json   after install: create state the app must clean up
	python gate_state.py residue SITE STATE.json   after uninstall: list anything left behind
	python gate_state.py kept-seed   SITE STATE.json  after a second install: an administrator edits the Letter Head
	                                                  and a document links to it, so uninstall must keep it
	python gate_state.py kept-render SITE STATE.json  after that uninstall: the kept Letter Head must still print
	python gate_state.py kept-cleanup SITE STATE.json after the final install: remove the temporary records

Run with the bench interpreter from the `sites` folder. Exit code 1 when `residue` finds anything.
"""

import glob
import json
import os
import sys

import frappe

DOCTYPE = "Institutional Theme Settings"
PRINT_STYLE = "Print Style"
LETTER_HEAD = "Letter Head"
PRINT_NAME = "Midad"
WEBSITE = ("app_name", "app_logo", "splash_image", "favicon")
KEPT_STATE = ""
# 0x81 is undefined in every text encoding `File.get_content` tries, so core copies these bytes unchanged,
# as it does a real image (a text-decodable file would be re-encoded into a different one).
PNG = b"\x89PNG\r\n\x1a\n\x81\x90" + b"\x00" * 16
CORE_SETTINGS = ("Navbar Settings", "Website Settings")
CORE_FIELDS = ("app_logo", "splash_image", "favicon")


def core_setting_files() -> list[str]:
	"""Names of the File rows attached to the logo fields of Navbar Settings and Website Settings."""
	return frappe.get_all(
		"File",
		filters={"attached_to_doctype": ("in", CORE_SETTINGS), "attached_to_field": ("in", CORE_FIELDS)},
		pluck="name",
	)


def website_values() -> dict:
	values = {f"Website Settings.{f}": frappe.db.get_single_value("Website Settings", f) for f in WEBSITE}
	values["Navbar Settings.app_logo"] = frappe.db.get_single_value("Navbar Settings", "app_logo")
	return values


def print_state() -> dict:
	"""The shipped print records and their bookkeeping globals (print/ship.py)."""
	return {
		"print_style": bool(frappe.db.exists(PRINT_STYLE, PRINT_NAME)),
		"letter_head": bool(frappe.db.exists(LETTER_HEAD, PRINT_NAME)),
		"globals": frappe.db.count("DefaultValue", {"defkey": ("like", "ins_print_%")}),
	}


def seed(state_path: str) -> None:
	state = {
		"original": website_values(),
		"print_at_seed": print_state(),
		"core_files_before": core_setting_files(),
	}
	# An administrator's own upload of the same image, attached to a logo field before the theme is
	# configured: it has the emblem's content hash and file_url, and must survive uninstall. With the
	# default target core finds it and makes no Navbar copy; with GATE_ADMIN_TARGET="Website Settings.favicon"
	# the sync makes a Navbar copy, which must go while this row stays.
	admin_doctype, _sep, admin_field = os.environ.get(
		"GATE_ADMIN_TARGET", "Navbar Settings.app_logo"
	).partition(".")
	admin = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": "gate-admin-emblem.png",
			"content": PNG,
			"is_private": 0,
			"attached_to_doctype": admin_doctype,
			"attached_to_name": admin_doctype,
			"attached_to_field": admin_field,
		}
	).insert(ignore_permissions=True)
	state["admin_file"] = admin.name
	file = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": "gate-emblem.png",
			"content": PNG,
			"is_private": 0,
			"attached_to_doctype": DOCTYPE,
			"attached_to_name": DOCTYPE,
		}
	).insert(ignore_permissions=True)
	doc = frappe.get_doc(DOCTYPE)
	doc.system_name = "Gate Test Authority"
	doc.emblem = file.file_url
	doc.default_density = "Compact"
	doc.save()
	# An administrator saving Website Settings while it holds the emblem makes core attach copies of it.
	frappe.get_doc("Website Settings").save()
	state["core_files_after_save"] = core_setting_files()
	frappe.defaults.set_user_default("ins_palette", "graphite", "Administrator")
	frappe.defaults.set_user_default("ins_density", "Compact", "Administrator")
	folder = frappe.get_site_path("public", "files", "institutional_theme")
	os.makedirs(folder, exist_ok=True)
	with open(os.path.join(folder, "ins_palette_custom.gate.css"), "w", encoding="utf-8") as handle:
		handle.write("/* gate */\n")
	frappe.db.commit()
	state["written"] = website_values()
	state["file"] = file.name
	with open(state_path, "w", encoding="utf-8") as handle:
		json.dump(state, handle, indent=1)
	print(
		json.dumps(
			{"seeded": state["written"], "print_records_after_install": state["print_at_seed"]}, indent=1
		)
	)
	if not (state["print_at_seed"]["print_style"] and state["print_at_seed"]["letter_head"]):
		print(
			"WARNING: the Midad Print Style or Letter Head was not shipped by install; the print check proves nothing"
		)


def residue(state_path: str) -> int:
	with open(state_path, encoding="utf-8") as handle:
		state = json.load(handle)
	left = {}
	if frappe.db.exists("DocType", DOCTYPE):
		left["doctype"] = "still exists"
	if frappe.db.count("Singles", {"doctype": DOCTYPE}):
		left["singles rows"] = frappe.db.count("Singles", {"doctype": DOCTYPE})
	if frappe.db.exists("File", state["file"]):
		left["file row"] = state["file"]
	if frappe.db.count("File", {"attached_to_doctype": DOCTYPE}):
		left["file rows attached"] = frappe.db.count("File", {"attached_to_doctype": DOCTYPE})
	strays = [
		name
		for name in core_setting_files()
		if name not in state.get("core_files_before", []) and name != state.get("admin_file")
	]
	if strays:
		left["file rows attached to Navbar/Website Settings"] = strays
	stray_disk = sorted(glob.glob(frappe.get_site_path("public", "files", "gate-emblem*")))
	if stray_disk:
		left["files on disk"] = [os.path.basename(path) for path in stray_disk]
	admin_file = state.get("admin_file")
	if admin_file and not frappe.db.exists("File", admin_file):
		left["administrator's file with the emblem's bytes"] = "was deleted"
	elif admin_file:
		admin_url = frappe.db.get_value("File", admin_file, "file_url")
		if not os.path.exists(frappe.get_site_path("public", admin_url.lstrip("/"))):
			left["administrator's file on disk"] = "was deleted"
		# The gate's own test file: remove it, so the site ends as it began.
		frappe.delete_doc("File", admin_file, force=True, ignore_permissions=True)
		frappe.db.commit()
	for key in ("ins_palette", "ins_density"):
		if frappe.db.count("DefaultValue", {"defkey": key}):
			left[f"default {key}"] = frappe.db.count("DefaultValue", {"defkey": key})
	if frappe.db.count("DefaultValue", {"defkey": ("like", "ins_identity_%")}):
		left["globals ins_identity_*"] = frappe.db.count(
			"DefaultValue", {"defkey": ("like", "ins_identity_%")}
		)
	# Print records: installed untouched, so uninstall must remove both and clear the bookkeeping globals.
	if frappe.db.exists(PRINT_STYLE, PRINT_NAME):
		left["print style Midad"] = "still exists"
	if frappe.db.exists(LETTER_HEAD, PRINT_NAME):
		left["letter head Midad"] = "still exists"
	if frappe.db.count("DefaultValue", {"defkey": ("like", "ins_print_%")}):
		left["globals ins_print_*"] = frappe.db.count("DefaultValue", {"defkey": ("like", "ins_print_%")})
	if frappe.db.get_single_value("Print Settings", "print_style") == PRINT_NAME:
		left["Print Settings.print_style"] = PRINT_NAME
	print(
		json.dumps(
			{"print_after_uninstall": print_state(), "print_at_seed": state.get("print_at_seed")}, indent=1
		)
	)
	if frappe.db.count("Version", {"ref_doctype": DOCTYPE}):
		left["version rows"] = frappe.db.count("Version", {"ref_doctype": DOCTYPE})
	if os.path.exists(frappe.get_site_path("public", "files", "institutional_theme")):
		left["site files folder"] = "still exists"
	now = website_values()
	for key, original in state["original"].items():
		if now[key] != original:
			left[key] = f"{now[key]!r} instead of {original!r}"
	print(json.dumps({"after_uninstall": now}, indent=1))
	print("RESIDUE: " + (json.dumps(left, indent=1) if left else "none"))
	return 1 if left else 0


KEPT_NOTE = "Gate kept letter head note"


def kept_seed(state_path: str) -> None:
	"""An administrator edits the shipped Letter Head and a document uses it: uninstall keeps the record."""
	doc = frappe.get_doc(LETTER_HEAD, PRINT_NAME)
	doc.content = (doc.content or "") + '\n<p class="gate-admin-note">Edited by an administrator</p>'
	doc.save(ignore_permissions=True)
	note = frappe.get_doc(
		{"doctype": "Note", "title": KEPT_NOTE, "public": 1, "content": "<p>Gate</p>"}
	).insert(ignore_permissions=True)
	frappe.db.commit()
	with open(state_path + ".kept", "w", encoding="utf-8") as handle:
		json.dump({"note": note.name}, handle)
	print(json.dumps({"letter_head_edited": True, "note": note.name}))


def kept_render() -> int:
	"""Print a document with the kept Letter Head after uninstall: HTML always, PDF when wkhtmltopdf exists."""
	import shutil

	from frappe.translate import print_language

	left = {}
	with open(KEPT_STATE, encoding="utf-8") as handle:
		name = json.load(handle)["note"]
	if not frappe.db.exists(LETTER_HEAD, PRINT_NAME):
		left["kept letter head"] = "missing: uninstall did not keep the edited record"
	for lang in ("en", "ar"):
		try:
			with print_language(lang):
				html = frappe.get_print("Note", name, letterhead=PRINT_NAME, as_pdf=False)
			bad = [m for m in ("Context Error", "UndefinedError", "ins_identity") if m in html]
			if bad or "gate-admin-note" not in html:
				left[f"html {lang}"] = f"markers {bad}, admin note present: {'gate-admin-note' in html}"
			if shutil.which("wkhtmltopdf"):
				frappe.local.form_dict.pop("pdf_generator", None)
				with print_language(lang):
					pdf = frappe.get_print(
						"Note", name, letterhead=PRINT_NAME, as_pdf=True, pdf_generator="wkhtmltopdf"
					)
				if not pdf.startswith(b"%PDF"):
					left[f"pdf {lang}"] = "not a PDF"
				print(f"printed {lang}: html {len(html)} bytes, pdf {len(pdf)} bytes")
			else:
				print(f"printed {lang}: html {len(html)} bytes, wkhtmltopdf not installed: pdf NOT VERIFIED")
		except Exception as error:
			left[f"print {lang}"] = f"{type(error).__name__}: {error}"
	print("KEPT PRINT: " + (json.dumps(left, indent=1) if left else "ok"))
	return 1 if left else 0


def kept_cleanup() -> None:
	with open(KEPT_STATE, encoding="utf-8") as handle:
		name = json.load(handle)["note"]
	frappe.delete_doc("Note", name, force=True, ignore_permissions=True)
	if frappe.db.exists(LETTER_HEAD, PRINT_NAME):
		frappe.delete_doc(LETTER_HEAD, PRINT_NAME, force=True, ignore_permissions=True)
	frappe.db.commit()
	from institutional_theme.print import ship

	print("ship again:", ship.ship())
	frappe.db.commit()


def main() -> int:
	global KEPT_STATE
	mode, site, state_path = sys.argv[1:4]
	frappe.init(site)
	frappe.connect()
	frappe.set_user("Administrator")
	try:
		KEPT_STATE = state_path + ".kept"
		if mode == "seed":
			seed(state_path)
			return 0
		if mode == "kept-seed":
			kept_seed(state_path)
			return 0
		if mode == "kept-render":
			return kept_render()
		if mode == "kept-cleanup":
			kept_cleanup()
			return 0
		return residue(state_path)
	finally:
		frappe.destroy()


if __name__ == "__main__":
	sys.exit(main())
