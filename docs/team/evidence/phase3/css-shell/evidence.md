# css-shell (css-A) evidence, Phase 3 P0

Labels: VERIFIED (I ran it), COMPUTED, ASSUMED, NOT VERIFIED.

## Done

Files written (desk partials, each with a two-line header; `ins_desk.bundle.scss` already imported all of them, so it is unchanged):

| File | Content |
|---|---|
| `institutional_theme/public/scss/desk/_shell.scss` | Sidebar item radius 4px, active item ring + accent bar at the inline start + strong label, anchor colour, dropdown menu item radius |
| `.../_page_head.scss` | Sticky `top: var(--ins-ribbon-height)` (0px without the ribbon), title 18px/600, breadcrumb type and separator colour |
| `.../_list.scss` | Head row type, sticky first column (subject) at `inset-inline-start: 0` with an opaque background following row state through `--ins-row-bg`, inline-start scroll padding, hover shadow removed, empty state, pagination selected state |
| `.../_reports.scss` | Datatable: inline padding by density, header weight/colour/background, totals row, hover, scroll padding. No height anywhere |
| `.../_grid.scss` | Child table head, empty state, scroll padding. No height |
| `.../_overlays.scss` | Dialog, freeze backdrop, dropdown and popover, tooltip, toast, awesomplete, datepicker |
| `.../_workspace.scss` | Number, shortcut and link cards: radius, elevation, hover, title type, link item colour |
| `.../_appearance.scss` | `.ins-sr-only`, fieldsets, option rows, swatch dots painted from `--ins-swatch-colour`, selected cue, help |
| `tests/browser/screens.mjs` | Screenshots of 6 P0 screens, en/ar x Light/Dark x comfortable/compact, `--inject` compiles and injects the SCSS |

Rule checks (VERIFIED by grep on the eight files): no `!important`, no literal colour, no physical `left/right/width/height` property. No datatable or grid row/cell height set.

## Verified

| Check | Command | Result |
|---|---|---|
| Compile, zero warnings | `node apps/frappe/node_modules/sass/sass.js --load-path=scss --load-path=apps/frappe/node_modules ins_desk.bundle.scss` | No output, exit 0 (VERIFIED) |
| Computed-style assertions, live desk, bundle injected | `cd tests/browser; PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node ../../docs/team/evidence/phase3/css-shell/assert.mjs` | 90 pass, 0 fail; 8 combinations (en/ar x Light/Dark x comfortable/compact) of 11 assertions each plus 2 on the Appearance page. Log `assert.log` (VERIFIED) |
| Assertions cover | sidebar active radius and ring, accent bar 3px and on the inline-start side (left in en, right in ar), page head sticky top, title 18px, list subject sticky with opaque background, list scroll padding 192px, datatable cell inline padding 12px/8px by density, header weight 500, no theme rule sets height on `dt-row`/`dt-cell`, dialog radius 8px with elevation, swatch dot painted with 1px border, `.ins-sr-only` hidden | VERIFIED |
| Screenshots | `node screens.mjs --inject`, output in `docs/team/evidence/phase3/screens/` | see "Screenshots" below |

## Screenshots

48 PNGs (1280x800, 4.1 MB total) in `docs/team/evidence/phase3/screens/<lang>-<mode>-<density>-<screen>.png`, screens `desktop`, `workspace` (Build), `list` (User), `form` (own User, tabs), `report` (User report view), `dialog` (frappe.ui.Dialog). Users `css-shell-{en,ar}-{light,dark}@midad.test`; density is set by writing `data-ins-density` after load (the same attribute `density.js` writes). Log: no page errors, `screenshots: 48`.

Opened and looked at (4): `ar-dark-compact-list`, `en-dark-comfortable-dialog`, `ar-light-compact-report`, `ar-light-comfortable-workspace`, plus en-light comfortable desktop, list, form, report, dialog, workspace and ar-dark comfortable list and desktop.
- Sidebar active item shows the 3px accent bar at the inline end (right side) in Arabic and at the left in English; in Dark the bar is the accent colour on the raised item.
- Page title is larger and bolder; the breadcrumb is muted; the list head is sunken with medium-weight text; compact rows are visibly denser than comfortable.
- Dialog in Dark: overlay surface with a hairline and rounded corners, primary button in the Dark primary, scrim visible. The Kind select shows a blank value because the fixture has no default.
- Report view in Arabic: header cells keep the sunken surface, cell text is padded at the inline edges; the checkbox column sits at the inline start (right). The first data row is core's empty total/filter row.
- Workspace cards in Arabic: hairline cards, titles at the inline start, link arrows mirrored.
- Not good: desktop app icons keep core's bright blue (inline colours, see Missing). In ar-dark the strip above the list filters is a slightly different tone than the page body (core's `.page-form` / filter area, not addressed).

## Missing, not verified

- NOT VERIFIED: the desktop (apps) screen icons. Their solid blue and grey fills are inline `style` colours chosen by JS (`frappe/public/js/frappe/utils/utils.js:1372-1389`, `desktop_pallete`); CSS cannot change an inline colour without `!important`. Left as core. Lead decision needed (the desk setting `desktop_icon_style` or a Python/JS change is outside my files).
- NOT VERIFIED: the sticky first column while scrolling horizontally on a very wide list. I verified the computed `position: sticky`, `inset-inline-start: 0` and background, not a scrolled screenshot. The selected-row colour for the sticky cell follows `:has(.list-row-checkbox:checked)` (ASSUMED browser support: Chromium yes).
- The datatable has its own sticky columns (`dt-cell--sticky`, observed in the DOM); I did not touch them. `scroll-padding-inline-start` values (192px list, 128px datatable and grid) are estimates of the frozen-column width.
- No child-table form screenshot with data: the User form has no editable child grid on its first tab. The grid rules are COMPUTED against the source, not seen rendered. ERPNext data was not created.
- Toast, awesomplete, datepicker, popover, tooltip, bulk-action bar, group-by sidebar, notification dropdown, account menu: rules written from the source, not seen in a screenshot.
- Toast colour bar at the inline start was not done (core has no element for it).
- Core `.fc-event` and `.bold` `!important` cases are outside my scope.
- `bench build` has not been run; screenshots use the injected compile, not the built bundle. Lead: please run `bench build --app institutional_theme` and a spot check.
- Arabic list: `.level-right` sticky block shadow and border in RTL come from core's own RTL stylesheet; I only removed the hover shadow.

## Selectors depended on (Frappe 16.32.0, paths under `frappe/public/`)

| Selector | Source | Purpose | If it changes |
|---|---|---|---|
| `.body-sidebar-container .body-sidebar .standard-sidebar-item`, `.active-sidebar`, `.item-anchor`, `.sidebar-item-label` | `scss/desk/sidebar.scss:19-23, 62-117, 271-274`; `js/frappe/ui/sidebar/sidebar.html:1`; `sidebar.js:389` | Sidebar radius, active ring and accent bar | Sidebar keeps core look (mapped colours still apply) |
| `.dropdown-menu-item` | `scss/desk/menu.scss:18-24`; `js/frappe/ui/menu.js:87-102` | Menu item radius | Core radius |
| `.page-head`, `.page-title .title-text` | `scss/desk/page.scss:119-130`, `page.js:735` | Sticky offset, title type | Head ignores the ribbon height; title is 16px |
| `.navbar-breadcrumbs a`, `a::before` | `scss/desk/breadcrumb.scss:6-30`; `ui/page.html:17` | Breadcrumb type, separator colour | Core grey breadcrumb |
| `.list-row`, `.list-row-head`, `.level-left .list-subject`, `.level-right`, `.list-row-checkbox` | `scss/desk/list.scss:137-178, 223-250, 329`; `js/frappe/list/list_view.js:771, 825, 1025` | Head type, sticky first column, row state | Column not sticky |
| `.frappe-list .result-container` | `scss/desk/list.scss:1-27`; `js/frappe/list/base_list.js` | Scroll padding | Focus can hide under the sticky column |
| `.msg-box` | `scss/desk/global.scss:538-542` | Empty state | Core empty state |
| `.list-paging-area .btn-group .btn.btn-paging.btn-info` | `scss/desk/list.scss:293-312`; `js/frappe/list/base_list.js:377-406` | Selected page-size button | Core look |
| `.datatable .dt-cell__content`, `.dt-header .dt-cell--header`, `.dt-row-header`, `.dt-row`, `.dt-cell`, `.dt-row-totalRow`, `.dt-scrollable` | `node_modules/frappe-datatable/dist/frappe-datatable.css:118, 185`; `src/rowmanager.js:353`; `scss/desk/frappe_datatable.scss:55-63, 113` | Padding, header type, totals | Core datatable look; geometry untouched |
| `.grid-heading-row`, `.grid-heading-row .grid-row`, `.grid-empty`, `.form-grid .grid-body .rows` | `scss/common/grid.scss:19-35, 154-169` | Child table head and empty state | Core look |
| `.modal-content`, `#freeze`, `#freeze.in`, `.freeze-message-container`, `.dropdown-menu`, `.popover`, `.tooltip-content`, `.desk-alert`, `.awesomplete > ul` | `scss/desk/global.scss:327-330, 347-352, 511-531`; `scss/desk/form.scss:3-11`; `scss/desk/toast.scss:12-40`; bootstrap `.modal-content` | Overlays | Core overlay look |
| `.datepicker` | air-datepicker markup (UNVERIFIED in this source tree, selector is the library's) | Datepicker surface | Core look |
| `.widget.number-widget-box`, `.shortcut-widget-box`, `.links-widget-box`, `.widget-title`, `.link-item`, `.number` | `scss/desk/desktop.scss:91-100, 538-600, 636-665`; `js/frappe/widgets/number_card_widget.js:26, 286`; `shortcut_widget.js:78`; `links_widget.js:27, 106` | Workspace cards | Core look |
| `.ins-*` Appearance markup | `docs/team/evidence/phase3/runtime/evidence.md:99` | Appearance page | Appearance page unstyled |

No `!important` introduced.

## Strings

None. The CSS adds no user-visible text.
