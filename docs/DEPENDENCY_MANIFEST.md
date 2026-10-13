# Dependency manifest

Verified target: Frappe 16.32.0, ERPNext 16.33.0, HRMS 16.20.1 (CLAUDE.md). Every Frappe path below is relative to the `frappe` package root of the 16.32.0 tag. Status labels: VERIFIED (the source line was opened, or the behaviour was run), COMPUTED, ASSUMED, UNVERIFIED. An entry marked UNVERIFIED is not to be read as VERIFIED.

Compiled from the evidence files named in each section. No row was added from memory.

## 1. Hooks enabled in `institutional_theme/hooks.py`

Generated from: `institutional_theme/hooks.py`, `docs/team/evidence/phase3/runtime/HOOKS_ON.md`, `docs/team/evidence/phase3/runtime/evidence.md` ("Hooks confirmed in Frappe 16.32.0 source"), `docs/team/evidence/phase3/web/evidence.md` (hooks section).

Note on staleness: `runtime/HOOKS_ON.md` and `runtime/evidence.md` (login page row) say `web_include_css` is still off. Commit `8e88dee` ("feat: enable the web bundle and the web content hook") enabled `web_include_css` and `web_include_js` in `hooks.py`, and `public/scss/ins_web.bundle.scss` and `public/js/ins_web.bundle.js` exist. The current `hooks.py` is the reference; the two runtime files are not updated for that change.

| Hook | Value in `hooks.py` | Target in this app | Frappe 16.32.0 consumer (file:line) | Status |
|---|---|---|---|---|
| `app_include_css` | `["ins_desk.bundle.css"]` | `public/scss/ins_desk.bundle.scss` | `www/desk.py:38-39` (hooks plus `site_config`), `:49-50` (context); `www/desk.html:24-26` (`include_style`, list order) | VERIFIED |
| `app_include_js` | `["ins_shell.bundle.js"]` | `public/js/ins_shell.bundle.js`, `public/js/shell/*.js` | `www/desk.py:38,49` | VERIFIED |
| `web_include_css` | `["ins_web.bundle.css"]` | `public/scss/ins_web.bundle.scss` (exists) | No consumer line recorded in any evidence file | UNVERIFIED (consumer not opened) |
| `web_include_js` | `["ins_web.bundle.js"]` | `public/js/ins_web.bundle.js` (exists) | No consumer line recorded in any evidence file | UNVERIFIED (consumer not opened) |
| `update_website_context` | `institutional_theme.website.update_website_context`, `institutional_theme.web_content.update_website_context` (in this order) | `website.py`, `web_content.py` | `website/page_renderers/base_template_page.py:69-75` (loops over the hook list, merges return dicts, no exception guard) | VERIFIED |
| `extend_bootinfo` | `institutional_theme.boot.extend_bootinfo` | `boot.py` | `sessions.py:169-170` (called with `bootinfo=`); cache read `sessions.py:139-147`, so `bootinfo.ins` is never cached | VERIFIED |
| `doc_events` (`Institutional Theme Settings`, `on_update`) | `institutional_theme.site_files.on_settings_update` | `site_files.py` | `model/document.py:1650-1660` (handler called as `(doc, method)`) | VERIFIED |
| `after_migrate` | `institutional_theme.install.after_migrate` | `install.py` | `migrate.py:200-203` (called with no arguments) | VERIFIED |
| `before_uninstall` | `institutional_theme.install.before_uninstall` | `install.py` | `installer.py:445-446` (called with no arguments) | VERIFIED |
| `doc_events` (`Institutional Theme Settings`, `on_update`), second handler | `institutional_theme.print.ship.on_settings_update` | `print/ship.py` | Same consumer as the row above (`model/document.py:1650-1660`; the hook value is a list of handlers). Round 2 backend evidence, item 6 and "Decisions" 7 | VERIFIED (registration; hook test, backend round 2 item 6) |
| `jinja` (`methods`) | `institutional_theme.identity.ins_identity` (function path, not module path) | `identity.py` | `utils/jinja.py:223-250` (a function path exposes that function only); rendered as `www/printview.py:231-241` does (backend round 2 item 5) | VERIFIED |
| `after_install` | `institutional_theme.install.after_install` | `install.py` | Frappe consumer line not recorded in the round-2 evidence. Registration verified by the hook test (backend round 2 item 6) | UNVERIFIED (consumer not opened) |
| `email_css` | `["ins_email.bundle.css"]` (appended after `email.bundle.css` and `email_erpnext.bundle.css`) | `public/scss/ins_email.bundle.scss` | `email/email_body.py:477`; `frappe.get_hooks("email_css")` lists it (backend round 2 item 8; print-web round 2 item 5, Premailer output checked) | VERIFIED |

Per-user and per-site links that are not hooks (palette bundles `ins_palette_<name>.bundle.css`, font bundles `ins_fonts_noto|tajawal.bundle.css`) are linked by `update_website_context` only when `<name>` and `rtl_<name>` are both in the asset manifest. Source: `runtime/HOOKS_ON.md`, `runtime/evidence.md`.

Asset manifest and bundle discovery (for the build step): `utils/__init__.py:950-967` (`get_assets_json()` merges `assets.json` and `assets-rtl.json`), `utils/jinja_globals.py:147-157` (`bundled_asset`), `esbuild/esbuild.js:258` and `esbuild/utils.js:27-37` (bundles under `public/**/*.bundle.*`; JS bundles only at the top of `public/js`). Source: `runtime/evidence.md`. VERIFIED.

Phase 3 note (`runtime/HOOKS_ON.md`): `email_css`, `jinja` and `after_install` were then not enabled. Round 2 enabled them; `hooks.py` lines 33, 50 and 55 now hold them, and their rows are in the table above. `after_install` now ships the Print Style and Letter Head (never as the default), so the phase 3 note "install changes nothing" no longer holds.

## 2. Frappe selectors the CSS depends on

Generated from: `docs/team/evidence/phase3/css-form/evidence.md` ("Selectors depended on (16.32.0, `frappe/public/`)"), `docs/team/evidence/phase3/css-shell/evidence.md` ("Selectors depended on (Frappe 16.32.0, paths under `frappe/public/`)"), `docs/team/evidence/phase3/web/evidence.md` ("Selectors depended on (Frappe 16.32.0, `frappe/` relative)"). Our-file column found by string search of `institutional_theme/public/scss` on this checkout. The search is a current-tree check, not part of the evidence files.

Path prefixes: css-form and css-shell rows are under `frappe/public/` (the `node_modules/...` row of css-shell is written as the evidence wrote it). Web rows are under `frappe/`.

### 2a. Desk, form (css-form)

| Selector | Our file | Frappe 16.32.0 source (file:line) | What breaks if it changes | Status |
|---|---|---|---|---|
| `.indicator-pill` | `desk/_form.scss`, `desk/_status.scss`, `desk/_base.scss` | `scss/common/indicator.scss:2` | Status pills and shapes vanish | VERIFIED |
| `.control-label.reqd:after` | `desk/_controls.scss` | `scss/common/controls.scss:151` | Required-marker colour reverts | VERIFIED |
| `.like-disabled-input` | `desk/_controls.scss`, `desk/_masked.scss` | `js/frappe/form/controls/base_input.js:29`, `scss/common/form.scss:14` | Read-only and masked value; read-only cue reverts to core | VERIFIED |
| `.form-tabs-list .form-tabs .nav-item .nav-link` | `desk/_form.scss` | `scss/desk/form.scss:484-500` | Tab styling and focus ring; tabs unstyled | VERIFIED |
| `.form-message` (colour classes) | `desk/_typography.scss`, `desk/_form.scss` | `scss/desk/form.scss:359-378` | Banners; banner pairs revert | VERIFIED |
| `.form-links .document-link` | `desk/_form.scss` | `scss/desk/form.scss:239` | Connection links | VERIFIED |
| `.form-section .section-head` | `desk/_typography.scss`, `desk/_form.scss` | `scss/desk/form.scss:41` | Section headings | VERIFIED |
| `.fc-event-main-frame`, `.fc-daygrid-dot-event` | Not found in `public/scss` on this checkout | `scss/desk/calendar.scss:71, 99` | Calendar event text (stays core blue). The `!important` in core is on these two selectors, see section 4 | VERIFIED (core line); our rule absent |
| `.btn.btn-primary`, `.btn.btn-secondary` | `desk/_actions.scss` | `scss/common/buttons.scss:80,117` | Button fills and the `--control-bg` rule | VERIFIED |
| `.btn.btn-default` | Not found as a selector; only `--btn-default-bg` / `--btn-default-hover-bg` in `generated/_frappe_map.scss` | `scss/common/buttons.scss:80,117` (cited with the rows above) | Default button fill | VERIFIED (core line); our selector absent |
| `.modal`, `.form-in-grid` | `desk/_scoped_variables.scss`, `desk/_controls.scss`, `desk/_overlays.scss`, `desk/_base.scss` | Cited from the draft partials: `desk/dark.scss:174-175` | Descendant variable scopes; Dark dialog fields revert to core grey | UNVERIFIED (css-form says "not re-opened this session") |
| `.grid-body .editable-row` | `desk/_scoped_variables.scss`, `desk/_controls.scss`, `desk/_grid.scss`, `desk/_base.scss` | Cited from the draft partials: `desk/dark.scss:189-193`, `common/grid.scss:283-286` | Descendant variable scopes | UNVERIFIED (not re-opened) |
| `.chart-container` | `desk/_scoped_variables.scss`, `desk/_dashboard.scss` | Cited from the draft partials: `desk/dark.scss:222-234` | Descendant variable scopes | UNVERIFIED (not re-opened) |
| `.new-timeline .timeline-item` | `desk/_typography.scss`, `desk/_form.scss` | No source line given in the evidence | Descendant variable scopes | UNVERIFIED (no line recorded) |
| `.switch-control` | `desk/_controls.scss` | Cited from the draft partials: `controls.scss:709-806` | Descendant variable scopes | UNVERIFIED (not re-opened) |
| `.rating` | `desk/_scoped_variables.scss` | No source line given in the evidence | Descendant variable scopes | UNVERIFIED (no line recorded) |
| `get_textstyle` letter-spacing | `desk/_typography.scss`, `desk/_ribbon.scss` | Cited from the draft partials: `espresso/_typography.scss:99` | Letter-spacing on Arabic text | UNVERIFIED (not re-opened) |
| `.modal` and related descendant rules (overall) | as above | Frappe source of the rows above | Dark dialog fields revert to core grey | UNVERIFIED (css-form row says "Not re-opened this session") |

Theme-owned attributes, not Frappe selectors (set by the shell script, ADR 0008): `data-ins-docstatus`, `data-ins-new`, `data-ins-action`, `data-ins-masked`, `data-ins-masked-label`, `html[data-ins-environment]`, `.ins-env-ribbon`. Source: css-form evidence, line 51.

### 2b. Desk shell, lists, reports, overlays (css-shell)

| Selector | Our file | Frappe 16.32.0 source (file:line) | What breaks if it changes | Status |
|---|---|---|---|---|
| `.body-sidebar-container .body-sidebar .standard-sidebar-item`, `.active-sidebar`, `.item-anchor`, `.sidebar-item-label` | `desk/_shell.scss` | `scss/desk/sidebar.scss:19-23, 62-117, 271-274`; `js/frappe/ui/sidebar/sidebar.html:1`; `js/frappe/ui/sidebar/sidebar.js:389` | Sidebar radius, active ring and accent bar; sidebar keeps core look | VERIFIED |
| `.dropdown-menu-item` | `desk/_shell.scss` | `scss/desk/menu.scss:18-24`; `js/frappe/ui/menu.js:87-102` | Menu item radius | VERIFIED |
| `.page-head`, `.page-title .title-text` | `desk/_page_head.scss`, `desk/_ribbon.scss`, `desk/_base.scss` | `scss/desk/page.scss:119-130`; `js/frappe/ui/page.js:735` | Sticky offset; title type (16px if it changes) | VERIFIED |
| `.navbar-breadcrumbs a`, `a::before` | `desk/_page_head.scss` | `scss/desk/breadcrumb.scss:6-30`; `js/frappe/ui/page.html:17` | Breadcrumb type and separator colour | VERIFIED |
| `.list-row`, `.list-row-head`, `.level-left .list-subject`, `.level-right`, `.list-row-checkbox` | `desk/_list.scss`, `desk/_base.scss` | `scss/desk/list.scss:137-178, 223-250, 329`; `js/frappe/list/list_view.js:771, 825, 1025` | Head type, sticky first column, row state; column not sticky | VERIFIED |
| `.frappe-list .result-container` | `desk/_list.scss`, `desk/_base.scss` | `scss/desk/list.scss:1-27`; `js/frappe/list/base_list.js` | Scroll padding; focus can hide under the sticky column | VERIFIED |
| `.msg-box` | `desk/_list.scss` | `scss/desk/global.scss:538-542` | Empty state | VERIFIED |
| `.list-paging-area .btn-group .btn.btn-paging.btn-info` | `desk/_list.scss` | `scss/desk/list.scss:293-312`; `js/frappe/list/base_list.js:377-406` | Selected page-size button | VERIFIED |
| `.datatable .dt-cell__content`, `.dt-header .dt-cell--header`, `.dt-row-header`, `.dt-row`, `.dt-cell`, `.dt-row-totalRow`, `.dt-scrollable` | `desk/_base.scss`, `desk/_typography.scss`, `desk/_reports.scss` | `node_modules/frappe-datatable/dist/frappe-datatable.css:118, 185`; `node_modules/frappe-datatable/src/rowmanager.js:353`; `scss/desk/frappe_datatable.scss:55-63, 113` | Padding, header type, totals; geometry is not overridden (findings section 5) | VERIFIED |
| `.grid-heading-row`, `.grid-heading-row .grid-row`, `.grid-empty`, `.form-grid .grid-body .rows` | `desk/_grid.scss` | `scss/common/grid.scss:19-35, 154-169` | Child table head and empty state | VERIFIED |
| `.modal-content`, `#freeze`, `#freeze.in`, `.freeze-message-container`, `.dropdown-menu`, `.popover`, `.tooltip-content`, `.desk-alert`, `.awesomplete > ul` | `desk/_overlays.scss`, `desk/_shell.scss`, `desk/_actions.scss`, `desk/_hardcoded.scss` | `scss/desk/global.scss:327-330, 347-352, 511-531`; `scss/desk/form.scss:3-11`; `scss/desk/toast.scss:12-40`; Bootstrap `.modal-content` | Overlay look; core look if it changes | VERIFIED |
| `.datepicker` | `desk/_overlays.scss` | Air-datepicker markup, not located in this source tree | Datepicker surface | UNVERIFIED (css-shell: "UNVERIFIED in this source tree, selector is the library's") |
| `.widget.number-widget-box`, `.shortcut-widget-box`, `.links-widget-box`, `.widget-title`, `.link-item`, `.number` | `desk/_workspace.scss` | `scss/desk/desktop.scss:91-100, 538-600, 636-665`; `js/frappe/widgets/number_card_widget.js:26, 286`; `shortcut_widget.js:78`; `links_widget.js:27, 106` | Workspace cards; core look | VERIFIED |

Theme-owned, not a Frappe selector and not listed above: the `.ins-*` Appearance markup (`desk/_appearance.scss`, contract in `runtime/evidence.md`).

### 2c. Website, login, error pages (web)

Paths are relative to `frappe/`.

| Selector | Our file | Frappe 16.32.0 source (file:line) | What breaks if it changes | Status |
|---|---|---|---|---|
| `body[data-path]`, body class, `banner_html`, `body_include` slots | `web/_base.scss`, `web/_login.scss` | `templates/base.html:57, 61-62, 115` | Page body hooks for the auth and error pages | VERIFIED |
| `.page-content-wrapper` (min-height, padding) | `web/_login.scss` | `public/scss/login.bundle.scss:5-13`; `templates/web.html:8` | Page spacing | VERIFIED |
| `.page_content` (min-height 50vh) | `web/_error_pages.scss`, `web/_login.scss` | `public/scss/website/index.scss:128-130` | Page height | VERIFIED |
| `.for-login .page-card` and siblings `.for-forgot`, `.for-login-with-email-link`, `.for-signup`, `.for-email-login`, `.for-reset-password` | `web/_login.scss` | `login.bundle.scss:27-50`; `www/login.html:119, 135, 150, 165`; `www/update-password.html:14` | Login card per screen | VERIFIED |
| `.page-card form`, `.form-group` | `web/_login.scss` | `login.bundle.scss:52-70` | Form layout | VERIFIED |
| `.page-card-actions .btn-login`, `.btn-ldap-login`, `.btn-signup`, `.btn-login-option` | `web/_login.scss`, `web/_base.scss` | `login.bundle.scss:72-165`; `www/login.html` (`email_login_body`) | Login buttons | VERIFIED |
| `.page-card-body` inputs, `.form-label`, `.field-icon`, `.email-field`, `.password-field`, `.toggle-password`, `.forgot-password-message`, `.login-error-banner`, `.login-success-banner`, `.field-error`, `.invalid` | `web/_login.scss` | `login.bundle.scss:210-352`; `www/login.html:9-48` | Field, banner and error states; password reveal icon is replaced by `ins_web.bundle.js` (`.ins-reveal`) | VERIFIED |
| `.sign-up-message` | `web/_login.scss` | `login.bundle.scss:356-372`; `www/login.html:125, 168` | Sign-up message | VERIFIED |
| `.page-card-head`, `img.app-logo`, `h4`, `.page-card-subtitle` | `web/_login.scss`, `web/_error_pages.scss` | `login.bundle.scss:398-435`; `www/login.html:92-93` | Login masthead | VERIFIED |
| `.invalid-login` (wiggle) | `web/_login.scss` | `login.bundle.scss:374-376` | Error animation; reduced-motion rule | VERIFIED |
| 2FA: `#twofactor_div`, `.form-verify`, `#login_token`, `#verify_token`, `.text-muted` hint | `web/_login.scss` | `templates/includes/login/login.js:365-381` | 2FA screen | VERIFIED |
| Update-password strength: `.for-reset-password .password-strength-bar-track` | `web/_login.scss` | `login.bundle.scss` (reset-password block); `www/update-password.html:55` | Password strength bar | VERIFIED |
| `.error-page`, `.details`, `h4`, `.error-content`, `.btn-primary` | `web/_error_pages.scss`, `web/_base.scss` | `public/scss/website/error-state.scss:1-24`; `www/error.html:19, 33-45`; `www/message.html:14-28` | Error and message pages | VERIFIED |

Note: the web evidence row for `.btn-primary` in `web/_error_pages.scss` was not in the three-file list; it is listed here because the error-page row includes it.

### 2d. Desk, round 2 (css, css2)

Source: `docs/team/evidence/round2/css/evidence.md` ("Selectors depended on (16.32.0)") and `docs/team/evidence/round2/css2/evidence.md` ("Selectors depended on (16.32.0)"). Paths are written as the evidence gave them. Where the evidence gave no directory the path is shown as given. "Our file" is found by string search of `institutional_theme/public/scss` on this checkout.

| Selector | Our file | Frappe 16.32.0 source (file:line) | What breaks if it changes | Status |
|---|---|---|---|---|
| `.fc-event` (`border: none !important`), `.fc-event-main`, `.fc-daygrid-dot-event` | `desk/_calendar.scss` (Dark chips, lines 33-39) | `calendar.scss:65` (core `.fc-event`); `.fc-event-main`, `.fc-daygrid-dot-event` as in section 2a | Dark chip surface, stripe and text colour; the stripe depends on core resetting the border colour | VERIFIED |
| `.frappe-control.has-error`, `.control-input`, `[data-fieldtype]` | `desk/_controls.scss` (lines 87, 101) | `base_input.js:277` (mandatory), `:286` (invalid); `controls.scss:222` (styling) | Error mask icon on `.control-input::after`, input `padding-inline-end` 32px; forced-colours behaviour | VERIFIED |
| `.tree-children`, `.tree-label`, `.tree-node-toolbar` | `desk/_tree.scss` | `tree.scss:46,51,108` (directory not recorded in the evidence) | Tree indent, labels and toolbar; the theme sets logical properties only, so no physical override remains | VERIFIED |
| `.gantt .grid-header`, `.grid-row`, `.row-line`, `.tick`, `.today-highlight`, `.upper-text`, `.lower-text`, `.bar-progress` | `desk/_gantt.scss` | `node_modules/frappe-gantt/dist/frappe-gantt.css:1-27,91-100`, loaded lazily by `gantt_view.js:228` | Chart canvas (core literal white and greys) mapped for Dark; breaks silently if frappe-gantt changes | VERIFIED (third-party, frappe-gantt 0.6.1) |
| `.gantt-container` | `desk/_gantt.scss:61` (`[dir="rtl"] .gantt-modern .gantt-container { direction: ltr }`) | `gantt_view.js`; `frappe_gantt.scss:88` (as given) | Without the rule every bar is off screen in an RTL scroll container (first bar at x=-970). Remove the rule if frappe-gantt gains RTL support | VERIFIED |
| `body { padding: 0 !important }`; `body { display: flex; align-items: flex-start }`; `.main-section { height: 100vh; overflow }` | `desk/_ribbon.scss`, `desk/_banners.scss` | `mobile.scss:1-5`; `main.scss:28-35`; `main.scss:37-43` | Ribbon and banner offsets. The theme does not rely on core `body` padding (core's `!important` out-ranks it); the ribbon offsets the sidebar and main section instead | VERIFIED |
| `.body-sidebar`, `.body-sidebar-container`, `.body-sidebar-container.expanded .body-sidebar` | `desk/_ribbon.scss`, `desk/_banners.scss` | `sidebar.scss:34-52`; `sidebar.scss:23-27`; `sidebar.scss:168-216` (mixin) | Sidebar offset under the ribbon and banner; sidebar height (`100vh`) | VERIFIED |
| `.page-head` sticky `top: 0` | `desk/_ribbon.scss`; `desk/_page_head.scss` (`top: var(--ins-ribbon-height)`, out-ranked by `_ribbon.scss`) | `page.scss:121-128` | Sticky head offset under the ribbon; sticky insets are measured from the padded scroller's content edge | VERIFIED |
| `body:has(> .ins-banner)`, `body:has(> .ins-banner) > .ins-banner`, `body:has(> .ins-banner) > .body-sidebar-container` | `desk/_banners.scss:6,14,19` | `:has()` is a CSS selector, not a Frappe source line. Browser support as stated in css2 evidence: Chromium 105+, Firefox 121+, Safari 15.4+ | Banner row (push content, no overlap). Without `:has()` the banner overlaps the sidebar | UNVERIFIED (version floors stated in the evidence, not measured) |
| `.ins-banner`, `[data-ins-banner]`, `.ins-banner-text`, `.ins-banner-action` | `desk/_banners.scss`; `public/js/shell/banner.js` | Theme's own contract (not Frappe). Read by `banner.js` | Banner markup contract between the stylesheet and `banner.js` | VERIFIED (theme-owned; markup checked on injected DOM) |
| `.ins-appearance > h1` | `desk/_appearance.scss` | `ins_appearance.js:46` (path as given; not found under `public/js` on this checkout) | Focus target for the Appearance page heading (visually hidden, shown when focused) | VERIFIED (theme-owned) |
| `.ace_editor` | `desk/_editors.scss` | `controls.scss:243-265` | Ace editor surface | VERIFIED |
| Ace theme `tomorrow` (`ace/theme/tomorrow`, class `ace-tomorrow`): `.ace_keyword`, `.ace_storage`, `.ace_meta.ace_tag.ace_tag-name`, `.ace_string`, `.ace_string.ace_regexp`, `.ace_constant.ace_numeric`, `.ace_comment`, `.ace_variable`, `.ace_support.*`, `.ace_entity.*`, `.ace_marker-layer`, `.ace_selection`, `.ace_cursor`, `.ace_invisible`, `.ace_indent-guide` | `desk/_editors.scss` | `code.js:84` (theme always loaded) | Syntax colours in Dark and Light; third-party names. Ace loads from its own bundle | VERIFIED (third-party, version-sensitive: breaks silently on an Ace change) |
| `.ql-editor.ql-blank::before`; `.ql-editor` | `desk/_editors.scss:55` | `node_modules` quill `dist/quill.snow.css`; `quill.scss:11` | Blank-state hint colour (`rgba(0,0,0,.6)` italic before mapping); third-party names | VERIFIED (third-party, breaks silently on a Quill change) |
| `kbd` (shortcuts dialog `<kbd>` chips) | `desk/_editors.scss` (key hints section) | Rendered by `keyboard.js:117-118`; dialog `keyboard.js:84-150` | Chip colour and `direction: ltr; unicode-bidi: isolate` (so "Ctrl+R" does not reorder in Arabic). The `direction: ltr` is not direction-specific | VERIFIED |
| Datatable markup in the proof (`.dt-instance-N .dt-cell`, `.dt-row`, `.dt-cell`) | `tools/proof/` only | frappe-datatable 1.20.7 source: `datatable.js:116-124`, `rowmanager.js:353`, `cellmanager.js:831-860,919-921`; runtime rule `.dt-instance-N .dt-cell { height }` (`style.js`) | The proof must reproduce core's runtime height rule (no product CSS overrides row or cell height) | VERIFIED (proof only) |
| List subject: `.level-item bold ellipsis` (unseen), bare span (seen) | `tools/proof/` only | `list_view.js:1323-1343` | Proof markup parity for unseen and seen subjects | VERIFIED (proof only) |

### 2e. Print, email and Letter Head (print-web, print-web2)

Source: `docs/team/evidence/round2/print-web/evidence.md` ("Selectors depended on (16.32.0 / 16.33.0)"), and `docs/team/evidence/round2/print-web2/evidence.md` (Chrome header page, "Selectors depended on"). Print bundle rows use `institutional_theme/public/scss/ins_print.bundle.scss`; email rows use `institutional_theme/public/scss/ins_email.bundle.scss`.

| Selector | Our file | Frappe 16.32.0 source (file:line) | What breaks if it changes | Status |
|---|---|---|---|---|
| `.print-format`, `.print-heading`, `.sub-heading`, `.page-break`, `.letter-head`, `.letter-head-footer` | `ins_print.bundle.scss` | `frappe/templates/styles/standard.css`; `templates/print_formats/standard_macros.html:198-212` | Print layout and headings; letter head placement | VERIFIED |
| `[document-status="draft"]`, `[document-status="cancelled"]` | `ins_print.bundle.scss` (watermark) | `standard_macros.html:215,220` | Watermark for Draft and Cancelled | VERIFIED |
| `.data-field[data-fieldname=...]` | `ins_print.bundle.scss` | `standard_macros.html:90-110` (`render_field_with_label`) | Field rendering in print formats | VERIFIED |
| `.table`, `.table-bordered` (child selectors) | `ins_print.bundle.scss` (ruled tables) | `frappe/public/css/bootstrap.css:1487-1501` | Table rules | VERIFIED |
| `.items-table`, `.tax-table`, `.highlight-bg`, `.invoice-page` | `ins_print.bundle.scss` (ruled tables, double rule above totals) | ERPNext print formats, for example `erpnext/accounts/print_format/sales_invoice_standard/sales_invoice_standard.json` | Cosmetic only; the rules fail safe. ERPNext class names are not verified as stable across ERPNext versions | UNVERIFIED (ERPNext class names across versions) |
| `td.text-right`, `td.text-left` (figures) | `ins_print.bundle.scss` | `standard_macros.html:189-196` | Figures alignment (line end in Arabic) | VERIFIED |
| `html[dir]` in both PDF generators | `ins_print.bundle.scss` (`[dir="rtl"]` pairs) | `www/printview.html:2`; `templates/print_formats/pdf_header_footer.html:2` | Direction in print output for wkhtmltopdf and Chrome | VERIFIED |
| `body:not([onload])` `.print-format .wrapper .letter-head .ins-lh` (margin-top 16mm) and `.letter-head-footer .ins-lf` (12mm) | `ins_print.bundle.scss:406-411` | `templates/print_formats/chrome_pdf_header_footer.html` (`.letter-head, .letter-head-footer { margin-top: -12mm !important }`, `.wrapper`); `pdf_header_footer.html` (`onload`, `-15mm`); `utils/pdf_generator/browser.py:171, 301-340` | Chrome repeat header: the letter head was clipped at the top of the page. The selector separates core's two header pages. Not re-run for Letter size, Cancelled with repeat header, or a 15mm top margin | UNVERIFIED across Frappe upgrades (print-web2 manifest row 2) |
| `.body-table`, `.email-container`, `.email-masthead`, `.email-title-cell`, `.email-body-cell`, `.email-footer-cell(.filled)`, `.email-footer-container`, `.email-header-title`, `.brand-name`, `.btn`, `.table`, `.callout-warning`, `.verification-code`, `.indicator-*` | `ins_email.bundle.scss` | `frappe/templates/emails/standard.html`, `email_header.html`, `email_footer.html`; `frappe/public/scss/email.bundle.scss` | Email layout; the rendering checked is Chromium on Premailer output. Gmail, Outlook and Apple Mail were not tested | VERIFIED (Chromium only) |
| Email physical properties: `border-left` (two rules, `ins_email.bundle.scss:117,134`), `text-align: start` with left as fallback | `ins_email.bundle.scss` | Mail clients (no logical-property support assumed) | Email bars and alignment in mail clients that ignore logical values | ASSUMED (mail clients not tested) |
| Print bundle physical properties (`border-top`, `margin-right`, `border-right-width`, `text-align: left/right`) and `[dir="rtl"]` pairs | `ins_print.bundle.scss` | QtWebKit (wkhtmltopdf) supports no logical properties, no `text-align: start`, no flex, no grid, no `inset` | Print layout under wkhtmltopdf. Only the vertical axis and symmetric values are used where possible. Physical properties are the fallback, not a defect | VERIFIED (generator behaviour observed on the patched build, print-web round 2) |
| ERPNext format declarations `color: ... !important` on `.items-table thead td` and `padding: ... !important` on cells; inline `float: right` on the subtotal block | ERPNext print format (not ours; cannot be overridden without `!important`) | ERPNext print format source | Header cells stay grey (`#7c7c7c`), bold and ruled. Subtotal block stays on the right in Arabic | VERIFIED (observed in the rendered PDFs, print-web round 2 "Not working or different") |

### 2f. Website and web pages, round 2 (print-web2)

Source: `docs/team/evidence/round2/print-web2/evidence.md` ("Selectors depended on (16.32.0)"). All rules are Light only and scoped to `body[data-path]:not(.ins-auth):not(.ins-error)` in `institutional_theme/public/scss/web/_website.scss`, which carries no `!important`.

| Selector | Our file | Frappe 16.32.0 source (file:line) | What breaks if it changes | Status |
|---|---|---|---|---|
| `h1` letter-spacing | `web/_website.scss` | `public/scss/website/base.scss:19-38` | Letter-spacing on Arabic headings (must stay 0) | VERIFIED |
| `[data-doctype="Web Form"] .page-content-wrapper .container .page_content`, `.web-form-introduction`, `.success-title`, `.success-message` | `web/_website.scss` | `web_form.scss` (directory as given) | Web form layout, introduction and success text | VERIFIED |
| `--*-avatar-bg`, `--*-avatar-color` (core variables remapped to the status pairs) | `web/_website.scss` | `website_avatar.scss:5-7` | Avatar colours (were 3.4 to 4.5:1 before the remap) | VERIFIED |
| `.empty-apps-state` | `web/_website.scss` | `templates/includes/list/list.html:5-9` | Empty-state closing rule and brass lead on list pages | VERIFIED |
| `.no-result` | `web/_website.scss` | `web_form_list.js:258` | Empty result on Web Form lists | VERIFIED |
| Web Page `text_align` inline style (`web_page.html:23`) | `web_content.py` `page_values()` (called at `web_content.py:179`) | `website/doctype/web_page/templates/web_page.html:23` | Arabic Web Pages parked at the left when `text_align: Left` is set inline (fixed in `page_values()`; test added) | VERIFIED |
| Error and message pages, login headings (`.page-card-head-text h4`, `.page-card-subtitle`) | `web/_login.scss` (`unicode-bidi: plaintext`, end of file); `web/_error_pages.scss:78` (`direction: ltr; text-align: start`) | `frappe/www/update-password.html:17-20`; `login.html:151`; `frappe/www/error.html:19-50`; `public/css/hljs-night-owl.css:30` | Mixed-language full stop placement; traceback direction; error page code block background | VERIFIED |

## 3. Frappe CSS variables overridden

Generated from: `docs/audits/dead_tokens.txt` (generated by `python -m institutional_theme.audits`; do not edit).

- Variables overridden by the theme: **377**.
- Declared and read by core (the override has an effect): 266.
- Declared by core, never read by it (inert today): 111.
- Read by core, never declared: 0.
- Consumed by this theme only: 0.
- Dead (neither in core nor consumed by the theme): 0.
- Core snapshot used: `institutional_theme/audits/data/core_vars_frappe_16.32.0.json`.

The full list is in `docs/audits/dead_tokens.txt`. The audit fails only on dead variables.

## 4. `!important`

Generated from: `grep -rn '!important' institutional_theme/public/scss` on this checkout.

Result: 8 hits. All 8 are on comment lines (lines beginning with `//`). There is no `!important` in any declaration.

| File:line | In a comment | Text (abridged) |
|---|---|---|
| `public/scss/desk/_typography.scss:2` | Yes | "Logical properties only; no !important." |
| `public/scss/desk/_controls.scss:2` | Yes | "Logical properties only; no !important" |
| `public/scss/desk/_actions.scss:37` | Yes | Core's `.btn-primary:active { color: ... !important }` (buttons.scss:~124) is not overridden |
| `public/scss/desk/_hardcoded.scss:2` | Yes | "no !important except where core uses it on the same property (calendar events), listed below" |
| `public/scss/desk/_hardcoded.scss:36` | Yes | Core sets `color: rgb(0, 112, 204) !important` on calendar selectors (calendar.scss:71, 99) |
| `public/scss/desk/_base.scss:2` | Yes | "Logical properties only; no !important" |
| `public/scss/web/_login.scss:6` | Yes | Out-ranks core without `!important` |
| `public/scss/web/_base.scss:27` | Yes | The body class is repeated to out-rank core without `!important` |

Round 2 declarations (not comments). Source: `docs/team/evidence/round2/css/evidence.md` ("Manifest rows to add") and `institutional_theme/public/scss/desk/_calendar.scss` lines 26-40, read for the selectors.

| File:line | Declaration | Why nothing else works (reason given in the evidence) | Status |
|---|---|---|---|
| `public/scss/desk/_calendar.scss:33` | `[data-theme="dark"] .fc .fc-event:not(.fc-daygrid-dot-event) { background-color: var(--ins-surface-raised) !important }` | Frappe writes the chip colours inline (`calendar.js:441-449`, through `prepare_colors` at `:431-449`); inline style out-ranks any selector, and no custom property outranks it | VERIFIED (reason as given) |
| `public/scss/desk/_calendar.scss:34-35` | `border-inline-start-style: solid !important; border-inline-start-width: 4px !important` (same selector) | Core sets `border: none !important` on `.fc-event` (`calendar.scss:65`); a non-important border longhand loses to it | VERIFIED (reason as given) |
| `public/scss/desk/_calendar.scss:39` | `[data-theme="dark"] .fc .fc-event:not(.fc-daygrid-dot-event) .fc-event-main { color: var(--ins-text-strong) !important }` | Frappe writes `color` inline on `.fc-event-main` (`calendar.js:441-449`) | VERIFIED (reason as given) |
| `public/scss/web/_website.scss` | Bootstrap `.text-muted { color: $text-muted !important }` (`apps/frappe/node_modules/bootstrap/scss/utilities/_text.scss:52`, compiled into core's website bundle by `frappe/public/scss/website/index.scss:4`, `$text-muted` #7c7c7c from `website/variables.scss:8`) gives 4.17:1 on the footer link. Rule: `body[data-path]:not(.ins-auth):not(.ins-error) .text-muted { color: var(--ins-text-muted) !important }`, 6.28:1 | Two `!important` declarations: only a more specific `!important` wins; the value is compiled in, so no variable reaches it. Contrast (priority 2) outranks the no-`!important` rule (priority 3), lead decision. Scoped to website pages; not the desk, auth or error pages | VERIFIED (`docs/team/evidence/round2/print-web3/evidence.md`) |

The four declarations in `_calendar.scss` are the only `!important` declarations added in round 2. The css2 evidence adds none. If `calendar.js` stops writing inline colours, the four can go.

Note for the reviewer: the comment at `_hardcoded.scss:2` says there is an exception "listed below". Before round 2 no `!important` declaration existed in the code, so no entry was needed. Count of `!important` declarations in the theme after round 2: 4 (`_calendar.scss`, the table above). The grep result in this section is the phase 3 grep and is not updated.

## 5. Site configuration keys the app reads

Generated from: grep of `institutional_theme/**/*.py` for `frappe.conf` on this checkout.

| Key | Read at | Values and effect | Status |
|---|---|---|---|
| `ins_environment` | `institutional_theme/boot.py:13` (desk boot value); `institutional_theme/web_content.py:60` (web pages); `institutional_theme/institutional_theme/doctype/institutional_theme_settings/institutional_theme_settings.py:182` (desk ribbon) | Absent or empty: no ribbon on the desk; web pages show no environment word. Desk: `production` gives no ribbon; `training`, `uat`, `staging` give the word; anything else gives "Non-production". Web: `production` gives "Production"; `training`, `uat`, `staging` as above; anything else "Non-production". | VERIFIED (read in source; the desk and web word lists differ for `production`) |
| `ins_release` | `institutional_theme/web_content.py:127` | String, stripped; empty when absent. Passed to the web templates (the `Release {0}` string). | VERIFIED (read in source) |
| `monitor` | Not read by any Python in this app. The app calls Frappe's `frappe.monitor.get_trace_id` at `institutional_theme/web_content.py:87-89`. | Frappe reads `monitor`, not this app. The web evidence says `monitor: 1` end to end is not verified (see `web/evidence.md`, not-verified list). | UNVERIFIED for end-to-end; not an app key. Round 2 status as given: VERIFIED on the bench for the 403 page at `/me` as Guest (en and ar; footer code equals `X-Frappe-Request-Id`; `docs/team/evidence/round2/print-web2/evidence.md` section 1) and for `www/message.html` with a status (`docs/team/evidence/round2/backend/evidence.md` item 4b) |

Test-only references (`tests/test_boot.py`, `tests/test_web_content.py`, the Settings doctype tests) are not counted.

Also read in round 2 (settings fields, not `frappe.conf`): `enable_idle_warning`, `idle_warning_minutes` and `enable_connection_banner` on Institutional Theme Settings (`institutional_theme/institutional_theme/doctype/institutional_theme_settings/institutional_theme_settings.json`). Source: `docs/team/evidence/round2/backend2/evidence.md` items 4a and 4b.

## 6. Round 2 core behaviours and APIs relied on

Generated from: `docs/team/evidence/round2/backend/evidence.md` ("Selectors and hooks depended on", "Manifest rows", "Decisions"), `docs/team/evidence/round2/backend2/evidence.md` ("Source depended on", "Manifest rows"), `docs/team/evidence/round2/print-web/evidence.md` ("Generators", "Hook lines"), `docs/team/evidence/round2/print-web2/evidence.md` ("Selectors depended on", "Manifest rows"), and `docs/team/reviews/upgrade-final.md` (the `after_commit` row). Paths are relative to the `frappe` package root of 16.32.0 unless a row says otherwise.

| Behaviour or API | Used by this app | Frappe 16.32.0 source (file:line) | What breaks if it changes | Status |
|---|---|---|---|---|
| `frappe.db.after_commit` | `institutional_theme/site_files.py:319, 324` (stylesheet regeneration runs after commit, so a rolled-back save writes nothing) | `database/database.py:130, 1194` (run); `:1203` (reset on rollback), per `docs/team/reviews/upgrade-final.md` line 3 | A regeneration could run before a save is committed, or after a rollback | VERIFIED (reviewer's source check, `upgrade-final.md` line 3) |
| `frappe.auth.get_logged_user` (session keep-alive for the idle warning) | `public/js/shell/idle_warning.js` (one GET per press of "Stay signed in") | `auth.py:450` | Any whitelisted authenticated GET would do; this is the keep-alive chosen | UNVERIFIED across upgrades (backend2 manifest row) |
| Session updated at the end of every request | Idle warning timing | `app.py:434`; `sessions.py:406-440` | Idle clock resets on each request | VERIFIED (lines as given in backend2) |
| `session_expiry` (`sessions.py:277, 366-368, 501-523`); saved System Settings copied to `sysdefaults` (`core/doctype/system_settings/system_settings.py:215-220`; `boot.py:51`) | `public/js/shell/idle_warning.js` (warning never later than 60 s before session length) | Default `240:00:00` at `sessions.py:277`; no value saved uses 240 h (`sessions.py:519`) | Warning timing: `frappe.boot.sysdefaults.session_expiry` exists only after an administrator saves System Settings; the default is mirrored in JS | VERIFIED (lines as given in backend2) |
| `frappe.realtime.socket` (socket.io client; `disconnect` and `connect` events) | `public/js/shell/connection_banner.js` | `public/js/frappe/socketio_client.js:62-72` | Realtime drop banner; `disconnect` with reason "io client disconnect" is ignored | UNVERIFIED against a live socket server (not run on the test bench) |
| `frappe.is_online` offline toast (core's own "Connection lost" toast appears alongside the theme banner) | `public/js/shell/connection_banner.js` | `public/js/frappe/dom.js:375`; `public/js/frappe/request.js:32` | Both messages appear when offline (core's toast and the theme banner) | VERIFIED (lines as given) |
| 401 handling (core redirects to the login page) | Session-expiry path of the idle warning; not tested | `public/js/frappe/request.js:135-139` | Expired session behaviour | VERIFIED (source line); real expiry (401) NOT TESTED |
| `page-change` jQuery event | `public/js/shell/banner.js` (banner found again on each page change); idle warning | `public/js/frappe/views/container.js:19`; `public/js/frappe/ui/toolbar/toolbar.js:69` | Banner and warning survive navigation or stop | VERIFIED (lines as given) |
| Masked fields: `masked_fields` cache (`model/meta.py:199-218`); form masking (`desk/form/meta.py:80`; `public/js/frappe/form/form.js:1214-1220`) | `public/js/shell/masked_fields.js`; `.control-value` (static value of read-only controls); `.control-label` | `model/meta.py:199-218`; `desk/form/meta.py:80`; `form.js:1214-1220` | Masked value presentation. Core caches the list as `masked_fields::...::user`; a first load after a Property Setter can return an empty list (seen once) | VERIFIED (lines as given); cache behaviour seen once on the bench |
| Letter Head `before_insert`, default rule and `validate_disabled_and_default` | `institutional_theme/print/ship.py` (Letter Head "Midad" created with `is_default` 0 under `frappe.flags.in_migrate`) | `printing/doctype/letter_head/letter_head.py:38-60`; `on_trash` at `:43` | Without the flag core sets source to "Image" and may make the first Letter Head the default | VERIFIED (lines as given) |
| Print Style append and Letter Head render | `institutional_theme/print/ship.py`; print format output | `www/printview.py:231-241, 421-442, 592-609`; `printing/doctype/print_style/print_style.py:24-35` | Shipped Print Style CSS and Letter Head output | VERIFIED (lines as given) |
| `frappe.lang` in Letter Head Jinja | `print/letter_head.html`, `print/letter_head_footer.html` | `utils/safe_exec.py:492` | Language attribute in the letter head | VERIFIED (line as given in print-web) |
| HTML Editor sanitising on save | Letter Head HTML is written with `frappe.db.set_value` after insert; an administrator save sanitises it and counts as an administrator change | `model/base_document.py:1307-1347` | Jinja markup in the Letter Head is altered by a save | VERIFIED (lines as given) |
| Link check on delete (`LinkExistsError`) | Uninstall keeps a Letter Head or Print Style that another document links to | `model/delete_doc.py:172, 376` | Uninstall keeps linked records | VERIFIED (lines as given) |
| `ins_identity()` (Jinja method, `jinja.methods`) | Letter Head emblem and names | `utils/jinja.py:223-250` | See the `jinja` row in section 1 | VERIFIED |
| `pdf_generator = "chrome"` (`get_chrome_pdf`) | Print PDFs under Chrome | `frappe/hooks.py:109` (registers `frappe.utils.pdf.get_chrome_pdf`) | Chrome generator unavailable | VERIFIED (line as given) |
| wkhtmltopdf patched Qt build (0.12.6.1) for repeat header and footer and page width | Print PDFs under wkhtmltopdf | Not a Frappe source line; observed (`wkhtmltopdf -V` prints "with patched qt") | The distribution package 0.12.6 is not enough. Production must have the patched build | VERIFIED (observed on the runner; production not checked) |
| `frappe.get_print` with `as_pdf=True`; core keeps `frappe.local.form_dict.pdf_generator` from the first call | Print tests | Observed (backend round 2 item 1c) | A second `pdf_generator` in one process silently uses the first generator | VERIFIED (observed) |
| Core 403 page (`NotPermittedPage`) and the error reference: `base_template_page.py:30-31, 52-54` (core merges `frappe.local.response["context"]` after the hooks ran); `not_permitted_page.py:23-25`; `frappe/__init__.py:1295-1299`; `website/serve.py:31`; `www/message.py` | `institutional_theme/web_content.py` (`_is_error_message`: a `www/message.html` page is an error when the status is 400 or more, or the indicator is red) | As given | Footer reference on the 403 page; `test_message_with_red_indicator_is_an_error` | VERIFIED (run, 17 tests OK) |
| `web_include_js` rendering (consumer for the row in section 1) | `ins_web.bundle.js` on web pages | `templates/base.html:105` (per `upgrade-final.md` line 3) | Web script loads | VERIFIED (line as given in the upgrade-final review) |
| `body[data-path]` (`templates/base.html`) | `web/_website.scss`, `web/_base.scss` | `templates/base.html` | Web page scope for every round 2 web rule | VERIFIED |
| Core `.text-muted` and Bootstrap `.text-muted !important` | `web/_website.scss` (see section 4) | `bootstrap/scss/utilities/_text.scss:52` via `frappe/public/scss/website/index.scss:4` | Contrast of muted text on the web pages | VERIFIED |
| Core 417 on standard web forms (`base_document.py:549`; `document_page.py:56`) | Not ours. Standard web forms return 417 "Value for Condition JSON cannot be a list" even for Administrator; non-standard forms work | As given | Standard web forms (update profile, address, issues, request data) do not open | VERIFIED (observed, backend round 2 print-web2 section 3) |
