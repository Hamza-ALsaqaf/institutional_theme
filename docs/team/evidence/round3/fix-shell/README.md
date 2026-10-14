# fix-shell (round 3, backend-engineer F2)

Scope: the shell script (`public/js/shell/*`, `ins_shell.bundle.js`), `ar.csv` rows, the browser tests `axe.mjs`, `a11y_attrs.mjs`, `grid_names.mjs`. Bench: `midad.test`, Frappe 16.32.0, ERPNext 16.33.0, axe-core 4.13.0 (Playwright, Chromium), users `axe-<lang>-<mode>@midad.test` (System Manager). Rebuild before every run: `tools/bench/b.sh build --app institutional_theme` (exit 0, 2 s) and `tools/bench/b.sh clear-cache`. Labels: VERIFIED = run on the live bench by me; COMPUTED = derived from source or from the run data; NOT RUN.

## Result per finding

| # | Finding | Fix | Evidence |
|---|---|---|---|
| 1 | Upgrade B1: Check values in Report View named "Select row N" | `a11y_rules.js`: the selection name applies only to `.dt-cell--col-0 input[type=checkbox]:not([disabled])` and never inside `.dt-cell__edit`. A read-only Check value now gets its own name, "{column}, row {n}" (see "Side effect" below). | VERIFIED, before/after below |
| 2 | a11y S1: row editor controls and collapse button unnamed | `field_labels.js` `ownControls` accepts controls inside `.form-in-grid`; `a11y_rules.js` runs `labelWrapper` for `.form-in-grid .frappe-control` and names `.grid-collapse-row`; `a11y_names.js` rescans a late-added wrapper there too. New axe screen `form-row-editor`. | VERIFIED: `a11y_attrs` row-editor checks (en, ar) and the axe screen: 142 core nodes on that screen with the theme blocked, 10 themed |
| 3 | a11y S2: no `main` landmark | new `landmarks.js`: `role="main"` on `#body`, only when the page has no `main`/`[role=main]` and `#body` has no role | VERIFIED: exactly one `[role=main]` (`#body`), not containing the header (en, ar); axe `bypass` incompletes 28 (core variant) and 30 (wave 2) to 0 |
| 4 | a11y S3: `aria-selected` missing on form tabs | `a11y_rules.js`: `aria-selected` written from `.active`, followed by one observer per tablist (class attribute, tab buttons only). No arrow-key behaviour added. | VERIFIED: all tabs carry `true/false` equal to `.active`, exactly one `true`, and it follows a tab click (en, ar) |
| 5 | a11y S4: English in the Arabic names | `ar.csv`: Previous Document, Next Document, Clear all filters (all three have an empty `msgstr` in frappe `ar.po`; erpnext and hrms have none). Datatable column filters get `aria-label` "Filter {column}" (context "Column filter") that outranks core's English title; the title is untouched. | VERIFIED in ar: tooltip-copied names are Arabic, `__("Clear all filters")` is Arabic, filter labels "تصفية <column>", titles still "Filter based on ..." |
| 6 | Upgrade S5: queue grows in a hidden tab | `dom.js` `defer()`: frame while visible, 250 ms timer while hidden, 1 s timer as backup for a tab hidden after the frame was requested. Used by `a11y_names.js`, `grid_names.js`, `field_labels.js`. | VERIFIED: with `document.hidden` forced true, a node added is named within 500 ms (`a11y_attrs` check "observer: a node added while the tab is hidden"). `actions.js` also uses rAF but keeps no node references (it rescans one wrapper), so it is left alone. |
| 7 | a11y S6: meta-viewport | new `viewport.js`: removes `maximum-scale`, `minimum-scale`, `user-scalable` from the viewport meta (attribute write, once) | VERIFIED: content becomes `width=device-width, initial-scale=1.0, minimal-ui`; axe `meta-viewport` 48 nodes to 0. See "Viewport at 375 px". |

## Commands run and results (all from `/home/runner/work/institutional_theme/institutional_theme`)

| Command | Result |
|---|---|
| `tools/bench/b.sh build --app institutional_theme` (x4, after each code change) | exit 0, about 4 s each |
| `tools/bench/b.sh clear-cache` | exit 0 |
| `node tests/browser/a11y_attrs.mjs` (final, after the last csv fix) | 88 checks, 0 failed, exit 0 (`a11y-attrs/results.md`, `logs/attrs4.log`) |
| `node tests/browser/grid_names.mjs --out .../fix-shell/grid-names` | 48 PASS, 0 FAIL, exit 0 (`grid-names/run.log`) |
| `node tests/browser/axe.mjs --variant=themed` (4 pairs x 24 screens) | summary: 274 nodes (`axe/`) |
| `node tests/browser/axe.mjs --variant=core --measure=no` | summary: 274 themed nodes all also present in core; 1185 core-only nodes the theme removes |
| `node tests/browser/axe.mjs --variant=themed --screens=list,form,form-child-table,form-row-editor,search,appearance` | colour-contrast incompletes measured (`axe-measure/`) |
| `tools/ci/local_ci.sh docs/team/evidence/round3/fix-shell/ci-1.log` | CI PASSED (before the Check-value commit); `ci-2.log` (after the evidence commit): CI PASSED |

Note: a first themed axe run was cut short by the web server being restarted by another agent (ERR_CONNECTION_REFUSED on the Arabic pairs); I re-ran the Arabic pairs and the core variant. The final `axe/` folder has all eight runs with 0 screen errors (the Coverage table in `axe/summary.md`).

## B1 on Report View with a Check column

User, Report View, columns ID, Full Name, Enabled (saved through `frappe.model.user_settings.save`, restored by the test afterwards).

Before (VERIFIED, `logs/probe2.mjs`, theme at commit 92af3a6): the selection checkbox in `col-0` and the Check value in `col-5` (`disabled`, class `disabled-selected`) both carried `aria-label="Select row 1"` (and 2, 3 on the next rows).

After (VERIFIED, `a11y_attrs` checks, en and ar):
- `report with a Check column: selection checkboxes are named "Select row N"`: PASS
- `report with a Check column: a Check value is named by its column and row, never "Select row N"`: PASS (en "Enabled, row 1"; ar "تمكين، الصف 1")
- `report with a Check column: a checkbox inside .dt-cell__edit is not named as a row selector`: PASS. This one is SIMULATED: the Enabled cell of User is not inline-editable on this site (double-click leaves an empty `.dt-cell__edit`), so the test inserts a checkbox into `.dt-cell__edit` and checks that no name is written.
- The existing checks "report: row checkboxes numbered from data-row-index" and "after scrolling, every visible row checkbox is named with its current row number" counted the Check column too and passed only because of the bug; they now select `.dt-cell--col-0`.

Side effect found and fixed: restricting the selection name left the disabled Check values with no name, and axe rule `label` (critical) then fired on 17 nodes per run (68 in the interim run; the 4 interim themed runs are not kept). The value name above removes them (final run: `label` 0).

## axe counts, before and after (violations, nodes; 4 runs = en/ar x light/dark)

| Rule | Wave 2 re-scan (23 screens) | Final themed (24 screens) | Note |
|---|---|---|---|
| listitem | 220 | 220 | core (awesomplete list), unchanged |
| meta-viewport | 48 | 0 | fixed by `viewport.js` |
| aria-allowed-attr | 20 | 20 | core, unchanged |
| aria-required-children | 12 | 12 | core, unchanged |
| aria-required-attr | 4 | 8 | +4 on the new screen `form-row-editor` (core Link field, below) |
| aria-valid-attr-value | 4 | 8 | +4, same input |
| document-title | 4 | 4 | core, unchanged |
| color-contrast | 0 | 2 | NEW, theme-worse-than-core: see "Open theme defects" |
| label | 0 | 0 | |
| **total** | **312** | **274** | 312 - 48 + 10 on the new screen |

The new screen is the large coverage gain: with the theme blocked it has 142 nodes (label 44, color-contrast 38, button-name 20, select-name 16, others); themed it has 10.

Classification (the existing method: a node is "core" when the same rule fires on the same selector, screen, language, mode with every `/assets/institutional_theme/` request blocked). This time the core variant was re-run (`axe/run-core-*.json`), not copied from wave 1. Result: 274 core, 0 theme by that method, with ONE exception that the method hides: the `.grid-delete-row` contrast node is in both, but the ratio is 2.51 themed against 4.42 core (the "theme colours worse than core" table in `axe/summary.md`, 2 nodes). So "0 caused by the theme" is false for that node: see below.

## Open theme defects found by this round (not fixable from the shell; for the css-engineer)

1. **Delete button in the row editor, Dark: white on `#fb7e77`, 2.51:1** (needs 4.5:1), `.grid-delete-row` (`.btn.btn-danger`). Core draws `color: $white` on `var(--danger)` (`frappe/public/scss/common/buttons.scss:130-133`); the theme maps `--danger` to `red.400` in Dark and defines `--ins-on-danger` (`red.950`) but no rule applies it to `.btn-danger` (grep of `public/scss` outside `generated/`: none). Core's own Dark red gives 4.42 (also under 4.5). Suggested: `html:root[data-theme=dark] .btn.btn-danger { color: var(--ins-on-danger) }` in `desk/_actions.scss`. Any other Delete/destructive button in Dark has the same pair (only this one was on a scanned screen).
2. **Status chip clipped on mobile lists at 375 px** (see "Viewport at 375 px"): the themed chip is 69 px wide (check icon added) against 56 px in core, and the sticky `.list-subject` (opaque white, `z-index: 1`) covers the left of it on rows with a long second line. VERIFIED by `elementFromPoint` on the chip's left half (`logs/overlap.mjs`): the hit element is `div.list-row-col.list-subject` in rows 1 and 2, and the chip itself in row 3.
3. **Home breadcrumb link is 16 x 17 px** with the next breadcrumb link 8 px away (nearest edge to the centre of the home link; WCAG 2.5.8 needs 24 px, or a 24 px circle that touches no other target). Core's is 16 x 20 and also fails; the theme made it 3 px shorter. COMPUTED from `getBoundingClientRect` (`logs/spacing.mjs`: en and ar themed, en core). axe reports it as incomplete in the themed runs (11 screens x 4 = 44 nodes, `contentOverflow`) and as a violation in the core runs. Suggested: `.navbar-breadcrumbs > li:first-child > a { display: inline-flex; align-items: center; justify-content: center; min-inline-size: 24px; min-block-size: 24px }`.

## Incomplete results triage (themed, 4 runs, 264 nodes; axe `incomplete`)

`bypass` is no longer incomplete in any themed run (it was 7-8 per run in wave 2 and 28 in the core runs): the `main` landmark satisfies it.

| Rule | Nodes | Also in core | Decision |
|---|---|---|---|
| color-contrast | 172 | 108 | **Not a theme problem; no real failure found.** Measured below. |
| aria-prohibited-attr | 48 | 48 | **Core.** One element: `a.sidebar-user-button` (`frappe/public/js/frappe/ui/sidebar/sidebar.html:52`), an `<a>` with `aria-label="User Menu"` and no `href`, so no role. It is also not keyboard-focusable (no `tabindex`; `onclick` only). The fix would be `role="button"` and `tabindex="0"` plus key handling: a behaviour change, so the theme does not do it. Reported as a core gap. |
| target-size | 44 | 0 (violation in core) | **A real, small defect, theme-fixable by CSS** (item 3 above). 1 element x 11 screens x 4 runs. |
| bypass | 0 | (28 in core) | Fixed by the landmark. |

Colour-contrast incompletes, measured (`axe-measure/summary.md`, `axe-measure/incomplete.json`; subset of screens, 136 of the 172 nodes; same reasons on the rest). Method: hide every glyph (`color: transparent`), screenshot the element's box, composite the element's computed text colour over every painted pixel, take the WCAG ratio, compare the minimum with 4.5 (3 for large text). COMPUTED from pixels, not from axe.

| Reason (axe messageKey) | Nodes measured | Result |
|---|---|---|
| elmPartiallyObscured | 90 (list rows 16-19 in two screens, search results) | 68 pass at every pixel (minimum 8.84 on list links, 12.13 on search). 22 "fail" at 1.19, all in Dark search results: **false positive of the method**. VERIFIED (`logs/mark.mjs`): those spans contain `<mark>` highlights (black text on `rgb(253,249,175)`, 19.35:1, the same in core), and the pixels under the mark were counted against the span's light text colour. The real pairs are the span text on the popup (median 12) and the mark (19.35). |
| bgOverlap | 36 (Ace editor, "Expand" buttons, help boxes, section head, sidebar avatar) | 36 pass at every pixel (lowest 4.65 on a help box, with 13 background colours in its box) |
| elmPartiallyObscuring | 4 (`.language-xml`) | pass |
| nonBmp | 4 (`.ins-selected-icon`, a check mark) | 7.69, pass |
| shortTextContent | 2 (Ace gutter number) | pass |

So: 0 colour-contrast incompletes are theme failures; 22 are a measuring artefact, explained. The wave-2 count of about 25 per run was 102 total; the rise to 172 is the new `form-row-editor` screen (about 36 nodes per pair) and the list rows. The `.grid-delete-row` failure is a *violation*, not an incomplete (above).

## pageErrors: six "undefined" entries per run

Explained, and core, not the theme. Each run records 5 errors on `workspace-cards` (`/desk/invoicing`) and 1 on `query-report` (`/desk/query-report/General Ledger`); the core variant (theme blocked) has the same 5 + 1. A CDP trace (`logs/errs.mjs`, `logs/errs-themed.log`, `logs/errs-core.log`) shows `Uncaught (in promise) undefined` thrown from `render_card` in `desk.bundle.*.js` (`frappe/public/js/frappe/widgets/number_card_widget.js:169-183`, `await this.get_data()`), right after `HTTP 403` on `frappe.desk.doctype.number_card.number_card.get_result`; and on the report, after `HTTP 403` on `frappe.desk.query_report.get_script`. The axe test users are System Manager without the Accounts roles, so core's permission check refuses those calls and core rejects the promise with no reason (message "undefined", no stack, `name` empty). A site with a user who has the Accounts roles would not log them. VERIFIED for the themed and core runs; the cause (the user's roles) is COMPUTED from the 403s, not checked by granting the role.

## Viewport at 375 px

VERIFIED (`mobile-375.json`, Chromium `isMobile`, 375 x 812, touch): on the User list, the User form and the User report view the meta content is `width=device-width, initial-scale=1.0, minimal-ui`, `document.documentElement.scrollWidth` equals `innerWidth` (375) on all three, `visualViewport.scale` is 1. So removing `minimum-scale`/`maximum-scale` does not make the page auto-shrink (no horizontal overflow), and zoom is now possible. Screenshots: `mobile-375-list.png`, `mobile-375-form.png`, `mobile-375-report.png`.

Layout risk observed (not caused by the meta change; it is the same 375 px layout): the themed status chip is clipped by the sticky subject cell on some rows (`mobile-375-list-themed.png`, rows 1 and 2; core in `mobile-375-list-core.png` is not clipped). Open theme defect 2 above. Pinch-zoom itself was not exercised (headless emulation has no pinch gesture): NOT RUN.

## Strings (new user-visible source strings, for the scribe's `ar.csv`; rows are already in `translations/ar.csv`, the Arabic is proposed)

| Source | Arabic row added | Context |
|---|---|---|
| Collapse | طيّ | Row editor (core's bare "Collapse" is "انهيار", which means a collapse as in a crash) |
| Previous Document | المستند السابق | none (frappe `ar.po` msgstr empty) |
| Next Document | المستند التالي | none (empty) |
| Clear all filters | مسح جميع الفلاتر | none (empty; core's "Clear Filters" is "مسح الفلاتر") |
| Filter {0} | تصفية {0} | Column filter |
| {0}, row {1} | {0}، الصف {1} | none (quoted in the csv because the source has a comma) |

"Row Number" is used as the name of the row-number column filter; frappe already translates it ("رقم الصف"), so no row was added. No duplicate keys (296 rows, csv parsed). A first version of the `{0}, row {1}` row was unquoted, split into three fields and left the Arabic session with English text; the `a11y_attrs` ar check caught it and it was fixed in the same round.

## Selectors depended on (16.32.0; for the scribe's manifest 2j)

| Selector or attribute | Source (16.32.0) |
|---|---|
| `.dt-cell--col-0 input[type=checkbox]` (selection column) | frappe-datatable 1.20.7: `src/datamanager.js:55-68` (checkbox column pushed), `:623-625` `getCheckboxHTML`; `src/rowmanager.js:45,127` (the library's own selector) |
| `input[type=checkbox][disabled]` Check value in a cell | `frappe/public/js/frappe/form/formatters.js:165-167` |
| `.dt-cell`, `.dt-cell--col-N`, `data-row-index`, `data-col-index`, `data-is-header`, `.dt-cell__content[title]` | `src/cellmanager.js:812-850` (class names and data attributes), `src/utils.js:9-21` (`undefined` is skipped) |
| `.dt-cell__edit` | `src/cellmanager.js:466,945` |
| `.datatable`, `.dt-header` | `src/datatable.js` root wrapper (used by the Report View in `frappe/public/js/frappe/views/reports/report_view.js`); not re-read line by line |
| `input.dt-filter[data-name][title="Filter based on ..."]` | `src/rowmanager.js:359-364`; `data-name` from `makeDataAttributeString` (`src/utils.js:9-21`) |
| `.form-in-grid`, `.grid-collapse-row` | `frappe/public/js/frappe/form/grid_row_form.js:4`, `:49-51` |
| `#body` (the container core fills) | `frappe/www/desk.html:38-42`; `frappe/public/js/frappe/views/container.js:12` |
| `meta[name=viewport]` | `frappe/www/desk.html:14-15` |
| `ul#form-tabs[role=tablist] > li.nav-item > button[role=tab].active` | `frappe/public/js/frappe/form/tab.js:30-45`; `frappe/public/js/frappe/form/layout.js:46` |
| Tooltip strings copied into names: "Previous Document", "Next Document", "Clear all filters" | `frappe/public/js/frappe/form/toolbar.js:344,352`; `frappe/public/js/frappe/list/base_list.js:1407` |

## Not done, risks

- **Arrow-key behaviour on form tabs** is not added (behaviour change; a11y S3 asked only for `aria-selected`). The tab widget still has no roving `tabindex`.
- **Desktop folder-thumbnail focus ring (a11y S5)** is CSS and not mine.
- The `.dt-cell__edit` skip is verified with a SIMULATED inline editor, not a real inline-edited Check cell (not reachable for User on this site).
- Row-editor Link fields (`input[data-target=Role]`): axe `aria-required-attr` (`aria-controls`) and `aria-valid-attr-value` (`aria-activedescendant="awesomplete_list_N_item_0"`) fire while the awesomplete list is open. Core markup (the same two rules fire on the search box); the node is also in the core variant. Not fixed.
- The first measurement pass of the colour-contrast triage was wrong in two ways (the glyph-hiding style tag was never removed, and transitions faded the colour back); both were fixed in `axe.mjs` before the numbers above were taken. The earlier numbers are not kept.
- Not run: screen readers, real touch pinch, forced colours, 320 px.
- `docs/audits/budgets.txt` was not touched by my runs (`git status docs/audits` is clean after `local_ci`; the budget audit passes, 0 problems). Built `ins_shell.bundle.*.js` is 21,238 bytes (20.7 KB) on the bench against the 24 KB budget: about 3.3 KB of headroom. The committed `budgets.txt` still says 18.3 KB for that bundle (stale, written by an earlier audit run); it is not regenerated here.
