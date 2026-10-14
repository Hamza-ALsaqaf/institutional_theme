import frappe
frappe.init(site="midad.test", sites_path="."); frappe.connect(); frappe.set_user("Administrator")
for dt, flt in [("Web Page", {"route": ["like", "ins-p2-%"]}), ("Web Form", {"route": ["in", ["visitor-request", "my-requests"]]}), ("ToDo", {"description": ["like", "%copy of the notice%"]}), ("ToDo", {"description": ["like", "%نسخة من الإشعار%"]}), ("User", {"email": ["like", "ins-p2-%"]})]:
    for n in frappe.get_all(dt, flt, pluck="name"): frappe.delete_doc(dt, n, force=1, ignore_permissions=True)
frappe.db.commit()
print("left", frappe.db.count("Web Page", {"route": ["like", "ins-p2-%"]}), frappe.db.count("Web Form", {"is_standard": 0}), frappe.db.count("User", {"email": ["like", "ins-p2-%"]}), frappe.db.count("ToDo"))
