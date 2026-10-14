# Round 3, backend C: grid checkbox names (task A) and Gantt month names (task B)

## Task A: accessible names for child-table checkboxes

Files: `institutional_theme/public/js/shell/grid_names.js` (new), `institutional_theme/public/js/ins_shell.bundle.js` (registers `initGridNames`), `institutional_theme/translations/ar.csv` (3 rows), `tests/browser/grid_names.mjs` (the test).

### What it does

- Row checkbox: `aria-label` = `__("Select row {0}", [idx])`. Header checkbox: `__("Select all rows")`. If a row has no number yet: `__("Select row")`.
- Attributes only. No element added, moved or removed. No core class touched.
- Never overrides a name core adds: a checkbox with `aria-labelledby`, or with an `aria-label` that this module did not write (tracked in a `WeakMap`), is skipped.
- Efficiency. Two kinds of observer, both created once, never rescanning the form:
  1. On `form-refresh` (the supported event, `public/js/frappe/form/form.js:625`) one light observer on the form layout. For each added element node it asks `closest(".form-grid")` or `querySelectorAll(".form-grid")` inside that node only, and hands each new grid to its own observer once (`WeakSet`).
  2. One observer per `.form-grid` (`childList`, `subtree`, and `attributes` with `attributeFilter: ["data-idx"]`). It collects only the `.grid-row` elements that changed and labels those rows' checkboxes in one animation frame. A grid with 500 rows is not rescanned when one row is added.
- Grids inside dialogs (a Table field in a `frappe.ui.Dialog`) are NOT covered: the shell watches form layouts only, to avoid a document-wide observer.

### Selectors depended on (Frappe 16.32.0, `frappe/public/js/frappe/form/` unless noted)

| Selector or behaviour | Source |
|---|---|
| `input.grid-row-check` (type checkbox, no name) | `grid_row.js:17` (markup), `:215` (static template row), `:250` (normal row) |
| Header row container `.grid-heading-row`, grid root `.form-grid`, `.grid-body` | `grid.js:77-79`; header GridRow created at `grid.js:450` |
| Row element `.grid-row` with `data-idx` and `.row-index span` holding the number | `set_row_index`, `grid_row.js:73-82`; `render_row` `grid_row.js:255-258` |
| Renumbering on add, delete, insert and drag goes through `set_row_index` (so `data-idx` changes) | `grid_row.js:73-82` (callers: `render_row` `:237`, `render_template` `:206`) |
| Header checkbox is told apart by `.grid-heading-row` ancestor (core does the same) | `grid.js:215` |
| `form-refresh` fires before fields exist | `form.js:625` |

Playwright-only selectors (the test, not the shipped script): `[data-fieldname='accounts'] .grid-add-row`, `.grid-remove-rows`, `.btn-open-row` (`grid_row.js:344`), `.grid-insert-row` and `.grid-collapse-row` (`grid_row_form.js:49-60`).

### Strings (for `ar.csv`; already added in this commit)

```
Select all rows,تحديد جميع الصفوف
Select row,تحديد الصف
Select row {0},تحديد الصف {0}
```

Checked against `apps/erpnext/erpnext/locale/ar.po`: it has "Select row {0}" with an empty `msgstr`, so the app row replaces nothing. `apps/frappe/frappe/locale/ar.po` has no entry for the three strings.

### Run (VERIFIED on the real build, `midad.test`, Frappe 16.32.0, ERPNext 16.33.0)

```
tools/bench/b.sh build --app institutional_theme                      # 14 s, bundle contains "Select all rows"
tools/bench/b.sh --site midad.test clear-cache
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/browser/grid_names.mjs   # exit 0, 48 checks PASS, 0 FAIL
```

Log: `run.log`; results: `grid_names.json`. The form is a new Journal Entry (`accounts` grid) opened by a System Manager + Accounts Manager user, once per language (`en`, `ar`). Per language the script:

0. Loads the page with `ins_shell.bundle` blocked (core as shipped): both checkboxes have no `aria-label`; `en-0-core-baseline.aria.yml` shows `- checkbox` with no name.
1. Loads the themed page: header "Select all rows", row "Select row 1".
2. Add Row: rows 1, 2 named.
3. Add Row again: rows 1, 2, 3 named.
4. Ticks row 1 and presses Delete (real core delete): rows renumber 1, 2 and every name follows.
5. Row form, "Insert Above" on row 1 (real core path), collapse: rows 1, 2, 3 named.
6. Drags row 1 below the last (SortableJS, raw mouse events): the order changed (asserted) and names still equal the numbers.

Each step writes the accessibility tree of the grid (`<lang>-<step>.aria.yml`, Playwright `ariaSnapshot`), for example `ar-4-delete-row.aria.yml`: `checkbox "تحديد جميع الصفوف"`, `checkbox "تحديد الصف 1"`, `checkbox "تحديد الصف 2"`. Screenshots `en-grid.png`, `ar-grid.png` (the Arabic one also shows core's onboarding widget and an open row; not themed by this task).

Notes on the test fixtures (not product behaviour): a new Journal Entry starts with one row, not two; Journal Entry also has a hidden second grid (`tax_withholding_entries`), so the script scopes to `accounts`. It creates two users on the test site (`grid-en@midad.test`, `grid-ar@midad.test`, password in the script) if they do not exist.

### Not verified

- Dark mode and the other palettes: the module sets attributes only, so no visual change; not run.
- Grids in dialogs, the Report View and the Sales Invoice items grid (same `grid_row.js` markup, so expected to work): not run.
- Screen reader output (NVDA, VoiceOver): only the browser accessibility tree was read.
- A form with several hundred rows: not run (the per-row design is why it should be cheap; no timing measured).

## Task B: Arabic month names on the Gantt axis. Verdict: not possible without touching core or monkey-patching. Nothing implemented.

Read in the bench (VERIFIED by reading the source; no new browser run, round 2 already shows the English axis in Arabic):

1. `frappe/public/js/frappe/views/gantt/gantt_view.js:98-108`: `new Gantt(this.$result[0], this.tasks, { bar_height: 35, ..., view_mode, date_format: "YYYY-MM-DD", on_click, ... })` is an object literal. It has no `language` key and no merge of any setting into it. `this.calendar_settings` (`gantt_view.js:11-14`, which a doctype's `calendar_settings.gantt` object extends) is used only for `field_map`, `order_by` and the popup; `gantt_custom_popup_html` (`:146-152`) only changes the popup. There is no `gantt_options` hook.
2. The bundled library is frappe-gantt 0.6.1 (`apps/frappe/node_modules/frappe-gantt/package.json`; `apps/frappe/package.json:56` asks `^0.6.0`). It does read `options.language` (`src/index.js:89` default `'en'`; used at `:501-521` for the lower and upper axis text and at `bar.js:202-210` for the popup), but `date_utils.format` indexes a month table `month_names[lang][...]` (`src/date_utils.js:9`, `:174-175`) that holds only `en`, `es`, `ru`, `ptBr`, `fr`, `tr`, `zh`. There is no Arabic table, and a language not in the table would throw (`undefined[...]`).
3. In the shipped `dist/frappe-gantt.js` the table is a `const` inside the library's IIFE (line 12), and the IIFE returns only `Gantt` (`:1964`, with `Gantt.VIEW_MODE` at `:1958`). `date_utils` and `month_names` are not exported, so no public locale registration exists.

Only routes left, both refused by the rules: (a) wrap `window.Gantt` or `frappe.views.GanttView.prototype.render_gantt` to inject `language` and a table (monkey-patching a core class; also needs a library edit to add the table); (b) rewrite the text of the SVG `.lower-text` / `.upper-text` elements after every render and every zoom (DOM rewriting of a core widget, re-run on each view-mode change). The sibling strings "Quarter Day", "Half Day", "Day", "Week", "Month" on the view-mode buttons are already translated (they pass through `__()`, `gantt_view.js:160-178`). Recommendation: keep it documented as a known gap (OWNER_REVIEW section 3 already says so) and propose an upstream contribution (pass `language` and add an `ar` table to frappe-gantt) if the owner wants it fixed.
