# Upgrade and QA checklist

Generated from: `CLAUDE.md` (verified target), `.github/workflows/ci.yml` (unit and audit commands), `institutional_theme/midad/build.py` (`--check`), `institutional_theme/audits/__main__.py` (`--core-css`, `--write-core-snapshot`, `--strict`), `tests/browser/*.mjs` (usage headers), `tools/bench/b.sh`, `tools/bench/gate_install_uninstall.sh`, `tools/bench/README.md`, `docs/team/evidence/phase3/screens/` (screen set), `docs/BRIEF.md` (P0 list). Round 2 additions (rows B7, B8, C10 to C27, E row "Portal and web form pages"): `docs/team/evidence/round2/{css,css2,print-web,print-web2,backend,backend2}/evidence.md`, and `docs/DEPENDENCY_MANIFEST.md` sections 2d to 2g and 6. Fix round 1 additions (rows C28, C29): `docs/team/evidence/round2/fix1-backend/` and `institutional_theme/public/js/shell/field_errors.js`. Wave 5 additions (rows C30 to C33): `docs/team/evidence/round2/w5-css/` and `w5-backend/`, `docs/DEPENDENCY_MANIFEST.md` section 2h, and `institutional_theme/public/scss/desk/_list.scss`.

Labels: VERIFIED (the command exists in this repo and its usage was read), UNVERIFIED (not run in this document; check it on the bench before relying on it).

Run every command from the repository root `institutional_theme/` unless a line says otherwise. Bench commands run as the bench user (see `tools/bench/README.md`).

## A. Before the upgrade

| # | Step | Command or action | Pass when |
|---|---|---|---|
| A1 | Record the target | Compare the new Frappe, ERPNext and HRMS tags with the verified target: Frappe 16.32.0, ERPNext 16.33.0, HRMS 16.20.1 | Tags are known. If they differ, re-read `docs/research/frappe-16.32-findings.md` sections 2 and 5 and `docs/DEPENDENCY_MANIFEST.md` before going on |
| A2 | Keep a restore point | Take the site backup your bench provides (UNVERIFIED for this repo: no backup command is in the repo) | Backup exists |
| A3 | Record the current gate state | `python -m institutional_theme.midad.build --check` | Exit 0 |

## B. After the upgrade: repository checks (no bench needed)

| # | Step | Command | Pass when |
|---|---|---|---|
| B1 | Colour package and emitter unit tests | `python -m unittest discover -s institutional_theme/midad/tests -t .` | All OK (the CI job runs this) |
| B2 | Audit unit tests | `python -m unittest discover -s institutional_theme/audits/tests -t .` | All OK |
| B3 | Generated files are current | `python -m institutional_theme.midad.build --check` | Exit 0. If it fails, the generated file is stale; regenerate it from `design/tokens.json` with the build, do not edit it by hand |
| B4 | Refresh the core variable snapshot | With the upgraded compiled core stylesheets at paths `<CORE_CSS...>` (UNVERIFIED: the path of the compiled desk CSS on the upgraded bench is not recorded in the repo): `python -m institutional_theme.audits --core-css <CORE_CSS...> --write-core-snapshot` | Snapshot `institutional_theme/audits/data/core_vars_frappe_16.32.0.json` is rewritten; review the diff, and rename the file to the new version if the version changed |
| B5 | Dead-token and contrast audits | `python -m institutional_theme.audits` (add `--strict` to fail on chart-series gaps) | Exit 0. The audit fails on any dead variable (declared by the theme, neither in core nor used by the theme) and on a shipped preset that fails a contrast pair. Reports are written to `docs/audits/` |
| B6 | Read the audit counts | Open `docs/audits/dead_tokens.txt` | "dead: 0"; the overridden count is the number you expect (377 at the Frappe 16.32.0 snapshot) |
| B7 | Budget audit against a built dist | `python -m institutional_theme.audits --dist <DIST_DIR>` (`<DIST_DIR>` is the built dist folder; with no build the audit prints "not built" and exits 0) | Exit 0. Limits: desk CSS 150 KB, web CSS 60 KB, fonts 350 KB WOFF2 per pairing; every `ins_*` bundle raw and gzip. Round 2 finding (backend2 evidence, item 3): `ins_web.bundle.css` measured 161 KB raw and 12.9 KB gzip (limits 60 KB and 12 KB), so this step fails until the bundle is cut or listed in `JUSTIFIED` in `institutional_theme/audits/budgets.py`. The desk limit is checked on the minified file; the unminified figure is NOT VERIFIED |
| B8 | Proof parity and stale-path test | `node tests/browser/proof_parity.mjs` (about 76 s; prerequisites and gate commands are in `docs/proof/README.md`) | "178 comparisons, 0 mismatches, 0 stale paths, 0 blocked requests" (round 2 css2 evidence, section 4). A proof with a wrong bundle hash exits 1 with `FAIL stale asset path`. Not run in Firefox or Safari; the proof is checked on Chromium only |

## C. After the upgrade: bench checks

Requires the bench built with the app installed on the test site. Commands run through `tools/bench/b.sh` (it takes the shared build lock).

| # | Step | Command | Pass when |
|---|---|---|---|
| C1 | Migrate | `tools/bench/b.sh migrate` | Completes. `after_migrate` runs without error (`institutional_theme.install.after_migrate`) |
| C2 | Build the app bundles | `tools/bench/b.sh build --app institutional_theme` | Completes. The asset manifests contain all 7 CSS keys and their `rtl_` keys (runtime evidence) |
| C3 | Restart the web process | `tools/bench/start_services.sh restart-web` | Web is up on port 8000 |
| C4 | Frappe test suite for the app | `tools/bench/b.sh run-tests --app institutional_theme` | All app tests pass. Record any failing test name; do not mark the run as passing with a known failure |
| C5 | Computed-style cascade against the compiled desk | `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/browser/cascade.mjs --bench <FRAPPE_BENCH_PATH>` (optional `--out DIR`) | Output shows `fail 0` (the last recorded run was pass 4256, fail 0) |
| C6 | Browser behaviour checks | `node tests/browser/first_paint.mjs`, `node tests/browser/appearance_keyboard.mjs`, `node tests/browser/actions.mjs` | Each prints PASS for every check. Run with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` as in C5 if the default browser path is absent |
| C7 | P0 screen captures | `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/browser/screens.mjs --inject` | 48 PNG files are written to `docs/team/evidence/phase3/screens/`. This overwrites the Phase 3 set: copy the old set first if you need it for comparison |
| C8 | Install, uninstall and reinstall gate | `tools/bench/gate_install_uninstall.sh [evidence-dir]` | Exit 0. The gate installs, uninstalls and reinstalls the app; the stock look after uninstall is compared with the "before" capture |
| C9 | Uninstall residue | Check the gate's `residue-after-uninstall.log` (in the evidence directory you passed) | No generated folder left under `sites/<site>/public/files/institutional_theme/` (`before_uninstall` removes it). Round 2 (backend2 item 5): `tools/bench/gate_state.py` `residue()` now fails on the Print Style "Midad", the Letter Head "Midad", the `ins_print_%` globals and Print Settings `print_style` still "Midad". The full gate (C8) was NOT RUN in round 2 with these checks; run it before relying on C9 for print |
| C10 | Print records shipped | `tools/bench/b.sh migrate`, then again | Print Style "Midad" and Letter Head "Midad" exist. The second migrate leaves their `modified` unchanged. An administrator-changed record is kept and logged, not overwritten. Note: `test_print_ship.py` deletes the real "Midad" records in `setUp` and `tearDown`; migrate again after running it. Evidence: `docs/team/evidence/round2/backend/evidence.md` item 6; `backend2` item 1b |
| C11 | Print PDFs under both generators | `wkhtmltopdf -V` (must print "with patched qt"). Then `frappe.get_print(..., style="Midad", letterhead="Midad", as_pdf=True)` for a fictional Quotation, `pdf_generator` set to `wkhtmltopdf` and then to `chrome` (clear `frappe.local.form_dict.pdf_generator` between calls), A4 and Letter, en and ar, Draft and Cancelled | Page size as set (`pdfinfo`). `pdffonts` lists embedded Plex faces. Ruled header, double rule above the grand total, watermark, letter head with the emblem at the line start (mirrored in ar). Repeat header and footer: header and footer repeat under wkhtmltopdf; under Chrome the letter head is no longer clipped (Letter size, Cancelled with repeat header and a 15 mm top margin were not re-run). ERPNext header colour and padding are core `!important` and cannot be changed. Delete the temporary records afterwards. Evidence: `print-web/evidence.md` "Generators"; `print-web2/evidence.md` section 2; `backend2` item 1b and 1c |
| C12 | Email bundle | In the bench Python shell: `frappe.get_hooks("email_css")` (the command form is not recorded in the repo) | The list contains `ins_email.bundle.css`. A rendered email (Premailer output) has no `var(`, and the header and footer are styled in en and ar. Not tested: Gmail, Outlook, Apple Mail. Evidence: `backend2` item 8; `print-web` item 5 |
| C13 | Letter Head | `tools/bench/b.sh migrate`; then open the Letter Head "Midad" in the desk | Created with `is_default` 0. Print Settings are not changed by the app. The administrator chooses the default. Renders in both generators (C11). A later save of the Letter Head in the desk counts as an administrator change and is kept on the next migrate. Evidence: `backend` decisions 1 and 4 |
| C14 | Environment ribbon and sidebar | Set `ins_environment` to `training` in `site_config.json` on the test site, open `/desk`, then restore the file and compare it with `cmp` | Ribbon at 0 to 24 px; page head at 24 px; sidebar header below the ribbon (32 px); document height equals the viewport; the sticky page head stays at 24 px after scrolling. Evidence: `css2/evidence.md` section 1 |
| C15 | Connection banner (offline) | In Institutional Theme Settings set `enable_connection_banner` to 1; restore it to 0 afterwards. Set the browser to offline on the desk | One `body > .ins-banner[data-ins-banner="offline"]`, first child, `role="status"`; a repeat adds none. Back online: "The connection is back.", removed after 4 s. Warning tone with a 4 px bar and the text label; the banner pushes the content down and does not overlap. Realtime drop: NOT VERIFIED against a live socket server. Evidence: `backend2` item 4a; `css2` section 2 |
| C16 | Idle warning | In Institutional Theme Settings set `enable_idle_warning` to 1 and `idle_warning_minutes` to 1; restore both afterwards. Stay idle for about 70 s | The warning is an `alertdialog` with focus on "Stay signed in". Typing does not dismiss it. The button refreshes the session and dismisses it, and focus returns. A failed refresh keeps it with "The session could not be refreshed. Try again." Real expiry (401) NOT TESTED. Evidence: `backend2` item 4b |
| C17 | Editors (Ace and Quill) | Client Script new form (`/desk/client-script/new`) in Dark and Light; open the shortcuts dialog by calling `frappe.ui.keys.show_keyboard_shortcut_dialog()` | Keyword text on the field: Dark rgb(150,203,255) at 11.1:1, Light rgb(0,88,149) at 7.4:1 (computed, `css2` section 3). "Ctrl+R" keeps its order in Arabic rows. Code stays left to right in Arabic. NOT VERIFIED: Ace in a Server Script form (`/desk/server-script/new` returned "Page not found" for the test user), fold widgets, autocomplete, Quill picker open, mention list |
| C18 | Gantt | `/desk/task/view/gantt?project=<PROJECT>` for a project with tasks, in Light and Dark, en and ar | Bars on screen in RTL. Chart canvas not white in Dark; bars rgb(23,30,40) in Dark. Evidence: `css/evidence.md` item 6 |
| C19 | Tree | `/desk/account/view/tree`, in Light and Dark, en and ar | Four combinations; indent; selected row (4 px radius); focus ring 2 px with 2 px offset. Evidence: `css/evidence.md` item 5 |
| C20 | Calendar Dark chips | Any calendar view with events (for example Event) in Dark | Chip surface raised, 4 px stripe in the text colour (text 14.52:1 on the chip). Per-event colours are not kept in Dark (by design; core resets the border, and the colour is written inline). Evidence: `css/evidence.md` item 2 |
| C21 | Masked field | Property Setter `mask=1` on a test field (Customer `tax_id` in the round 2 run), then remove it | One reason "Hidden for your role" (Arabic "مخفي لدورك"). The value is focusable (`role="textbox"`, `aria-readonly`) with the field name and the reason. Evidence: `backend` item 1; `backend2` item 2 |
| C22 | Appearance announcements (Arabic) | Appearance page in ar: change density, mode and colour preset; then force one save to fail | Success and failure messages in Arabic in a `role="status"` region. On failure the previous value is restored and focus returns to the restored radio. Evidence: `backend` item 2 |
| C23 | Error reference (403 and 500) | With `"monitor": 1` in `site_config.json` (restore it byte-identical afterwards), `/me` as Guest, and a temporary Web Page that raises an error | Footer reference equals the `X-Frappe-Request-Id` response header, en and ar. Evidence: `print-web2/evidence.md` section 1; `backend` item 4b |
| C24 | Web pages, round 2 | Web Page (en and ar), Visitor Request web form (new, invalid, focus, success), `/`, `/me`, `/orders`, `/quotations`, `/my-requests` as a Website User, navbar, footer, error page | Light only. Letter-spacing 0 on every Arabic text element. Every focus stop has a 2 px solid ring. Text contrast at least 4.5:1 except the `.text-muted` items in C25. Evidence: `print-web2/evidence.md` section 3 (`p2_checks`) |
| C25 | Muted text on web pages | Footer "ERPNext" link, "No ToDo found" and a breadcrumb span on the web list pages | At least 4.5:1. The website `.text-muted` rule (manifest section 4) gives 6.28:1 on the footer link (`print-web3/evidence.md`); the other two items were not re-measured |
| C26 | Font pairings | Desk and login page with the Noto pairing, then Tajawal, then back to IBM Plex (the original) | Exactly one `ins_fonts_*` link; computed `font-family` starts with the private family; the fonts load. One stale link (login still on Noto) was seen once in 6 runs and not reproduced in 40 more sequences. NOT VERIFIED as fixed. Evidence: `backend` item 3 |
| C27 | Forced colours | Forced colours emulation (DevTools) on the list, appearance and error screens, en Light and ar Dark | Checkbox visible; focus ring in a system colour; swatch dots keep their colour. Real Windows High Contrast: NOT VERIFIED. Evidence: `css/evidence.md` item 8 |
| C28 | Kept Letter Head after uninstall | Uninstall the app on a test site where the Letter Head "Midad" is linked to a document or was changed by an administrator. Then print that document in en and ar (`frappe.get_print(..., letterhead="Midad", as_pdf=True)`, pattern of C11) | The record is kept. The print succeeds with no "Context Error" (`www/printview.py` path). The emblem is absent, which is intended. The templates guard `ins_identity is defined` (`print/letter_head.html:6-7`, `print/letter_head_footer.html:4`). Evidence: `docs/team/evidence/round2/fix1-backend/uninstall-proof.log`, `kept-letterhead-en.pdf`, `kept-letterhead-ar.pdf`. The full gate C8 has not been re-run with this linked case |
| C29 | Invalid field announcement (`aria-invalid`) | Desk form in en and ar: leave a mandatory field empty, then enter an invalid value in a field; inspect the input in DevTools, then fix the value | The input has `aria-invalid="true"` while its `.frappe-control` wrapper has the class `has-error`, and the attribute is removed when the value is fixed. Source: `institutional_theme/public/js/shell/field_errors.js` (lines 1 to 26); core `base_input.js:277,286`. Screen-reader announcement: NOT VERIFIED |
| C30 | Accessible names of form inputs | UNVERIFIED (not run in this document): the recorded run is `docs/team/evidence/round2/w5-backend/labels-en.json` and `labels-ar.json`, made with the bench web up (C3). Re-run on the bench, then read `unnamedInAX` and `labelNotInAX` for each form | For customer, task and event (en and ar), `unnamedInAX` is 0 and `labelNotInAX` is empty. Last recorded run: customer 9 controls and task 11 controls with `unnamedInAX` 0; event 12 controls with `unnamedInAX` 0. Sales Invoice (3) and Item (2) report unnamed accessibility nodes; `unnamedDom` lists only grid row checkboxes, which keep core naming. Those two forms are not cleared by this row until the nodes are identified. Source: `public/js/shell/field_labels.js`, manifest section 2h |
| C31 | Reflow at 200% and 400% | UNVERIFIED (not run in this document): the recorded run is `docs/team/evidence/round2/w5-css/reflow.json` (`reflow.mjs`, bench web up). Read `over`, `docSW`, `vw` and `wide` for each run | `over` is false and `docSW` equals `vw` in every run, for en and ar, at viewport widths 640 px and 320 px as recorded, on home, workspace, list, form, report and dialog. Last recorded run: `over` false in 24 of 24 runs. `wide` lists elements past the edge in 12 of 24 runs (en 400% home; ar 200% on five screens; ar 400% on six screens). Element-level overflow is NOT CLEARED: the row does not pass until those elements are fixed or accepted in writing |
| C32 | Target size of the like action | UNVERIFIED (not run in this document): measure `span.like-action` in the desk list (`/desk/todo`) in DevTools, or run `docs/team/evidence/round2/w5-css/coarse.mjs` (its output is not in the repo) | The like element is at least 24 by 24 CSS px, and at least 44 by 44 px under `pointer: coarse` (the `--ins-target-min` values, manifest section 2h). Last recorded run: `target-before.json` shows 16 by 18 px (comfortable) and 16 by 17 px (compact) in en and ar. The after-fix size is NOT RECORDED: `target-after.json` has no like-action entry. Not a pass until measured |
| C33 | Reduced motion | UNVERIFIED (not run in this document): the recorded run is `docs/team/evidence/round2/w5-css/motion.json` (`motion.mjs`) | With `prefers-reduced-motion: reduce` on, `maxTransitionS` and `maxAnimationS` are 0.00001 s and `mm` is true, for en and ar. Last recorded run: both values 0.00001 s and `mm` true for en and ar. The Bootstrap modal rule is `public/scss/desk/_base.scss:101-104` (manifest section 2h). Not covered: the operating system setting itself and Firefox or Safari (not recorded) |

## D. Manual QA matrix: P0 desk screens

Screens are the six P0 screen types from `docs/BRIEF.md` that the screen capture covers: desktop (apps), workspace, list, form, report, dialog. Each cell is one capture (C7) plus a manual look at the same screen in the live desk.

Columns are language × mode × density. Tick a cell only after you looked at it in the live desk and the capture has no clipped text, no missing status shape, and no core-blue leak in Dark.

Generated from: the file names in `docs/team/evidence/phase3/screens/` (`<lang>-<mode>-<density>-<screen>.png`) and the screen list in `tests/browser/screens.mjs`.

| Screen | en Light Comfortable | en Light Compact | en Dark Comfortable | en Dark Compact | ar Light Comfortable | ar Light Compact | ar Dark Comfortable | ar Dark Compact |
|---|---|---|---|---|---|---|---|---|
| Desktop (apps) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Workspace | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| List | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Form | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Report | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Dialog | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

Totals: 6 screens × 8 combinations = 48 cells.

Check items in every cell (from the P0 list in `docs/BRIEF.md`): page head and breadcrumbs; status pill (colour, label and shape together); sidebar; primary and secondary buttons; for forms, every field state that the screen shows (default, focus, filled, read-only, mandatory-empty, invalid with message); for lists, row states and sticky first column; for reports, datatable header and totals; for dialogs, the freeze overlay and message box.

## E. Manual QA: P0 web pages

These pages are not in the density matrix (no density control on the login pages). The web evidence records Light tokens for `ins_web`.

| Page | en | ar | Notes |
|---|---|---|---|
| Login | [ ] | [ ] | Letter-spacing is 0 in Arabic; password reveal is a keyboard button |
| Two-factor (2FA) | [ ] | [ ] | `#twofactor_div` and the verify token field |
| Forgot password | [ ] | [ ] | Reset-link sentence and send button |
| Session expired | [ ] | [ ] | UNVERIFIED: no capture in the repo; which page shows the message was not checked in the source |
| Not found (404) and error (500) | [ ] | [ ] | The 500 page shows a reference and the time of error; the trace ID equals the Error Log `trace_id` (UNVERIFIED end to end: see `docs/team/evidence/phase3/web/evidence.md`) |
| Portal and web form pages (round 2; rows C23 to C25) | [ ] | [ ] | Light only. Web Page, Visitor Request form, `/me`, `/orders`, `/quotations`, `/my-requests`, navbar and footer. The `.text-muted` rule is in (C25). Standard core web forms return 417 in 16.32.0 (not this app) |

Dark mode on the web pages is not in the Phase 3 capture set; mark it UNVERIFIED if you test it.

## F. Sign-off

| Item | Result | Evidence path |
|---|---|---|
| Repository checks B1 to B6 | | |
| Bench checks C1 to C9 | | |
| Manual matrix D (48 cells) | | |
| Manual web checks E | | |
| Frappe, ERPNext and HRMS tags recorded (A1) | | |

Do not mark a row as passed on the strength of an earlier run. Each run's log goes in the evidence directory with its date.
