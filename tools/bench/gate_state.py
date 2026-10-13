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
WEBSITE = ("app_name", "app_logo", "splash_image", "favicon")
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16


def website_values() -> dict:
	values = {f"Website Settings.{f}": frappe.db.get_single_value("Website Settings", f) for f in WEBSITE}
	values["Navbar Settings.app_logo"] = frappe.db.get_single_value("Navbar Settings", "app_logo")
	return values


def seed(state_path: str) -> None:
	state = {"original": website_values()}
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
	print(json.dumps({"seeded": state["written"]}, indent=1))


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
