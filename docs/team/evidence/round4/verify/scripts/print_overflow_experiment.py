"""Does `white-space: nowrap` on the figures rule make the 11-column Standard Quotation table overflow?

Run under the bench Python from the bench's `sites` folder with the patched wkhtmltopdf on PATH:
    python print_overflow_experiment.py SITE OUTDIR

Creates two temporary Print Styles (the shipped "Midad" CSS plus one override each), renders a temporary fictional
Quotation with each in Chrome (ar) and wkhtmltopdf (en), and deletes everything again. Nothing shipped is changed.
"""

import sys

import frappe

site, out = sys.argv[1], sys.argv[2]
frappe.init(site=site, sites_path=".")
frappe.connect()
frappe.set_user("Administrator")
from frappe.translate import print_language
from frappe.utils import add_days, nowdate

base = frappe.db.get_value("Print Style", "Midad", "css")
variants = {
	"headers-wrap": "\n.print-format th.text-right { white-space: normal; }\n",
	"figures-and-headers-wrap": "\n.print-format td.text-right, .print-format th.text-right, .print-format td.text-right .value { white-space: normal; }\n",
}
for name, extra in variants.items():
	if frappe.db.exists("Print Style", f"V4 {name}"):
		frappe.delete_doc("Print Style", f"V4 {name}", force=1)
	frappe.get_doc(
		{"doctype": "Print Style", "print_style_name": f"V4 {name}", "css": base + extra, "disabled": 0}
	).insert()
company = frappe.db.get_value("Company", {}, "name")
CUST = "Verify4 Overflow Customer"
if not frappe.db.exists("Customer", CUST):
	frappe.get_doc(
		{
			"doctype": "Customer",
			"customer_name": CUST,
			"customer_type": "Company",
			"customer_group": frappe.db.get_value("Customer Group", {"is_group": 0}),
			"territory": frappe.db.get_value("Territory", {"is_group": 0}),
		}
	).insert()
items = [("V4-OVF-1", "Application server 2U", 38500, 4), ("V4-OVF-2", "Network storage unit", 27250, 2)]
for code, label, _rate, _qty in items:
	if not frappe.db.exists("Item", code):
		frappe.get_doc(
			{
				"doctype": "Item",
				"item_code": code,
				"item_name": label,
				"item_group": frappe.db.get_value("Item Group", {"is_group": 0}),
				"stock_uom": "Nos",
				"is_stock_item": 0,
			}
		).insert()
quo = frappe.get_doc(
	{
		"doctype": "Quotation",
		"quotation_to": "Customer",
		"party_name": CUST,
		"company": company,
		"transaction_date": nowdate(),
		"valid_till": add_days(nowdate(), 30),
		"items": [{"item_code": c, "qty": q, "rate": r} for c, _l, r, q in items],
	}
).insert()
frappe.db.commit()
try:
	for name in variants:
		for gen, lang in (("chrome", "ar"), ("wkhtmltopdf", "en")):
			frappe.local.form_dict.pop("pdf_generator", None)
			with print_language(lang):
				pdf = frappe.get_print(
					"Quotation",
					quo.name,
					print_format="Standard",
					style=f"V4 {name}",
					letterhead="Midad",
					as_pdf=True,
					pdf_options={"page-size": "A4"} if gen == "wkhtmltopdf" else {},
					pdf_generator=gen,
				)
			with open(f"{out}/overflow-{name}-{gen}-{lang}.pdf", "wb") as fh:
				fh.write(pdf)
			print("OK", name, gen, lang, len(pdf))
finally:
	frappe.delete_doc("Quotation", quo.name, force=1)
	for code, *_ in items:
		frappe.delete_doc("Item", code, force=1)
	frappe.delete_doc("Customer", CUST, force=1)
	for name in variants:
		frappe.delete_doc("Print Style", f"V4 {name}", force=1)
	frappe.db.commit()
	print(
		"LEFT styles",
		frappe.db.count("Print Style", {"name": ["like", "V4 %"]}),
		"quotations",
		frappe.db.count("Quotation", {"party_name": CUST}),
	)
	frappe.destroy()
