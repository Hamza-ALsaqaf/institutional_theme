import frappe
frappe.init(site="midad.test", sites_path="."); frappe.connect()
print("customers", frappe.db.count("Customer", {"customer_name": ["like", "Fix1%"]}), "items", frappe.db.count("Item", {"item_code": ["like", "F1-%"]}),
 "notes", frappe.db.count("Note", {"title": ["like", "Gate kept%"]}), "quotes_fix1", frappe.db.count("Quotation", {"party_name": ["like", "Fix1%"]}),
 "LH", frappe.db.exists("Letter Head","Midad"), "PS", frappe.db.exists("Print Style","Midad"), "apps", frappe.get_installed_apps())
