import frappe
frappe.init(site='midad.test', sites_path='.'); frappe.connect(); frappe.set_user("Administrator")
from frappe.translate import print_language
from frappe import _
out=[]
with print_language("ar"):
    for dt in ("Quotation","Sales Invoice"):
        m=frappe.get_meta(dt)
        for df in m.fields:
            if not df.label or df.print_hide or df.hidden or df.fieldtype in ("Section Break","Column Break","Tab Break","Table","Button","HTML"): continue
            a=_(df.label, context=dt); b=_(df.label)
            if a==df.label: out.append((dt,df.label,b if b!=df.label else ""))
print("COUNT",len(out))
for o in out: print("|".join(o))
