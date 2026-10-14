"""Render one fictional Quotation in a print format, wkhtmltopdf and Chrome, A4 and Letter, en and ar.
python render.py SITE OUTDIR VARIANT [FORMAT]   VARIANT: themed | core | noapp
themed: Print Style Midad + Letter Head Midad. core: Print Style Standard, no letter head (theme installed).
noapp: like core, and the app is removed from this process (get_installed_apps patched before any hook is read); the site is not changed."""
import json, sys
import frappe
site, out, variant = sys.argv[1:4]
fmt_arg = sys.argv[4] if len(sys.argv) > 4 else None
frappe.init(site=site, sites_path=".")
frappe.connect()
if variant == "noapp":
	orig = frappe.get_installed_apps
	frappe.get_installed_apps = lambda *a, **k: [x for x in orig(*a, **k) if x != "institutional_theme"]
	frappe.local.hooks = None
	frappe.clear_cache()
	assert "institutional_theme" not in frappe.get_installed_apps()
	assert not any("ins_identity" in str(m) for m in frappe.get_hooks("jinja").get("methods", []))
frappe.set_user("Administrator")
from frappe.translate import print_language
from frappe.utils import add_days, nowdate
print("FRAPPE", frappe.__version__, "VARIANT", variant)
company = frappe.db.get_value("Company", {}, "name")
CUST = "Clip5 Temp Customer"
items = [("C5-TMP-1", "Application server 2U", "خادم تطبيقات 2U", 38500, 4), ("C5-TMP-2", "Network storage unit", "وحدة تخزين شبكي", 27250, 2)]
if not frappe.db.exists("Customer", CUST):
	frappe.get_doc({"doctype": "Customer", "customer_name": CUST, "customer_type": "Company",
		"customer_group": frappe.db.get_value("Customer Group", {"is_group": 0}),
		"territory": frappe.db.get_value("Territory", {"is_group": 0})}).insert()
for code, en, *_ in items:
	if not frappe.db.exists("Item", code):
		frappe.get_doc({"doctype": "Item", "item_code": code, "item_name": en, "item_group": frappe.db.get_value("Item Group", {"is_group": 0}), "stock_uom": "Nos", "is_stock_item": 0}).insert()
quo = frappe.get_doc({"doctype": "Quotation", "quotation_to": "Customer", "party_name": CUST, "company": company,
	"transaction_date": nowdate(), "valid_till": add_days(nowdate(), 30),
	"items": [{"item_code": c, "qty": n, "rate": r, "item_name": ar} for c, _e, ar, r, n in items]}).insert()
frappe.db.commit()
res = {}
try:
	if fmt_arg == "IMPLICIT":
		fmt = None  # as the round-4 script: no print_format argument, core resolves the doctype default itself
	else:
		fmt = fmt_arg or frappe.get_meta("Quotation").default_print_format or "Standard"
	print("QUOTATION", quo.name, "FORMAT", fmt, "DEFAULT", frappe.get_meta("Quotation").default_print_format)
	for gen in ("wkhtmltopdf", "chrome"):
		for paper in ("A4", "Letter"):
			for lang in ("en", "ar"):
				frappe.local.form_dict.pop("pdf_generator", None)
				key = f"{gen}-{paper}-{lang}"
				try:
					args = {"style": "Midad", "letterhead": "Midad"} if variant == "themed" else {"style": "Standard", "no_letterhead": 1}
					with print_language(lang):
						opts = {"page-size": paper} if gen == "wkhtmltopdf" else {}
						if gen == "chrome":
							opts = {"page-size": paper}
						pdf = frappe.get_print("Quotation", quo.name, print_format=fmt, as_pdf=True, pdf_options=opts, pdf_generator=gen, **args)
					open(f"{out}/{variant}-{key}.pdf", "wb").write(pdf)
					res[key] = len(pdf); print("OK", key, len(pdf))
				except Exception as e:
					res[key] = repr(e)[:300]; print("FAIL", key, repr(e)[:300])
finally:
	frappe.delete_doc("Quotation", quo.name, force=1)
	for code, *_ in items:
		frappe.delete_doc("Item", code, force=1)
	frappe.delete_doc("Customer", CUST, force=1)
	frappe.db.commit()
	print("LEFT", frappe.db.exists("Customer", CUST), frappe.db.count("Item", {"item_code": ["like", "C5-TMP-%"]}))
	frappe.destroy()
