"""Render the real auth emails (password reset, verification code) in Arabic and English through Frappe's own
path (frappe.sendmail -> QueueBuilder -> Premailer-inlined MIME message) and write the HTML. Nothing is sent or stored:
QueueBuilder.process is replaced by a capture and the run ends in a rollback.
Run from the bench `sites` folder with the bench Python: python email_render.py SITE OUTDIR"""
import email
import sys

import frappe

site, out = sys.argv[1], sys.argv[2]
frappe.init(site=site, sites_path=".")
frappe.connect()
frappe.set_user("Administrator")
print("FRAPPE", frappe.__version__)
frappe.in_test = True
from frappe.email.doctype.email_queue import email_queue as eq
from frappe.twofactor import get_email_body_for_2fa

captured = []


def capture(self, send_now=False):
	captured.append(self.as_dict(include_recipients=False))
	return []


eq.QueueBuilder.process = capture
frappe.get_doc({"doctype": "Email Account", "email_account_name": "Fix2 Temp", "email_id": "noreply@example.invalid",
	"default_outgoing": 1, "enable_outgoing": 1, "smtp_server": "localhost", "smtp_port": 25,
	"no_smtp_authentication": 1, "service": ""}).insert(ignore_permissions=True)
frappe.clear_cache()
try:
	for lang in ("en", "ar"):
		frappe.local.lang = lang
		frappe.local.lang_full_dict = None
		frappe.flags.token_expiry = 300
		del captured[:]
		frappe.get_doc("User", "Administrator").password_reset_mail("http://example.invalid/update-password?key=abc")
		kw = {"wrapper": "templates/emails/auth_email.html"} if "auth_email" in open(frappe.get_app_path("frappe", "twofactor.py")).read() else {}
		frappe.sendmail(recipients="admin@example.com", subject=frappe._("Verification Code"),
			message=get_email_body_for_2fa({"otp": "482915"}), with_container=True, delayed=True, **kw)
		print("CAPTURED", lang, len(captured))
		for data, kind in zip(captured, ("password_reset", "verification_code")):
			msg = email.message_from_string(data["message"])
			for part in msg.walk():
				if part.get_content_type() == "text/html":
					html = part.get_payload(decode=True).decode("utf-8")
					open(f"{out}/email-{kind}-{lang}.html", "w", encoding="utf-8").write(html)
					print(lang, kind, len(html))
finally:
	frappe.db.rollback()
	frappe.destroy()
