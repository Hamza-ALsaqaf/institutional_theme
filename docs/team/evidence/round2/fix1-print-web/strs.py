import frappe, re, json, glob
frappe.init(site='midad.test', sites_path='.'); frappe.connect()
from frappe.translate import print_language
from frappe import _
print("SI default", frappe.get_meta("Sales Invoice").default_print_format)
files=glob.glob("/home/user/frappe-bench/apps/erpnext/erpnext/selling/print_format/quotation*/*.json")+glob.glob("/home/user/frappe-bench/apps/erpnext/erpnext/accounts/print_format/sales_invoice*/*.json")
with print_language("ar"):
  for f in files:
    h=json.load(open(f)).get("html") or ""
    miss=sorted({s for s in re.findall(r"_\(\s*[\"']([^\"']+)[\"']\s*\)",h) if _(s)==s})
    print(f.split("/")[-1], miss)
