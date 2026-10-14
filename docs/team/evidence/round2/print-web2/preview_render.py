# Renders preview PDFs. Usage: preview_render.py OUTDIR  (bench python, from the sites folder)
import json, sys, os, re
import frappe
frappe.init(site='midad.test', sites_path='.')
frappe.connect()
frappe.set_user("Administrator")
from institutional_theme.fonts import print_font_css, print_font_families
out = sys.argv[1]
assets = json.load(open('assets/assets.json'))
css_path = 'assets/' + assets['ins_print.bundle.css'].replace('/assets/', '', 1)
css = open(css_path).read()
fam = print_font_families("IBM Plex")
style_css = print_font_css("IBM Plex") + "\n.print-format{font-family:%s}\n" % fam["sans"] + css
STYLE = "Midad Draft Preview"
LH = "Midad Preview LH"
base = '/home/user/frappe-bench/apps/institutional_theme/institutional_theme/print/'
if frappe.db.exists("Print Style", STYLE): frappe.delete_doc("Print Style", STYLE, force=1)
frappe.get_doc({"doctype":"Print Style","print_style_name":STYLE,"css":style_css}).insert()
if frappe.db.exists("Letter Head", LH): frappe.delete_doc("Letter Head", LH, force=1)
frappe.flags.in_migrate = True
lh = frappe.get_doc({"doctype":"Letter Head","letter_head_name":LH,"source":"HTML","content":open(base+'letter_head.html').read(),"footer_source":"HTML","footer":open(base+'letter_head_footer.html').read(),"is_default":0})
lh.insert(); frappe.flags.in_migrate = False
frappe.db.commit()
IDENT = {"institution_name":"Example Institution","institution_name_ar":"مؤسسة المثال","system_name":"Unified Institutional System","emblem_url":"","address":"1 Sample Street, Sampletown","contact":"+000 0000 0000 · info@example.invalid"}
frappe.get_jenv().globals["ins_identity"] = lambda: dict(IDENT)
names = json.load(open(sys.argv[2]))
from frappe.translate import print_language
gens = sys.argv[3].split(",")
sizes = sys.argv[4].split(",")
langs = sys.argv[5].split(",")
kinds = sys.argv[6].split(",")
rh = int(sys.argv[7]) if len(sys.argv) > 7 else 0
frappe.db.set_single_value("Print Settings", "repeat_header_footer", rh)
prev_cancel = frappe.db.get_single_value("Print Settings", "allow_print_for_cancelled")
frappe.db.set_single_value("Print Settings", "allow_print_for_cancelled", 1)
for g in gens:
  for size in sizes:
    for lang in langs:
      for kind in kinds:
        tag = f"{g}-{size}-{lang}-{kind}" + ("-rh" if rh else "")
        try:
          frappe.local.form_dict.pop("pdf_generator", None)
          with print_language(lang):
            opts = {"page-size": size} if g == "wkhtmltopdf" else {}
            if g == "chrome": frappe.db.set_single_value("Print Settings", "pdf_page_size", size)
            pdf = frappe.get_print("Quotation", names[kind], style=STYLE, as_pdf=True, letterhead=LH, pdf_options=opts, pdf_generator=g)
          open(f"{out}/{tag}.pdf", "wb").write(pdf); print("OK", tag, len(pdf))
        except Exception as e:
          import traceback; print("FAIL", tag, repr(e)[:300])
frappe.db.set_single_value("Print Settings", "repeat_header_footer", 0)
frappe.db.set_single_value("Print Settings", "pdf_page_size", "A4")
frappe.db.set_single_value("Print Settings", "allow_print_for_cancelled", prev_cancel)
frappe.db.commit()
