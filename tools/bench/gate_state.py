"""State seeding and residue check for the install/uninstall gate.

	python gate_state.py seed    SITE STATE.json   after install: create state the app must clean up
	python gate_state.py residue SITE STATE.json   after uninstall: list anything left behind

Run with the bench interpreter from the `sites` folder. Exit code 1 when `residue` finds anything.
"""

import json
import os
import sys

import frappe

DOCTYPE = "Institutional Theme Settings"
PRINT_STYLE = "Print Style"
LETTER_HEAD = "Letter Head"
PRINT_NAME = "Midad"
WEBSITE = ("app_name", "app_logo", "splash_image", "favicon")
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16


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
	state = {"original": website_values(), "print_at_seed": print_state()}
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


def main() -> int:
	mode, site, state_path = sys.argv[1:4]
	frappe.init(site)
	frappe.connect()
	frappe.set_user("Administrator")
	try:
		if mode == "seed":
			seed(state_path)
			return 0
		return residue(state_path)
	finally:
		frappe.destroy()


if __name__ == "__main__":
	sys.exit(main())
