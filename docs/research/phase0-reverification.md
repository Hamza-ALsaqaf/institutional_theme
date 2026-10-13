# Phase 0 re-verification against Frappe 16.32.0

Checked on 2026-10-13 against a clone of tag `v16.32.0` and the published `frappe-datatable@1.20.7` and `bootstrap@4.6.2` npm tarballs. Paths are relative to the `frappe` app. Every row is VERIFIED (line opened) unless marked COMPUTED (derived) or NOT RUN.

## Results

| # | Finding | Where in 16.32.0 | Status | Note |
|---|---|---|---|---|
| 1a | Light/dark blocks at (0,1,0) | `scss/common/css_variables.scss:4-5`, `scss/desk/css_variables.scss:3-4` (`:root, [data-theme="light"]`); `scss/desk/dark.scss:2` (`[data-theme="dark"]`) | CONFIRMED | Specificity COMPUTED. |
| 1b | Bootstrap `--primary` after dark block | `scss/desk/index.scss:1` imports `variables`, which imports `css_variables` and `dark` (`desk/variables.scss:134-135`); `index.scss:7` imports bootstrap; bootstrap `scss/bootstrap.scss:11` imports `_root.scss`, whose lines 7-9 emit `$theme-colors` on `:root`; `desk/variables.scss:29` `"primary": $primary`; `espresso/_colors.scss:14,16` `$gray-900: #171717`, `$primary: $gray-900` | CONFIRMED | No dark value exists. |
| 1c | Deterministic selectors `html:root, html [data-theme="light"]` / `html:root[data-theme="dark"], html [data-theme="dark"]` | derived from 1a | CONFIRMED (COMPUTED) | (0,1,1) and (0,2,1)/(0,1,1) beat (0,1,0) regardless of order. |
| 1d | Descendant re-declarations (spot-checked 12) | `desk/dark.scss:124, 174-175, 191-192, 196-197, 222-234, 246-248, 266-268`; `common/grid.scss:285-286, 299`; `common/indicator.scss:72-73`; `common/controls.scss:360-365`; `desk/toast.scss:14-30`; `desk/frappe_datatable.scss:1-17`; `common/quill.scss:290`; `desk/navbar.scss:58` | CONFIRMED | Declarations for `.modal, .form-in-grid` are at 191-192. |
| 2a | Bundle glob | `esbuild/esbuild.js:258` `*.bundle.{js,ts,css,sass,scss,less,styl,jsx}` | CONFIRMED | |
| 2b | Basename-keyed, global manifest | `esbuild/esbuild.js:450` `let key = path.basename(info.entryPoint);` RTL keys get `rtl_` (`:451-453`) | CONFIRMED | Core's own `hooks.py:37` uses `"desk.bundle.css"` for a `.scss` source. |
| 2c | Missing key emits a broken link | `utils/jinja_globals.py:155` `path = bundled_assets.get(path) or path`, then `abs_url` (`website/utils.py:234-236` prefixes `/`) | CONFIRMED | Under `ar`, a missing key is emitted as `/rtl_ins_desk.bundle.css` (`jinja_globals.py:153-154`). |
| 2d | Font `url()` must be absolute | `esbuild/ignore-assets.js:4-7` marks `^/assets/` as external; core `public/css/fonts/inter/inter.css:6` uses absolute URLs | CONFIRMED (mechanism) | Failure of a relative URL NOT RUN. |
| 3a | Toolchain versions | `yarn.lock:2849` rtlcss 4.1.1, `:2871` sass 1.69.5, `:1287` esbuild 0.14.54, `:2549` postcss 8.4.31, `:580` bootstrap 4.6.2 | CONFIRMED | `package.json` ranges are `^4.0.0`, `^1.63.0`, `^0.14.29`. |
| 3b | `css-rtl` output | `esbuild/esbuild.js:229` `output_name.replace("/css/", "/css-rtl/")`; `:300-301` rtlcss plugin only for that build | CONFIRMED | |
| 3c | RTL languages | `utils/jinja_globals.py:164` `local.lang in ["ar", "he", "fa", "ps"]` | CONFIRMED | |
| 3d | `rtl:begin:ignore` in core | `scss/common/quill.scss:10,33`; `scss/common/datepicker.scss:1,3`; `js/lib/leaflet/leaflet.css:3,18` | CONFIRMED | rtlcss handling of custom/logical properties not re-opened. |
| 4a | Indicator class list, pill background/colour | `scss/common/indicator.scss:52-53` (list), `:62-66`; pill 20px `:21`; dot 6px `:36`, `.no-indicator-dot` `:32` | CONFIRMED | |
| 4b | Not Saved orange, Draft red, Cancelled red, Submitted blue | `js/frappe/model/indicator.js:28, 73, 78, 95` | CONFIRMED |  |
| 4c | Workflow Inverse → `black`, no CSS rule | `model/indicator.js:57-62` (`Inverse: "black"`); no `.black` rule anywhere in `public/scss` or `public/css` | CONFIRMED | |
| 5a | `cellHeight` drives geometry | datatable `src/defaults.js:79` default `40`; `src/body-renderer.js:41` `itemHeight: this.options.cellHeight`; `src/style.js:164-168` injects `.dt-cell` height; Frappe passes `33` (`views/reports/query_report.js:1123`) and `35` (`report_view.js:349`, `form/multi_select_dialog.js:224`, `data_import/import_preview.js:143`) | CONFIRMED | |
| 5b | Absolute rows, scroller `itemHeight * total` | `dist/frappe-datatable.cjs.js:4599` (`var scrollerHeight = config.itemHeight * config.total;`); `dist/frappe-datatable.js:4756-4759` rows get `position: 'absolute', top` | CONFIRMED | |
| 5c | `--dt-*` scoped on `.datatable` | `scss/desk/frappe_datatable.scss:1-17`, imported at `desk/index.scss:40` | CONFIRMED, plus | The package CSS also declares `--dt-*` on `:root` (`src/style.css:1-…`), imported by `scss/report.bundle.scss:1` (in desk via `hooks.py:38`) and `web_form.bundle.scss:3`. Override on `.datatable`. |
| 5d | Injected `text-align:right` | `src/style.js:301-304` `.dt-cell--col-N {'text-align': column.align}`; `src/datamanager.js:138-139` numeric → `right`; `report_view.js:1249-1255` numeric and Date → `right` | CONFIRMED | Physical `right`, injected at runtime: rtlcss never sees it. |
| 6a | `login.bundle.css` after `web_include_css` | `templates/base.html:23-25` includes `templates/includes/head.html` (`web_include_css` at `:12-13`), then `base.html:27-29` `block head_include`; `www/login.html:87-88` fills it | CONFIRMED | |
| 6b | `body[data-path]` | `templates/base.html:57` `data-path="{{ path \| e }}"` | CONFIRMED | Value `login` ASSUMED. |
| 7a | Default wkhtmltopdf | `printing/doctype/print_settings/print_settings.json:176-180` default `wkhtmltopdf`; `utils/print_format.py:240-241` | CONFIRMED | |
| 7b | Generator chosen by Print Settings | `printing/page/print/print.js:720-723`; `printing/doctype/print_format/print_format.json:269-274`; `utils/print_utils.py:52-53`; `www/printview.py:98` | DIFFERS | Also a per-Print-Format field. The desk print page uses `print_format?.pdf_generator`, falling back to `this.print_settings.pdf_generator \|\| "wkhtmltopdf"`; the server path reads `frappe.get_cached_value("Print Format", print_format, "pdf_generator") or "wkhtmltopdf"`. Test both. |
| 7c | `scrub_urls` rewrites `: url(` and appends `!important`; JS disabled | `utils/data.py:79-81` `r'(:[\s]?url)(\([\'"]?)((?!http)[^\'" >]+)([\'"]?\))'`; `:2403-2405` appends `" !important"`; `utils/pdf.py:107, 110` | CONFIRMED | Matches `:url(` and `: url(` (one optional space). A second `url(` after a comma is not expanded. |
| 8 | Masking | `model/utils/mask.py:6-44`; `js/frappe/form/form.js:1214-1220`; `form/layout.js:251-256` | CONFIRMED | Placeholder varies: `XXXXXXXX` default, phone `abcXXXXXX`, email `XXXXXX@domain`, date `XX-XX-XXXX`, time `XX:XX`. |
| 9 | `data-label = encodeURIComponent(<translated label>)` on page buttons and menu items | `js/frappe/ui/page.js:286`, `:571`, `:644-646`, `:656-660`, `:466-481` | DIFFERS | (1) Primary/secondary actions are not encoded: `.attr("data-label", opts.label)` (`:286`). (2) Inner buttons encode the label *as passed*, then show `${__(label)}` (`:656-659`), so the attribute is translated only if the caller passed `__()`. (3) Menu items from `add_menu_item`/`add_dropdown_item` have no `data-label`: `<a class="grey-link dropdown-item" href="#" onClick="return false;">` (`:466, 477`). Only group-dropdown items (`:644`) carry it. |
| 10 | `form-refresh` | `js/frappe/form/form.js:625` `() => $(document).trigger("form-refresh", [this]),` | CONFIRMED | Runs after `refresh_header`, before `refresh_fields` and the `refresh` trigger (`:622-629`). |
| 11 | `<html data-theme-mode data-theme dir lang>` | `www/desk.html:2` | CONFIRMED | |
| 12 | Desk CSS order | `www/desk.py:37-39`; `__init__.py:966` hooks loaded in `get_installed_apps()` order; `:936` reads `installed_apps` global | CONFIRMED | |
| 13 | `extend_bootinfo` call site | `sessions.py:169-170` `frappe.get_attr(hook)(bootinfo=bootinfo)` | CONFIRMED, plus | Keyword call: the parameter must be `bootinfo`. Runs outside the per-user cache (`:139-147`). `desk_theme` is set after it (`:182`), so a hook cannot override it. |
| 14 | `before_uninstall` | `installer.py:437-441` backup, `:445-446` `frappe.get_attr(before_uninstall)()`, `:453` module deletion | CONFIRMED | |

## Facts for Phase 1 (desk first paint)

All VERIFIED in `www/desk.html` unless marked.

1. The `<html>` attributes are rendered by the server: `data-theme-mode` and `data-theme` are both `desk_theme.lower()` (`light`, `dark` or `automatic`), plus `dir` and `lang` (`:2`; `desk.py:52-53, 56`).
2. `<head>` (`:3-35`) holds only meta tags, title, favicon and the `app_include_css` links (`:24-26`, plain `<link rel="stylesheet">` from `jinja_globals.py:144`). The only inline script in `<head>` is the Crowdin snippet when `lang == "eo"` (`:28-34`). No boot data and no hook output reach `<head>`; `desk.py` passes only `app_include_js`, `app_include_css` and `app_include_icons` from hooks (`:37-40`).
3. `<body>` order: splash `div.centered.splash` with `splash_image` or the Frappe logo (`:37`, `templates/includes/splash_screen.html:1-4`), the empty `.main-section` (`:38-42`), the inline script that sets `frappe.boot` (`:46-59`), `app_include_icons` (`:61-63`), then `app_include_js` as synchronous `<script src>` with no `defer` (`:65-67`, `jinja_globals.py:110`).
4. Only the CSS from `app_include_css` is guaranteed before first paint. It can key on the four server-rendered attributes. Any `data-ins-*` attribute set from JS, including JS reading values from `extend_bootinfo`, arrives after the splash may already have painted (COMPUTED; NOT RUN in a browser).
5. `Automatic`: `data-theme="automatic"` stays until `frappe.ui.set_theme()` runs from the desk bundle (`desk.js:49, 93-118`; `ui/theme_switcher.js:152-163`, using `matchMedia("(prefers-color-scheme: dark)")`). To avoid a flash, CSS must cover `[data-theme="automatic"]` inside `@media (prefers-color-scheme: dark)`.
6. `app_include_css` entries without `.bundle.`, or starting with `/assets`, skip the manifest lookup and pass through `abs_url` (`jinja_globals.py:151-157`). A server-rendered stylesheet URL (for example a per-site preset file) would therefore load in `<head>` before first paint.
7. The splash is removed in `make_page_container` (`desk.js:374`).
