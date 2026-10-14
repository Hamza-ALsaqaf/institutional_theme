"""Install HRMS on the PostgreSQL test site. Test bench only.

Run by tools/bench/hrms.sh from the bench `sites` directory with the bench interpreter:
    python -I hrms_install.py <site>

Why this exists: `bench install-app hrms` fails on PostgreSQL with HRMS v16.20.1. The post-install patch
hrms/patches/post_install/update_employee_advance_status.py builds `WHERE ... AND return_amount AND ...`,
which MariaDB accepts and PostgreSQL rejects ("argument of AND must be type boolean, not type numeric").
The patch only rewrites existing Employee Advance rows, so on a site without any it has nothing to do.
This runner replaces that one function in memory for the length of the install (nothing on disk is edited)
and refuses to proceed when Employee Advance rows exist. It then calls the stock installer; when a first
attempt already registered the app (the installer adds it to the installed apps before its after-install
hook), it re-runs the same installer with force, which is what `bench install-app --force` does.
"""

from __future__ import annotations

import sys

import frappe


def main(site: str) -> int:
	frappe.init(site=site, sites_path=".")
	frappe.connect()
	frappe.set_user("Administrator")

	import hrms.patches.post_install.update_employee_advance_status as patch

	def execute() -> None:
		if frappe.db.table_exists("Employee Advance") and frappe.db.count("Employee Advance"):
			raise RuntimeError("Employee Advance rows exist: the PostgreSQL workaround must not skip the patch")
		print("update_employee_advance_status: no Employee Advance rows, nothing to update (skipped on PostgreSQL)")

	patch.execute = execute

	from frappe.installer import install_app

	installed = "hrms" in frappe.get_installed_apps()
	finished = installed and frappe.db.exists("Leave Type", "Casual Leave")
	if finished:
		print("hrms already installed and its fixtures exist: nothing to do")
	else:
		install_app("hrms", verbose=True, force=installed)
	frappe.db.commit()
	frappe.destroy()
	return 0


if __name__ == "__main__":
	raise SystemExit(main(sys.argv[1]))
