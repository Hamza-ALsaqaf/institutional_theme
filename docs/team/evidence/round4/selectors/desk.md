# Desk selectors added for Frappe v16.52.0 (round 4, css-engineer)

> Corrected by scribe (round-4 second pass, 2026-10-14): the lines marked "corrected by scribe" were checked against `/tmp/src/frappe-16.32.0`, `/tmp/src/frappe-16.52.0` and the bench node_modules. The rest of this file is as the engineer wrote it.


Evidence level: COMPUTED from source (both trees read at `v16.32.0` and `v16.52.0`; frappe-gantt from `/home/frappe/newest-bench/apps/frappe/node_modules` 1.1.0 and `/home/frappe/frappe-bench/...` 0.6.1) and compiled (`build-1632.log`: `bench build --app institutional_theme` exit 0, no warnings). Nothing here was rendered; the rendering checks are a later task. Every new selector sits next to the old one; where it is absent it matches nothing. No `!important` added, no datatable height touched, only `--ins-*` tokens used.

All paths are under `frappe/public/` unless stated. "Theme" paths are under `institutional_theme/public/scss/desk/`.

## G4. Names gone from core

| Old name (16.32.0) | New markup (v16.52.0) | Theme file: rule |
|---|---|---|
| `.dropdown-menu-item` (`js/frappe/ui/menu.js:102`, `ui/sidebar/sidebar_header.js:352`, `scss/desk/menu.scss:18`) | `.es-menu__item` rows inside `.es-menu` (`js/frappe/ui/components/menu.js:331-332`, `css/espresso/components/menu.css:81`) | `_shell.scss` radius; `_base.scss` inset focus ring for `.es-menu` |
| `.dropdown-menu`, `.popover` panels (Bootstrap) | `.es-menu` (`menu.css:44`), `.es-popover` (`css/espresso/components/popover.css:28`); `.dropdown-menu` stays only as a hidden item store (`ui/page.html:49,58`) | `_overlays.scss` surface, hairline, radius, elevation |
| `.page-title .title-text` (list title crumb, `views/breadcrumbs.js:216,219`; `scss/desk/mobile.scss:357`) | last crumb `.es-breadcrumbs li:last-child .es-breadcrumbs__item` (`ui/page.js:1048-1058` `set_title`, `ui/components/breadcrumbs.js:55-80`, `breadcrumbs.css:100`) | `_page_head.scss` 18px / 600 title |
| `ul.navbar-breadcrumbs > li > a` (`ui/page.html:17` in 16.32.0) | `nav.es-breadcrumbs.navbar-breadcrumbs > ol > li > a\|button\|span.es-breadcrumbs__item` (`ui/page.html:17`, `breadcrumbs.css:61`) | `_page_head.scss` crumb colour/size, hover, inset focus ring, `ol > li` target size |
| separator on `a::before` (`scss/desk/breadcrumb.scss:9-20`) | separator on `.es-breadcrumbs li + li::before` (`breadcrumbs.css:40`) | `_page_head.scss` colour and margin |
| `.btn-paging.btn-info` (`list/base_list.js:377,397`, `scss/desk/list.scss:300`) | `frappe.ui.TabButtons`: `.es-tab-buttons > .es-pill[data-state="active"]` (`list/base_list.js:388-399`, `css/espresso/components/tab_buttons.css:65,114,289`) | `_list.scss` selected fill, rail and pill radius |
| `.desk-alert` (`ui/messages.js:443`, `scss/desk/toast.scss:12`) | `.es-toast` in `.es-toast-container` (`ui/messages.js:430` `show_alert`, `ui/components/toast.js:32-57`, `css/espresso/components/toast.css:34`) | `_overlays.scss` hairline, radius, dialog elevation |
| `.breadcrumb { background: white }` (`scss/desk/breadcrumb.scss:4`) | file deleted; no replacement needed | `_hardcoded.scss` rule left in place (harmless) |
| `.onb-progress-badge`, `.onb-progress-badge-complete` (`ui/user_onboarding/user_onboarding.bundle.js:209-275`) | directory `ui/user_onboarding` no longer exists in v16.52.0; no replacement | `_core_contrast.scss` rules left in place (match nothing) |

Names still present in both and therefore unchanged: `.navbar-breadcrumbs` (now on the `nav`), `.body-sidebar`, `.standard-sidebar-item`, `.active-sidebar`, `.item-anchor`, `.sidebar-item-label` (16.32.0 `scss/desk/sidebar.scss:36,85,271,112,103`; v16.52.0 `:54,144,544,198,171`).

Not replaced, by design: `.es-tooltip` (`tooltip.css:28`, bubble and arrow both read `--surface-gray-10`; a selector would split the arrow from the bubble), so it is left to the variable map (see "Variables for the backend").

## G5. frappe-gantt 0.6.1 to 1.1.0

| Old | New | Theme rule |
|---|---|---|
| `.gantt .today-highlight` (SVG rect, `frappe-gantt.css:25`, `index.js:439` of 0.6.1) | `.current-highlight` (line, `src/styles/gantt.css:182`), `.current-ball-highlight` (`:189`), `.current-date-highlight` (header chip, `:196`) all painted by `--g-today-highlight` | `_gantt.scss`: `--g-today-highlight: var(--ins-primary)` and `--g-text-light: var(--ins-on-primary)` for the chip text; the old rule is kept |
| `.gantt .grid-header` SVG `fill`/`stroke` | `div.grid-header` direct child of `.gantt-container` (`src/index.js:471`) painted by `--g-header-background`, `--g-row-border-color` | `_gantt.scss` `--g-*` block (20 variables, all declared on `.gantt-container`, unread by 0.6.1) |
| `.upper-text`, `.lower-text` SVG `fill` | divs coloured by `color` | both `fill` and `color` set |
| (n/a) `.tick.thick` | `.gantt .tick.thick` (`gantt.css`, thicker) | stroke `--ins-border-strong` |
| (n/a) `.current-upper` literal `background: #fff` (`gantt.css:116`) | | `--ins-surface-raised` |
| popup `rgba` dark, white `.title` from core `frappe_gantt.scss` | popup `background: #fff` while core still paints a white `.title` and `--gray-500` `.subtitle` (`scss/desk/frappe_gantt.scss:6-16`): white on white | `.gantt-container:has(> .grid-header) .popup-wrapper`, `.title`, `.subtitle` (true only for 1.1.0, whose header is a div child of the container; 0.6.1's is an SVG rect) |
| `.gantt-modern .gantt ...` (class added by 16.32.0 `views/gantt/gantt_view.js:96`) | class is no longer added (`gantt_view.js` of v16.52.0 has no `addClass`); `scss/desk/frappe_gantt.scss:1,84` still names it (corrected by scribe; `:25` is not a `.gantt-modern` line in 16.32.0) | every `.gantt-modern .gantt*` rule and the RTL `direction: ltr` pin re-keyed on `.gantt-container` (created by both libraries, `index.js:62`) |

Not themed: `.gantt .grid-column:hover { fill: #3131310d !important }` (library, `!important` on `fill`; a translucent dark that is faint on Dark; matching it would need a theme `!important`).

## G6. Form error classes

`has-error-mandatory` and `has-error-invalid` (`js/frappe/form/controls/base_input.js:270-286`) are always set together with `has-error` (`has-error` is `is_invalid || mandatory-and-empty`); 16.32.0 sets only `has-error` (`base_input.js:277,286`). Frappe's own rule is on `.has-error` (`scss/common/controls.scss:259,272`).

| File | Change |
|---|---|
| `_controls.scss` | `$ins-has-error: ":is(.has-error, .has-error-mandatory, .has-error-invalid)"` replaces every `.has-error` after `.frappe-control` (same specificity as one class) |
| `js/shell/field_errors.js` | `aria-invalid="true"` when any of the three classes is present. Core writes no per-field message element in either version (the `.help-box` holds the field description, not an error), so there is no error description to link and no `aria-describedby` is set |

## G8. The new shell (icon rail dock, tree sidebar, panels)

| Element (v16.52.0, `scss/desk/`) | Theme rule |
|---|---|
| `.body-sidebar`, `.standard-sidebar-item`, `.active-sidebar` (`sidebar.scss:54,144,544`), same classes as 16.32.0 | Existing `_shell.scss` rules apply to both; added: `.active-sidebar .item-anchor` takes `--ins-text-strong` (core's `--ink-gray-8` at (0,4,0) lost to the theme's anchor rule) |
| Collapsed rail: `.body-sidebar-container:not(.expanded) .sidebar-item-container:has(> .nested-container.hidden .active-sidebar) > .standard-sidebar-item` (`sidebar.scss:365-375`) | `_shell.scss` `$ins-rail-active-group`: hairline ring, `--ins-radius-sm`, strong anchor |
| `.dock`, `.dock-item`, `.dock-item.active` (`dock.scss:30,145,203`; markup `ui/sidebar/dock.js:21-40,305-312`) | new `_dock.scss`: tile radius, active ring and inline-start accent bar (as the sidebar row), floating tray hairline and `--ins-radius-lg` (`body:not(.dock-pinned)`) |
| `.sidebar-panel` (`sidebar_panel.scss:8-32`, literal `rgba(0,0,0,.1) 8px 0 8px`, physical `border-right`) and `.panel-header .panel-header-actions span` | `_dock.scss`: `border-color` (side-agnostic, so core's own RTL flip is not doubled), overlay elevation token, 4px radius |
| `.body-sidebar-container.expanded .overlay` below md: literal `rgba(0,0,0,.5)` (`sidebar.scss:535`; 16.32.0 `rgba(128,128,128,.5)` at `:256` (corrected by scribe; was `:255`)) | `_hardcoded.scss`: `--ins-surface-scrim`, so the scrim is token-driven on both versions (small intended change on 16.32.0) |
| Pinned dock is a third full-height in-flow column of `body` (`dock.scss:223-246`) | `_banners.scss`: three grid columns and the row reset when a banner exists; `_ribbon.scss`: dock clears the environment ribbon |
| Scrollers that clip: `.es-menu` (`menu.css:52`), `.dock`/`.dock-items` (`dock.scss:50,249`), `.body-sidebar-top` (`sidebar.scss:112`) | `_base.scss`: added to the inset-focus-ring container list |

Not styled, by design: `.sidebar-edge` and `.sidebar-collapse-arrow` (`sidebar.scss:388,433`) read `--outline-gray-3`, `--outline-gray-2`, `--surface-elevation-3`, `--shadow-sm` (mapping only); `.shell-header` (`sidebar_header.scss:9`) reads `--surface-gray-3`, `--surface-elevation-2`, `--ink-gray-*` (mapping only); `.sidebar-user-button` hover reads `--surface-gray-2` and `--radius`. Core's `.section-break { color: var(--ink-gray-5) !important }` is left to the map.

## Variables for the backend (mapping, no selector)

Declared by v16.52.0 desk shell and read by the rules above or by core components I did not override. Light and Dark both need values.

- Shell: `--desk-sidebar-bg` (declared twice: `:root` and `[data-theme="dark"]`, `sidebar.scss:24,28` (corrected by scribe: `:15,19` are comments in 16.52.0); the Dark override has specificity (0,2,0), so the generated Dark map must use a selector of equal or higher specificity), `--dock-bg` (defaults to it), `--dock-ink`, `--dock-ink-hover`, `--dock-ink-active`, `--surface-elevation-2`, `--surface-elevation-3` (active row, active dock tile, collapse arrow), `--outline-elevation-2`, `--surface-alpha-gray-2` (menu highlight), `--surface-gray-8`, `--surface-gray-9` (toast), `--surface-gray-10` (tooltip bubble and arrow), `--surface-red-3` (destructive menu row), `--ink-base` (text on the inverse toast and tooltip, light on both modes), `--ink-gray-3`, `--ink-blue-link`, `--ink-blue-5`, `--ink-green-5`, `--ink-amber-5`, `--ink-red-5` (toast icons).
- Effects: `--focus-outline-default` (`css/espresso/effects.css:28,43`; read by `.es-pill`, `.es-breadcrumbs__item`, `.es-toast__action`; the theme's ring wins by specificity on `button`/`a`, the map should still point it at the ring), `--elevation-base`, `--elevation-2`, `--elevation-lg`, `--elevation-xl`, `--elevation-2xl` (menu, popover, toast, tab pill), `--radius`, `--radius-md`, `--radius-lg`, `--radius-4`, `--radius-5` (dock tile and logo radius).
- Layout, not to be mapped: `--sidebar-width`, `--sidebar-collapsed-width`, `--dock-tile`, `--dock-width`, `--spacing`, `--page-head-height`.
- Gantt `--g-*` are third-party and are mapped in `_gantt.scss` (not by the generated map).

## Unresolved or for the lead

- `js/shell/a11y_rules.js:268` selects `.navbar-breadcrumbs > li:first-child > a` for the home-link name. v16.52.0 has no home-icon crumb (trail starts at the module, `views/breadcrumbs.js:150-211`), so the rule is simply idle there; the file is not mine, so I did not edit it. Other crumbs are named by their visible label.
- Page status chip: v16.52.0 renders `span.es-badge.page-indicator-pill` (`ui/page.html:24`) instead of `.indicator-pill`; the status partial (`_status.scss`) was not in G4 and was not changed. It needs a check in the rendering pass.
- Crumb target size (WCAG 2.5.8) of `.es-breadcrumbs__item` (padding `--spacing` block, 16px line) is unmeasured; measure in the rendering pass.
- Gantt 1.1.0 RTL: the `direction: ltr` pin on the container is carried over by analogy; whether 1.1.0 needs it in RTL is unverified.
- Menu/popover shape rule sets `--ins-radius-md` but not their surface: `--surface-elevation-2` must be mapped (above) or the panels stay core-coloured.
