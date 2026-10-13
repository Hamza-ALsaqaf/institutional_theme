"""End to end: print a record with the shipped Print Style and Letter Head, as HTML and as PDF (wkhtmltopdf).
Run from the bench sites folder with the bench python as the bench user."""

import json

import frappe

frappe.init(site="midad.test", sites_path=".")
frappe.connect()
frappe.set_user("Administrator")
out = {}
for lang in ("en", "ar"):
	frappe.local.lang = lang
	html = frappe.get_print("User", "be-r2-en@midad.test", style="Midad", letterhead="Midad")
	out[lang] = {
		"has_font_face": "@font-face" in html,
		"has_print_family": "Midad Print Plex Sans" in html,
		"letterhead_table": 'class="ins-lh"' in html,
		"footer_table": 'class="ins-lf"' in html or "ins-lf" in html,
		"print_rules": ".print-format" in html,
		"html_bytes": len(html),
	}
	pdf = frappe.get_print("User", "be-r2-en@midad.test", style="Midad", letterhead="Midad", as_pdf=True)
	path = f"/tmp/ins_r2_print_{lang}.pdf"
	with open(path, "wb") as handle:
		handle.write(pdf)
	out[lang]["pdf"] = path
	out[lang]["pdf_bytes"] = len(pdf)
print(json.dumps(out, indent=1))
frappe.destroy()
