# Temporary fictional website records for the P2 screenshots. Run with the bench python (pyrun.sh).
import frappe
frappe.init(site="midad.test", sites_path="."); frappe.connect(); frappe.set_user("Administrator")
HTML = """<div class="container my-5"><h1>About the Example Institution</h1>
<p class="lead">A fictional institution used to check how the public website looks. This page has no real content.</p>
<h2>Services</h2><p>Visitors can submit a request, read notices and contact the front desk. <a href="/visitor-request/new">Send a request</a> or read the <a href="/contact">contact page</a>.</p>
<h3>Opening hours</h3>
<table class="table table-bordered"><thead><tr><th>Day</th><th>Hours</th><th>Desk</th></tr></thead><tbody>
<tr><td>Sunday to Thursday</td><td>08:00 to 15:00</td><td>Front desk</td></tr>
<tr><td>Friday</td><td>Closed</td><td>None</td></tr></tbody></table>
<ul><li>Bring a valid identification document.</li><li>Requests are answered within five working days.</li></ul>
<blockquote class="blockquote"><p>Plain notices, plain words.</p></blockquote>
<div class="form-group"><label for="ins-q">Search the notices</label><input id="ins-q" class="form-control" type="text" placeholder="Type a word"></div>
<p><a class="btn btn-primary" href="/visitor-request/new">Send a request</a> <a class="btn btn-default" href="/contact">Contact us</a> <button class="btn btn-secondary">Secondary</button></p>
<p><code>REF-2026-0001</code></p></div>"""
HTML_AR = """<div class="container my-5"><h1>عن المؤسسة النموذجية</h1>
<p class="lead">مؤسسة افتراضية لاختبار مظهر الموقع العام. لا يحتوي هذا الموقع على محتوى حقيقي.</p>
<h2>الخدمات</h2><p>يمكن للزوار تقديم طلب وقراءة الإشعارات والتواصل مع مكتب الاستقبال. <a href="/visitor-request/new">أرسل طلبا</a> أو افتح <a href="/contact">صفحة الاتصال</a>.</p>
<h3>ساعات العمل</h3>
<table class="table table-bordered"><thead><tr><th>اليوم</th><th>الساعات</th><th>المكتب</th></tr></thead><tbody>
<tr><td>الأحد إلى الخميس</td><td>08:00 إلى 15:00</td><td>مكتب الاستقبال</td></tr>
<tr><td>الجمعة</td><td>مغلق</td><td>لا يوجد</td></tr></tbody></table>
<ul><li>أحضر وثيقة هوية سارية.</li><li>يُرد على الطلبات خلال خمسة أيام عمل.</li></ul>
<div class="form-group"><label for="ins-q">ابحث في الإشعارات</label><input id="ins-q" class="form-control" type="text" placeholder="اكتب كلمة"></div>
<p><a class="btn btn-primary" href="/visitor-request/new">أرسل طلبا</a> <a class="btn btn-default" href="/contact">اتصل بنا</a></p></div>"""
for route, html in (("ins-p2-about", HTML), ("ins-p2-about-ar", HTML_AR)):
    for n in frappe.get_all("Web Page", {"route": route}, pluck="name"): frappe.delete_doc("Web Page", n, force=1)
    frappe.get_doc({"doctype": "Web Page", "title": "About the Example Institution" if "ar" not in route else "عن المؤسسة", "route": route, "published": 1,
        "content_type": "HTML", "main_section_html": html, "full_width": 0}).insert()
for n in frappe.get_all("Web Form", {"route": "visitor-request"}, pluck="name"): frappe.delete_doc("Web Form", n, force=1)
wf = frappe.get_doc({"doctype": "Web Form", "title": "Visitor Request", "route": "visitor-request", "doc_type": "ToDo", "module": "Desk", "published": 1,
    "login_required": 0, "allow_multiple": 1, "allow_edit": 0, "is_standard": 0, "show_list": 0, "button_label": "Send request",
    "introduction_text": "<p>Tell us what you need. A staff member will reply.</p>", "success_title": "Request received", "success_message": "Thank you. Your request has been recorded.",
    "web_form_fields": [
        {"fieldname": "description", "fieldtype": "Text", "label": "Request", "reqd": 1},
        {"fieldname": "priority", "fieldtype": "Select", "label": "Priority", "options": "Low\nMedium\nHigh", "default": "Medium"},
        {"fieldname": "date", "fieldtype": "Date", "label": "Needed by"}]})
wf.insert()
# a second, login-required list form for the portal user
for n in frappe.get_all("Web Form", {"route": "my-requests"}, pluck="name"): frappe.delete_doc("Web Form", n, force=1)
wf2 = frappe.get_doc({"doctype": "Web Form", "title": "My Requests", "route": "my-requests", "doc_type": "ToDo", "module": "Desk", "published": 1,
    "login_required": 1, "allow_multiple": 1, "allow_edit": 1, "is_standard": 0, "show_list": 1, "list_title": "My requests",
    "apply_document_permissions": 0, "button_label": "Save",
    "list_columns": [{"fieldname": "description", "fieldtype": "Text", "label": "Request"}, {"fieldname": "priority", "fieldtype": "Select", "label": "Priority"}],
    "web_form_fields": [
        {"fieldname": "description", "fieldtype": "Text", "label": "Request", "reqd": 1},
        {"fieldname": "priority", "fieldtype": "Select", "label": "Priority", "options": "Low\nMedium\nHigh"}]})
wf2.insert()
for email, lang in (("ins-p2-en@midad.test", "en"), ("ins-p2-ar@midad.test", "ar")):
    if not frappe.db.exists("User", email):
        frappe.get_doc({"doctype": "User", "email": email, "first_name": "P2 Visitor " + lang, "language": lang, "user_type": "Website User", "send_welcome_email": 0, "new_password": "P2-Visit-Pass-2026!"}).insert()
frappe.db.commit()
print("setup ok", frappe.db.exists("Web Form", "visitor-request"))
