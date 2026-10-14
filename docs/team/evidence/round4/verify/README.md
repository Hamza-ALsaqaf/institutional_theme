# Round 4 verification, both Frappe versions (backend-engineer)

Run on 2026-10-14 between 06:13 and 07:12 UTC, in this container (4 cores), against the working copy of `build/midad-v1` at `84318a4` plus
the uncommitted SCSS of the css-engineer (see "Caveat on the stylesheets"). Labels: VERIFIED means the command was run and its output is in
this folder. Every command is in the `*.log` file of its folder, with its exit code and seconds on the last line (`*.log.cmds` has the same
as a tab-separated line).

| | 16.32.0 (midad.test, port 8000, ERPNext 16.33.0) | v16.52.0 (midad52.test, port 8001, ERPNext v16.50.0) |
|---|---|---|
| Evidence folder | `16.32.0/` | `v16.52.0/` |

## Result table (check x version)

| # | Check | 16.32.0 | v16.52.0 | Evidence |
|---|---|---|---|---|
| 1 | `bench run-tests --app institutional_theme` | PASS: 148 integration tests OK (145 s) then 255 unit tests OK, exit 0, 152 s | PASS: 148 OK (167 s), 255 unit OK, exit 0, 174 s | `16.32.0/run-tests.log`, `v16.52.0/run-tests.log` |
| 1b | Unit suites (`midad` 145, `audits` 110), under the bench Python inside check 1 and under CI's Python in check 5 | PASS | PASS | same, `ci/local_ci.log` |
| 2a | axe, P0 screens, Light and Dark, en and ar, themed and theme-blocked (24 screens, 21 in Dark) | PASS: 256 nodes, **0 caused by the theme** (baseline round 3: 272, 0) | PASS: 348 nodes, **0 caused by the theme**, every node also fires with the theme blocked (core markup) | `16.32.0/axe/summary.md`, `v16.52.0/axe/summary.md`, `*/axe-run.log` |
| 2b | Attribute checks `a11y_attrs.mjs` | PASS: 100 of 100 | **FAIL: 96 of 99 pass; 3 fail, all "core string with no Arabic translation"** (finding F2) | `16.32.0/a11y-attrs.log`, `v16.52.0/a11y-attrs.log`, `*/a11y-attrs/results.md` |
| 2c | Child-table checkbox names `grid_names.mjs` | PASS: 48 PASS, 0 FAIL | PASS: 48 PASS, 0 FAIL | `*/grid-names.log` |
| 3a | Print Style "Midad" and Letter Head "Midad", A4, wkhtmltopdf 0.12.6.1 (patched Qt) and Chrome, en and ar, default print format of Quotation | PASS: 4 PDFs, Plex embedded, Midad rules applied | **PASS with finding F1**: 4 PDFs, but the default format is ERPNext's "Quotation Modern with Images", which has no `.print-format` root, so the Print Style's rules and fonts do not apply | `*/print/`, `*/print-check.log` |
| 3b | Same with core's "Standard" print format | PASS: 4 PDFs, Plex embedded; **FAIL finding F3** (wide table overflows) | PASS: 4 PDFs, Plex embedded; **FAIL finding F3** | `*/print/*-standard.pdf`, `*/print-overflow/` |
| 3c | Email bundle render (real `email_css` hook, en and ar) | PASS: brand rule inlined, no `var()`, `unicode-bidi: plaintext` present | PASS: identical result | `*/print/email-*.html`, `*/print/email-*.png`, `*/print/results.json` |
| 4 | Install and uninstall gate with residue check | PASS: 18 commands, all exit 0; `RESIDUE: none`; asset lists before = after uninstall; login pixels before = after uninstall (0 px); todo pixels 201 px differ (relative time text, F5); kept Letter Head printed to HTML and PDF (wkhtmltopdf) in en and ar | PASS: 18 commands, all exit 0; `RESIDUE: none`; asset lists identical; login and todo pixels before = after uninstall (0 px); kept Letter Head printed to HTML and PDF in en and ar | `16.32.0/gate/`, `v16.52.0/gate/` (run logs `gate-run.log`) |
| 4b | Throw-away site residue check (`uninstall_residue.sh throwaway`) | PASS: 10 steps exit 0, `RESIDUE: none`, table diff `RESIDUE: none`, site dropped | PASS: same, run on the newest bench | `16.32.0/uninstall-residue/`, `v16.52.0/uninstall-residue/` |
| 5a | ruff 0.16.8 check and format | PASS (exit 0) | (version independent) | `ci/local_ci.log` |
| 5b | `midad.build --check` | PASS (exit 0) | (version independent) | `ci/local_ci.log` |
| 5c | `python -m institutional_theme.audits` as CI runs it | PASS: `audits: passed` | (version independent) | `ci/local_ci.log` |
| 5d | `audits` against each bench's built dist (budgets) | PASS: `budgets: 0 problem(s)`, exit 0 | PASS: same | `audits/audits-bench-*-dist-snapshots.log`, `audits/budgets-*.log` |
| 5e | `audits --core-css 16.32.0=... --core-css 16.52.0=...` (live core CSS of both benches, Gantt included) | PASS: categories equal the committed snapshots (16.32.0: 268 declared and read, 131 declared only, 0 read only, 84 dead in this version; 16.52.0: 430, 33, 6, 15; combined 0 dead) | PASS: same | `audits/audits-bench-*-dist-livecore.log` |

Verdict by the table: checks 2b (3 Arabic labels), 3a (v16.52.0 default format) and 3b (wide table) are open findings, none of them in a
file I own. Everything else passes on both versions.

## Findings

**F1. v16.52.0 + ERPNext v16.50.0: the default print format of Quotation is not styled by the Print Style (open, not mine).** ERPNext 16.50
ships `Quotation Modern with Images` (and the other Modern formats) and sets it as the Quotation default through a Property Setter. Its
HTML has `<body class="print-format-doc">` and no `.print-format` element, plus its own `html, body { font-family: Inter }` and an `@import`
of Google Fonts. Every rule of the shipped Print Style is scoped to `.print-format`, so none applies: the PDFs embed Inter and DejaVu Sans
(Arabic falls back to DejaVu), the ruled heading and the watermark are missing and the Letter Head shows its name unstyled
(`v16.52.0/print/pdffonts.txt`, `v16.52.0/print/png/*-A4-*.png` against `*-standard.png`). On 16.32.0 and ERPNext 16.33.0 the default is a
custom format that does have `.print-format`, and Plex is embedded. The Letter Head itself, the page size, RTL mirroring and the
watermark word are present on both. Fix would be a second root (`body.print-format-doc`) in `ins_print.bundle.scss` and in the family rule
of `print/ship.py:121`; the SCSS is the print-web-engineer's. The lead decides whether the theme should cover ERPNext's new formats at all.

**F2. v16.52.0 Arabic: three accessible names are English (open, scribe's file).** On 16.32.0 the shell script names these elements and
`ar.csv` translates them. On v16.52.0 core names them itself, through `__()`, and has no Arabic string for them, so the theme's file is the
place: `Breadcrumb` (`nav.es-breadcrumbs`, `ui/components/breadcrumbs.js:85`), `Sidebar Menu` (`ui/sidebar/sidebar_header.html:8`) and
`Add attachment` (`form/templates/form_sidebar.html:128`, `form/controls/attachment_gallery.js:205`; the old string was `Add Attachment`).
Also `Collapse` in the row editor reads `انهيار` (core's word) because core calls `__("Collapse")` without the context `Row editor` that the
theme's entry carries. English names pass. The elements are named in English, not unnamed: axe finds nothing on them
(`v16.52.0/a11y-probe.json`, `v16.52.0/a11y-attrs/results.md`). Whether an `ar.csv` entry reaches core's own `__()` call was not tested.

**F3. Both versions: the Print Style makes wide tables overflow (open, not mine, found by comparing with core's rendering).** In
`ins_print.bundle.scss:154-161` the figures rule sets `white-space: nowrap` on `th.text-right` as well as `td.text-right`. The standard
Quotation print format has eleven columns, so the header cells ("Distributed Discount Amount", "Rate of Stock UOM") stop wrapping and the
table is wider than the page: wkhtmltopdf clips the Amount column at the right edge and Chrome in Arabic clips the leftmost columns
(`16.32.0/print/png/*-standard.png` against `*-standard-core.png`, which is core's Standard style without Letter Head and fits). I rendered
the same document with the shipped CSS plus one override, `.print-format th.text-right { white-space: normal; }`: the whole table fits in
Chrome (ar) and wkhtmltopdf (en) on both versions (`*/print-overflow/png`, script `scripts/print_overflow_experiment.py`; temporary
Print Styles and records deleted again, `LEFT styles 0`). So dropping `th.text-right` from the nowrap group is the fix; the selector list is
at `ins_print.bundle.scss:154`. Not caused by the new Frappe version; probably present since round 2 (not checked against the round-2
PDFs).

**F4. Intermittent timeout in the gate's screenshot step (unexplained).** Twice a `capture.mjs` run waited 60 s for `.page-head` of
`/app/todo` and failed: 16.32.0 `capture-before` (attempt 2) and v16.52.0 `capture-after-uninstall` (attempt 1), both directly after an
uninstall, at times when other agents were running browser sessions on this container (not confirmed for each failure). The rerun
passed in 8 s each time. UNVERIFIED hypothesis: load from those sessions. I added a diagnostic to `tools/bench/capture.mjs` (screenshot `<label>-todo-FAILED.png`, page text, failed requests)
so a repeat can be told apart from a broken desk. All attempts are kept: `16.32.0/gate-run-attempt{1,2,3}*.log`,
`16.32.0/gate-attempt*/`, `v16.52.0/gate-run-attempt1*.log`, `v16.52.0/gate-attempt1*/`. Attempt 1 on 16.32.0 failed because I had
broken `/opt/pw-node/node_modules` (see "Environment changes"); attempt 3 was complete but could not print to PDF because wkhtmltopdf was
not on the bench user's PATH (`kept-print.log` says "pdf NOT VERIFIED"), so the final 16.32.0 gate is the fourth run.

**F5. Todo screenshot after uninstall differs by 191 to 201 px on 16.32.0.** The box is the relative time of the three seeded ToDo rows
("55 m" before, "56 m" after); I cropped both screenshots to confirm. Not a style difference. Round 3 recorded 5 px for the same reason,
presumably. On v16.52.0 the same comparison gave 0 px (the rows age less than a minute between captures).

**F6. `ins_web.bundle.css` is at 59.9 of 60.0 KB raw** (budget from the brief), both directions; `ins_desk` 140.7 of 150 KB after the
css-engineer's last build. One more rule in the web bundle fails the budget audit (`audits/budgets-*.log`).

## Axe on v16.52.0: classification

Each node was scanned twice, with the theme and with every `/assets/institutional_theme/` request blocked (`tests/browser/axe.mjs`
classifies by rule, selector, screen, language and mode). **Theme-caused: 0.** Core markup, by rule (identical sets with the theme blocked):

| Rule (impact) | Nodes | Where | Cause in core |
|---|---|---|---|
| aria-allowed-attr (critical) | 124 | `.nav-item.dropdown-navbar-user` on every desk screen, desktop icons | `aria-haspopup`/`aria-expanded` on a `div` |
| listitem (serious) | 200 | search results | `awesomplete` `<li>` inside a `<ul role="listbox">` |
| aria-required-attr, aria-valid-attr-value (critical) | 8 and 8 | `#navbar-search`, `input[data-target="Role"]` | attributes on core's search input and Link control (the same rules fire on the same selectors on 16.32.0) |
| aria-required-children (critical) | 4 | `#awesomplete_list_3` | `role="listbox"` whose children are plain `<li>` |
| aria-command-name (serious) | 4 | filter popover `.remove-filter` | `role="button"` without a name |

For comparison 16.32.0 (256 nodes): listitem 204, aria-allowed-attr 20, aria-required-children 12, aria-required-attr 8,
aria-valid-attr-value 8, document-title 4. The theme *removes* 973 nodes on v16.52.0 and 1094 on 16.32.0 (button-name, label, colour
contrast, link-name and others) that exist with the theme blocked. Theme colours worse than core: 0 on both. v16.52.0 has no
`document-title` nodes and the `aria-allowed-attr` count is higher because the new shell adds the attributes to more elements. Axe is
automated only and does not establish WCAG conformance.

Script changes made to scan v16.52.0 (they keep 16.32.0 results; all are in `tests/browser/`):
- login clicked `.btn-login`, which v16.52.0's rewritten login page does not have: now presses Enter in `#login_password` (`axe.mjs`,
  `a11y_attrs.mjs`, `axe_avatars.mjs`);
- `notifications` (`.sidebar-panel-notifications` instead of `.dropdown-notifications`) and `toast` (`.es-toast-container .es-toast`
  instead of `#alert-container .alert`) failed on v16.52.0 in the first full run: the selectors accept both markups now, and the two
  screens were re-run on v16.52.0 (`v16.52.0/axe-rerun-notifications-toast.log`, 0 violations themed) and merged into the main JSON
  (`mergedFrom` in each file) before `--summarize`. The first run's failures are in `v16.52.0/axe-run.log`;
- `a11y_attrs.mjs`: nine checks look for markup that exists only on 16.32.0 (`.navbar-breadcrumbs > li > a`, `.header-logo > img`,
  the exact English labels the 16.32.0 shell script writes). When `nav.es-breadcrumbs` is present it now asks for a name given by core and,
  in Arabic, a name that is not plain ASCII (the three failures of F2). On 16.32.0 markup every check is as before (100 of 100). The probe
  that shows the 16.52.0 markup is `scripts/probe_a11y52.mjs`, output `v16.52.0/a11y-probe.json`.

## Caveat on the stylesheets

My axe, print and gate runs used the `ins_desk` / `ins_web` build that was current when each ran. The css-engineer rebuilt after my axe
scan (`ins_desk.bundle.WRBFSDWU.css` at 07:03; axe saw `FUV47A7O` and `NHPPQMLS`) and had uncommitted changes in `_actions.scss`, `_base.scss`,
`_dock.scss`, `_gantt.scss` and `_status.scss`. The axe result above therefore does not cover those edits. Re-run after the last build:
`docs/team/evidence/round4/verify/scripts/axe_both.sh <dir>` (both sites at once, about 15 minutes), then
`node tests/browser/axe.mjs --summarize --out=<dir>/<version>/axe`. The audits and budgets in rows 5a to 5e were run at 06:18 to 06:19 and
the budgets again at 07:08 (dist `ins_desk` 140.7 KB, `ins_web` 59.9 KB, `ins_shell` 20.8 KB).

## Environment changes (outside the repository)

- I ran `npm ci` in `tests/browser`; `tests/browser/node_modules` was a symlink to `/opt/pw-node/node_modules` and npm emptied the target.
  Restored with `npm ci` in `/opt/pw-node` (playwright-core 1.56.1 again). Anything that ran Playwright through `PW_NODE_PATH` between about
  06:17 and 06:55 would have failed to load it (my gate attempt 1 did). `tests/browser/node_modules` is now a real folder holding axe-core
  4.13.0, @axe-core/playwright 4.13.0 and playwright-core 1.56.1 (git-ignored).
- wkhtmltopdf 0.12.6.1 (patched Qt) from the official `0.12.6.1-3` jammy `.deb` (17 MB, downloaded in under a minute), extracted to
  `/tmp/wk/x` and linked as `/usr/local/bin/wkhtmltopdf` and `wkhtmltoimage`; `poppler-utils` installed with apt (`pdffonts`, `pdftoppm`).
  Chromium for core's Chrome PDF generator was downloaded by core itself into each bench (`chromium/`).
- `/tmp/ins-gate-state.json` and the lock were used as the helpers define them; both throw-away sites were dropped.

## State left behind

Both sites: `institutional_theme` installed (`list-apps` in each `gate/list-apps-final.log`), built (`sync_assets.py --check`: both benches
consistent, no entry points at a missing file), Administrator's desk theme Light, Print Style and Letter Head "Midad" present, both ports
answer `/login` 200. The test users `axe-*`, `grid-*` and their ToDo rows remain on both sites (as after round 3). Because the tests of check
1 delete and recreate the shipped print records, I ran `bench migrate` on v16.52.0 after them (`v16.52.0/migrate-after-tests.log`, ship
result "unchanged"); on 16.32.0 the print script's `ship()` call reported "unchanged" as well.

## Files

- `scripts/print_check.py`, `scripts/run_print_check.sh`: PDFs (default format, Standard with Midad, Standard with core's style and no
  Letter Head), email render, temporary records deleted (`LEFT 0 None 0`).
- `scripts/email_shot.mjs`: Chrome screenshots of the rendered emails.
- `scripts/print_overflow_experiment.py`: F3 experiment.
- `scripts/probe_a11y52.mjs`: F2 probe.
- `scripts/axe_both.sh`: the re-run command.
- Source changes: `tests/browser/axe.mjs`, `a11y_attrs.mjs`, `axe_avatars.mjs`, `tools/bench/capture.mjs` (diagnostic only).

## Not verified

- A real Arabic translation reaching core's `__()` for the three labels of F2 (needs an `ar.csv` entry and a build).
- axe on the css-engineer's final stylesheets (see the caveat).
- Print with HRMS formats (HRMS is not installed on either site).
- Printing a multi-page document and Print Settings "repeat header and footer" (round 2 covered them on 16.32.0; not repeated).
- Cause of F4.
