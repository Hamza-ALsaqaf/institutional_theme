"""Run the STOCK HRMS post-install patch update_employee_advance_status on a site, then roll back. Test bench only.

    python -I hrms_stock_patch_check.py <site>        (from the bench `sites` directory, bench interpreter)

Shows whether the workaround of hrms_install.py is still needed on a given HRMS tag: the stock patch is called
unmodified; on PostgreSQL it raises DatatypeMismatch ("argument of AND must be type boolean, not type numeric").
Nothing is committed.
"""

from __future__ import annotations

import sys

import frappe


def main(site: str) -> int:
	frappe.init(site=site, sites_path=".")
	frappe.connect()
	frappe.set_user("Administrator")
	import hrms.patches.post_install.update_employee_advance_status as patch

	try:
		patch.execute()
	except Exception as e:
		print(f"STOCK PATCH FAILS: {type(e).__module__}.{type(e).__name__}: {str(e).splitlines()[0]}")
		return_code = 1
	else:
		print("STOCK PATCH RAN WITHOUT ERROR")
		return_code = 0
	finally:
		frappe.db.rollback()
		frappe.destroy()
	return return_code


if __name__ == "__main__":
	raise SystemExit(main(sys.argv[1]))
