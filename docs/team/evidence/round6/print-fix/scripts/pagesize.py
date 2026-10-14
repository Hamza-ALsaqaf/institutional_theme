"""wkhtmltopdf Draft Leave Application on small pages: sets Print Settings pdf_page_size, renders, restores it.
    python -I pagesize.py SITE OUTDIR   (A5 landscape, A6 portrait, A4, Letter)"""
import sys

import frappe

frappe.init(site=sys.argv[1], sites_path=".")
frappe.connect()
frappe.set_user("Administrator")
orig = frappe.db.get_single_value("Print Settings", "pdf_page_size")
try:
	for size, orient in (("A5", "Landscape"), ("A6", "Portrait"), ("A4", "Portrait"), ("Letter", "Portrait")):
		frappe.db.set_single_value("Print Settings", "pdf_page_size", size)
		frappe.db.commit()
		frappe.clear_cache()
		pdf = frappe.get_print("Leave Application", "HR-LAP-2026-00001", print_format="Standard", as_pdf=True,
			pdf_generator="wkhtmltopdf", pdf_options={"orientation": orient}, style="Midad", letterhead="Midad")
		open(f"{sys.argv[2]}/wk_{size}_{orient.lower()}.pdf", "wb").write(pdf)
		print("OK", size, orient, len(pdf), flush=True)
finally:
	frappe.db.set_single_value("Print Settings", "pdf_page_size", orig)
	frappe.db.commit()
	frappe.clear_cache()
	print("restored", frappe.db.get_single_value("Print Settings", "pdf_page_size"), "was", orig)
