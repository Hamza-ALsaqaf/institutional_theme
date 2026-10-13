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

Per-user and per-site links that are not hooks (palette bundles `ins_palette_<name>.bundle.css`, font bundles `ins_fonts_noto|tajawal.bundle.css`) are linked by `update_website_context` only when `<name>` and `rtl_<name>` are both in the asset manifest. Source: `runtime/HOOKS_ON.md`, `runtime/evidence.md`.

Asset manifest and bundle discovery (for the build step): `utils/__init__.py:950-967` (`get_assets_json()` merges `assets.json` and `assets-rtl.json`), `utils/jinja_globals.py:147-157` (`bundled_asset`), `esbuild/esbuild.js:258` and `esbuild/utils.js:27-37` (bundles under `public/**/*.bundle.*`; JS bundles only at the top of `public/js`). Source: `runtime/evidence.md`. VERIFIED.

Not enabled (target does not exist yet, or by design): `email_css` (Phase 4), `jinja` (`identity.ins_identity`, Phase 4), `after_install` (install changes nothing, by design). Source: `runtime/HOOKS_ON.md`.

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

Note for the reviewer: the comment at `_hardcoded.scss:2` says there is an exception "listed below". No `!important` declaration exists in the code, so no manifest entry for an exception is needed. Count of `!important` declarations in the theme: 0.

## 5. Site configuration keys the app reads

Generated from: grep of `institutional_theme/**/*.py` for `frappe.conf` on this checkout.

| Key | Read at | Values and effect | Status |
|---|---|---|---|
| `ins_environment` | `institutional_theme/boot.py:13` (desk boot value); `institutional_theme/web_content.py:60` (web pages); `institutional_theme/institutional_theme/doctype/institutional_theme_settings/institutional_theme_settings.py:182` (desk ribbon) | Absent or empty: no ribbon on the desk; web pages show no environment word. Desk: `production` gives no ribbon; `training`, `uat`, `staging` give the word; anything else gives "Non-production". Web: `production` gives "Production"; `training`, `uat`, `staging` as above; anything else "Non-production". | VERIFIED (read in source; the desk and web word lists differ for `production`) |
| `ins_release` | `institutional_theme/web_content.py:127` | String, stripped; empty when absent. Passed to the web templates (the `Release {0}` string). | VERIFIED (read in source) |
| `monitor` | Not read by any Python in this app. The app calls Frappe's `frappe.monitor.get_trace_id` at `institutional_theme/web_content.py:87-89`. | Frappe reads `monitor`, not this app. The web evidence says `monitor: 1` end to end is not verified (see `web/evidence.md`, not-verified list). | UNVERIFIED for end-to-end; not an app key |

Test-only references (`tests/test_boot.py`, `tests/test_web_content.py`, the Settings doctype tests) are not counted.
