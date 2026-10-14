import frappe,sys
frappe.init(site=sys.argv[1], sites_path="."); frappe.connect(); frappe.set_user("Administrator")
from institutional_theme.print import ship
print(ship.ship()); frappe.db.commit()
print(frappe.get_all("Print Style",pluck="name"), frappe.get_all("Letter Head",pluck="name"))
