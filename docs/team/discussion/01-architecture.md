# 01 — Architecture proposals (ADR 0002 to 0007)

Status: proposal, discussion round 1. Author: theme-architect, 2026-10-13.

Every `file:line` below is in Frappe 16.32.0 (tag `v16.32.0`), relative to the `frappe` app unless it starts with `esbuild/`, and was opened for this proposal. Evidence labels: VERIFIED (line read), COMPUTED (derived), ASSUMED, UNVERIFIED. "P1" to "P5" are the priorities of `docs/BRIEF.md` section 3 (P1 correctness, P2 accessibility, P3 upgrade-safety and maintainability, P4 productivity, P5 aesthetics).

Replies go at the end, under "Replies", at most 200 words each, with evidence.

---

## 0002 — Per-user preset and density storage

**Decision.** Two user defaults, `ins_palette` and `ins_density`, written with `frappe.defaults.set_user_default` (`defaults.py:12-13`). This is the same `DefaultValue` mechanism core uses for each user's `time_zone` and locale keys (`core/doctype/user/user.py:336-350`). The User doctype is not altered.

**How the user changes it.** A desk Page of this app, `ins-appearance` ("Appearance" / "المظهر"), with no roles, so every desk user may open it (`core/doctype/page/page.py:126-136`). It is found through the awesomebar, which searches `boot.page_info` (`desk/desk_views.py:36`, `public/js/frappe/ui/toolbar/search_utils.js:279-300`). The page shows the allowed presets as labelled swatch cards, the two densities, and a button that opens Frappe's own Light/Dark/Automatic dialog the way core does (`new frappe.ui.ThemeSwitcher().show()`, `public/js/frappe/ui/sidebar/sidebar_header.js:243`). Saving calls this app's `institutional_theme.api.set_appearance(palette, density)`, declared `@frappe.whitelist(methods=["POST"])`, which rejects Guest. The method checks the palette against the site's allowed list and the density against `comfortable|compact` on the server, so a System Manager's restriction cannot be bypassed from the browser (P1). It writes defaults for `frappe.session.user` only. No core method is overridden. Density applies at once through the root attribute; a palette change reloads the page (0003).

**How the value reaches the page.** On the server, the `update_website_context` hook reads the effective palette while `/desk` renders and links its stylesheet in `<head>` (0003). On the client, `extend_bootinfo` (`sessions.py:169-170`, which runs outside the per-user boot cache at `:136-147`) adds `frappe.boot.ins = {palette, density, allowed, environment, behaviour flags}`. The effective palette is the stored value if it is still allowed, otherwise the site default. A disallowed stored value is kept, so allowing it again restores the user's choice.

**The `sysdefaults` leak (findings section 7).** `boot.sysdefaults = frappe.defaults.get_defaults()` (`boot.py:51`) merges the user's defaults over the global ones (`defaults.py:105-118`). They also reach `frappe.boot.user.defaults` (`utils/user.py:204, 259`), which the client uses to pre-fill a new document's field with the same fieldname (`public/js/frappe/model/create_new.js:167`, `public/js/frappe/defaults.js:5-6`). So: both keys carry the `ins_` prefix; no field of this app may be named `ins_palette` or `ins_density`; client code reads `frappe.boot.ins` only, never `sysdefaults`. Writing a default clears that user's caches (`defaults.py:173-176, 270-273`). That is acceptable for an action users take rarely.

**Lifecycle.** `before_uninstall` deletes the `DefaultValue` rows whose `defkey` is one of the two keys. Deleting a User leaves the rows behind, exactly like core's own `time_zone` default. Their `parenttype` is `__default` (`defaults.py:179-190`), so the child-table delete in `model/delete_doc.py:267` does not reach them. They are harmless, and uninstall removes them.

**Alternatives rejected.**
1. *A small doctype `Institutional Theme User Preference` with a Link to User.* It works, and uninstall drops it automatically. But a Link to User makes `check_if_doc_is_linked` (`model/delete_doc.py:376`) block deleting the user until the row is removed. Avoiding that needs a `doc_events` hook on User: more moving parts for the same result (P3).
2. *Browser `localStorage`.* It is per device, not per user, so it gives the wrong result on shared office PCs (BRIEF section 2). The server cannot see it either, so the palette could not be in `<head>` (P1, and 0003).
3. *Not an alternative: a Navbar Settings menu item.* In 16.32 these items are pushed into the sidebar menu with no `url` or `onClick` (`sidebar_header.js:106-110`). A Route item does nothing (`public/js/frappe/ui/menu.js:126-176`). An Action item is rendered as an inline `onclick` string (`menu.js:102-103`), which breaks the rule against inline scripts.

**Verification.** Python tests: set a value; restrict it and get the fallback; get `ValidationError` for a disallowed value; after uninstall on the test site, no rows remain.

---

## 0003 — No flash of the wrong palette

**What paints first (VERIFIED).** `<head>` holds only the `app_include_css` links (`www/desk.html:24-26`). `<body>` begins with the splash, one image over the `html` background `var(--bg-color)` (`:37`, `templates/includes/splash_screen.html:1-4`, `public/scss/desk/global.scss:1-3`). Boot data and `app_include_js` follow as synchronous scripts (`desk.html:46-67`). The desk is built only on `$(document).ready` (`public/js/frappe/desk.js:15-26`), and `setup_theme()` runs in the same synchronous `startup()` that builds the sidebar and page container (`desk.js:33-52`). So no script-set attribute can precede the splash's first paint (the premise of ADR 0001 question 2 fails), and the bench-wide bundle, keyed by basename (`esbuild/esbuild.js:450-456`), cannot carry a per-site default.

**Decision.** The server chooses the palette and delivers it as a stylesheet in `<head>`. There is no `data-ins-palette` attribute.
- `ins_desk.bundle.css` carries `midad` as the base colour tokens.
- Each other shipped preset is a bundle, `ins_palette_<name>.bundle.css`, generated from `tokens.json` and holding only `--ins-*` colour tokens. The custom preset is a generated file per site (0004).
- The `update_website_context` hook runs for `/desk` after `desk.py` has filled `app_include_css` and before the template renders (`website/path_resolver.py:34-35`; `website/page_renderers/template_page.py:95, 99, 101`; `base_template_page.py:27-35, 69-74`; `www/desk.py:37-51`). Only `desk.py` puts `app_include_css` in the context, which identifies the desk. The hook returns a copy of the list with the user's palette file appended unless it is `midad`. `include_style` resolves the bundle and its `rtl_` twin (`utils/jinja_globals.py:132-157`). A parser-inserted `<link>` in `<head>` blocks rendering, so the first paint already uses the right palette (COMPUTED; NOT RUN).
- Website pages may be cached across users per path and language (`website/utils.py:49-58, 529-555`), so they get only the site default. `/desk` is never cached (`www/desk.py:5`).
- Density stays a root attribute (BRIEF section 8): the shell script sets `data-ins-density="compact"` when evaluated, before the desk exists.

**Selector shapes**

| Block | Light | Dark | Automatic, in `@media (prefers-color-scheme: dark)` |
|---|---|---|---|
| base `midad` | `html:root` (0,1,1); `html [data-theme="light"]` (0,1,1) | `html:root[data-theme="dark"]` (0,2,1); `html [data-theme="dark"]` (0,1,1) | `html:root[data-theme="automatic"]` (0,2,1) |
| palette file | `html:root[dir]` (0,2,1); `html[dir] [data-theme="light"]` (0,2,1) | `html:root[dir][data-theme="dark"]` (0,3,1); `html[dir] [data-theme="dark"]` (0,2,1) | `html:root[dir][data-theme="automatic"]` (0,3,1) |

`dir` is always rendered on `<html>` (`desk.html:2`, `templates/base.html:3`). Every block beats core's (0,1,0) blocks and Bootstrap's `:root` (findings section 2). The only tie, palette-light against base-dark or base-automatic at (0,2,1), is resolved by the rule the audit enforces: **within each block family, the light, dark and automatic key sets are identical**. The palette's (0,3,1) block then re-declares every key, whatever the file order. The inner-element selectors cover the theme switcher's previews (`public/js/frappe/ui/theme_switcher.js:89, 93`).

**What can still change on screen.**
1. Nothing palette-related.
2. `Automatic` before `set_theme()` (`theme_switcher.js:152-163`): theme tokens are right through the media query; core rules keyed only on `[data-theme="dark"]` stay light, but only the splash shows, on the mapped `--bg-color`.
3. Changing preset reloads the page: a navigation, not a flash. Density and Light/Dark switch live.
4. A missing generated file is rewritten before it is linked (0004); if that fails, nothing is linked and the user sees `midad`.
5. With an empty cache, text can render before the WOFF2 arrives; the `font-display` policy is set in Phase 2.

**Alternatives rejected.**
1. *All presets in the bundle under `html[data-ins-palette]`, attribute set from boot* (the lead's sketch). The splash flashes for users not on the default, and every preset ships on every page against the 150 KB budget, to save a reload on a rare change (P5 against P1).
2. *Site default in `site_config.app_include_css`* (`www/desk.py:39`): per site, not per user; see 0004.

**Verification.** Headless Chromium records frames from navigation start (CDP screencast) per preset and mode, asserting the first painted `html` background is the audited `--bg-color`; the token audit checks key-set parity.

---

## 0004 — Custom brand preset and uploaded fonts

**Decision.** Generated files per site, in `sites/<site>/public/files/institutional_theme/`, served as static files and linked in `<head>` by the same `update_website_context` hook as 0003. No `site_config` edit, no endpoint, no inline style.
- `ins_palette_custom.<hash>.css`: the custom preset, computed by the D6 Python port on the approved curves, with the selector shapes and key set of a shipped palette bundle.
- `ins_fonts_uploaded.<hash>.css`: the `@font-face` rules for uploads.
- `<hash>` is the first 12 hex digits of the content's SHA-256: the same settings give the same name, and any change busts every cache. Both names are kept in hidden settings fields (0005).
- Written on save (after validation), in `after_migrate`, and lazily: before emitting a link, the hook checks the file exists (one `stat`) and otherwise rewrites it from the database (a file write, no database write). The previous file is kept until the next generation, so a page rendered meanwhile by another worker never gets a 404.
- Served at `/files/institutional_theme/…` by Werkzeug in development (`app.py:532-538`, `middlewares.py:33-40`; `.css` is not force-downloaded, `utils/response.py:309-324`) and by nginx in production (bench template: UNVERIFIED here, check on the bench). The names contain no `.bundle.`, so `bundled_asset` passes them through (`utils/jinja_globals.py:151-157`).
- Bundled pairings: `ins_fonts_noto.bundle.css` and `ins_fonts_tajawal.bundle.css` hold `@font-face` rules and font variables; IBM Plex is in `ins_desk.bundle.css`. Only the selected pairing is linked (D5).

**Uploaded fonts.** Four Attach fields: Arabic and Latin, regular and semibold. Each upload is a public `File` attached to the settings, at `/files/<name>`, checked by magic number (WOFF2 `wOF2`; TrueType `00 01 00 00` or `true`), not by extension. The generator writes one `@font-face` per file, with private family names `Ins Uploaded Arabic` and `Ins Uploaded Latin`, `src: url("/files/…") format("woff2"|"truetype")`, and on the Arabic face a `unicode-range` of the Arabic blocks so digits come from the Latin face (findings section 9). Font variables go on `html:root[dir]` (0,2,1), above the (0,1,1) `--font-stack` rule in findings section 8. Print under wkhtmltopdf needs TTF (findings section 6); with WOFF2 uploads only, print keeps the bundled IBM Plex TTF.

**After a database restore without files.** The settings and `File` rows return; the files do not. On the next desk load the hook finds the generated CSS missing and regenerates it. The custom preset is intact, because it is data. Each `@font-face` whose upload is missing is left out, so text falls back to IBM Plex, never to a broken face, and the settings form names the missing uploads (0005). `bench restore` calls `_new_site(source_sql=…)` and does not run migrate (`commands/site.py:362-374`), so the lazy path is what makes this safe. Restoring `--with-public-files` brings everything back: file backups archive the whole `files` folder (`utils/backups.py:347-353`).

**After `bench build`.** Nothing changes. The build writes only `sites/assets` (`esbuild/esbuild.js:450-456`), and its Redis flush empties only caches rebuilt from the database.

**Uninstall.** `before_uninstall` deletes the folder; once the hook is gone nothing links to it.

**Alternatives rejected.**
1. *Rewrite `site_config.app_include_css` on save* (`www/desk.py:39`, `installer.py:666-679`). A web request would write a file deployments own (read-only in some containers: UNVERIFIED); each worker caches it for 60 s (`config.py:147-150`, `__init__.py:200`); it is per site, not per user; and website pages read `web_include_css` from hooks only (`website/doctype/website_settings/website_settings.py:232`). (P1, P3)
2. *A cached whitelisted endpoint at a fixed hook URL.* A Python request in the render-blocking path of every desk load, needing non-JSON response handling, that fails exactly when the server is busy while static files still serve. (P1, P3)

**Verification.** Python tests: deterministic hash, regeneration after deleting the folder, fallback for a missing upload. On the bench: the link is in `<head>` and served as `text/css`.

---

## 0005 — Settings doctype

**Decision.** One Single, `Institutional Theme Settings`, module Institutional Theme. System Manager reads and writes; no other role has access. Users get effective values through `frappe.boot.ins` (0002).

**Fields** (fieldname, type, default):

*Colour.* `default_palette` (Select: audited presets plus `custom`; `midad`). `allow_midad`, `allow_graphite`, `allow_petrol`, `allow_forest`, `allow_plum`, `allow_umber` (Check, 1) and `allow_custom` (Check, 0); ticking only the default locks the site. `custom_label_en`, `custom_label_ar` (Data); `custom_primary`, `custom_accent` (Color, `mandatory_depends_on: allow_custom`, so core's own mandatory message applies); `custom_audit` (Small Text, read only: last audit summary).

*Typography.* `font_pairing` (Select `IBM Plex` / `Noto Sans` / `Tajawal` / `Uploaded`; `IBM Plex`). `font_arabic_regular`, `font_latin_regular` (Attach, mandatory for `Uploaded`), `font_arabic_semibold`, `font_latin_semibold` (Attach, optional).

*Identity, written through to existing settings.*
- `system_name` (Data) → Website Settings `app_name`, the desk title (`www/desk.py:60-62`).
- `emblem` (Attach Image) → Website Settings `app_logo` and `splash_image`, Navbar Settings `app_logo` (`core/doctype/navbar_settings/navbar_settings.py:26-39`; `website_settings.py:259-260`).
- `favicon` (Attach Image) → Website Settings `favicon` (`website_settings.py:254-255`; `www/desk.html:20-23`).

New, read by this app only: `institution_name`, `institution_name_ar` (Data); `wordmark`, `wordmark_dark` (Attach Image); `authorised_use_notice`, `authorised_use_notice_ar`, `support_contact` (Small Text). A value is written through only when it changed in this save (`has_value_changed`), via the target's own `save()`. Install and migrate never write these targets (BRIEF section 9.1).

*Layout and behaviour.* `default_density` (Select `Comfortable` / `Compact`; `Comfortable`). `enable_idle_warning` (Check, 0) with `idle_warning_minutes` (Int, 5) before the System Settings `session_expiry`, default `240:00:00` (`sessions.py:518-519`). `enable_connection_banner` (Check, 0), driven by `frappe.realtime.socket` (`public/js/frappe/socketio_client.js:53-72, 223`). `environment` (Data, read only) shows `frappe.conf.ins_environment` (`Training`, `UAT`, `Staging`; absent means Production, no ribbon). `custom_css_file`, `fonts_css_file` (Data, hidden, read only; 0004).

The environment is not editable here (P1): a production backup restored on a training server would otherwise hide the ribbon. `site_config.json` belongs to the server, not the database.

**Validation** in `validate`. The custom preset is checked against every pair in `tokens.json` → `contrast`, in both modes, with the D6 port. There is no "save anyway".

| Case | English | Arabic |
|---|---|---|
| default not allowed | The default colour preset {0} must also be allowed. | يجب أن تكون مجموعة الألوان الافتراضية {0} مسموحاً بها أيضاً. |
| contrast fails | Custom preset rejected: {0} on {1} in {2} mode is {3}:1; {4} requires at least {5}:1. | رُفضت المجموعة المخصصة: تباين {0} على {1} في الوضع {2} يساوي {3}:1، ويتطلب «{4}» ‏{5}:1 على الأقل. |
| not a font | {0} is not a WOFF2 or TrueType font file. | الملف {0} ليس ملف خط بصيغة WOFF2 أو TrueType. |
| private font | The font file {0} must be public so that the login page can load it. | يجب أن يكون ملف الخط {0} عاماً لتتمكن صفحة الدخول من تحميله. |
| idle range | The idle warning must come between 1 and 30 minutes before the session expires. | يجب أن يظهر تنبيه الخمول قبل انتهاء الجلسة بمدة تتراوح بين 1 و30 دقيقة. |
| upload missing (warning on load) | The uploaded font {0} is missing from the server; IBM Plex is used until it is uploaded again. | الخط المرفوع {0} غير موجود على الخادم؛ يُستخدم IBM Plex إلى أن يُرفع مجدداً. |

In the contrast message, {0} and {1} are token names, {2} is "Light" or "Dark" (فاتح / داكن) and {4} the contrast group. All strings use `_()` and have entries in `translations/ar.csv`.

**Alternatives rejected.**
1. *No identity fields; edit Website and Navbar Settings directly.* Identity in three places, against BRIEF section 5.4 (P3).
2. *A "Theme Profile" doctype with several profiles.* More records and permissions; D4 allows one custom preset (P3).

**Verification.** A unit test per message; a pale custom primary is rejected, naming the failing pair.

---

## 0006 — Test bench: pending Phase 0 bench result

---

## 0007 — Interactive proof built from the real compiled CSS

**Decision.** `scripts/build_proof.py` (standard library only) builds `docs/proof/midad-proof.html` from a built bench, never from the design canvas.

1. **Inputs.** The script reads `sites/assets/assets.json` and resolves the same keys `bundled_asset` resolves (`utils/jinja_globals.py:147-157`):
   - core `desk.bundle.css` and `report.bundle.css`, which are core's `app_include_css` (`hooks.py:36-39`);
   - this app's `ins_desk.bundle.css` and every `ins_palette_*` and `ins_fonts_*` bundle;
   - for each of these, its `rtl_` twin from `dist/css-rtl/` (`esbuild/esbuild.js:229, 450-456`).

   A sample custom preset file is generated by the same Python port the runtime uses.
2. **Self-contained.** Each file is inlined verbatim in its own `<style data-src="<manifest path>">`. Font `url(/assets/…)` references that the theme uses are rewritten to `data:` URIs: about 235 KB of WOFF2 for the IBM Plex defaults (findings section 9), about 315 KB as base64. Other `/assets/` URLs in core CSS (Inter, images) are left alone and fail harmlessly offline. A check asserts that no computed `font-family` in the proof depends on them. Icons are copied from core's sprites (`hooks.py:40-43`) for only the symbols the markup uses, into a hidden sprite like the desk's `#all-symbols` (`www/desk.html:43, 61-63`). Expected size is 2 to 4 MB, mostly core CSS twice (ASSUMED). The script prints the measured size and the README records it.
3. **Markup.** Hand-written screen partials with Frappe's real structure: sidebar, `page.html` head, list rows, form controls, grid, datatable, dialogs, toasts. Each partial names the core template it mirrors. A class check fails the build if any class in the proof is not found in the core compiled CSS, core JS or HTML templates, or this theme's bundles. Datatable rows keep core's absolute geometry from `cellHeight`; the theme never sets their height. Content is natural English and Arabic from `proof/strings.json`.
4. **Controls.** The proof has its own script; it is not the product. It sets `data-theme-mode` and `data-theme`, resolving Automatic with `matchMedia` as `theme_switcher.js:152-163` does. It swaps `dir` and `lang` and enables the LTR or RTL set of `<style>` elements through `HTMLStyleElement.disabled`. It also sets `data-ins-density`, enables one palette `<style>`, and shows a token and contrast panel read from the audit's JSON output.

**How "proof matches product" is checked.** A Playwright test opens, on the test bench with fixture records, the same screens as the proof: a draft form, a submitted form, a list, a report and a dialog. It opens the proof too. For about 40 probe selectors it compares `getComputedStyle`: colours, borders, font family, size and weight, line height, padding, radius, block size and outline. It does so for Light and Dark × LTR and RTL × both densities × every shipped palette. Colours must match exactly and lengths within 0.5 px. The proof embeds each manifest path, and the test fails if they differ from the bench's `assets.json`, so a stale proof cannot pass. CI runs the test at every gate.

**Alternatives rejected.**
1. *Render the design canvas (`design/canvas/midad.css`).* Its markup is illustrative, not Frappe's (design/README, "What the artboards are not"), so approving it would not approve the product (P1).
2. *Snapshot live desk pages into one file.* The snapshot would capture the runtime styles the datatable injects (findings section 5), would depend on fixture data, and would be hard to make bilingual. It is used instead as the reference side of the parity test (P3).

**Fallback.** Without a full bench, the same script runs against a Frappe clone with built assets (WORKFLOW, Phase 0 fallback). The parity test then compares against the static harness, and OWNER_REVIEW records that no live site was used.

---

## Consequential actions

**Decision.** The shell script tags actions with `data-ins-action="submit|cancel|amend|delete|approve|reject"`. CSS keys only on that attribute and never on `data-label`, which is translated, not encoded on primary actions (`public/js/frappe/ui/page.js:286`), and missing on plain menu items (`page.js:437-485`).

**What is matched**, inside `frm.page.wrapper .page-actions`:
- `button.primary-action` and `.btn-secondary` (`page.js:151-152`): their `data-label` is `__(status)` (`form/toolbar.js:808, 845`);
- menu links, by the text of `.menu-item-label`: Delete is added as `__("Delete")` (`toolbar.js:507-508`);
- workflow items: `add_action_item(__(d.action))` (`form/workflow.js:104`). Approve and Reject are core's standard Workflow Action Masters (`utils/install.py:119-120`). Other action names stay untagged and look routine.

The comparison is string equality with `__("Submit")` and the others, evaluated at runtime with the same function and dictionary the toolbar used (`frappe._messages`, `www/desk.html:55`). It is therefore equal by construction in every language, even when another app overrides a translation.

**When it runs.** `form-refresh` alone is not enough. The Amend check is asynchronous (`toolbar.js:732-756`), workflow items arrive after a promise (`workflow.js:99-104`), and editing a field resets the primary action without a refresh (`toolbar.js:860`). So the script runs one pass on `form-refresh` and installs one `MutationObserver` per page wrapper (`childList`, `subtree`, `attributeFilter: ["data-label"]`), guarded so it is installed only once. It writes attributes only and never restructures the DOM. If tagging fails, the button keeps core's look and works as before.

---

## Form status hook

On `$(document).on("form-refresh", (e, frm) => …)` (`public/js/frappe/form/form.js:625`) the shell script sets `data-ins-docstatus` to `0`, `1` or `2` on `frm.page.wrapper` (`form.js:90`, `ui/page.js:44`), and `data-ins-new` while `frm.is_new()`. The event fires after `refresh_header` and before `refresh_fields` (`form.js:618-627`), so the attribute is in place before fields render. It is how Draft and Cancelled, both red in core (`model/indicator.js:73, 78`), get distinct styles. It does not follow unsaved edits, because `frm.dirty()` does not trigger `form-refresh` (`toolbar.js:860`); core's orange "Not Saved" pill already signals that. The handler is idempotent and writes attributes only.

---

## Replies

Replies were posted as separate files: `01-reply-css.md` and `01-reply-print-web.md`. The reviews are in `docs/team/reviews/upgrade-phase1.md` and `docs/team/reviews/a11y-phase1.md`.

---

## Outcome

Revised once, on evidence, and accepted on 2026-10-13. The records are `docs/adr/0002` to `0008`; the file plan is `docs/team/PLAN.md`.

- **0002**: storage as proposed. The mode is now a native radio group that calls core's `switch_theme`; core's dialog is not used (a11y 1).
- **0003**: the server-linked palette as proposed. The hook is guarded and checks the manifest. `color-scheme` is set and audited in every block (upgrade 2, 4, 5, 7-9; a11y 3).
- **0004**: names are content hashes computed at link time, and writes are atomic. Semibold uploads are mandatory (upgrade 3, 6; a11y 2).
- **0005**: identity is written with `set_single_value` and restored on uninstall (upgrade 1, 10).
- **0006**: pending the bench result.
- **0007**: the proof, with the a11y 12 additions.
- **0008**: action, status, masking and ribbon hooks; tagging includes state checks.
