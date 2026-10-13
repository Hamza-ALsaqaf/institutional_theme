"""Fix 1 proof: a kept Midad Letter Head still prints after uninstall.
Usage (bench python, from the sites folder): uninstall_proof.py MODE OUTDIR
  setup    ship, create fictional Customer/Items/Quotation linked to the Letter Head, edit the Letter Head as an administrator
  render   render the Quotation with the kept Letter Head to HTML and PDF (wkhtmltopdf), en and ar
  cleanup  delete the temporary records and ship again
"""
import json
import sys

import frappe

frappe.init(site="midad.test", sites_path=".")
frappe.connect()
frappe.set_user("Administrator")
from frappe.translate import print_language
from frappe.utils import add_days, nowdate

mode, out = sys.argv[1:3]
CUST = "Fix1 Temp Customer"
ITEMS = [("F1-TMP-1", "Application server 2U", 38500, 4), ("F1-TMP-2", "Network storage unit", 27250, 2)]
QFILE = "/tmp/fix1-quotation-name.txt"


def show_state(label):
	print(
		label,
		json.dumps(
			{
				"letter_head": bool(frappe.db.exists("Letter Head", "Midad")),
				"print_style": bool(frappe.db.exists("Print Style", "Midad")),
				"ins_identity_registered": "institutional_theme.identity.ins_identity"
				in (frappe.get_hooks("jinja") or {}).get("methods", []),
				"installed_apps": frappe.get_installed_apps(),
			}
		),
	)


if mode == "setup":
	from institutional_theme.print import ship

	print("SHIP", ship.ship())
	show_state("STATE_BEFORE")
	company = frappe.db.get_value("Company", {}, "name")
	if not frappe.db.exists("Customer", CUST):
		frappe.get_doc({"doctype": "Customer", "customer_name": CUST, "customer_type": "Company",
			"customer_group": frappe.db.get_value("Customer Group", {"is_group": 0}),
			"territory": frappe.db.get_value("Territory", {"is_group": 0})}).insert()
	for code, name, _rate, _qty in ITEMS:
		if not frappe.db.exists("Item", code):
			frappe.get_doc({"doctype": "Item", "item_code": code, "item_name": name,
				"item_group": frappe.db.get_value("Item Group", {"is_group": 0}), "stock_uom": "Nos",
				"is_stock_item": 0}).insert()
	quo = frappe.get_doc({"doctype": "Quotation", "quotation_to": "Customer", "party_name": CUST,
		"company": company, "transaction_date": nowdate(), "valid_till": add_days(nowdate(), 30),
		"letter_head": "Midad",
		"items": [{"item_code": c, "qty": q, "rate": r} for c, _n, r, q in ITEMS]}).insert()
	open(QFILE, "w").write(quo.name)
	# An administrator edits the Letter Head in the desk: a normal save, so core sanitises the content.
	doc = frappe.get_doc("Letter Head", "Midad")
	shipped = doc.content
	doc.content = shipped + '\n<p class="fix1-admin-note">Edited by an administrator</p>'
	doc.save()
	frappe.db.commit()
	after = frappe.db.get_value("Letter Head", "Midad", "content")
	print("ADMIN_EDIT_KEPT_JINJA_GUARD", "ins_identity is defined" in after, "| shipped chars", len(shipped), "| after save chars", len(after))
	open(out + "/letter_head_after_admin_save.html", "w").write(after)
	print("QUOTATION", quo.name, "letter_head", quo.letter_head)

elif mode == "render":
	show_state("STATE_AFTER_UNINSTALL")
	name = open(QFILE).read().strip()
	print("QUOTATION", name, "letter_head", frappe.db.get_value("Quotation", name, "letter_head"))
	for lang in ("en", "ar"):
		frappe.local.form_dict.pop("pdf_generator", None)
		with print_language(lang):
			html = frappe.get_print("Quotation", name, letterhead="Midad", as_pdf=False)
		bad = [m for m in ("Context Error", "UndefinedError", "ins_identity") if m in html]
		open(f"{out}/kept-letterhead-{lang}.html", "w").write(html)
		print("HTML", lang, len(html), "problem markers:", bad or "none", "| admin note present:", "fix1-admin-note" in html)
		frappe.local.form_dict.pop("pdf_generator", None)
		with print_language(lang):
			pdf = frappe.get_print("Quotation", name, letterhead="Midad", as_pdf=True,
				pdf_options={"page-size": "A4"}, pdf_generator="wkhtmltopdf")
		open(f"{out}/kept-letterhead-{lang}.pdf", "wb").write(pdf)
		print("PDF", lang, len(pdf), pdf[:5])

elif mode == "cleanup":
	name = open(QFILE).read().strip()
	frappe.delete_doc("Quotation", name, force=1)
	for code, *_ in ITEMS:
		frappe.delete_doc("Item", code, force=1)
	frappe.delete_doc("Customer", CUST, force=1)
	if frappe.db.exists("Letter Head", "Midad"):
		frappe.delete_doc("Letter Head", "Midad", force=1)
	frappe.db.commit()
	from institutional_theme.print import ship

	print("SHIP_AGAIN", ship.ship())
	frappe.db.commit()
	print("LEFT", frappe.db.count("Quotation", {"party_name": CUST}), frappe.db.exists("Customer", CUST),
		frappe.db.count("Item", {"item_code": ["like", "F1-TMP-%"]}))
	show_state("STATE_END")
frappe.destroy()
