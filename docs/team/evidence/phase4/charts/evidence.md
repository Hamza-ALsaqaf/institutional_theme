# Phase 4 charts evidence (css-engineer)

## Done
- `institutional_theme/public/scss/desk/_dashboard.scss` (new), imported in `ins_desk.bundle.scss` after `desk/workspace`, inside the rtl wrapper.
- Dashes: `html:root[dir] .chart-container g.dataset-line.dataset-N .line-graph-path`, N = 1..5 (the index is 0-based, so these are series 2..6): 8 4, 2 4, 12 4 2 4, 16 6, 2 2. Series 1 and 7 solid. Never on bars.
- Dark stroke width and circle stroke: already in `_scoped_variables.scss:25-36` (`html:root[dir] .chart-container`, 2px, `--ins-surface-raised`); not duplicated.
- Chart card: `html:root[dir] .widget.dashboard-widget-box` gets `--ins-radius-md` and `--ins-elevation-raised`, as the workspace cards. Number cards (`.widget.number-widget-box`) are already in `_workspace.scss`; no new rule.
- No `!important`, logical properties n/a (no directional properties), no literal colours.

## Verified (ran, live bench, sass compile of the bundle injected, 0 warnings)
- COMPUTED stroke-dasharray, en/ar x light/dark (4 contexts, users `css-chart-{en,ar}-{light,dark}@midad.test`): series 1 none, 2 `8px, 4px`, 3 `2px, 4px`, 4 `12px, 4px, 2px, 4px`, 5 `16px, 6px`, 6 `2px, 2px`, 7 none. Stroke width 2px in light and dark.
- COMPUTED real Dashboard Chart card (`css-chart-todo-line` on `css-chart-dash`, ToDo count, Line): radius 6px; light shadow = raised elevation, bg rgb(255,255,255); dark bg rgb(23,30,40), shadow none (raised elevation token is none in dark).
- Screenshots: `{en,ar}-{light,dark}-{dashboard,multiseries}.png` in this folder.
- `tests/browser/cascade.mjs --bench /home/user/frappe-bench`: 4256 pass, 0 fail, rtlIdentical true (its evidence was written to /tmp, not the repo).

## Not verified / missing
- Density (comfortable/compact): not rendered; no density-dependent rule was written.
- The multi-series chart is synthetic (`new frappe.Chart` with 7 line datasets injected into a `.widget.dashboard-widget-box` host on the dashboard page): Dashboard Chart on ToDo yields one series only. The real card's chart rendered no data in the screenshots (fictional/empty ToDo set; not investigated).
- Dataset circle stroke: no `.dataset-units circle` existed in the rendered line chart (frappe-charts draws dots only with `hideDots` off and points visible); the white-circle fix is by variable only, not asserted.
- Protanopia/grayscale screenshots (ADR 0010) not produced.
- The test users and the chart/dashboard docs `css-chart-*` remain on the bench (not deleted).
- Frappe-charts selector line numbers: the installed dist is minified (one line), so file:line is replaced by the source facts in ADR 0010 decision 3 (`ChartComponents.js:370`, `draw.js:100-110`); the dist strings were grepped and match.

## Selector list
| Selector | Source | Purpose | Breaks if changed |
|---|---|---|---|
| `g.dataset-line.dataset-N` | frappe-charts 2.0.0-rc27 dist/frappe-charts.esm.js lineGraph `layerClass` ("dataset-units dataset-line dataset-"+index); src ChartComponents.js:370 | per-series hook | dashes vanish, lines separable by colour only |
| `.line-graph-path` | same dist, `U("M"+r,"line-graph-path",n)`; src draw.js:100-110 | the path that takes the dash | same |
| `.chart-container` | frappe-charts.min.css:27-60 | scope | same |
| `.widget.dashboard-widget-box` | frappe desk/desktop.scss:189 | chart card | card loses radius/elevation parity |
