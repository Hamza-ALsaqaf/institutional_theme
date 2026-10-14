"""Fictional HR records for the HRMS desk pages of the test site. Test bench only.

Run by tools/bench/hrms.sh from the bench `sites` directory with the bench interpreter:
    python -I hrms_seed.py <site>

Idempotent: every record is looked up first and created only when missing. A failure in one block is
reported on its own line and does not stop the other blocks. Prints one `URL <path>` line for every record
the HRMS pages can be opened on. Names are invented; none belongs to a real person or institution.
"""

from __future__ import annotations

import sys
import traceback

import frappe
from frappe.utils import add_days, add_months, get_first_day, get_last_day, getdate, nowdate

# (first name, last name, gender, designation, date of birth)
PEOPLE = [
	("Layla", "Hamdan", "Female", "Analyst", "1990-03-14"),
	("Omar", "Qasim", "Male", "Accountant", "1987-11-02"),
	("سارة", "المنصور", "Female", "Analyst", "1992-07-21"),
	("خالد", "الرفاعي", "Male", "Accountant", "1985-01-30"),
	("Nadia", "Farouk", "Female", "Coordinator", "1994-09-09"),
]
DESIGNATIONS = ["Analyst", "Accountant", "Coordinator"]
JOINING = "2026-01-02"  # inside the 2026 fiscal year the test site wizard creates


def log(msg: str) -> None:
	print(msg, flush=True)


def block(name: str):
	"""Decorator: run one seed block, report failure without stopping the others."""

	def wrap(fn):
		def run(*a, **kw):
			try:
				result = fn(*a, **kw)
				frappe.db.commit()
				return result
			except Exception:
				frappe.db.rollback()
				log(f"BLOCK {name} FAILED")
				log(traceback.format_exc())
				return None

		return run

	return wrap


def url(doctype: str, name: str) -> None:
	from urllib.parse import quote

	log(f"URL /desk/{frappe.scrub(doctype).replace('_', '-')}/{quote(name, safe='')}")


@block("designations")
def make_designations() -> None:
	for d in DESIGNATIONS:
		if not frappe.db.exists("Designation", d):
			frappe.get_doc({"doctype": "Designation", "designation_name": d}).insert()


@block("employees")
def make_employees(company: str) -> list[str]:
	names = []
	for first, last, gender, desig, dob in PEOPLE:
		existing = frappe.db.get_value(
			"Employee", {"first_name": first, "last_name": last, "company": company}
		)
		if existing:
			names.append(existing)
			continue
		doc = frappe.get_doc(
			{
				"doctype": "Employee",
				"first_name": first,
				"last_name": last,
				"gender": gender,
				"date_of_birth": dob,
				"date_of_joining": JOINING,
				"company": company,
				"status": "Active",
				"designation": desig,
			}
		).insert()
		names.append(doc.name)
	for n in names:
		url("Employee", n)
	return names


@block("holidays")
def make_holiday_list(company: str) -> None:
	"""Leave and salary calculations need a holiday list that covers the dates they touch."""
	year = getdate(nowdate()).year
	name = f"Test Institution Weekend {year}"
	if not frappe.db.exists("Holiday List", name):
		doc = frappe.get_doc(
			{
				"doctype": "Holiday List",
				"holiday_list_name": name,
				"from_date": f"{year}-01-01",
				"to_date": f"{year}-12-31",
				"weekly_off": "Friday",
			}
		)
		doc.get_weekly_off_dates()
		doc.insert()
	if not frappe.db.exists(
		"Holiday List Assignment", {"applicable_for": "Company", "assigned_to": company, "docstatus": 1}
	):
		frappe.get_doc(
			{
				"doctype": "Holiday List Assignment",
				"applicable_for": "Company",
				"assigned_to": company,
				"holiday_list": name,
				"from_date": f"{year}-01-01",
			}
		).insert().submit()


@block("leave")
def make_leave(company: str, employees: list[str]) -> None:
	year = getdate(nowdate()).year
	leave_type = "Casual Leave"
	if not frappe.db.exists("Leave Type", leave_type):
		frappe.get_doc(
			{"doctype": "Leave Type", "leave_type_name": leave_type, "max_continuous_days_allowed": 3}
		).insert()
	for emp in employees[:3]:
		if not frappe.db.exists(
			"Leave Allocation", {"employee": emp, "leave_type": leave_type, "docstatus": 1}
		):
			frappe.get_doc(
				{
					"doctype": "Leave Allocation",
					"employee": emp,
					"leave_type": leave_type,
					"from_date": f"{year}-01-01",
					"to_date": f"{year}-12-31",
					"new_leaves_allocated": 12,
					"company": company,
				}
			).insert().submit()
	start = add_days(nowdate(), 14)
	while getdate(start).weekday() > 3:  # Monday to Thursday, so the application does not span a weekend
		start = add_days(start, 1)
	for emp, status, submit, offset in (
		(employees[0], "Open", False, 0),
		(employees[2], "Approved", True, 21),
	):
		from_date = add_days(start, offset)
		while getdate(from_date).weekday() > 2:
			from_date = add_days(from_date, 1)
		to_date = add_days(from_date, 1)
		found = frappe.db.get_value(
			"Leave Application", {"employee": emp, "leave_type": leave_type, "from_date": from_date}
		)
		if found:
			url("Leave Application", found)
			continue
		doc = frappe.get_doc(
			{
				"doctype": "Leave Application",
				"employee": emp,
				"leave_type": leave_type,
				"from_date": from_date,
				"to_date": to_date,
				"status": status,
				"description": "Fictional leave request for interface testing",
				"company": company,
				"leave_approver": "Administrator",
				"follow_via_email": 0,
			}
		).insert()
		if submit:
			doc.submit()
		url("Leave Application", doc.name)


@block("salary")
def make_salary(company: str, employees: list[str]) -> None:
	currency = frappe.db.get_value("Company", company, "default_currency")
	for name, abbr, kind in (
		("Basic", "B", "Earning"),
		("Housing", "H", "Earning"),
		("Social Insurance", "SI", "Deduction"),
	):
		if not frappe.db.exists("Salary Component", name):
			frappe.get_doc(
				{
					"doctype": "Salary Component",
					"salary_component": name,
					"salary_component_abbr": abbr,
					"type": kind,
					"depends_on_payment_days": 0,
				}
			).insert()
	structure = "Standard Monthly"
	if not frappe.db.exists("Salary Structure", structure):
		doc = frappe.get_doc(
			{
				"doctype": "Salary Structure",
				"name": structure,
				"company": company,
				"currency": currency,
				"is_active": "Yes",
				"payroll_frequency": "Monthly",
				"earnings": [
					{"salary_component": "Basic", "amount_based_on_formula": 1, "formula": "base * 0.7"},
					{"salary_component": "Housing", "amount_based_on_formula": 1, "formula": "base * 0.3"},
				],
				"deductions": [
					{
						"salary_component": "Social Insurance",
						"amount_based_on_formula": 1,
						"formula": "base * 0.09",
					},
				],
			}
		).insert()
		doc.submit()
	url("Salary Structure", structure)
	month_start = get_first_day(add_months(nowdate(), -1))
	for emp in employees[:2]:
		if not frappe.db.exists("Salary Structure Assignment", {"employee": emp, "docstatus": 1}):
			frappe.get_doc(
				{
					"doctype": "Salary Structure Assignment",
					"employee": emp,
					"salary_structure": structure,
					"from_date": JOINING,
					"company": company,
					"currency": currency,
					"base": 9000,
				}
			).insert().submit()
		existing = frappe.db.get_value("Salary Slip", {"employee": emp, "start_date": month_start})
		if existing:
			url("Salary Slip", existing)
			continue
		from hrms.payroll.doctype.salary_slip.salary_slip import SalarySlip
		from hrms.payroll.doctype.salary_structure.salary_structure import make_salary_slip

		# HRMS v16.20.1 on PostgreSQL: SalarySlip.compute_year_to_date and compute_month_to_date order an
		# aggregate query by "creation", which PostgreSQL rejects (GroupingError). In this seed process only,
		# the year-to-date and month-to-date figures are left at zero; nothing on disk is changed and the slip is otherwise computed by HRMS.
		SalarySlip.compute_year_to_date = lambda self: None
		SalarySlip.compute_month_to_date = lambda self: None

		slip = make_salary_slip(structure, employee=emp, posting_date=get_last_day(month_start))
		slip.start_date = month_start
		slip.end_date = get_last_day(month_start)
		slip.insert()
		url("Salary Slip", slip.name)


def main(site: str) -> None:
	frappe.init(site=site, sites_path=".")
	frappe.connect()
	frappe.set_user("Administrator")
	company = frappe.db.get_single_value("Global Defaults", "default_company") or frappe.db.get_value(
		"Company", {}
	)
	log(f"company {company}")
	make_designations()
	make_holiday_list(company)
	employees = make_employees(company) or []
	if len(employees) >= 3:
		make_leave(company, employees)
		make_salary(company, employees)
	frappe.destroy()


if __name__ == "__main__":
	main(sys.argv[1])
