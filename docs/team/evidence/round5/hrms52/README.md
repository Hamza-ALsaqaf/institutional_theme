# HRMS on Frappe v16.52.0 (round 5, item 4)

Run 2026-10-14 on the newest bench `/home/frappe/newest-bench` (Frappe v16.52.0, ERPNext v16.50.0, PostgreSQL), on a separate site `hrms52.test` with its own web server on port 8002. `midad52.test` (port 8001) was not touched: no HRMS on it, its server was not restarted, its default-site behaviour is unchanged. Label: VERIFIED = run and output in this folder.

## 1. Tag pinned and why (VERIFIED, read from a clone of the tag)

`git ls-remote --tags https://github.com/frappe/hrms 'v16*'`, highest last: `v16.20.0, v16.20.1, v16.49.0, v16.50.0` (HRMS has no v16.52.0 tag). The newest, **`v16.50.0`** (commit `7c03769`, `hrms/__init__.py` `__version__ = "16.50.0"`), is compatible:

- `pyproject.toml`: `[tool.bench.frappe-dependencies] frappe = ">=16.50.0,<17.0.0"`, `erpnext = ">=16.0.0,<17.0.0"`. Frappe v16.52.0 and ERPNext v16.50.0 satisfy both.
- `hrms/hooks.py:7`: `required_apps = ["frappe/erpnext"]`.

No step down was needed. Pinned in `tools/bench/env52_hrms.sh` (`HRMS_TAG=v16.50.0`, with this reasoning in its header). `get_describe.log`: `v16.50.0`. `list_apps.log`: `frappe 16.52.0`, `erpnext 16.50.0`, `institutional_theme 0.1.0`, `hrms 16.50.0`.

## 2. Install (all commands: `commands.tsv`, `setup/commands.tsv`)

Seconds include waiting for `/tmp/ins-bench.lock`, which another agent's `run-tests` held for several minutes at a time (that is why `set-config` took 221 s and `list-apps` 226 s).

```
sudo env "PATH=$PATH" HRMS_ENV=tools/bench/env52_hrms.sh tools/bench/hrms.sh site            # exit 0
sudo env "PATH=$PATH" HRMS_ENV=tools/bench/env52_hrms.sh tools/bench/hrms.sh erpnext wizard  # exit 0
sudo env "PATH=$PATH" HRMS_ENV=tools/bench/env52_hrms.sh tools/bench/hrms.sh theme get install build   # exit 0
sudo env "PATH=$PATH" HRMS_ENV=tools/bench/env52_hrms.sh tools/bench/hrms.sh web seed verify          # see below
```

| Step | Command (abridged) | Exit | s | Log |
|---|---|---|---|---|
| site_new | `bench new-site hrms52.test --db-type postgres ...` | 0 | 198 | site_new.log |
| site_config, site_host | `set-config developer_mode 1`, `host_name http://hrms52.test:8002` | 0, 0 | 221, 1 | |
| erpnext | `newest_site.sh erpnext` (`install-app erpnext`) | 0 | 307 | erpnext.log |
| wizard | `newest_site.sh wizard` (fictional data: Test Institution, SAR, Asia/Riyadh, FY 2026) | 0 | 265 | wizard.log (`true`) |
| theme | `newest_site.sh install` (`install-app institutional_theme`) | 0 | 220 | theme.log |
| get | `bench get-app https://github.com/frappe/hrms --branch v16.50.0 --skip-assets` (its post-install runs `yarn install` for the PWA and roster front ends) | 0 | 49 | get.log |
| install | `hrms_install.py hrms52.test` | 0 | 44 | install.log |
| build | `bench build --app hrms` (includes the two yarn front-end builds) | 0 | 36 | build.log |
| web | `newest_site.sh restart-web` (server for `hrms52.test` only) | 0 | 5 | web.log |
| seed | `hrms_seed.py hrms52.test` | 0 | 9 | seed.log |
| verify | `list-apps`, `ping` (`pong`), `hrms_check.mjs` | 0 | 226, 0, 17 | check.log |

The first `verify` run exited 1 (`check`, 32 s): `hrms_check.mjs` waited for `.btn-login`, which the Frappe 16.52 login page no longer has (it has a submit `button.es-button`). Fixed in `tools/bench/hrms_check.mjs` by submitting with Enter in the password field (works on both versions); the second run passed 8 of 8 (the routes are now workspace-prefixed: `/desk/hr-setup/employee`, `/desk/leaves/leave-application`, `/desk/payroll/salary-slip`).

Seed (`seed.log`): 5 employees (two with Arabic names), 2 leave applications, 1 salary structure, 2 salary slips (the `URL` lines of `seed.log`); no `BLOCK ... FAILED` line. All names invented.

### Workarounds (test bench only, nothing on disk edited)

- STILL NEEDED on v16.50.0: `hrms/patches/post_install/update_employee_advance_status.py` is byte-for-byte the same query. `stock_patch_check.log` (`tools/bench/hrms_stock_patch_check.py`, runs the unmodified patch and rolls back): `psycopg2.errors.DatatypeMismatch: argument of AND must be type boolean, not type numeric`. `hrms_install.py` replaces that one function in memory (it refused if Employee Advance rows existed; none) and `install.log` shows `update_employee_advance_status: no Employee Advance rows, nothing to update (skipped on PostgreSQL)`. The "installed but failed" recovery with `force=True` was not needed this time (a first attempt never failed because the workaround was applied from the start).
- Salary Slip `compute_year_to_date` / `compute_month_to_date` (`salary_slip.py:2296` and `:2320`, `frappe.get_list` with SUM and the default `ORDER BY creation`): same code as 16.20.1; the seed neutralises them for its own run (unchanged `hrms_seed.py`). Not re-proved separately on this tag; the seed succeeded with the same neutralisation. ASSUMED still necessary.
- New in 16.50.0 (not a workaround, a finding): `frappe.get_all(... fields=[{"SUM": ...}])` in `get_leaves_pending_approval_for_period` (`leave_application.py:1190`) fails on PostgreSQL, see "Defects not from the theme".
- Server: the web server of `midad52.test` is started with `--site midad52.test`, which makes Frappe ignore the Host header (`frappe/app.py` `init_request`: `_site or X-Frappe-Site-Name or host`). A second site therefore needs its own server and port (8002). `b52.sh` and `env52.sh` select `midad52.test` through `NEWEST_SITE`; they were not changed. `bench use` was not run (the bench has no `currentsite.txt`).

Side effects on the shared newest bench (disclosed): `hrms` is now in `apps.txt` and the bench virtualenv, and `sites/assets` holds the HRMS bundles. `midad52.test` does not have `hrms` in its `installed_apps`, so its hooks and tests do not load it.

## 3. Screens (VERIFIED, `screens/hrms_screens.json`, `screens.log`, `analysis.txt`)

Command (about 2.5 min): `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/browser/hrms_screens.mjs --base http://localhost:8002 --out docs/team/evidence/round5/hrms52/screens`. As a bare ES module it does not resolve `playwright-core` through `NODE_PATH` (the line in checklist C34 is wrong for ESM: `ERR_MODULE_NOT_FOUND`); I ran a copy from `/tmp/hrms-run/` next to a `node_modules` symlink to `/opt/pw-node/node_modules`. The script itself is the one in the repository, with the one selector change below.

Selector change in `tests/browser/hrms_screens.mjs` (backward compatible): the status pill check queried `.indicator-pill, .indicator`; on Frappe 16.52 status pills are `<span class="es-badge" data-theme="green">` (`.indicator-pill` count: 0), so the first run checked 0 pills. It now queries `.indicator-pill, .indicator, .es-badge`; 116 pills checked, minimum ratio 8.01.

| Combination (1366x768) | Records | Flagged |
|---|---|---|
| Arabic, Light | 21 | 0 |
| Arabic, Dark | 21 | 0 |
| English, Light | 21 | 0 |
| English, Dark | 21 | 0 |
| Total | 84 | **0** |

Per combination: Employee list and form, Leave Application list and form (plus the server-error dialog), Salary Slip list and form, workspaces Leaves and Payroll, Organizational Chart (default, selected, 390 px), comfortable and compact density. 4068 text elements checked for WCAG contrast (4.5, 3 for large): 0 below. Dark: 0 light surfaces of 900 px2 or more. 0 horizontal overflow. Sidebar on the inline-start side in every record (right in RTL), 0 wrong. PNGs: `screens/shots/` (84 files, 5.6 MB).

Same result as round 3 (0 of 84). HRMS org-chart cards in Dark: `.node-card` computes `rgb(29, 37, 47)`, not white, although `hierarchy_chart.scss` still has `background: white` (now at lines 2, 187, 329 in v16.50.0). Not counted, as in round 3: avatar initial (core palette), narrow org chart sidebar off-canvas.

### Flagged triage

No record was flagged, so there is no theme defect to report to the css-engineer. Items looked at anyway:

1. Page errors (not flagged by the script; recorded in `hrms_screens.json`). Attributed with stacks (`scripts/screens_stack.mjs`, three runs) and compared with the theme's bundles blocked (`scripts/errs.mjs`, `page_errors_theme_vs_none.log`): identical with and without the theme, so none is caused by it.
   - `NotAllowedError: play() failed` : browser autoplay policy (a core notification sound), headless only.
   - `TypeError: Cannot convert undefined or null to object` at `make_dashboard (leave_application.js:86)` `Object.keys`: HRMS client script, consequence of the server error below (`leave_details` is undefined).
   - `TypeError: Cannot read properties of undefined (reading '$link')` (x2) and `(reading 'parent_id')`: `hrms/dist/js/hierarchy-chart.bundle.js` `HierarchyChart.set_selected_node` / click handler, raised when the fixture's root nodes (no reporting line) are clicked. HRMS defect.
   - `NotFoundError: Failed to execute 'removeChild'` on the workspace Leaves, once in 4 runs of the `en-light` combination: stack is `frappe/dist/js/desk.bundle.js` `ResizeObserver.boundDrawFn` (a core chart redraw); intermittent, core. The theme's JS never calls `removeChild`.
2. Leave Application form opens an "Error in server" dialog in every combination (4 `leave-form-server-error-dialog` records, kept as evidence of the dialog's styling, 0 flagged). Cause on v16.50.0: `GET /api/method/hrms.hr.doctype.leave_application.leave_application.get_leave_details` returns 500, `psycopg2.errors.GroupingError: column "tabLeave Application.creation" must appear in the GROUP BY clause or be used in an aggregate function` (`leave_application.py:1034` calling `:1190`). PostgreSQL-only; HRMS/core, MariaDB unaffected. Same defect as 16.20.1.
3. `hrms_check.mjs` reports one page error on the HRMS routes (`Cannot convert undefined or null to object`), the same `make_dashboard` error.

## 4. Proposed checklist wording

Replace row C34 (the checklist is owned by the lead; not edited here):

> | C34 | HRMS desk screens (HRMS 16.20.1 on Frappe 16.32.0, HRMS 16.50.0 on Frappe 16.52.0) | Install: 16.32.0 `tools/bench/hrms.sh` (steps `get install build restart seed verify`, `docs/team/evidence/round3/hrms/README.md`); 16.52.0 `sudo env "PATH=$PATH" HRMS_ENV=tools/bench/env52_hrms.sh tools/bench/hrms.sh site erpnext wizard theme get install build web seed verify` (site `hrms52.test`, port 8002, tag pinned in `env52_hrms.sh`; the script takes the bench lock itself; `docs/team/evidence/round5/hrms52/README.md`). Run: `cd tests/browser && npm ci`, then `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node hrms_screens.mjs --base http://localhost:8000` (16.32.0) or `--base http://localhost:8002 --out docs/team/evidence/round5/hrms52/screens` (16.52.0). A bare `NODE_PATH` does not work for an ES module: playwright-core must be in a `node_modules` above the script. Headless Chromium needs a locale such as `en-US` (`alt_keyboard_shortcuts.js:99`) | Exit 0 and 0 flagged of 84 records in `hrms_screens.json` on both versions (16.32.0: `round3/hrms-screens/README.md`; 16.52.0, HRMS v16.50.0: `round5/hrms52/README.md`, run of 2026-10-14, VERIFIED; the pill check covers `.es-badge` on 16.52). Not counted, by design: the avatar initial (core palette, `div.avatar-frame`) and the org chart in the narrow layout (sidebar off-canvas). NOT VERIFIED: selected and expanded org-chart states with a reporting hierarchy, feedback and appraisal summary, circular progress, salary slip with earnings, keyboard focus on HRMS pages. Known HRMS/core defects on PostgreSQL (not theme issues): `get_leave_details` GroupingError (Leave Application form dialog), Salary Slip year-to-date, post-install patch `update_employee_advance_status`; HRMS org-chart `$link` / `parent_id` errors on root nodes. |

## Not done / not verified

- HRMS was not run on MariaDB (the bench is PostgreSQL only): the PostgreSQL defects are assumed absent there, as stated by round 3, not tested.
- Salary slips are drafts; no Attendance, Expense Claim, Appraisal, reporting hierarchy: org-chart edges, `.node-card.active`, feedback summary and circular progress not rendered. Axe scan and keyboard focus on HRMS pages not run.
- Not re-run on 16.32.0 after the two script edits (`hrms.sh` defaults, `hrms_check.mjs` Enter login, `hrms_screens.mjs` `.es-badge`); the default values of `hrms.sh` are unchanged and `bash -n` passes, but the 16.32.0 site `midad.test` was not touched.
