"""Render HRMS documents in print formats: wkhtmltopdf and Chrome, A4, en and ar. Test bench only.

    python -I hrms_print_render.py SITE OUTDIR VARIANT [JOBS_FILE]
VARIANT  themed: Print Style "Midad" + Letter Head "Midad".
         core:   Print Style "Standard", no letter head (theme installed).
         noapp:  like core, and the app is removed from this process (get_installed_apps patched before any hook is
                 read; developer_mode sites only, see docs/team/evidence/round5/print-clip/scripts/render.py).
JOBS_FILE  lines `Doctype|Document name|Print Format`; default: every DOC line printed by hrms_print_seed.py is
           read from the file given. File names: <variant>__<slug of doctype+format>__<generator>-<lang>.pdf.
Generator is a per-call argument (nothing site-wide changes). Prints one `OK`/`FAIL` line per render.
"""

import re
import sys

import frappe

site, out, variant = sys.argv[1:4]
jobs_file = sys.argv[4]
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

print("FRAPPE", frappe.__version__, "VARIANT", variant)
args = (
	{"style": "Midad", "letterhead": "Midad"}
	if variant == "themed"
	else {"style": "Standard", "no_letterhead": 1}
)
for line in open(jobs_file):
	line = line.strip()
	if not line or line.startswith("#"):
		continue
	dt, name, fmt = line.split("|")
	slug = re.sub(r"[^a-z0-9]+", "-", f"{dt} {fmt}".lower()).strip("-")
	for gen in ("wkhtmltopdf", "chrome"):
		for lang in ("en", "ar"):
			key = f"{variant}__{slug}__{gen}-{lang}"
			frappe.local.form_dict.pop("pdf_generator", None)
			try:
				with print_language(lang):
					pdf = frappe.get_print(
						dt,
						name,
						print_format=fmt,
						as_pdf=True,
						pdf_options={"page-size": "A4"},
						pdf_generator=gen,
						**args,
					)
				open(f"{out}/{key}.pdf", "wb").write(pdf)
				print("OK", key, len(pdf), flush=True)
			except Exception as e:
				print("FAIL", key, repr(e)[:300], flush=True)
frappe.destroy()
