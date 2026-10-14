"""Fictional HR records for the HRMS print-format check (round 6). Test bench only; never an app fixture.

Run from the bench `sites` directory with the bench interpreter, after tools/bench/hrms_seed.py:
    python -I hrms_print_seed.py <site>

Adds to what hrms_seed.py created: a richer Salary Structure (five earnings, four deductions, Arabic component
names), one submitted Salary Slip on it, one hourly (timesheet) Salary Slip, an Expense Claim, a Job Applicant with
a Job Offer, and an Appointment Letter. Idempotent (look up, create when missing). A failing block is reported on its
own line (`BLOCK name FAILED`) and does not stop the others. Prints `DOC <doctype> <name>` for every record.

HRMS on PostgreSQL: Salary Slip compute_year_to_date / compute_month_to_date order an aggregate by "creation"
(GroupingError); they are neutralised in this process only, as in hrms_seed.py. Nothing on disk is changed.
"""

from __future__ import annotations

import sys
import traceback

import frappe
from frappe.utils import add_days, add_months, get_first_day, get_last_day, nowdate


def log(msg: str) -> None:
	print(msg, flush=True)


def block(name: str):
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


def doc_line(doctype: str, name: str) -> None:
	log(f"DOC {doctype}|{name}")


def neutralise_ytd() -> None:
	from hrms.payroll.doctype.salary_slip.salary_slip import SalarySlip

	SalarySlip.compute_year_to_date = lambda self: None
	SalarySlip.compute_month_to_date = lambda self: None


COMPONENTS = (
	("Basic", "B", "Earning", None),
	("Housing", "H", "Earning", None),
	("Print Transport", "PT", "Earning", "بدل نقل"),
	("Print Allowance", "PA", "Earning", "بدل طبيعة عمل"),
	("Print Overtime", "PO", "Earning", "عمل إضافي"),
	("Social Insurance", "SI", "Deduction", None),
	("Print Advance Recovery", "PAR", "Deduction", "خصم سلفة"),
	("Print Health Fund", "PHF", "Deduction", "صندوق الرعاية الصحية"),
	("Print Tax", "PTX", "Deduction", "ضريبة الدخل"),
)
STRUCTURE = "Midad Print Full"
HOURLY = "Midad Print Hourly"


@block("components")
def make_components() -> None:
	for name, abbr, kind, _ar in COMPONENTS:
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


@block("structure")
def make_structure(company: str, currency: str) -> None:
	def row(c, f):
		return {"salary_component": c, "amount_based_on_formula": 1, "formula": f}

	if not frappe.db.exists("Salary Structure", STRUCTURE):
		doc = frappe.get_doc(
			{
				"doctype": "Salary Structure",
				"name": STRUCTURE,
				"company": company,
				"currency": currency,
				"is_active": "Yes",
				"payroll_frequency": "Monthly",
				"earnings": [
					row("Basic", "base * 0.6"),
					row("Housing", "base * 0.25"),
					row("Print Transport", "base * 0.08"),
					row("Print Allowance", "base * 0.05"),
					row("Print Overtime", "base * 0.02"),
				],
				"deductions": [
					row("Social Insurance", "base * 0.09"),
					row("Print Advance Recovery", "500"),
					row("Print Health Fund", "base * 0.01"),
					row("Print Tax", "base * 0.03"),
				],
			}
		).insert()
		doc.submit()
	doc_line("Salary Structure", STRUCTURE)


def assign(emp: str, structure: str, company: str, currency: str, base: float) -> None:
	# A later assignment date wins; the earlier assignment from hrms_seed.py stays submitted.
	if not frappe.db.exists(
		"Salary Structure Assignment", {"employee": emp, "salary_structure": structure, "docstatus": 1}
	):
		frappe.get_doc(
			{
				"doctype": "Salary Structure Assignment",
				"employee": emp,
				"salary_structure": structure,
				"from_date": "2026-01-03",
				"company": company,
				"currency": currency,
				"base": base,
			}
		).insert().submit()


@block("full slip")
def make_full_slip(company: str, currency: str, emp: str) -> None:
	from hrms.payroll.doctype.salary_structure.salary_structure import make_salary_slip

	neutralise_ytd()
	assign(emp, STRUCTURE, company, currency, 18500)
	start = get_first_day(add_months(nowdate(), -1))
	found = frappe.db.get_value(
		"Salary Slip", {"employee": emp, "salary_structure": STRUCTURE, "start_date": start}
	)
	if found:
		doc_line("Salary Slip", found)
		return
	slip = make_salary_slip(STRUCTURE, employee=emp, posting_date=get_last_day(start))
	slip.start_date = start
	slip.end_date = get_last_day(start)
	slip.insert()
	slip.submit()
	doc_line("Salary Slip", slip.name)


@block("hourly slip")
def make_hourly_slip(company: str, currency: str, emp: str) -> None:
	from hrms.payroll.doctype.salary_structure.salary_structure import make_salary_slip

	neutralise_ytd()
	if not frappe.db.exists("Salary Structure", HOURLY):
		doc = frappe.get_doc(
			{
				"doctype": "Salary Structure",
				"name": HOURLY,
				"company": company,
				"currency": currency,
				"is_active": "Yes",
				"payroll_frequency": "Monthly",
				"salary_slip_based_on_timesheet": 1,
				"salary_component": "Basic",
				"hour_rate": 85,
				"deductions": [
					{
						"salary_component": "Social Insurance",
						"amount_based_on_formula": 1,
						"formula": "gross_pay * 0.09",
					}
				],
			}
		).insert()
		doc.submit()
	assign(emp, HOURLY, company, currency, 0)
	start = get_first_day(add_months(nowdate(), -2))
	found = frappe.db.get_value("Salary Slip", {"employee": emp, "salary_structure": HOURLY})
	if found:
		doc_line("Salary Slip", found)
		return
	if not frappe.db.exists("Activity Type", "Print Review Work"):
		frappe.get_doc({"doctype": "Activity Type", "activity_type": "Print Review Work"}).insert()
	ts = frappe.get_doc(
		{
			"doctype": "Timesheet",
			"employee": emp,
			"company": company,
			"time_logs": [
				{
					"activity_type": "Print Review Work",
					"from_time": f"{add_days(start, 3)} 08:00:00",
					"hours": 8,
					"to_time": f"{add_days(start, 3)} 16:00:00",
				},
				{
					"activity_type": "Print Review Work",
					"from_time": f"{add_days(start, 4)} 08:00:00",
					"hours": 6.5,
					"to_time": f"{add_days(start, 4)} 14:30:00",
				},
			],
		}
	).insert()
	ts.submit()
	slip = make_salary_slip(HOURLY, employee=emp, posting_date=get_last_day(start))
	slip.start_date = start
	slip.end_date = get_last_day(start)
	slip.salary_slip_based_on_timesheet = 1
	slip.insert()
	slip.submit()
	doc_line("Salary Slip", slip.name)


@block("expense claim")
def make_expense_claim(company: str, currency: str, emp: str) -> None:
	found = frappe.db.get_value("Expense Claim", {"employee": emp, "remark": "Fictional claim for print test"})
	if found:
		doc_line("Expense Claim", found)
		return
	if not frappe.db.exists("Expense Claim Type", "Print Travel"):
		doc = frappe.get_doc({"doctype": "Expense Claim Type", "expense_type": "Print Travel"})
		doc.append(
			"accounts",
			{
				"company": company,
				"default_account": frappe.db.get_value(
					"Account", {"company": company, "root_type": "Expense", "is_group": 0}
				),
			},
		)
		doc.insert()
	doc = frappe.get_doc(
		{
			"doctype": "Expense Claim",
			"naming_series": "HR-EXP-.YYYY.-",
			"employee": emp,
			"company": company,
			"currency": currency,
			"posting_date": nowdate(),
			"remark": "Fictional claim for print test",
			"expenses": [
				{
					"expense_type": "Print Travel",
					"expense_date": add_days(nowdate(), -3),
					"description": "Transport to the regional office",
					"amount": 420,
					"sanctioned_amount": 420,
				},
				{
					"expense_type": "Print Travel",
					"expense_date": add_days(nowdate(), -2),
					"description": "Lodging, two nights",
					"amount": 1300,
					"sanctioned_amount": 1300,
				},
			],
		}
	).insert()
	doc_line("Expense Claim", doc.name)


@block("job offer and appointment letter")
def make_offer_and_letter(company: str) -> None:
	for desig in ("Analyst",):
		if not frappe.db.exists("Designation", desig):
			frappe.get_doc({"doctype": "Designation", "designation_name": desig}).insert()
	applicant = frappe.db.get_value("Job Applicant", {"applicant_name": "Rana Jaber"})
	if not applicant:
		applicant = (
			frappe.get_doc(
				{
					"doctype": "Job Applicant",
					"applicant_name": "Rana Jaber",
					"email_id": "rana.jaber@example.test",
					"status": "Open",
				}
			)
			.insert()
			.name
		)
	offer = frappe.db.get_value("Job Offer", {"job_applicant": applicant})
	if not offer:
		offer = (
			frappe.get_doc(
				{
					"doctype": "Job Offer",
					"job_applicant": applicant,
					"applicant_name": "Rana Jaber",
					"offer_date": nowdate(),
					"designation": "Analyst",
					"company": company,
					"status": "Awaiting Response",
				}
			)
			.insert()
			.name
		)
	doc_line("Job Offer", offer)
	template = "Midad Print Template"
	if not frappe.db.exists("Appointment Letter Template", template):
		frappe.get_doc(
			{
				"doctype": "Appointment Letter Template",
				"template_name": template,
				"introduction": "Dear {{ applicant_name }}, we are pleased to confirm your appointment.",
				"closing_notes": "Please sign and return one copy.",
				"terms": [
					{"title": "Probation", "description": "The first three months are a probation period."},
					{"title": "Working hours", "description": "Forty hours a week, Sunday to Thursday."},
				],
			}
		).insert()
	letter = frappe.db.get_value("Appointment Letter", {"job_applicant": applicant})
	if not letter:
		letter = (
			frappe.get_doc(
				{
					"doctype": "Appointment Letter",
					"job_applicant": applicant,
					"applicant_name": "Rana Jaber",
					"appointment_date": nowdate(),
					"appointment_letter_template": template,
					"company": company,
					"introduction": "Dear Rana Jaber, we are pleased to confirm your appointment.",
					"closing_notes": "Please sign and return one copy.",
					"terms": [
						{"title": "Probation", "description": "The first three months are a probation period."},
						{"title": "Working hours", "description": "Forty hours a week, Sunday to Thursday."},
					],
				}
			)
			.insert()
			.name
		)
	doc_line("Appointment Letter", letter)


def main(site: str) -> None:
	frappe.init(site=site, sites_path=".")
	frappe.connect()
	frappe.set_user("Administrator")
	company = frappe.db.get_single_value("Global Defaults", "default_company") or frappe.db.get_value(
		"Company", {}
	)
	currency = frappe.db.get_value("Company", company, "default_currency")
	emps = frappe.get_all("Employee", filters={"company": company}, pluck="name", order_by="name")
	log(f"company {company} currency {currency} employees {emps}")
	make_components()
	make_structure(company, currency)
	make_full_slip(company, currency, emps[2])
	make_hourly_slip(company, currency, emps[3])
	make_expense_claim(company, currency, emps[1])
	make_offer_and_letter(company)
	for dt in ("Employee", "Leave Application", "Attendance"):
		n = frappe.get_all(dt, pluck="name", limit=1, order_by="name")
		if n:
			doc_line(dt, n[0])
	frappe.destroy()


if __name__ == "__main__":
	main(sys.argv[1])
