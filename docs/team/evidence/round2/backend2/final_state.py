import frappe
frappe.init(site="midad.test", sites_path="."); frappe.connect()
print("Print Style", frappe.db.exists("Print Style", "Midad"), "Letter Head", frappe.db.exists("Letter Head", "Midad"))
print("globals", frappe.db.get_all("DefaultValue", {"defkey": ["like", "ins_print_%"]}, ["defkey"]))
print("Property Setter tax_id mask", frappe.db.count("Property Setter", {"doc_type": "Customer", "field_name": "tax_id", "property": "mask"}))
print("Customer BE R2", frappe.db.count("Customer", {"customer_name": ["like", "BE R2%"]}), "Quotation", frappe.db.count("Quotation"), "Item B2", frappe.db.count("Item", {"item_code": ["like", "B2-TMP-%"]}))
print("settings", {k: frappe.db.get_single_value("Institutional Theme Settings", k) for k in ("enable_idle_warning", "idle_warning_minutes", "enable_connection_banner")})
print("css has family rule", ".print-format {" in frappe.db.get_value("Print Style", "Midad", "css"))
frappe.destroy()
