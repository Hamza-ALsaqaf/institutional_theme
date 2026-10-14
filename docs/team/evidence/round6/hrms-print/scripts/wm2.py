import frappe,sys
frappe.init(site=sys.argv[1], sites_path="."); frappe.connect(); frappe.set_user("Administrator")
out=sys.argv[2]; tops=sys.argv[3].split(",")
dt,name,fmt=sys.argv[4:7]
base=frappe.db.get_value("Print Style","Midad","css")
try:
  for t in tops:
    css=base+("\n.print-format [document-status=\"draft\"], .print-format [document-status=\"cancelled\"]{top:%s !important}\n"%t)
    frappe.db.set_value("Print Style","Midad","css",css); frappe.db.commit(); frappe.clear_cache()
    for gen in ("chrome",):
        pdf=frappe.get_print(dt,name,print_format=fmt,as_pdf=True,pdf_generator=gen,pdf_options={"page-size":"A4"},style="Midad",letterhead="Midad")
        open(f"{out}/wm2_{t}_{gen}.pdf","wb").write(pdf)
finally:
  frappe.db.set_value("Print Style","Midad","css",base); frappe.db.commit(); frappe.clear_cache()
  print("restored", frappe.db.get_value("Print Style","Midad","css")==base)
