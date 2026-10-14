"""Read-only: the end of the exception when Salary Slip Classic is rendered on 16.32.0 (the render script truncates it to 300 characters)."""

import html
import sys

import frappe

frappe.init(site=sys.argv[1], sites_path=".")
frappe.connect()
frappe.set_user("Administrator")
print("FRAPPE", frappe.__version__)
for kwargs in ({"style": "Midad", "letterhead": "Midad"}, {"style": "Standard", "no_letterhead": 1}):
	try:
		frappe.get_print("Salary Slip", "Sal Slip/HR-EMP-00003/00001", print_format="Salary Slip Classic", as_pdf=False, **kwargs)
		print("RENDERED", kwargs)
	except Exception as e:
		text = html.unescape(str(e))
		print("FAILED", kwargs, "last lines:")
		print("\n".join(text.strip().splitlines()[-6:]))
frappe.destroy()
