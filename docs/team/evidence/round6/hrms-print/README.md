# Round 6, item 1: HRMS print formats under the Midad Print Style and Letter Head

Run 2026-10-14 (14:00 to 14:40 UTC). Labels: VERIFIED = run, output in this folder, and looked at where it says "viewed"; COMPUTED = derived from files by a script; ASSUMED = not run.

## Setup (VERIFIED)

| | Version A | Version B |
|---|---|---|
| Frappe / ERPNext / HRMS | 16.32.0 / 16.33.0 / 16.20.1 | 16.52.0 / 16.50.0 / v16.50.0 |
| Site, bench | `midad.test`, `/home/frappe/frappe-bench` (run as `frappe` under `flock -o /tmp/ins-bench.lock`) | `hrms52.test`, `/home/frappe/newest-bench` (same wrapper) |
| wkhtmltopdf | 0.12.6.1 with patched Qt (official `0.12.6.1-3` jammy `.deb`, extracted to `/tmp/wkdl/x`, linked in `/usr/local/bin`) | same |
| Chrome | core's `headless_shell` (Skia/PDF m133) | same |
| Paper, languages | A4 only (Letter not rendered in this round), English and Arabic | same |
| Generator | per-call argument `pdf_generator=` (nothing site-wide changed, no Print Settings edit) | same |

Variants per document and format: `themed` (Print Style "Midad" + Letter Head "Midad"), `core` (Print Style "Standard", no letter head, theme installed), `noapp` (as `core`, and the app removed from the render process as in round 5 `print-clip/scripts/render.py`; used only where a defect needed isolating).

Scripts (copies in `scripts/`; the two that matter live in `tools/bench/`): `tools/bench/hrms_print_seed.py` (fictional records, test sites only, never a fixture), `tools/bench/hrms_print_render.py SITE OUTDIR VARIANT JOBS_FILE`, `scripts/run.sh BENCH script args` (wrapper), `scripts/montage.py` (en | ar side by side, 80 dpi), `scripts/pdf_post.sh` (`pdffonts.txt`, `pdfinfo.txt`). Job lists: `v16.32.0/jobs.txt`, `v16.52.0/jobs.txt` (`Doctype|Document|Print Format`).

The Print Style and Letter Head on each site were shipped with the app's own `ship.ship()` (the build had run after the install, so `after_install` had skipped them): `{'print_style': 'created', 'letter_head': 'created'}` on `midad.test`. After each SCSS change below: `tools/bench/b.sh build --app institutional_theme`, `tools/bench/b52.sh build --app institutional_theme`, then `ship.ship()` on both sites (`updated` on each).

## Formats covered and the criterion

Every standard HRMS print format on disk (`apps/hrms/**/print_format/*/*.json`, `standard: Yes`):

- 16.20.1 (8): Salary Slip Standard, Salary Slip Classic, Salary Slip Detailed, Salary Slip Compact, Salary Slip with Year to Date, Salary Slip based on Timesheet, Standard Appointment Letter, Job Offer.
- v16.50.0 (5): Salary Slip Classic, Salary Slip Detailed, Salary Slip Compact, Standard Appointment Letter, Job Offer. (v16.50.0 dropped Standard, Year to Date and Timesheet from the app; the Salary Slip then prints in core's auto-generated "Standard".)

Plus core's "Standard" for the HRMS doctypes that I decided matter. Criterion: a document HR hands to a person or files (Employee, Leave Application, Attendance, Expense Claim) and Salary Slip itself; excluded: setup doctypes (Salary Structure, Leave Type, Holiday List, Designation) and list-only doctypes, which nobody prints. Salary Slip "Standard" is core's auto layout and is covered on both versions.

Seed data (fictional names only; Arabic names on two employees, Arabic component names): the round-5 seed plus `hrms_print_seed.py`: a Salary Structure with five earnings and four deductions (two Arabic component names), a submitted Salary Slip on it for an Arabic-named employee (gross 18,500.00, deductions 2,905.00, net 15,595.00), an hourly Salary Slip from a submitted Timesheet (14.5 h), an Expense Claim (draft, two lines), a Job Applicant with a Job Offer, an Appointment Letter. All created in 9 `DOC` lines on both sites; no `BLOCK ... FAILED` after fixing the expense account lookup.

PostgreSQL workaround (HRMS, not patched): Salary Slip `compute_year_to_date` and `compute_month_to_date` (`ORDER BY creation` on an aggregate, `GroupingError`) are replaced by no-ops inside the seed process only (`neutralise_ytd()`). Consequence for the evidence: the "Year to date" figures of the slips are 0.00 or equal to the period amounts, as the slip stored them; they are not meaningful numbers. Same workaround as `tools/bench/hrms_seed.py`, same cause as `docs/team/evidence/round5/hrms52/README.md`.

## Matrix (themed; every cell is 4 PDFs: wkhtmltopdf and Chrome requested, en and ar)

| Format | Document | 16.32.0 / HRMS 16.20.1 | 16.52.0 / HRMS v16.50.0 |
|---|---|---|---|
| Salary Slip Standard (HRMS) | slip 00003 | OK, viewed wk and Chrome, en and ar | not on this version |
| Salary Slip Classic, Detailed, Compact | slip 00003 | **FAIL, 12 renders, no PDF** (defect 1) | OK, viewed (themed, after fix; core and noapp for Classic) |
| Salary Slip with Year to Date | slip 00003 | OK, viewed wk, en and ar; Chrome not opened | not on this version |
| Salary Slip based on Timesheet | hourly slip 00004 | OK, viewed wk, en and ar; Chrome not opened | not on this version |
| Standard (core) for Salary Slip | slip 00003 | OK, not opened | OK, viewed wk and Chrome, en and ar, themed and core |
| Standard Appointment Letter | HR-APP-LETTER-00001 | OK, viewed wk and Chrome, en and ar | OK, not opened (wkhtmltopdf en PDF 13942 bytes against 13916 on 16.32.0: similar, COMPUTED, not proof of identical output) |
| Job Offer | HR-OFF-2026-00001 | OK, viewed wk and Chrome | OK, viewed Chrome |
| Standard (core) for Employee | HR-EMP-00003 | OK, viewed wk | OK, not opened |
| Standard (core) for Leave Application | HR-LAP-2026-00001 (draft) | OK, viewed wk, watermark mid-page | OK, not opened |
| Standard (core) for Attendance | HR-ATT-2026-00001 | OK, viewed Chrome | OK, not opened |
| Standard (core) for Expense Claim | HR-EXP-2026-00001 (draft) | OK, viewed wk and Chrome before and after the watermark fix | OK, viewed wk |

Counts: 16.32.0 themed 40 PDFs and 12 failures (`v16.32.0/render-themed.log`); 16.52.0 themed 40 PDFs, 0 failures (`v16.52.0/render-themed.log`). `core` the same counts (`render-core.log`). Core PDFs were deleted to keep the folder small; the PNG montages are kept in `m/` (`<variant>__<format>__<generator>.png`, English on the left, Arabic on the right). `noapp`: 16.32.0 `render-noapp.log` (4 formats, the three builder formats fail the same way), 16.52.0 `render-noapp.log` (Salary Slip formats, 16 PDFs). Not every PNG was opened; the opened ones are named in the matrix. The rest follow from identical code paths and are COMPUTED only by size and by the render logs.

`pdffonts` (`v*/pdffonts.txt`, `pdfinfo.txt`): after the fixes every `themed__*.pdf` on both versions embeds only IBM Plex Sans and IBM Plex Sans Arabic (the loop that lists any other font printed nothing, VERIFIED). Before the `.ss-doc` fix the three builder salary slips embedded Liberation Sans, Liberation Sans Bold and DejaVu Sans (defect 4). The `core__` PNGs show Liberation Sans, as expected without the theme.

## Defects, cause, and what was changed

### 1. Salary Slip Classic, Detailed and Compact do not render on Frappe 16.32.0 (HRMS 16.20.1): core/HRMS, not the theme, not fixed

`TypeError: Can't compile non template nodes` from `frappe/templates/print_format/print_header.html:21-22` (`{{ frappe.render_template(layout.header, ...) }}`): the builder formats store `layout.header` as a dict, which this Frappe version's template renders as a string. Fails with the theme, with the theme's Print Style but no letter head, with Standard style, with the letter head and Standard style, with core's own "Company Letterhead", and with the app removed from the process (`noapp`, 12 failures, `v16.32.0/render-noapp.log`). Every `FAIL` line in the logs. HRMS 16.20.1 ships these three formats for a Frappe that cannot print them; on Frappe 16.52.0 they work. Nothing to fix in this app.

### 2. Chrome drops the document title that sits in the header (Salary Slip "Standard", `Sal Slip/...`, and the sub-title of Expense Claim, Leave Application, Employee): core, not fixed

With a letter head, Chrome's repeated header page cuts the print format's own header block (the title and the name): `chrome-header-title/combo.log`: the title is missing with the Midad style and letter head, with the Midad style and "Company Letterhead", with Standard style and "Company Letterhead" (core only), and present only without a letter head. `margin.py` shows the print format's top margin (0, 5, 10, 15 mm) does not change it. The cause is in core's header page (`utils/pdf_generator/browser.py` measures `.wrapper` height after core's own `.letter-head { margin-top: -12mm !important }`, `chrome_pdf_header_footer.html`); I did not find a theme-side change that restores it (an extra bottom padding on `.wrapper` with `!important` did not: `scripts/` experiment printed no title). wkhtmltopdf shows the title. Users who need the title in Chrome can place it in the letter head or the body.

### 3. Draft and Cancelled watermark in the wrong place (THEME): fixed

`[document-status="draft"]` was `position: fixed; top: 40%`. wkhtmltopdf resolves 40% against the height of the document, so on a short document (the Expense Claim) the box landed on the first rows, mostly hidden under the cells (`v16.32.0` PNG before the fix, seen in the session; not kept). Chrome printed it at the top over the title. This is also the round-5 observation (Quotation, "overlaps the totals").

Measured (`watermark-measure/wm2.png`, `wm3.png`, `scripts/wm2.py`, Chrome, Midad letter head, tops of 10 to 118 mm): in Chrome a fixed box is printed whole at 10 mm, cut at 20 mm, and absent from 30 mm down; wkhtmltopdf follows the length. So a single length cannot serve both: with only `top: 118mm` Chrome printed no mark at all (a regression seen and reverted in the session).

Fix (`institutional_theme/public/scss/ins_print.bundle.scss`): `top: 118mm` for wkhtmltopdf (old WebKit, which ignores `@supports`), `top: 10mm` inside `@supports (display: grid)` for Chrome. Result, viewed: wkhtmltopdf, Expense Claim and Leave Application (en and ar), box in the middle of the page and over empty space on a short document; Chrome (en and ar), whole box at the top over the letter head rule and the title, 12% opacity, readable (`v16.32.0/m/themed__expense-claim-standard__chrome.png`). Not fixed, and said plainly: in Chrome the watermark still overlaps the title on every document. Not tested: a multi-page draft (repeat on every page, both generators) and no-letter-head prints (the Chrome origin may differ). Cause of the Chrome limit not found.

### 4. Builder salary slips print in Liberation Sans and DejaVu Sans (THEME gap): fixed

HRMS sets `font-family: "Helvetica Neue", Helvetica, Arial` on `.ss-doc` in each format's CSS. Under the Plex letter head the body printed in Arial's stand-in and the Arabic in DejaVu Sans. Fix: `.ss-doc { font-family: inherit }` next to the existing `.page-break` rule (same remedy). `pdffonts` after: Plex only.

### 5. Arabic builder salary slips are not RTL-aware (HRMS), mirrored by THEME: fixed

The HRMS CSS hard-codes the left-to-right sides (components `text-align: left`, amounts `text-align: right`, accent bar `border-left`, separators `border-right`, gaps `padding-left`). In Arabic the table flips and the text does not, so each amount sat against its component name, headers merged ("المستحقاتكمية") and the net pay bar was on the wrong edge. The same page without the theme is identical (`core__salary-slip-salary-slip-classic__chrome.png`, `noapp` PNGs). Fix: mirrored physical sides for these classes under `[dir="rtl"] .print-format` in `ins_print.bundle.scss` (physical pairs are the file's documented pattern for wkhtmltopdf; these formats are Chrome-only). Viewed after: Classic, Detailed, Compact, Arabic, columns separated, labels at the right edge, amounts at the left edge, bar on the right. English unchanged (the rules are `[dir="rtl"]` only). Manifest rows added (`docs/DEPENDENCY_MANIFEST.md`). Untested: HRMS 16.20.1 on Frappe 16.32.0 (the formats do not render there, defect 1).

### 6. Core's Salary Slip "Standard" is wider than the page on v16.50.0: core/HRMS, not the theme

Two six-column tables side by side in two half-width columns. Without the theme, wkhtmltopdf clips the right table (`core__salary-slip-standard__wkhtmltopdf.png`) and Chrome clips it too; with the theme wkhtmltopdf fits both tables but the first table's last header ("Tax on additional salary") runs into the second table's "Sr" column, and Chrome clips the right table at the page edge as without the theme. The theme does not cause the overflow and did not change the Chrome result; under wkhtmltopdf it trades clipping for header overlap. Not fixed: the content does not fit in half a page. Recommendation to users: print Salary Slip Classic, Detailed or Compact (they fit and are now Plex and RTL-correct).

### 7. Observations, not defects of the theme

- wkhtmltopdf requested for Classic, Detailed, Compact on v16.52.0 returns Chrome output: the formats pin `pdf_generator = chrome` (round-5 finding 1). VERIFIED here by file size: wkhtmltopdf and Chrome PDFs of the same slip are byte-for-byte the same size (119327 en, 184027 ar).
- Chrome, builder formats: the Midad letter head rule is about 3.5 mm wider on the right than the format's own content (letter head 47 to 614 px at 80 dpi, content to 603). Core's body page is scaled slightly; any letter head shows it. Not changed.
- Standard Appointment Letter prints without the letter head under both generators (the HRMS template does not output `letter_head`; the Job Offer format does). The Plex body and the format's own heading are fine.
- Arabic print of English-only values (component names, the "In Words" line) shows the leading full stop at the left end of the English run: correct for an RTL paragraph, and the same without the theme. Salary Component names were not translated in the seed.
- Print Style size: the built `ins_print.bundle.css` is now 12.4 KB raw (was about 10), 2.2 KB gzipped; budget 24 KB (`docs/audits/budgets.txt`). It is sent in every desk boot.

## Not verified

- Letter paper (A4 only).
- Multi-page documents (long expense claims, slips that break across pages), and the repeat of the watermark on page 2.
- Prints without a letter head with the Midad Print Style (the watermark position for Chrome).
- Every PNG; see the matrix for which were opened.
- HRMS 16.20.1 Classic, Detailed, Compact (cannot render, defect 1).
- Emblem and letter head were not changed this round.
- The Salary Slip "Year to date" values (PostgreSQL workaround).
- Actual photocopy of the prints (black and white): not done.
