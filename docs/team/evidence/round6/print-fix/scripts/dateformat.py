"""Arabic Salary Slip Classic (Chrome) under each site date format; System Settings date_format is restored afterwards.
    python -I dateformat.py SITE OUTDIR"""
import sys

import frappe

frappe.init(site=sys.argv[1], sites_path=".")
frappe.connect()
frappe.set_user("Administrator")
from frappe.translate import print_language



def setfmt(fmt):
	# saved as a document: System Settings.on_update copies date_format into the defaults that the printer reads
	doc = frappe.get_doc("System Settings")
	doc.date_format = fmt
	doc.save()
	frappe.db.commit()


print("Language ar date_format:", frappe.db.get_value("Language", "ar", "date_format"))
orig = frappe.db.get_single_value("System Settings", "date_format")
try:
	for fmt in ("dd/mm/yyyy", "dd-mm-yyyy"):
		setfmt(fmt)
		frappe.clear_cache()
		# per-process caches of the format
		for attr in ("user_date_format", "system_settings", "locale"):
			if hasattr(frappe.local, attr):
				setattr(frappe.local, attr, None)
		with print_language("ar"):
			pdf = frappe.get_print("Salary Slip", "Sal Slip/HR-EMP-00003/00001", print_format="Salary Slip Classic", as_pdf=True,
				pdf_generator="chrome", pdf_options={"page-size": "A4"}, style="Midad", letterhead="Midad")
		open(f"{sys.argv[2]}/classic-ar_{fmt.replace('/', 'S').replace('-', 'D')}.pdf", "wb").write(pdf)
		print("OK", fmt, len(pdf), flush=True)
finally:
	setfmt(orig)
	frappe.clear_cache()
	print("restored", frappe.db.get_single_value("System Settings", "date_format"), frappe.db.get_default("date_format"), "was", orig)
