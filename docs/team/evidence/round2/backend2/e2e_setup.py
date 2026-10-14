"""Create temporary fictional records, run ship, render the Quotation with the SHIPPED Print Style and Letter Head.
Usage (bench python, sites folder): e2e_setup.py OUTDIR"""
import json
import sys

import frappe

frappe.init(site="midad.test", sites_path=".")
frappe.connect()
frappe.set_user("Administrator")
from frappe.translate import print_language
from frappe.utils import add_days, nowdate

from institutional_theme.print import ship

out = sys.argv[1]
print("SHIP", ship.ship())
print("STYLE_HAS_FAMILY", ".print-format {" in frappe.db.get_value("Print Style", "Midad", "css"))
print("LH", frappe.db.get_value("Letter Head", "Midad", ["name", "is_default", "source"]))
company = frappe.db.get_value("Company", {}, "name")
CUST = "Backend2 Temp Customer"
if not frappe.db.exists("Customer", CUST):
	frappe.get_doc({"doctype": "Customer", "customer_name": CUST, "customer_type": "Company",
		"customer_group": frappe.db.get_value("Customer Group", {"is_group": 0}),
		"territory": frappe.db.get_value("Territory", {"is_group": 0})}).insert()
items = [("B2-TMP-1", "Application server 2U", "خادم تطبيقات 2U", 38500, 4),
	("B2-TMP-2", "Network storage unit", "وحدة تخزين شبكي", 27250, 2)]
for code, en, ar, r, q in items:
	if not frappe.db.exists("Item", code):
		frappe.get_doc({"doctype": "Item", "item_code": code, "item_name": en,
			"item_group": frappe.db.get_value("Item Group", {"is_group": 0}), "stock_uom": "Nos", "is_stock_item": 0}).insert()
quo = frappe.get_doc({"doctype": "Quotation", "quotation_to": "Customer", "party_name": CUST, "company": company,
	"transaction_date": nowdate(), "valid_till": add_days(nowdate(), 30),
	"items": [{"item_code": c, "qty": n, "rate": r, "item_name": ar} for c, en, ar, r, n in items]}).insert()
frappe.db.commit()
print("QUOTATION", quo.name)
for gen in ("wkhtmltopdf", "chrome"):
	for lang in ("en", "ar"):
		frappe.local.form_dict.pop("pdf_generator", None)  # core keeps the first value in form_dict
		with print_language(lang):
			opts = {"page-size": "A4"} if gen == "wkhtmltopdf" else {}
			pdf = frappe.get_print("Quotation", quo.name, style="Midad", letterhead="Midad", as_pdf=True,
				pdf_options=opts, pdf_generator=gen)
		path = f"{out}/{gen}-A4-{lang}.pdf"
		open(path, "wb").write(pdf)
		print("OK", path, len(pdf))
# cleanup
frappe.delete_doc("Quotation", quo.name, force=1)
for code, *_ in items:
	frappe.delete_doc("Item", code, force=1)
frappe.delete_doc("Customer", CUST, force=1)
frappe.db.commit()
print("LEFT", frappe.db.count("Quotation", {"party_name": CUST}), frappe.db.exists("Customer", CUST),
	frappe.db.count("Item", {"item_code": ["like", "B2-TMP-%"]}))
print("PRINT_STYLE_RECORD", frappe.db.exists("Print Style", "Midad"), frappe.db.exists("Letter Head", "Midad"))
frappe.destroy()
