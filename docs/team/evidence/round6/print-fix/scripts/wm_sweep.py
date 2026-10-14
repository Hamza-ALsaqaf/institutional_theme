"""Chrome watermark sweep: render Leave Application and Expense Claim (Draft), en and ar, A4, Midad style and letter head,
with the Draft frame's `top` forced to each value in turn, then restore the Print Style. Test bench only.
    python -I wm_sweep.py SITE OUTDIR 10mm,12mm,...
The forced rule is measurement scaffolding (it carries !important to beat the shipped rule); it is never saved in the app.
"""
import sys

import frappe

site, out, tops = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
frappe.init(site=site, sites_path=".")
frappe.connect()
frappe.set_user("Administrator")
from frappe.translate import print_language

docs = (("Leave Application", "HR-LAP-2026-00001", "leave"), ("Expense Claim", "HR-EXP-2026-00001", "expense"))
base = frappe.db.get_value("Print Style", "Midad", "css")
try:
	for t in tops:
		css = base + '\n.print-format [document-status="draft"], body.print-format-doc [document-status="draft"]{top:%s !important}\n' % t
		frappe.db.set_value("Print Style", "Midad", "css", css)
		frappe.db.commit()
		frappe.clear_cache()
		for dt, name, slug in docs:
			for lang in ("en", "ar"):
				with print_language(lang):
					pdf = frappe.get_print(dt, name, print_format="Standard", as_pdf=True, pdf_generator="chrome",
						pdf_options={"page-size": "A4"}, style="Midad", letterhead="Midad")
				open(f"{out}/wm_{slug}_{lang}_{t}.pdf", "wb").write(pdf)
				print("OK", slug, lang, t, flush=True)
finally:
	frappe.db.set_value("Print Style", "Midad", "css", base)
	frappe.db.commit()
	frappe.clear_cache()
	print("restored", frappe.db.get_value("Print Style", "Midad", "css") == base)
