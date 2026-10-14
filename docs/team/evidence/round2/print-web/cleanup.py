import frappe
frappe.init(site='midad.test', sites_path='.'); frappe.connect(); frappe.set_user("Administrator")
frappe.flags.in_migrate = True
for dt, f in [("Print Style","Midad Draft Preview"),("Letter Head","Midad Preview LH")]:
    if frappe.db.exists(dt, f): frappe.delete_doc(dt, f, force=1)
for n in frappe.get_all("Web Page", {"route":"ins-preview-err"}, pluck="name"): frappe.delete_doc("Web Page", n, force=1)
for n in frappe.get_all("Quotation", {"party_name":"Midad Preview Customer"}, pluck="name"):
    d = frappe.get_doc("Quotation", n)
    if d.docstatus == 1: d.cancel()
    frappe.delete_doc("Quotation", n, force=1)
for dt, flt in [("Customer",{"name":"Midad Preview Customer"}),("Item",{"item_code":["like","MIDAD-PV-%"]})]:
    for n in frappe.get_all(dt, flt, pluck="name"): frappe.delete_doc(dt, n, force=1)
frappe.db.commit()
print("left:", frappe.db.count("Quotation"), frappe.db.exists("Print Style","Midad Draft Preview"), frappe.db.exists("Letter Head","Midad Preview LH"), frappe.db.count("Item",{"item_code":["like","MIDAD-PV-%"]}))
print(frappe.db.get_single_value("Print Settings","print_style"), frappe.db.get_single_value("Print Settings","repeat_header_footer"), frappe.db.get_single_value("Print Settings","allow_print_for_cancelled"), frappe.db.get_single_value("Print Settings","pdf_page_size"))
