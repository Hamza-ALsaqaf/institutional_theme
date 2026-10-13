# Frappe 16.32.0 findings

Read from source on 2026-10-13 against **Frappe 16.32.0, ERPNext 16.33.0, HRMS 16.20.1**. Paths are relative to the `frappe` app root unless they start with another app name. Line numbers are for 16.32.0; re-check them, do not trust them blindly. Anything not listed here has not been verified.

Everything here was inspected, not executed in a browser, unless it says otherwise. Re-verify against the exact tag you build on before relying on a line.

## 1. Navigation in this version

- There is **no dock and no persistent top navbar**. `header` in `www/desk.html` is empty except for read-only, impersonation, announcement and mobile cases.
- Desktop (apps) screen: `desk/page/desktop/` (`desktop.html`, `desktop.js`, and page CSS `desktop.css`, not SCSS). Classes: `.desktop-wrapper`, `.desktop-navbar`, `.desktop-search-wrapper`, `.desktop-notifications`, `.desktop-avatar`, `.icons-container > .icons > a.desktop-icon > .icon-container + .icon-caption > .icon-title`.
- Sidebar: `public/js/frappe/ui/sidebar/*.html`, styles `public/scss/desk/sidebar.scss` (flagged `// clean-this-file`). `.body-sidebar-container[.expanded] > .body-sidebar` (50px collapsed, `--sidebar-width` 220px expanded) with `a.sidebar-header`, `#navbar-modal-search`, `.sidebar-notification`, `.sidebar-items`, `.body-sidebar-bottom` (user button). Item: `.sidebar-item-container > .standard-sidebar-item[.active-sidebar] > a.item-anchor > .sidebar-item-icon + .sidebar-item-label + .sidebar-item-suffix`.
- Account and app menu: `div.frappe-menu.context-menu[role=menu] > .dropdown-menu-item` appended to `body` (`ui/menu.js`, `scss/desk/menu.scss`).
- Page head: `ui/page.html`. `.page-head` is `position: sticky; top: 0; z-index: 6` with `.page-head-content` at `--page-head-height` (48px). Title area: `ul.navbar-breadcrumbs > li > a.title-text | a.title-text-form`, then `span.indicator-pill.no-indicator-dot.{colour}` (target `.title-area .indicator-pill`; the `.page-indicator-pill` class is stripped by JS). Actions: `.page-actions > .custom-actions`, `.standard-actions > .page-icon-group`, `.menu-btn-group`, `.actions-btn-group`, `button.primary-action`.
- Awesomebar is a standard modal with `.navbar-modal-wrapper`; there is no command-palette class.

## 2. Tokens and the cascade

- Espresso (`public/scss/espresso/`): raw ramps on `:root` for 12 hues (gray, blue, green, red, orange, amber, yellow, cyan, teal, violet, pink, purple), steps 50-900; semantic `--surface-*`, `--ink-*`, `--outline-*` as literal hex on `:root` (light) and `[data-theme="dark"]`. There is no `--surface-base`, `--surface-sidebar`, elevation tokens, alpha variants or spacing scale.
- Legacy variables (`scss/common/css_variables.scss`, `scss/desk/css_variables.scss`, `scss/desk/dark.scss`) are declared on `:root, [data-theme="light"]` and `[data-theme="dark"]` and chain from the **raw ramps**, not from the semantic tokens. In the compiled desk CSS, `--gray-N` is read 197 times; `--text-color` 113, `--border-color` 112, `--fg-color` 49, `--bg-color` 42, `--control-bg` 41; `--surface-*` only 25.
- `--primary` is not a Frappe variable. Bootstrap 4.6.2 emits `:root{--primary:#171717}` after Frappe's dark block and there is no dark value. Bootstrap also bakes `#171717` into `.bg-primary`, `.text-primary`, `.border-primary`, `.badge-primary`, `.btn-outline-primary` and the checked custom switch.
- All of these blocks have specificity (0,1,0); core dark wins over `:root` by source order alone.
- Selectors that win deterministically: light on `html:root, html [data-theme="light"]`; dark on `html:root[data-theme="dark"], html [data-theme="dark"]`. Because `html:root` also matches a dark root, **every variable set in light must also be set in dark** (and in any automatic-mode block), or light values leak into dark. Enforce key-set parity in the audit.
- Keep the ramp orientation in dark (core hard-wires steps, for example `dark.scss:196-197`); re-tune the gray steps instead of inverting the ramp.
- Variables re-declared on descendants, which root-level overrides do not reach (cover each one):
  - `desk/dark.scss`: 124 (sidebar toggle `--icon-stroke`), 174-175 (`.grid-body .editable-row`), 189-193 (`.modal, .form-in-grid`), 196-197 (`.print-format`), 222-234 (`.chart-container`, ten `--charts-*`), 246-248 (`.rating`), 266-268 (`.indicator`, twelve dots)
  - `common/grid.scss` 285-286, 299; `common/indicator.scss` 72-73; `common/controls.scss` 360-365; `desk/toast.scss` 14-30; `desk/frappe_datatable.scss` 2-17 (`--dt-primary-color: $primary` compiles to a literal); `common/quill.scss` 290; `desk/navbar.scss` 58; `--checkbox-size` inside media queries; many scoped `--icon-stroke` rules.
- Hard-coded colours to handle explicitly: `desk/breadcrumb.scss:4` (white), `desk/page/desktop/desktop.css` 13, 317 (`black !important`), 507, `desk/form_sidebar.scss:392` (`#000`), `desk/calendar.scss` 64, 99, `desk/form.scss` 54, 58 and `common/grid.scss:150` (`#c9c9c9` outlines), `desk/notification.scss:36`, `desk/module.scss:119`. `desk/print_preview.scss:73` is white on purpose: print preview stays paper white.
- Mode mechanics: `www/desk.html` renders `<html data-theme-mode="…" data-theme="…" dir=… lang=…>`. `Automatic` is rendered as `data-theme="automatic"` (matching neither block) until `ui/theme_switcher.js` resolves it. `User.desk_theme` is a Select with `Light`, `Dark`, `Automatic` and no default; the server falls back to `Light` (`www/desk.py:56`, `sessions.py:182`). The theme-switcher preview puts `data-theme` on inner elements (`theme_switcher.js:89,93`).
- Website and login pages carry no `data-theme` at all: always light.
- A full inventory of every custom property the desk CSS declares and reads can be regenerated with postcss from `sites/assets/frappe/dist/css/desk.bundle.*.css`; build that into the dead-token audit rather than trusting a static list.

## 3. Build and bundles

- Bundles are discovered by glob `public/**/*.bundle.{js,ts,css,sass,scss,less,styl,jsx}` in every app folder. Output goes to `<app>/dist/css/<name>.<hash>.css` and the manifest `sites/assets/assets.json` is keyed by **basename**, global across apps: prefix every bundle (`ins_desk.bundle.scss`).
- Hooks reference `"ins_desk.bundle.css"`; `utils/jinja_globals.py` `bundled_asset()` resolves it. A key missing from the manifest is emitted as a broken link, not skipped.
- Toolchain: sass 1.69.5 (legacy `render()` API), esbuild 0.14.54, postcss 8.4.31, autoprefixer, rtlcss 4.1.1. `node_modules` and other apps are importable from SCSS. Font `url()` values must be absolute (`/assets/institutional_theme/...`); relative ones fail the build.
- RTL: rtlcss runs on every style bundle of every app and writes `dist/css-rtl/`; the server picks the RTL file when `frappe.local.lang` is one of `ar`, `he`, `fa`, `ps`. rtlcss flips physical properties and leaves custom properties and logical properties untouched. Core uses `/*rtl:begin:ignore*/ … /*rtl:end:ignore*/`. Wrap the theme bundles in that pair and use logical properties, so LTR and RTL outputs are identical.
- CSS order in the desk is the **site's installed-app order** plus `site_config.app_include_css` (`www/desk.py:37-39`), not `apps.txt`. A later-installed app loads after this one. On the login page `login.bundle.css` is in `block head_include` and loads **after** `web_include_css`; scope login rules with `body[data-path="login"]` and sufficient specificity.
- `bench build --app X` relinks every app's assets and flushes the Redis cache shared by all sites. For a lighter rebuild: `cd apps/frappe && node esbuild --apps institutional_theme` after the assets symlink exists.
- Core ships Inter only (`public/css/fonts/inter/`), `--font-stack` in `espresso/_typography.scss`, `--weight-regular: 420` (with static font files 420 resolves to 500: override it to 400). There is no Arabic font logic in core.

## 4. Status, workflow, masking, actions

- Indicator classes: `green, cyan, blue, orange, yellow, gray, grey, red, pink, darkgrey, purple, light-blue` (`scss/common/indicator.scss`), each `background: var(--bg-X); color: var(--text-on-X)`. `.indicator-pill` is 20px high with a 6px dot unless `.no-indicator-dot` (list and page-head pills use it).
- `model/indicator.js`: unsaved is "Not Saved" orange; **Draft is red; Cancelled is red**; Submitted is blue. Workflow state styles map Success to green, Warning to orange, Danger to red, Primary to blue, Info to light-blue, **Inverse to `black`, which has no CSS rule**.
- List pills carry `data-filter` (for example `docstatus,=,0`), which CSS can target. The form title pill has no such hook. `$(document).trigger("form-refresh", [frm])` (`form/form.js:625`) is a supported event from which a small script can set a `data-ins-docstatus` attribute on the form wrapper.
- Role-masked fields have **no markup at all**: the server sends a placeholder (`XXXXXXXX`, `model/utils/mask.py`) and the client forces `fieldtype = "Data"`, `read_only = 1` for names in `meta.masked_fields`. Marking them needs an attribute set from script.
- Page buttons and menu items carry `data-label = encodeURIComponent(<translated label>)` (`ui/page.js:286, 550-695`). Tag consequential actions through that, not by button text.
- There is no session-expired dialog (401 redirects to `/login`), no idle warning and no realtime-disconnect UI; offline is an orange toast (`request.js`, `dom.js`).

## 5. Lists, forms, reports

- List: `.frappe-list .result-container` scrolls horizontally; header is `.list-row-container:first-child` sticky; `.list-row .level-right` is the sticky end column; rows `div.list-row-container[tabindex] > div.level.list-row`; there is **no selected class** (only `input.list-row-checkbox:checked`); the list sidebar is disabled in 16.32. Filters: `.filter-selector .filter-button[.btn-primary-light]`, `.filter-popover`, pills `div.filter-tag.btn-group`.
- Form control: `.frappe-control[.has-error] > .form-group > .clearfix > label.control-label[.reqd]` and `.control-input-wrapper > .control-input + .control-value.like-disabled-input + .help-box`. Read-only display is `.like-disabled-input`, styled by core with the *disabled* tokens. There is no inline validation message element. `.form-control` has no border in core; focus is a Bootstrap box-shadow.
- Child table: `.form-grid-container > .form-grid > .grid-heading-row + .grid-body > .rows > .grid-row > .data-row.row > .row-check, .row-index, .grid-static-col`; sticky gutter and `.sticky-grid-col`.
- Focus in core: `a, .btn …:focus { outline: 0 }`, and `--focus-default` box-shadows on some buttons and on `.btn:active`. There is no autofill rule.
- **frappe-datatable 1.20.7 computes row geometry from the `cellHeight` option** (33 or 35), not from the DOM: rows are absolutely positioned and the scroller height is `itemHeight * total`. **Never override row or cell height in CSS**; restyle padding, type and colour inside the box. `--dt-*` variables are scoped on `.datatable` (`scss/desk/frappe_datatable.scss`). Numeric cells are aligned by injected `.dt-cell--col-N{text-align:right}` rules, not by a class. ERPNext financial reports mark group rows with inline `font-weight: bold`.
- frappe-charts 2.0.0-rc27: series colours are hex set from JS, mostly inline; `--charts-*` variables are on `:root` (light) and scoped on `.chart-container` in dark; charts are forced `direction: ltr`.
- Other views: Kanban (`scss/desk/kanban.scss`, `--kanban-*`), Calendar (`@fullcalendar` 6.1.11, `.fc-*`), Tree (`scss/desk/tree.scss`), Gantt (frappe-gantt 0.6.1, no variables).

## 6. Login, website, print, email

- Login: `www/login.html` extends `templates/web.html`; `.login-content.page-card > .page-card-head > img.app-logo + h4`, `form.form-signin`, `.page-card-body`, `.toggle-password`, `.social-logins`, 2FA markup injected by `templates/includes/login/login.js`. Logo: Website Settings `app_logo`, then Navbar Settings `app_logo`, then the `app_logo_url` hook, **which is only honoured when exactly two apps define it** (`core/doctype/navbar_settings/navbar_settings.py:26-39`): set the logo as data, and only when the field is empty.
- Website Settings fields that exist: `show_footer_on_login`, `address` (exposed to templates as `footer_address`), `copyright`, `footer_powered`, `app_name`, `app_logo`, `favicon`, `splash_image`, `banner_html`, `head_html`.
- Website boot is a fixed dictionary with no hook, and `frappe._messages` is empty on website pages, so `__()` returns English in `web_include_js`. Translate server-side in an `update_website_context` hook; `body_class` reaches `templates/base.html:57`.
- Error pages (`www/error.html`, `message.html`, `404.html`) share `.error-page`; maintenance reuses `message.html` with HTTP 503.
- PDF: the default generator is **wkhtmltopdf** (0.12.6.1, Qt4 WebKit, no WOFF2, runs with `disable-javascript`); Chrome is opt-in (`Print Settings.pdf_generator`). `scrub_urls` rewrites only `: url(` and appends `!important`, which breaks a multi-source `src`: use one TTF `url()` per `@font-face`, no `format()`. Under Chrome, the page-number script core refers to is missing. "Page X of Y" therefore needs testing under both generators.
- Print Style CSS is unscoped and is shipped in every desk boot (`boot.py:283-288`): do not base64 fonts into it. A non-standard Print Style inserts cleanly (`standard = 1` needs developer mode). `Letter Head.before_insert` forces `source = "Image"` outside install and migrate, and the first Letter Head becomes the default: create it only from `after_install` or `after_migrate`.
- Print DOM: `.print-format > .page-break > #header-html (.letter-head, .print-heading) + .row.section-break + #footer-html`; draft and cancelled are plain `<h4>` headings, there is no watermark; `dir` is set on the print document for RTL languages.
- Email: `templates/emails/standard.html`; CSS comes from the additive `email_css` hook and is inlined by Premailer (`email/email_body.py:469-488`): no custom properties, no `@font-face`.

## 7. Hooks, install, translations

- `extend_bootinfo(bootinfo)` runs on every desk boot (`sessions.py:169-170`).
- `before_uninstall` takes no arguments and runs after the backup, before module deletion. Print Style and Letter Head are not linked to a Module Def, so they are not removed automatically. A Letter Head referenced by documents cannot be deleted: disable it, and restore `Print Settings.print_style` first.
- Store "what this app shipped" checksums with `frappe.db.set_global()`; `set_default` leaks into `frappe.boot.sysdefaults`.
- Translations: `institutional_theme/translations/ar.csv`, no header, `source,translation[,context]` (`translate.py:190-216`); the whole dictionary ships in desk boot, so desk `__()` works without an extraction step. Later-installed apps override identical source strings.
- A hand-made app is registered with `pip install -e apps/<app>` and a line in `sites/apps.txt`; do the pip step first.
- SQLite (`bench new-site --db-type sqlite`) exists but is experimental and off in core CI; ERPNext on SQLite is not credible. PostgreSQL and MariaDB are the supported choices for a test bench.

## 8. Things observed in the owner's bench

- Another installed app ships `/assets/tcsid_center/css/tcsid-brand.css`: full-range TTF faces named `IBM Plex Sans Arabic` (so this app must use a **private font-family name**), `html[lang=ar], html[dir=rtl]{--font-stack}` at (0,1,1), `[data-theme=light] .btn-primary` with a `:hover` rule at (0,3,0), and a 2px gold border on `.desktop-navbar`. Document the interaction in the README troubleshooting section and make sure this theme wins where both are installed.
- ERPNext's bundle declares no custom properties; HRMS reads the raw gray ramp.

## 9. Fonts

`@fontsource/ibm-plex-sans`, `-sans-arabic`, `-mono` 5.3.0, OFL-1.1. Latin 400/500/600 (71 KB) + Arabic 400/500/600 (134 KB) + Mono 400/500 (30 KB) = 235 KB of WOFF2. All three share x-height 516 and cap-height 698 (1000 upm). Latin digits are all 600 units wide (tabular by default). The Arabic subset contains no Latin digits, so with unicode-range split faces the digits always come from the Latin face.
