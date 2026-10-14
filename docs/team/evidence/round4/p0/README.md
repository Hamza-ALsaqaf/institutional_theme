# Round 4: P0 desk screens on Frappe 16.32.0 and v16.52.0

Run on the two benches (midad.test:8000 is 16.32.0, midad52.test:8001 is v16.52.0) as Administrator, with the `institutional_theme` bundle built by `b.sh build` and `b52.sh build` after the toast change. Language and theme were set through the User record per run and restored to en and Light. Capture scripts: `scripts/p0.mjs`, `scripts/toast.mjs`, `scripts/forced.mjs`. Data per screen: `checks-<version>.json` (direction, theme, horizontal overflow, clipped-text probe on buttons, labels, cells, nav items).

Screens: the six of `tests/browser/screens.mjs` (the P0 list of phase 3): desktop, workspace, list, form, report, dialog. 16.32.0: 48 files (en/ar, Light/Dark, comfortable and compact). v16.52.0: 24 files (comfortable). All 72 viewed (contact sheets of the four language and mode variants per screen, then full size for form and workspace). Probe result: 0 failed captures, 0 horizontal overflow, 0 clipped-text hits, every Arabic capture has `dir=rtl` (36 of 36), `data-theme` correct in all.

| Screen | 16.32.0 | v16.52.0 | Difference and judgement |
|---|---|---|---|
| desktop | Viewed. Icon grid (13 apps), search bar, Light/Dark, ar mirrored. | Viewed. Icon grid with the two installed apps, new top bar with launcher. | Accepted core difference: new shell (ADR 0011 D). Fewer icons because the newest bench has fewer desktop records. Arabic ellipsis of long Latin names ("... Framework") is core text-overflow on mixed-direction text, both versions. |
| workspace (Build) | Viewed. Bordered cards per section. | Viewed. Borderless sections, count chips, new two-rail sidebar. | Accepted core difference (new shell, new workspace markup). In Dark the `.layout-main-section.frappe-card` panel sits one step above the page on both versions: the card token, by design, not a defect. |
| list (User) | Viewed. Status pills, filters, count, ar columns mirrored. | Viewed. Same list, sidebar rail and top actions moved. | Accepted core difference (shell). The ar-dark v16.52.0 list shows 3 rows against 5 in en: saved list filter plus data on the bench, not styling. |
| form (User) | Viewed. Sidebar, tabs, fields, timeline, ar mirrored, dark inputs sunken. | Viewed. Same content, breadcrumb and indicator in the new head. | Same look; shell difference only. |
| report | Viewed. Datatable header, filters row, checkboxes, row heights untouched. | Viewed. Same datatable. | None. In ar a Latin cell value truncated by core shows "...dministrator" (ellipsis on the logical start side): core behaviour of both versions, accepted. |
| dialog | Viewed. Overlay surface, inputs, primary button, ar mirrored. | Viewed. Identical. | None. |

Defects: no theme defect found on the captures. One defect was found by measurement and fixed before capture (below).

## Toast (task 1)

`frappe.show_alert` rendered with each indicator, Light and Dark, both versions (`toast-<version>.json`). Fix: `html:root[dir] .es-toast[data-type="..."]` sets `--es-toast-icon` to `--ins-status-{info,success,warning,danger}-solid`, in `desk/_overlays.scss`. No global token changed.

| v16.52.0 | Light icon | Dark icon | Text (Light / Dark) |
|---|---|---|---|
| info (blue) | 4.87 | 6.75 | 13.17 / 12.00 |
| success (green) | 4.79 | 6.89 | 13.17 / 12.00 |
| warning (orange) | 3.79 | 8.28 | 13.17 / 12.00 |
| error (red) | 5.54 | 6.15 | 13.17 / 12.00 |

Before the fix the icons read the raw 400 steps (1.9 to 2.5:1). 16.32.0 has `.desk-alert` with no icon: text 8.20 to 8.33 (Light) and 8.71 to 9.12 (Dark) on the feedback surface. All pass (3:1 icons, 4.5:1 text). Screenshots: `16.52.0/toast-16.52.0-Light-orange.png` (lowest ratio), `16.52.0/toast-16.52.0-Dark-red.png`.

## Forced colours (task 4)

`16.52.0/forced-colors-todo-list.png` and `forced-colors-todo-form.png`, Chromium `forcedColors: active`, Light. Viewed: status pills keep a border and icon with text, primary button has a border, the keyboard focus ring is a 2px solid outline with 2px offset (computed `solid 2px`, offset `2px`), field and toolbar borders are visible. The `.indicator-pill` probe on the form returned null (the new-form pill is the head indicator, shown in the screenshot).

## Cascade (task 2)

16.32.0: 4256 of 4256, 0 failures. v16.52.0: 6304 of 6304, 0 failures (`../desk/cascade-*.json`).

## Not verified

Compact density on v16.52.0 (not asked). Real touch and screen reader behaviour. Browser locale in captures is en-US for both languages (the language comes from the User record; Arabic numerals come from the server).

## CI checks run locally

`ci-ruff.log`, `ci-unit-midad.log` (145 OK), `ci-unit-audits.log` (110 OK), `ci-build-check.log` (0 stale), `ci-audits.log` (passed; desk bundle 139.6 KB of 150 KB raw, 16.4 of 30 gzip). The bench rewrote `docs/audits/budgets.txt` and `dead_tokens.txt`; both were reverted.
