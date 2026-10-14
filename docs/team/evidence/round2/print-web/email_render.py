# Renders a sample email with the theme's email_css added (the hook is enabled by the lead later; here it is injected in-process).
import frappe, json
frappe.init(site='midad.test', sites_path='.'); frappe.connect(); frappe.set_user("Administrator")
orig = frappe.get_hooks
def hooks(*a, **k):
    r = orig(*a, **k)
    if a and a[0] == "email_css":
        return list(r) + ["ins_email.bundle.css"]
    return r
frappe.get_hooks = hooks
from frappe.email.email_body import get_formatted_html
samples = {
 "en": ("Purchase order awaiting approval", "<p>Purchase order PO-2026-00418 from Sample Supplier is waiting for your approval.</p><p><a class='btn btn-primary' href='https://example.invalid/app/purchase-order/PO-2026-00418'>Open document</a></p><table class='table table-bordered'><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody><tr><td>Application server</td><td>154,000.00</td></tr></tbody></table>"),
 "ar": ("أمر شراء بانتظار الاعتماد", "<p>أمر الشراء PO-2026-00418 من شركة الأفق للتوريدات بانتظار اعتمادك.</p><p><a class='btn btn-primary' href='https://example.invalid/app/purchase-order/PO-2026-00418'>فتح المستند</a></p><table class='table table-bordered'><thead><tr><th>الصنف</th><th>المبلغ</th></tr></thead><tbody><tr><td>خادم تطبيقات</td><td>154,000.00</td></tr></tbody></table>"),
}
for lang,(subject,body) in samples.items():
    html = get_formatted_html(subject, body, header=[subject, "blue"], footer="<div>Unified Institutional System</div>", email_account=None, with_container=1) if False else get_formatted_html(subject, body, header=[subject, "blue"], with_container=1)
    open(f"/tmp/pdfout/email-{lang}.html","w").write(html)
    print(lang, len(html), "var(" in html, "ins" in html)
