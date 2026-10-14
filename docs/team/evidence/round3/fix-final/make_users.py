# Creates or updates the Light users g-en-light@midad.test and g-ar-light@midad.test (System Manager).
# Run:  tools/bench/b.sh console < make_users.py   (the web API refuses with QueueOverloaded while 550 stale jobs sit in the queue)
import frappe
PW = "Mdd#Test2026x"
for l in ("en", "ar"):
	email = f"g-{l}-light@midad.test"
	if frappe.db.exists("User", email):
		u = frappe.get_doc("User", email)
	else:
		u = frappe.new_doc("User")
		u.email = email
		u.first_name = "G"
		u.last_name = l
		u.send_welcome_email = 0
		u.append("roles", {"role": "System Manager"})
	u.language = l
	u.desk_theme = "Light"
	u.enabled = 1
	u.new_password = PW
	u.save(ignore_permissions=True)
	print("USER", email, u.language, u.desk_theme)
frappe.db.commit()
