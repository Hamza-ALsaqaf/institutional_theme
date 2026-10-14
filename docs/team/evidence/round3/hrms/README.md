# HRMS v16.20.1 on the test site (round 3, item 2)

Script: `tools/bench/hrms.sh` (steps `get install build restart seed verify`), helpers `tools/bench/hrms_install.py`, `tools/bench/hrms_seed.py`, `tools/bench/hrms_check.mjs`.
Run: `sudo env "PATH=$PATH" PW_NODE_PATH=/opt/pw-node/node_modules flock -o /tmp/ins-bench.lock env -u UV_CACHE_DIR tools/bench/hrms.sh`.
Every command with exit code and duration: `commands.tsv` (the first `install` row, exit 1, is the stock `bench install-app hrms`; see below).

## Results

- VERIFIED `get.log`, `get_describe.log`: `bench get-app https://github.com/frappe/hrms --branch v16.20.1 --skip-assets`, exit 0, 44 s; `git describe --tags` prints `v16.20.1`. `UV_CACHE_DIR` is unset by `as_bench`, so the permission error of the first attempt did not recur.
- VERIFIED `list_apps.log`: `frappe 16.32.0`, `erpnext 16.33.0`, `institutional_theme 0.1.0`, `hrms 16.20.1`.
- VERIFIED `build.log`: `bench build --app hrms`, exit 0, 20 s. `restart.log`: web restarted. `ping.log`: `pong`.
- VERIFIED `seed.log`: fictional records created, and a second run created nothing more (counts 5 / 2 / 2 / 3 unchanged). `check.log`: a logged-in browser opens `/app/employee` (redirects to `/desk/employee?status=Active`), Leave Application and Salary Slip lists, one form of each, and the Leaves and Payroll workspaces; 8 of 8 PASS.

## Records created (URLs relative to the site)

```
/desk/employee/HR-EMP-00001   Layla Hamdan        /desk/employee/HR-EMP-00003   سارة المنصور   (Arabic name)
/desk/employee/HR-EMP-00002   Omar Qasim          /desk/employee/HR-EMP-00004   خالد الرفاعي   (Arabic name)
/desk/employee/HR-EMP-00005   Nadia Farouk
/desk/leave-application/HR-LAP-2026-00001   Open (draft), Casual Leave, employee 1
/desk/leave-application/HR-LAP-2026-00002   Approved (submitted), employee 3
/desk/salary-structure/Standard%20Monthly
/desk/salary-slip/Sal%20Slip%2FHR-EMP-00001%2F00001   draft
/desk/salary-slip/Sal%20Slip%2FHR-EMP-00002%2F00001   draft
```

Also created: designations Analyst, Accountant, Coordinator; Holiday List "Test Institution Weekend 2026" (Friday off) and its company assignment; Leave Allocations (Casual Leave, 12 days, employees 1 to 3); Salary Components Basic, Housing, Social Insurance; Salary Structure Assignments for employees 1 and 2. Every employee, institution and amount is invented.

## HRMS v16.20.1 defects on PostgreSQL (the bench is PostgreSQL; not theme issues; HRMS on disk is untouched)

1. `bench install-app hrms` fails (exit 1) in the post-install patch `hrms/patches/post_install/update_employee_advance_status.py`: `psycopg2.errors.DatatypeMismatch: argument of AND must be type boolean, not type numeric` (`WHERE docstatus = 1 AND return_amount AND ...`). `hrms_install.py` replaces that one function in memory for the length of the install (it rewrites existing Employee Advance rows only; the script refuses when rows exist) and calls the stock installer with `force=True` because the failed attempt had already registered the app. The failed attempt also made `bench uninstall-app hrms` fail (`Value for Condition JSON cannot be a list`), which is why the recovery is a forced re-install.
2. Salary Slip `validate` calls `compute_year_to_date` and `compute_month_to_date` (`salary_slip.py` lines 2300 and 2323 in the clone), which query with `ORDER BY creation` on an aggregate: `psycopg2.errors.GroupingError`. The seed process neutralises both for its own run; the two slips therefore have zero year-to-date and month-to-date figures. Opening such a slip in the desk and saving it will hit the same error on this bench. On MariaDB neither occurs.
3. Leave approver is mandatory (HR Settings default) and a holiday list must cover the dates, so the seed sets `leave_approver = Administrator` and creates the holiday list.

## Notes for the css-engineer

- Headless Chromium needs `locale: "en-US"` (or another): core calls `new Intl.Locale(navigator.language)` at `frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:99`, which throws without one and leaves the desk blank. Without it every page of this bench looks empty.
- One page error remains on the HRMS routes, `Cannot convert undefined or null to object` (not yet attributed to core or theme).
- HRMS workspaces on this site: Leaves, Payroll, Expenses, Tenure, Shift & Attendance, Performance, Recruitment, HR Setup, Tax & Benefits. There is no workspace named `hr`.

## Not done

Salary slips are drafts (submitting needs a payment account and payroll accounts). Attendance, Expense Claim and Appraisal records were not created.
