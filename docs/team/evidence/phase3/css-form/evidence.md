# css-C evidence: form, controls, status, actions, masked, ribbon, typography (Phase 3)

Time: 2026-10-13, 18:5x UTC. Draft from commit 3b38e7b, reviewed, corrected and verified headlessly. No commit made.

## Done

- ADR 0010 Decision 1 rules in `_controls.scss` are exactly as specified (the `:is(.btn, .filter-chart, .avatar-action, .ql-mention-list-item, .ql-editor .mention)` `--control-bg` rule, and `.form-control { border: 1px solid var(--ins-border-control) }` at (0,1,0)). VERIFIED by `cascade.mjs`: field background `surface-field`, border `border-control`, `.btn-default` `surface-fill`, `.datatable .form-control` `0px none`.
- Read-only distinct from disabled (flat hairline underline vs filled dashed box, text colours differ). VERIFIED computed (asserts in `cascade.mjs`).
- Autofill keeps its inset on focus (reset excludes `:-webkit-autofill`; specificity comments corrected to (0,2,2) / (0,3,2)). Rule-text check only; real autofill NOT observed.
- Arabic typography: `letter-spacing: 0` (verified to beat core's 0.02em on `.btn`, pill, label in RTL), `--ins-leading-arabic` (23.1px body in RTL), `lining-nums tabular-nums` on datatable content.
- Dark descendant re-declarations (`.modal`, `.form-in-grid`, `.grid-body .editable-row`, `.chart-container`) with probe elements in the fixture, asserted in all four modes and three palettes.
- Second-app fixture (upgrade-phase2 item 6): `tests/browser/harness/second_app.css` reproduces the findings section 8 rules and loads after `ins_desk` (scenario `second-app`). Added `.btn.btn-primary` property rules (0,4,1) / hover and active (0,5,1) to `_actions.scss`; asserts `.btn-primary` background and hover, and `--font-stack`, win.
- Form tabs, sections, links, timeline, banners; pills (shape plus colour, Draft ring / Cancelled square on `data-ins-docstatus` and list `data-filter`); actions on `data-ins-action`; masked on `data-ins-masked*`; ribbon on `html[data-ins-environment]` and `.ins-env-ribbon`.
- `!important`: the one real hit (`_hardcoded.scss`, `.fc-event-main-frame, .fc-daygrid-dot-event`) REMOVED, as instructed. Core sets `color: rgb(0, 112, 204) !important` there (`calendar.scss:71` and `:99`, opened), so the theme cannot replace it: calendar event text keeps core's blue on `--ins-feedback-info-bg`. OPEN for the lead (contrast of that pair not computed; either accept a manifest entry for `!important` or change the event background). All other grep hits are in comments.
- Test fix: Chromium computes a 1.5px border as 1px at DPR 1, so the Draft ring assertion accepts 1px or 1.5px.

## Verified (commands)

Core CSS compiled from the pinned source (`/home/user/src/frappe-16.32.0`, sass 1.69.5, `~` imports mapped to `/tmp/ins-core/node_modules`; datepicker CSS missing, irrelevant) because the bench did not exist:

    node /tmp/ins-sass/core.js            # 691604 bytes core desk css
    cd tests/browser && PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node cascade.mjs --bench /tmp/fb --evidence docs/team/evidence/phase3/css-form
    -> sassWarnings: [], rtlIdentical: {desk: true, graphite: true}, total 4256, pass 4256, fail 0
       (ltr and rtl x 4 palettes/orders x 4 modes: light, dark, automatic-light, automatic-dark)

Results: `css-cascade.json`. Screenshots (fixture page with core + theme CSS, midad): `fixture-{ltr,rtl}-{light,dark}.png`. Every `var(--ins-*)` used in the desk partials exists in the generated files (the only non-generated one, `--ins-ribbon-height`, is declared in `_ribbon.scss`). No literal colours or physical properties in my partials (grep).

## Not verified / missing

- Live desk: the bench (`/home/user/frappe-bench`, `/tmp/ins-bench-ready`, localhost:8000) did not exist during my run. No injection into a real form, no css-form- users, no real-form screenshots. Screenshots are of the harness fixture only.
- Real browser autofill; Windows High Contrast; the second-app test was not shown to fail without the new `.btn-primary` rules (not run).
- `_form.scss` timeline, sections and links are asserted only for tabs and banner; no assertion for `.form-links`, `.new-timeline`, section heads.
- Page-head and sticky offsets under the ribbon (`_page_head.scss`, not my file): the ribbon only adds `scroll-padding` and body padding; a sticky `.page-head` top offset needs the ribbon height added there.
- Sticky `.btn-primary:active` colour: core's `!important` (`buttons.scss`, `:active`) not overridden.

## Selectors depended on (16.32.0, `frappe/public/`)

| Selector | Source (opened) | Purpose / breaks if changed |
|---|---|---|
| `.indicator-pill` | `scss/common/indicator.scss:2` | status pills and shapes; shapes vanish |
| `.control-label.reqd:after` | `scss/common/controls.scss:151` | required marker colour |
| `.like-disabled-input` | `js/frappe/form/controls/base_input.js:29`, `scss/common/form.scss:14` | read-only and masked value; read-only cue reverts to core |
| `.form-tabs-list .form-tabs .nav-item .nav-link` | `scss/desk/form.scss:484-500` | tab styling and focus ring; tabs unstyled |
| `.form-message` (colour classes) | `scss/desk/form.scss:359-378` | banners; banner pairs revert |
| `.form-links .document-link` | `scss/desk/form.scss:239` | connection links |
| `.form-section .section-head` | `scss/desk/form.scss:41` | section headings |
| `.fc-event-main-frame`, `.fc-daygrid-dot-event` | `scss/desk/calendar.scss:71, 99` | calendar event text (stays core blue) |
| `.btn.btn-primary`, `.btn.btn-secondary`, `.btn.btn-default` | `scss/common/buttons.scss:80,117` | button fills and the `--control-bg` rule |
| Not re-opened this session; cited from the draft partials, lines as written there: `.modal, .form-in-grid` and `.grid-body .editable-row` (`desk/dark.scss:174-175, 189-193`, `common/grid.scss:283-286`), `.chart-container` (`dark.scss:222-234`), `.new-timeline .timeline-item`, `.switch-control` (`controls.scss:709-806`), `.rating`, `get_textstyle` letter-spacing (`espresso/_typography.scss:99`) | | descendant variable scopes; Dark dialog fields revert to core grey |

Theme-owned: `data-ins-docstatus`, `data-ins-new`, `data-ins-action`, `data-ins-masked`, `data-ins-masked-label`, `html[data-ins-environment]`, `.ins-env-ribbon` (ADR 0008; set by the shell script).

## Strings

No new source strings. The masked reason `Hidden for your role` and the ribbon text come from the shell script (ADR 0008), already listed there.
