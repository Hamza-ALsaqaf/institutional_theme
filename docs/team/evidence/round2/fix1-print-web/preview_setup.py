# Creates temporary preview records (fictional data). Run with the bench python from the sites folder.
import frappe
frappe.init(site='midad.test', sites_path='.')
frappe.connect()
from frappe.utils import add_days, nowdate
frappe.set_user("Administrator")
company = frappe.db.get_value("Company", {}, "name")
if not frappe.db.exists("Customer", "Midad Preview Customer"):
    frappe.get_doc({"doctype":"Customer","customer_name":"Midad Preview Customer","customer_type":"Company","customer_group":frappe.db.get_value("Customer Group",{"is_group":0}),"territory":frappe.db.get_value("Territory",{"is_group":0})}).insert()
items = [("MIDAD-PV-1","Application server 2U, 64 GB","خادم تطبيقات 2U، ذاكرة 64 غيغابايت",38500,4),
("MIDAD-PV-2","Network storage unit, 48 TB","وحدة تخزين شبكي بسعة 48 تيرابايت",27250,2),
("MIDAD-PV-3","Managed switch, 48 ports","مبدّل شبكة مُدار، 48 منفذاً",9840,3)]
for code,en,ar,r,q in items:
    if not frappe.db.exists("Item", code):
        frappe.get_doc({"doctype":"Item","item_code":code,"item_name":en,"item_group":frappe.db.get_value("Item Group",{"is_group":0}),"stock_uom":"Nos","is_stock_item":0}).insert()
def make(submit=None):
    q = frappe.get_doc({"doctype":"Quotation","quotation_to":"Customer","party_name":"Midad Preview Customer","company":company,"transaction_date":nowdate(),"valid_till":add_days(nowdate(),30),
        "items":[{"item_code":c,"qty":n,"rate":r,"item_name":ar} for c,en,ar,r,n in items]})
    q.insert()
    if submit: q.submit()
    if submit == "cancel": q.cancel()
    return q.name
names = {"draft": make(), "submitted": make("submit"), "cancelled": make("cancel")}
frappe.db.commit()
print("PREVIEW_NAMES", names)
