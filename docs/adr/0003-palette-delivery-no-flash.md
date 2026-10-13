# 0003 — Palette delivery with no flash

Status: accepted, 2026-10-13. Settles ADR 0001 question 2. Applies upgrade findings 2, 4, 5, 7-9, accessibility findings 3 and 9, and the css-engineer's conditions.

## Context

The desk's `<head>` holds only the `app_include_css` links. The splash paints before any script runs, so a root attribute set from boot cannot precede the first paint (the premise of ADR 0001 question 2 fails). The manifest is keyed by basename across the bench, so a bundle cannot carry a per-site default.

## Decision

**The server picks the palette and links its stylesheet in `<head>`.** There is no `data-ins-palette` attribute.

- `ins_desk.bundle.css` carries the `midad` colour tokens, the mapping onto Frappe's variables, and the base rules.
- Each other shipped preset is `ins_palette_<name>.bundle.css`. It is generated from `tokens.json` and holds only `--ins-*` declarations.
- The custom preset is a per-site generated file (0004).

**The hook.** `institutional_theme.website.update_website_context(context) -> dict | None`. Its whole body sits inside `try/except Exception`. On failure it calls `frappe.log_error(title="Institutional Theme: stylesheet links", defer_insert=True)` and returns `None`: nothing is linked and the user sees `midad`.

1. *Desk*: `context.get("template") == "www/desk.html"` and `context.app_include_css` is a list. The hook returns `{"app_include_css": [*context.app_include_css, *links]}`, where `links` are:
   - the user's palette (0002), unless it is `midad`;
   - the site's font links (0004).
2. *Website and login*: otherwise, when `web_include_css` is in the context, the hook returns `{"web_include_css": [*context.web_include_css, *site_links]}`. `site_links` are the site-default palette and the font links.

   These pages have no `data-theme` (light only) and are cached across users, so they never get a per-user value.
3. The hook always builds a new list and never appends in place: `web_include_css` is the worker's cached hooks list.
4. A bundle is linked only if `frappe.utils.get_assets_json()` has both `<name>` and `rtl_<name>` (a missing key would be a broken link); a generated file only if it exists after `ensure()` (0004).

**Selector shapes.** Light, dark and automatic blocks per family. The automatic block sits inside `@media (prefers-color-scheme: dark)`.

| Family | Light | Dark | Automatic |
|---|---|---|---|
| base `--ins-*` (`midad`) | `html:root`, `html [data-theme="light"]` (0,1,1) | `html:root[data-theme="dark"]` (0,2,1), `html [data-theme="dark"]` (0,1,1) | `html:root[data-theme="automatic"]` (0,2,1) |
| Frappe variable mapping, and every palette or custom file | `html:root[dir]` (0,2,1), `html[dir] [data-theme="light"]` (0,2,1) | `html:root[dir][data-theme="dark"]` (0,3,1), `html[dir] [data-theme="dark"]` (0,2,1) | `html:root[dir][data-theme="automatic"]` (0,3,1) |

Every block beats core's (0,1,0) blocks and Bootstrap's `:root`. The mapping sits at the palette shapes, so a later-installed app at (0,1,1) cannot displace it. Mapped values are `var(--ins-…)` references, so a palette changes only `--ins-*`.

**Parity, independent of order.** `institutional_theme/midad/emit.py` emits all three blocks of a family from one key list (the base colour keys); the custom preset uses the same emitter. A unit test (every preset plus a sample custom one) and `python -m institutional_theme.audits` (built files) assert equal key sets. The one tie, palette-light against base-dark at (0,2,1), then never decides a value.

**`color-scheme`.** In `ins_desk` only:
- `color-scheme: light` in the base light block;
- `color-scheme: dark` in the base dark block;
- `html:root[data-theme="automatic"] { color-scheme: light dark; }` outside the media query.

The parity audit checks all three. Palette and custom files may contain custom properties only (audited), so they never set `color-scheme` or `forced-color-adjust`; every `forced-colors` rule lives in `ins_desk` or `ins_web`.

**Density.**
- The shell script sets `data-ins-density` on `<html>` while it is evaluated, before the desk is built.
- Comfortable values sit on `html:root[dir]` (0,2,1); compact on `html:root[dir][data-ins-density="compact"]` (0,3,1).
- The coarse-pointer block, `@media (pointer: coarse)`, uses `html:root[dir][data-theme-mode][data-ins-density], html:root[dir][data-theme-mode]` (0,4,1) and (0,3,1). It sets only target-size tokens and wins by specificity, not by order.
- The datatable never gets a `height`; compact changes only padding and type inside core's 33 or 35px `cellHeight`. Its 28px and 44px row targets are documented exceptions (it still meets 24px).

**What can still change on screen.** Nothing palette-related. Under Automatic, before `set_theme()` runs, core rules keyed only on `[data-theme="dark"]` stay light, but only the splash is visible, on the mapped `--bg-color`. A failed hook or missing file shows `midad`. Fonts swap on first load (0004).

## Alternatives rejected

1. *All presets in one bundle under `html[data-ins-palette]`, set from boot.* The wrong palette flashes for users not on the default, and every preset ships to every page (P1, P5).
2. *Site default in `site_config.app_include_css`.* It is per site, not per user; see 0004.

## Consequences

- **backend-engineer**: `website.py`, `emit.py`, generated files, parity, first-paint and hook tests.
- **css-engineer**: `ins_desk.bundle.scss`, `desk/_base.scss` (forced-colors, `font-synthesis`), the order-independence test.
- **print-web-engineer**: `ins_web` scopes login rules as `html body[data-path="login"] …`, so they out-rank `login.bundle.css`.

## Verification

- Python tests: `/desk` for a user on `petrol` has the link in `<head>`; a removed manifest key gives no link; a raising hook still gives 200 and one Error Log row after commit; website pages get a new list.
- Headless Chromium CDP screencast, per preset and mode: the first painted `html` background equals the audited `--bg-color`.
- Browser test: with the palette loaded before `ins_desk`, computed values are identical.

## Evidence (Frappe 16.32.0)

- `www/desk.html:2` attributes, `:24-26` CSS links, `:46-67` boot script then JS; `www/desk.py:5` `no_cache`, `:37-51` context.
- `public/js/frappe/desk.js:110-118`.
- `website/page_renderers/template_page.py:59-64` `template_path` is relative to the app (`www/desk.html`), `:185` `context.template`.
- `website/page_renderers/base_template_page.py:15-16, 27-32, 69-75`: the hook loop, which has no exception guard.
- `website/doctype/website_settings/website_settings.py:232`.
- `utils/jinja_globals.py:147-157` `bundled_asset`.
- `utils/__init__.py:950-967` `get_assets_json`.
- `utils/error.py:44-51, 95-96` `defer_insert`.
- `public/scss/desk/dark.scss:177` core sets `color-scheme` only for dark.
- `public/js/frappe/ui/theme_switcher.js:89, 93, 154-163`.
- `esbuild/esbuild.js:450-456`.
