"""Print Style and Letter Head PDFs (wkhtmltopdf 0.12.6.1 patched Qt, and Chrome), A4, en and ar, plus the email bundle render.

Run under the bench Python from the bench's `sites` folder (see run_print_check.sh):
    python print_check.py SITE OUTDIR

A temporary fictional Quotation, Customer and Items are created and deleted again. The shipped records are used as they
are on the site (ship.ship() is called first, as `bench migrate` does, and its result printed).
"""

import json
import sys

import frappe

site, out = sys.argv[1], sys.argv[2]
frappe.init(site=site, sites_path=".")
frappe.connect()
frappe.set_user("Administrator")
from frappe.translate import print_language
from frappe.utils import add_days, nowdate

from institutional_theme.print import ship

print("FRAPPE", frappe.__version__)
print("SHIP", ship.ship())
print(
	"PRINT_STYLE",
	frappe.db.exists("Print Style", "Midad"),
	"LETTER_HEAD",
	frappe.db.exists("Letter Head", "Midad"),
)
css = frappe.db.get_value("Print Style", "Midad", "css") or ""
print("STYLE_HAS_FAMILY", ".print-format {" in css, "STYLE_BYTES", len(css))
company = frappe.db.get_value("Company", {}, "name")
CUST = "Verify4 Temp Customer"
items = [
	("V4-TMP-1", "Application server 2U", "خادم تطبيقات 2U", 38500, 4),
	("V4-TMP-2", "Network storage unit", "وحدة تخزين شبكي", 27250, 2),
]
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
for code, en, _ar, _r, _q in items:
	if not frappe.db.exists("Item", code):
		frappe.get_doc(
			{
				"doctype": "Item",
				"item_code": code,
				"item_name": en,
				"item_group": frappe.db.get_value("Item Group", {"is_group": 0}),
				"stock_uom": "Nos",
				"is_stock_item": 0,
			}
		).insert()
results = {}
quo = frappe.get_doc(
	{
		"doctype": "Quotation",
		"quotation_to": "Customer",
		"party_name": CUST,
		"company": company,
		"transaction_date": nowdate(),
		"valid_till": add_days(nowdate(), 30),
		"items": [{"item_code": c, "qty": n, "rate": r, "item_name": ar} for c, _en, ar, r, n in items],
	}
).insert()
frappe.db.commit()
try:
	print("QUOTATION", quo.name)
	default_format = frappe.get_meta("Quotation").default_print_format or "Standard"
	print("DEFAULT_PRINT_FORMAT", default_format)
	# The last variant uses core's "Standard" Print Style and no Letter Head: core's own rendering of the same document, to tell what the
	# theme causes from what the format does by itself.
	for fmt_label, fmt in (("", None), ("-standard", "Standard"), ("-standard-core", "Standard")):
		for gen in ("wkhtmltopdf", "chrome"):
			for lang in ("en", "ar"):
				frappe.local.form_dict.pop("pdf_generator", None)  # core keeps the first value in form_dict
				key = f"{gen}-A4-{lang}{fmt_label}"
				try:
					with print_language(lang):
						opts = {"page-size": "A4"} if gen == "wkhtmltopdf" else {}
						args = {"style": "Midad", "letterhead": "Midad"}
						if fmt_label.endswith("-core"):
							args = {"style": "Standard", "no_letterhead": 1}
						if fmt:
							args["print_format"] = fmt
						pdf = frappe.get_print(
							"Quotation", quo.name, as_pdf=True, pdf_options=opts, pdf_generator=gen, **args
						)
						if gen == "chrome":
							html = frappe.get_print("Quotation", quo.name, as_pdf=False, **args)
							with open(f"{out}/html-{lang}{fmt_label}.html", "w", encoding="utf-8") as fh:
								fh.write(html)
					with open(f"{out}/{key}.pdf", "wb") as fh:
						fh.write(pdf)
					results[key] = {"ok": True, "bytes": len(pdf)}
					print("OK", key, len(pdf))
				except Exception as exc:
					results[key] = {"ok": False, "error": repr(exc)[:300]}
					print("FAIL", key, repr(exc)[:300])

	# Email: the real email_css hook (no injection), en and ar bodies.
	from frappe.email.email_body import get_formatted_html

	print("EMAIL_CSS_HOOK", frappe.get_hooks("email_css"))
	samples = {
		"en": (
			"Purchase order awaiting approval",
			"<p>Purchase order PO-2026-00418 from Sample Supplier is waiting for your approval.</p><p><a class='btn btn-primary' href='https://example.invalid/app/purchase-order/PO-2026-00418'>Open document</a></p><table class='table table-bordered'><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody><tr><td>Application server</td><td>154,000.00</td></tr></tbody></table>",
		),
		"ar": (
			"أمر شراء بانتظار الاعتماد",
			"<p>أمر الشراء PO-2026-00418 من شركة الأفق للتوريدات بانتظار اعتمادك.</p><p><a class='btn btn-primary' href='https://example.invalid/app/purchase-order/PO-2026-00418'>فتح المستند</a></p><table class='table table-bordered'><thead><tr><th>الصنف</th><th>المبلغ</th></tr></thead><tbody><tr><td>خادم تطبيقات</td><td>154,000.00</td></tr></tbody></table>",
		),
	}
	for lang, (subject, body) in samples.items():
		html = get_formatted_html(subject, body, header=[subject, "blue"], with_container=1)
		with open(f"{out}/email-{lang}.html", "w", encoding="utf-8") as fh:
			fh.write(html)
		checks = {
			"bytes": len(html),
			"has_var_function": "var(" in html,
			"has_theme_brand_rule": "#0f3a65" in html,
			"has_unicode_bidi_plaintext": "unicode-bidi: plaintext" in html
			or "unicode-bidi:plaintext" in html,
		}
		results[f"email-{lang}"] = checks
		print("EMAIL", lang, json.dumps(checks))
finally:
	frappe.delete_doc("Quotation", quo.name, force=1)
	for code, *_ in items:
		frappe.delete_doc("Item", code, force=1)
	frappe.delete_doc("Customer", CUST, force=1)
	frappe.db.commit()
	print(
		"LEFT",
		frappe.db.count("Quotation", {"party_name": CUST}),
		frappe.db.exists("Customer", CUST),
		frappe.db.count("Item", {"item_code": ["like", "V4-TMP-%"]}),
	)
	print(
		"PRINT_STYLE_RECORD",
		frappe.db.exists("Print Style", "Midad"),
		frappe.db.exists("Letter Head", "Midad"),
	)
	with open(f"{out}/results.json", "w", encoding="utf-8") as fh:
		json.dump(results, fh, indent=1, ensure_ascii=False)
	frappe.destroy()
