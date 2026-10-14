"""Core-only render of the default Quotation format (Standard Print Style, no Letter Head) to attribute clipping.
Run via run_print_check.sh with SCRIPT=core_modern.py."""
import sys

import frappe

site, out = sys.argv[1], sys.argv[2]
frappe.init(site=site, sites_path=".")
frappe.connect()
frappe.set_user("Administrator")
from frappe.translate import print_language
from frappe.utils import add_days, nowdate

CUST = "Verify4 Core Customer"
company = frappe.db.get_value("Company", {}, "name")
if not frappe.db.exists("Customer", CUST):
	frappe.get_doc({"doctype": "Customer", "customer_name": CUST, "customer_type": "Company",
		"customer_group": frappe.db.get_value("Customer Group", {"is_group": 0}),
		"territory": frappe.db.get_value("Territory", {"is_group": 0})}).insert()
item = "V4-CORE-1"
if not frappe.db.exists("Item", item):
	frappe.get_doc({"doctype": "Item", "item_code": item, "item_name": "Application server 2U", "item_group": frappe.db.get_value("Item Group", {"is_group": 0}), "stock_uom": "Nos", "is_stock_item": 0}).insert()
quo = frappe.get_doc({"doctype": "Quotation", "quotation_to": "Customer", "party_name": CUST, "company": company,
	"transaction_date": nowdate(), "valid_till": add_days(nowdate(), 30),
	"items": [{"item_code": item, "item_name": "Application server 2U", "qty": 2, "rate": 38500}]}).insert()
frappe.db.commit()
try:
	for gen in ("wkhtmltopdf", "chrome"):
		for lang in ("en", "ar"):
			frappe.local.form_dict.pop("pdf_generator", None)
			with print_language(lang):
				opts = {"page-size": "A4"} if gen == "wkhtmltopdf" else {}
				pdf = frappe.get_print("Quotation", quo.name, as_pdf=True, pdf_options=opts, pdf_generator=gen, style="Standard", no_letterhead=1)
			open(f"{out}/{gen}-core-modern-{lang}.pdf", "wb").write(pdf)
			print("OK", gen, lang)
finally:
	frappe.delete_doc("Quotation", quo.name, force=1)
	frappe.delete_doc("Item", item, force=1)
	frappe.delete_doc("Customer", CUST, force=1)
	frappe.db.commit()
	frappe.destroy()
