# HRMS v16.20.1 desk screens under the theme (round 3, item 2)

Run 2026-10-14 01:11 UTC on `midad.test` (Frappe 16.32.0, ERPNext 16.33.0, HRMS v16.20.1, institutional_theme real build, PostgreSQL). Command: `NODE_PATH=/opt/pw-node/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/browser/hrms_screens.mjs` (about 3 minutes, exit 0). Users `hrms-{ar,en}-{light,dark}@midad.test` (System Manager, HR Manager, HR User, Leave Approver, Employee). Output: `hrms_screens.json` (all computed values), `shots/*.png` (84 records, 1366x768).

## What was checked (VERIFIED, computed in the live page)
Pages: Employee list and form (HR-EMP-00001), Leave Application list and form (HR-LAP-2026-00001), Salary Slip list and form, workspaces Leaves (`/app/leaves`) and Payroll (`/app/payroll`) (HRMS has no single "HR" workspace in 16.20.1: `hrms/hr/workspace/*`, `hrms/payroll/workspace/*`), Organizational Chart (`/app/organizational-chart`, default, selected-click and 390 px wide). Each in Light and Dark, Arabic and English, comfortable and compact (density by `data-ins-density` on `html`), 8 combinations.
Per record: WCAG text contrast of every visible text element (4.5, 3 for large) against the composited background; Dark: no visible surface of 900 px2 or more with luminance above 0.8 (no white surface); indicator pills (148 checked) legible; sidebar on the inline-start side (right in RTL, left in LTR); no horizontal overflow.

Result after the fixes below: 0 flagged out of 84 records, with these exceptions that are not counted: the avatar initial (core user-colour palette, 3.41:1, `div.avatar-frame`) is excluded from the check and is a core/pre-existing value; and the org-chart narrow layout puts the sidebar off-canvas by design.
Before the fixes (same script, earlier run): Light failed on every page with `span.d-block.text-secondary` at 3.96:1 (sidebar user email), and Dark failed on the Leave list Select placeholder at 3.70:1.

## HRMS raw gray ramp (findings 8)
`hrms.bundle.css` (`hrms/public/scss/hierarchy_chart.scss`, `feedback.scss`, `circular_progress.scss`) reads `--gray-100/200/300/400/500/600/700/800` and `--border-color`, `--shadow-*`, `--text-color` and has `background: white` at `hierarchy_chart.scss:2, 139, 276` (`.node-card`, `.node-card.collapsed`, `.node-group`). This theme maps every `--gray-*` for both modes (`generated/_frappe_map.scss`), so the ramp reads as designed. VERIFIED in Dark: `.node-card` computes `rgb(29, 37, 47)` (not white) although `hrms.bundle.css` loads after `ins_desk.bundle.css`; no fix needed (core `.card` background reaches the cards first through the theme). NOT VERIFIED: `.node-card.active`, `.active-path`, `.node-group` (mobile cards), the SVG edge strokes and `.circular-progress` / feedback summary (`feedback_summary.html`), because the fixtures contain no reporting hierarchy, appraisal or feedback records. These use only mapped ramp variables, so they follow the map, but that is COMPUTED reasoning, not a rendered check.

## Fixes made
`institutional_theme/public/scss/desk/_hardcoded.scss` (appended, three blocks):
1. Bootstrap contextual text utilities `.text-primary/-dark/-secondary/-success/-info/-warning/-danger` and `a.text-secondary:hover` re-pointed at text and feedback tokens. Core ships literals with `!important` (compiled from vendored Bootstrap: `.text-secondary{color:#7c7c7c!important}` and so on; `.text-dark #383838` would be unreadable on Dark). HRMS desk templates use them (`hrms/public/js/templates/feedback_summary.html`, `interview_feedback.html`). Selector `html:root[dir] .text-*` (0,3,1) with `!important` (core uses `!important` on the same property: an important declaration can only be beaten by another).
2. `.text-extra-muted` (core `desk/global.scss:608-610`, `color: var(--gray-500) !important`) re-pointed at `--ins-text-muted`: Dark night-500 is 3.70:1 on field surfaces (Select placeholder of list standard filters, `frappe/public/js/frappe/form/controls/select.js:28`). `!important` for the same reason.
Manifest entries needed for the four-plus-one `!important` declarations: (a) text utilities block (8 declarations), (b) `.text-extra-muted`.

## HRMS defect seen (not the theme)
`hrms.hr.doctype.leave_application.leave_application.get_leave_details` returns 500 on PostgreSQL ("column tabLeave Application.creation must appear in the GROUP BY clause"), so the Leave Application form opens a "Error in server" dialog in every mode. The script keeps a screenshot of that dialog (`shots/leave-form-dialog-*.png`, also useful as a check of the dialog's styling) and closes it before auditing the form. Backend should know: it is HRMS upstream, MariaDB is unaffected.
The only page JS errors: a browser autoplay `NotAllowedError` and `TypeError: Cannot convert undefined or null to object` on page load (core, not CSS), recorded per run.

## Selectors depended on
| Selector | Source | Purpose | Breaks if changed |
|---|---|---|---|
| `.text-primary`, `.text-dark`, `.text-secondary`, `.text-success`, `.text-info`, `.text-warning`, `.text-danger` (important literals) | frappe compiled `desk.bundle.css` (Bootstrap 4 utilities, `frappe/public/scss/desk/` imports vendored bootstrap) | re-point at tokens | contrast regression returns |
| `.text-extra-muted` | frappe 16.32.0 `public/scss/desk/global.scss:608-610` | muted text token | Select placeholder 3.70:1 in Dark returns |
| `.node-card`, `.node-card.collapsed`, `.node-group` | HRMS v16.20.1 `hrms/public/scss/hierarchy_chart.scss:2,139,276`; markup `hrms/public/js/templates/node_card.html:1`, `hierarchy_chart_mobile.js:480` | read only (not styled by the theme; probed) | HRMS white cards in Dark if `.card` stops painting them |
| `.body-sidebar` | frappe 16.32.0 (existing) | sidebar side check | check reports "none" |

## Strings
None.

## Not done
Selected/expanded org-chart states, feedback and appraisal summary, circular progress (no data); Salary Slip with real earnings (the fixture has one slip, checked); axe scan (backend owns it); Light/Dark keyboard focus on HRMS pages.
