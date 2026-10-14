# Round 5, item 3: the open v16.52.0 items

Evidence labels: VERIFIED (ran it, output in this folder), COMPUTED (computed style in a real browser), ASSUMED. Benches: 16.32.0 `midad.test:8000`, v16.52.0 `midad52.test:8001` (Frappe v16.52.0, ERPNext v16.50.0, PostgreSQL). Chromium via Playwright, Administrator, fictional records made by `scripts/seed.mjs` (ToDos, Kanban boards "Ins Probe Board" (v1) and "Ins Probe Board V2", the custom submittable DocType "Ins Probe Slip" with a draft, a submitted and a cancelled document). Source trees read: `/tmp/frappe-newest/frappe-src` (tag v16.52.0), `/home/frappe/frappe-bench/apps/frappe` (16.32.0), ERPNext v16.50.0 fetched from its tag.

| # | Item | Result |
|---|---|---|
| 1 | Kanban v1 column dot neutral on v16.52.0 | Fixed |
| 2 | Side panel Draft and Cancelled with the error look | Fixed (needs one small shell script, see below) |
| 3 | Status badges of other apps (Job Card, Work Order Draft/Submitted/Cancelled) | Fixed for the Work Order form through a stable core hook; Cancelled keeps the red family |
| 4 | List badges clip at 400% zoom | Fixed by CSS |
| 5 | Login is Light only | Not changed. Lead decision: login, website and error pages are Light only (platform constraint and design) |

## 1. Kanban v1 column dot

- Cause: 16.52.0 renders the dot as an icon-only badge, `frappe.ui.badge.html({ theme: indicator, icon: "circle" })` (`views/kanban/kanban_column.html:4`), and `apply_column_indicator` re-sets its `data-theme` (`kanban_board.bundle.js:1713-1718`). It was not a status host, so it was neutral. On 16.32.0 it is `span.kanban-col-dot.indicator.<colour>` (`kanban_column.html:4`), which the theme already shapes.
- Fix: `desk/_status.scss`: `.kanban-column-title > .es-badge:not(.kanban-column-count)` joins `$ins-badge-host`; the core circle svg inside it is hidden because the theme shape replaces it. The count badge (`kanban_column.html:6`) stays neutral.
- VERIFIED: `shots/16.52.0-after/{en,ar}-{light,dark}-kanban.png` (Open orange half, Closed green check, Cancelled red cross; computed pairs in `probe.json`, screen `kanban`). Kanban v2 is not changed (its dot is core's own gray ring; no host). 16.32.0 unchanged: `shots/16.32.0-after/*-kanban.png`.

## 2. Side panel Draft and Cancelled

- Hook: none exists in core. `side_panel.js:741-747` renders `frappe.ui.badge({ label, theme })` from `frappe.get_indicator(preview.doc, doctype)`; Draft is `["Draft", "red", "docstatus,=,0"]` (`model/indicator.js:72-74`), Cancelled is red too, and no attribute carries the docstatus. 16.32.0 has no side panel (0 matches of `side-panel` in `public`).
- Fix: `public/js/shell/side_panel_status.js` (initialised from `ins_shell.bundle.js`, one import and one list entry) calls the same public `frappe.get_indicator` on the panel's current preview and writes our `data-ins-filter="docstatus,=,0|2"` on the badge. `_status.scss` adds that attribute to the existing Draft (neutral ring) and Cancelled (muted square) rules. The panel lives in a lazy bundle (`side_panel.bundle.js`), so the script watches for `.side-panel-indicator` to appear and then observes it. It reads `frappe.ui._side_panel` (private name) inside try/catch: if core renames it the attribute is not written and the look falls back to core's red.
- Open point: a workflow state shown red is not touched (its filter is not docstatus).
- VERIFIED (COMPUTED): `shots/16.52.0-after/*-sidepanel-{draft,submitted,cancelled}.png`, `probe.json` (`side-draft`: bg `rgb(241,244,248)` text `rgb(66,75,87)` ring, same as the list Draft; `side-cancelled`: muted pair and square, same as the list). Dark and Arabic in the same folder.

## 3. Badges from other apps

- Source: embedded lists. Work Order form (ERPNext v16.50.0 `work_order.js:1431` Job Card status, `:1482` Draft/Submitted/Cancelled) renders through core `frappe.ui.EmbeddedList` (`ui/embedded_list.js:201` table, `:293` `frappe.ui.badge.html`), also used by core (`core/doctype/role/role.js:462`, `workspace.js:721`, `doctype_settings/tabs/naming.js:302`). Stable hook: `.embedded-list-table td > .es-badge`, now a host.
- Result: the status is coloured and shaped (Completed green check, In Progress half, Submitted check). Limits: (a) the Cancelled Stock Entry cell is `theme: red` with no docstatus attribute, so it shows the red family and cross, not the muted square of the list; (b) Job Card "Open" is red in ERPNext's own indicator map. (c) A badge a third app renders outside an embedded list, a list view or the page head has no stable hook; those stay neutral (`[data-theme]` alone cannot be a host, because Kanban v2 tags and shortcut counts carry it as a label, ADR 0011 R4).
- VERIFIED: the real Role form, Documents tab (`shots/16.52.0-after/*-role-embedded.png`, `probe-embedded.json`: Custom blue dot, Standard neutral). COMPUTED: a table with the Work Order column definitions on core's `EmbeddedList` (`*-workorder-style.png`). A real Work Order could not be created: on PostgreSQL ERPNext raises `AmbiguousColumn: ORDER BY "idx"` on insert (`scripts/seed_wo.mjs` output, test-bench limitation, not the theme).

## 4. 400% zoom clip of the list badge

- Cause (VERIFIED): at 320 CSS px core's `.result-container` is `overflow-x: hidden` (`list.scss:815-818`), and its `.result` is `display: table; width: auto; min-width: 100%` (`:3-8`), so the table grows to 341 px in a 278 px container and `.level-right` (130 px) lands outside. 16.32.0 scrolls (`overflow: auto`).
- Fix: `desk/_list.scss`, `@media (max-width: 576px)` (core's `sm`): `.result { table-layout: fixed; inline-size: 100%; max-inline-size: 100% }`. No row or cell height is touched. The subject column shrinks (it is already an ellipsis flex item).
- VERIFIED (`scripts/z400.mjs`, 320 px wide at device scale 4; `shots/z400-*`, `probe.json`): before (v16.52.0) scrollWidth 341 or 325 against 278, 3 of 6 ToDo badges and 3 of 3 slip badges outside; after 277 of 277 in en, ar, Light, Dark, both lists, 0 clipped, page overflow 0. 16.32.0 after: 277 of 277, 0 clipped (it was unclipped before; `auto` overflow). Residual: a Latin subject in an Arabic row is truncated at its start by the browser's ellipsis (mixed direction, core behaviour). Not tested: real browser zoom (the stand-in is the round-4 one), tablet widths between 577 and 900 px (the a11y A3 note about the Priority badge at 900 px is a different core layout and is not changed).

## Checks

- Sass: `tools/bench/b.sh build --app institutional_theme`: 0 warnings (grep of the output). Generated files: no token touched; `python -m institutional_theme.midad.build --check`: 12 checked, 0 stale. Audits `python -m institutional_theme.audits`: passed (contrast 0 failing, dead tokens 0 dead in every version, budgets 0 problems; `docs/audits/budgets.txt` regenerated because the bundle sizes moved).
- Cascade (`tests/browser/cascade.mjs`, five new assertions per scenario: Kanban dot, embedded cell, dot svg hidden, count stays neutral, side-panel Draft): 16.32.0 4576 of 4576, v16.52.0 7680 of 7680 (7520 before) (`cascade/`).
- No new `!important`. No datatable height. Logical properties only (`inline-size`).
- Not verified: Kanban v1 dot with a colour outside the map; a side panel opened from the report-view link click (opened with `frappe.ui.get_side_panel().open` after `frappe.require("side_panel.bundle.js")`, the call core's link handler makes); screen readers.

## Proposed wording

Checklist "Known on v16.52.0", replace the first two bullets and the badge-clipping bullet with:

- Status badges that another app renders outside a core list, the page head, the side panel, the Data Import log, the Kanban v1 dot or an embedded list (for example a third app's own `frappe.ui.badge` in a custom page) are neutral: the text is kept, the colour and the shape are not (`README.md`, "A status badge is grey on Frappe v16.52.0"). The Work Order form's Job Card and Stock Entry statuses are coloured (embedded list). A Cancelled cell there keeps the red family and cross because it carries no docstatus.
- (Remove) the side-panel Draft and Cancelled bullet: fixed in round 5 (`data-ins-filter`, `docs/team/evidence/round5/v1652-items/`).
- (Remove) the list badge clipping bullet: fixed in round 5 (fixed table layout at 576 px and below).
- Keep: the login is Light only (a lead decision: login, website and error pages are Light only by platform constraint and design; `docs/team/reviews/a11y-round4.md` finding 11).

README section "A status badge is grey on Frappe v16.52.0": replace the first paragraph with: "On Frappe v16.52.0 the theme draws a status shape and colour on core's own status badges: the list view status, the page status chip, the side panel status, the Data Import log result, the Kanban v1 column dot and the status cells of embedded lists (the ERPNext Work Order form). Badges that another app renders from its own code elsewhere are drawn neutral; their text is unchanged." Delete the sentence about Kanban v1 dots having no visible effect. Add: "Login, website and error pages are Light only by platform constraint and design (a decision recorded by the lead; a11y round-4 finding 11)."
