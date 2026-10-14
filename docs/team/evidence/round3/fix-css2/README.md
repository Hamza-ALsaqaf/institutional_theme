# fix-css2 (round 3, second fix round)

Files changed: `institutional_theme/public/scss/desk/_actions.scss`, `_list.scss`, `_page_head.scss`. Build: `tools/bench/b.sh build --app institutional_theme`, 0 warnings, no new `!important`. Probe: `probe.mjs` (users `css3-<lang>-<mode>@midad.test`, explicit locale; results `probe.json`, `probe.log`, screenshots `list-*-375.png`, `list-*-1280.png`, `danger-*.png`). Cascade: `cascade.log`, 4256/4256. axe: `axe/` (themed, list, form, form-row-editor, 4 lang-mode runs).

## 1. Solid danger button (VERIFIED, computed styles on the real `.grid-delete-row`, 1280 px)
`html:root[dir] .btn.btn-danger` now uses `--ins-on-danger` on `--ins-danger` (text, icon via currentColor, hover uses `--ins-danger-hover`; the pressed state is core's, see the correction below), with color pinned for hover, focus, disabled. Ratios (text on button background, all five states, en and ar):
- Light: white on `#be3737` 5.54 normal/focus/disabled, 8.05 hover (`#992225`). The "11.94 active" this README first gave was core's neutral pressed colours, not red (correction below).
- Dark: `#3a0b0b` on `#fb7e77` 6.78 normal/focus/disabled, 9.56 hover (`#ffada6`). (Was 2.51.) The "12.00 active" was likewise core's neutral pressed colours.
- **Correction (fix-final, VERIFIED with `:active` forced through DevTools):** core's `.btn:active { color: var(--text-color) !important; background-color: var(--control-bg) !important; box-shadow: var(--focus-default) !important }` (`frappe/public/scss/common/buttons.scss:16-21`) beats the theme's pressed rule, so a pressed Delete button shows core's neutral control colours: Light `rgb(40, 49, 60)` on `rgb(241, 244, 248)` 11.94:1, Dark `rgb(223, 227, 232)` on `rgb(29, 37, 47)` 12.00:1. Readable, but not red. No `!important` was added. Data: `docs/team/evidence/round3/fix-final/focus_active.json`.
Disabled is drawn by core with reduced opacity (not measured through opacity). Other `.btn-danger` uses: grep of the desk SCSS finds none besides core's own rule; the only instance on a scanned screen is the grid delete row; dialog destructive buttons are tagged `data-ins-action="delete"` and take the outline rule (unchanged, later in the file, wins at equal specificity). axe `color-contrast`: 0 nodes on list, form, form-row-editor in all four modes.

## 2. Mobile list status chip (VERIFIED)
Cause: the sticky `.list-subject` (z-index 1) extends under the sticky `.level-right` block. Fix: `html:root[dir] .list-row .level-right { z-index: 2 }` (core makes it `position: sticky`, so z-index applies). The chip keeps its shape, label and width (69 px en, 55 px ar). Probe: for every chip fully inside the viewport (6 points each, `elementFromPoint`), covered points = 0 in all of en/ar x light/dark at 375 and 1280 (7 chips at 375, 12 at 1280 per run). Rows within 56 px of the viewport bottom were excluded: the core sticky "load more" footer overlaps them (hit element `.btn-more`), unrelated to the subject cell. Screenshots: `list-ar-dark-375.png` etc.

## 3. Home breadcrumb target (VERIFIED, 1280 px; hidden at 375 by core)
`.navbar-breadcrumbs > li:first-child > a` is inline-flex with 24 x 24 minimum, `margin-inline: -4px 0` so the glyph stays where it was. Measured 24 x 24 in en and ar, Light and Dark; the next link starts exactly at the home link's end (no overlap). axe `target-size`: not reported (it was 44 incomplete nodes).

## Axe
Themed run, list+form+form-row-editor: 8 nodes, all `aria-required-attr` / `aria-valid-attr-value` on `input[data-target="Role"]` in the row editor, unchanged core markup (earlier rounds counted them as core; this run did not repeat the blocked-theme variant, so the summary's "theme" label is by default, not a finding).

## Selectors depended on (16.32.0)
| Selector | Source |
|---|---|
| `.btn.btn-danger` colours | frappe/public/scss/common/buttons.scss:130-133 |
| `.grid-delete-row` | frappe/public/js/frappe/form/grid_row_form.js (row editor; found in DOM, line not re-read) |
| `.list-row .level-right` sticky | frappe/public/scss/desk/list.scss:155-156 (sticky), 706-720 mobile block |
| `.list-subject` | list.scss:280-283; mobile `.level-left` block 616-640 |
| `.navbar-breadcrumbs > li:first-child > a` | frappe/public/scss/desk/breadcrumb.scss:7-30 |

## Not done
Pinch/zoom; breadcrumb at 375 px (hidden by core); disabled-state ratio through opacity. Site config `max_queued_jobs` was raised to create users (the queue held 550 stale jobs) and reverted.
