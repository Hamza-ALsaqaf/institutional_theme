# Hooks enabled in `institutional_theme/hooks.py` (backend-engineer R2, Phase 3)

| Hook | Value | Target exists | Compiles or imports | Frappe 16.32.0 consumer |
|---|---|---|---|---|
| `app_include_css` | `["ins_desk.bundle.css"]` | `public/scss/ins_desk.bundle.scss` | Sass (dart-sass from `/tmp/ins-sass`, load path `public/scss`) wrote 108679 bytes with no error. COMPUTED. `bench build` result: see evidence.md | `www/desk.py:39,50`; `www/desk.html:24-26` |
| `app_include_js` | `["ins_shell.bundle.js"]` | `public/js/ins_shell.bundle.js` + `public/js/shell/*.js` | `node --check` on each file as ESM: all pass. COMPUTED. esbuild result: see evidence.md | `www/desk.py:38,49` |
| `update_website_context` | `institutional_theme.website.update_website_context` | `website.py` | ruff clean, compiles, stub-run | `website/page_renderers/base_template_page.py:69-75` |
| `extend_bootinfo` | `institutional_theme.boot.extend_bootinfo` | `boot.py` | ruff clean, compiles | `sessions.py:169-170` (called with `bootinfo=` keyword) |
| `doc_events` | `Institutional Theme Settings.on_update` -> `institutional_theme.site_files.on_settings_update` | `site_files.py` | ruff clean, compiles | `model/document.py:1650-1660` (handler is called as `(doc, method)`) |
| `after_migrate` | `institutional_theme.install.after_migrate` | `install.py` | ruff clean, compiles | `migrate.py:200-203` (called with no arguments) |
| `before_uninstall` (already on) | `institutional_theme.install.before_uninstall` | `install.py` | unchanged | `installer.py:445-446` |

Still commented out, because the target does not exist yet: `web_include_css` (`ins_web.bundle.scss`, print-web-engineer), `email_css` (`ins_email.bundle.scss`, Phase 4), `jinja` (`identity.ins_identity`, and the print Letter Head, Phase 4), `after_install` (install changes nothing, by design).

Palette and font bundles (`ins_palette_<name>.bundle.css`, `ins_fonts_noto|tajawal.bundle.css`) are not in `hooks.py`: they are linked per user by `update_website_context`, only when both `<name>` and `rtl_<name>` are in the asset manifest. All five palette bundles and both font bundles compile with Sass (COMPUTED).
