"""Render the shipped Letter Head the way printview.py does (render_template with doc). Run via bench execute."""

import frappe
from frappe.utils.jinja import render_template


def run():
	out = {}
	for lang in ("en", "ar"):
		frappe.local.lang = lang
		row = frappe.db.get_value("Letter Head", "Midad", ["content", "footer"], as_dict=True)
		out[lang] = {
			"header": render_template(row.content, {"doc": {}}),
			"footer": render_template(row.footer, {"doc": {}}),
		}
	print(frappe.as_json(out, indent=1))
