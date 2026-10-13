# Phase 3 runtime (backend-engineer R2): evidence

Labels: VERIFIED (ran it or opened the line), COMPUTED, ASSUMED. Bench `midad.test`, Frappe 16.32.0, ERPNext 16.33.0, Postgres. Nothing is committed.

## Hooks confirmed in Frappe 16.32.0 source (VERIFIED, opened)

| Hook or API | Source |
|---|---|
| `app_include_css`, `app_include_js` read from hooks plus `site_config`, each a new list | `www/desk.py:38-39` (`hooks.get(...) + frappe.conf.get(...)`), context `:49-50` |
| Desk links rendered with `include_style` in `<head>`, in list order | `www/desk.html:24-26` |
| `update_website_context(context)` called per hook, return dict merged, no exception guard | `website/page_renderers/base_template_page.py:69-75` |
| `context.template` is the app-relative template path (`www/desk.html`) | `website/page_renderers/template_page.py:59-64, 185` |
| `extend_bootinfo(bootinfo=...)` keyword call, after the bootinfo cache read (so `bootinfo.ins` is never cached) | `sessions.py:139-147` (cache), `:169-170` (hook) |
| `after_migrate` called with no arguments | `migrate.py:200-203` |
| `before_uninstall` called with no arguments | `installer.py:445-446` |
| `doc_events` handler composed as `handler(doc, method)`, runs before `clear_cache` of the document | `model/document.py:1650-1660` |
| `frappe.whitelist(methods=[...])` registers `allowed_http_methods_for_whitelisted_func` | `__init__.py:439-470` |
| `frappe.defaults.set_user_default` / `get_defaults_for`, cache cleared by `_clear_cache(parent)` | `defaults.py:12-13, 235-255, 268-273` |
| `get_assets_json()` merges `assets.json` and `assets-rtl.json` (keys `rtl_<name>`) | `utils/__init__.py:950-967` |
| `bundled_asset` rewrites `*.bundle.css` through the manifest, other paths through `abs_url` | `utils/jinja_globals.py:147-157` |
| `log_error(defer_insert=True)` | `utils/error.py:44-51, 95-96` |
| Desk bundles discovered under `public/**/*.bundle.*`; JS bundles only at the top level of `public/js` | `esbuild/esbuild.js:258`, `esbuild/utils.js:27-37` |
| Page events are looked up on the wrapper: `wrapper.on_page_load`, `wrapper.on_page_show` (`frappe.pages[name]` is the wrapper) | `public/js/frappe/views/pageview.js:97, 105-117` |
| `frappe.xcall(method, params, type)` resolves `r.message` | `public/js/frappe/request.js:13-28` |
| `form-refresh` triggered after `refresh_header`, before `refresh_fields` | `public/js/frappe/form/form.js:618-627` |
| `masked_fields` on the form meta | `public/js/frappe/form/form.js:1214-1220` |
| `frappe.workflow.workflows[doctype]`, `get_all_transitions` (local, throws without a workflow, so the script checks first) | `public/js/frappe/model/workflow.js:5-22, 84-90` |
| Page head structure (`.page-head`, `.custom-actions`, `.menu-btn-group`, `.actions-btn-group`, `.primary-action`, `.btn-secondary`, `.inner-group-button`) | `public/js/frappe/ui/page.html:1, 54-85`; `page.js:151-165, 566-571, 640-656` |
| Delete is a menu item only when docstatus is not 1 and the doc is saved | `public/js/frappe/form/toolbar.js:500-510` |
| `new Intl.Locale(navigator.language)` throws in a headless browser with no locale (every `make_app_page` fails); the browser tests pass `locale` | `public/js/frappe/ui/alt_keyboard_shortcuts.js:99` |

## What was built (files)

`institutional_theme/hooks.py`, `site_files.py`, `preferences.py`, `api.py`, `boot.py`, `website.py`, `install.py` (adds `after_migrate`), `institutional_theme/page/ins_appearance/{__init__.py, ins_appearance.json, ins_appearance.js}`, `tests/{__init__,helpers,test_api,test_boot,test_preferences,test_site_files,test_website_hook}.py`, `tests/browser/{first_paint,appearance_keyboard,actions}.mjs`. The shell drafts under `public/js/` were reviewed against the source above and left unchanged.

## Results

| Check | Result | Label |
|---|---|---|
| `bench build --app institutional_theme` | built: `ins_shell.bundle.js` 5.19 Kb, `ins_desk.bundle.css` 97.91 Kb (ltr and rtl), 4 palette bundles, 2 font bundles; all 7 CSS keys and 7 `rtl_` keys in the manifests. Log `bench-build.log` | VERIFIED |
| `bench migrate` | ran, `after_migrate` ran with no error. Log `migrate.log` | VERIFIED |
| `restart-web` | web up on 8000 (first attempt as the wrong user failed on `web.pid`; rerun with `sudo`; log `restart-web.log`) | VERIFIED |
| `bench run-tests --app institutional_theme` | Frappe suite: 88 tests, 87 pass, 1 fails, and the failure is not in my files (see below); my 5 modules (45 tests) all pass; unit suites 140 OK. Log `run-tests-3.log` (earlier runs `run-tests-1.log`, `run-tests-2.log`) | VERIFIED |
| `/desk` for a user on `petrol` (curl) | `<head>` has `ins_desk.bundle.<h>.css` then `ins_palette_petrol.bundle.<h>.css`; `<script src=".../ins_shell.bundle.<h>.js">`; `frappe.boot.ins` carries palette, density and the allowed cards | VERIFIED |
| `/desk` for Administrator (midad) | `ins_desk` and `ins_shell` linked, no palette link | VERIFIED |
| Arabic user | links are the `css-rtl/` build (`rtl_ins_desk`); custom palette linked as `/files/institutional_theme/ins_palette_custom.<h>.css` | VERIFIED |
| Custom file | served `200`, `Content-Type: text/css; charset=utf-8`, header says generated; link disappears when the site stops allowing `custom`, while the user's stored value is kept | VERIFIED |
| `set_appearance` over HTTP | POST ok; GET `403`; Guest `403`; unknown preset gives `ValidationError` "The colour preset nope is not available on this site." | VERIFIED |
| Login page | no ins link (`web_include_css` stays off: `ins_web` does not exist yet) | VERIFIED |
| `first_paint.mjs` (JS blocked, first painted pixel vs `--bg-color` of the finished desk) | 10 of 10 pass: Dark midad 17,24,32; graphite 17,24,32; petrol 13,26,30; forest 14,26,22; plum 28,20,29. Light is 255,255,255 for every preset, so Light proves the link order only. Log `first_paint.log`, `first_paint.json` | VERIFIED |
| `appearance_keyboard.mjs`, en and ar | 26 of 26 pass: three fieldsets with legends, Tab reaches the mode group, the arrow key changes mode live, `data-theme-mode` follows, no dialog, announcement, Apply disabled until a different choice, reload lands focus on the `h1` with the message. Log `appearance_keyboard.log` | VERIFIED. The Arabic messages shown were English (no `ar.csv` entries yet), so the Arabic wording is not verified |
| `actions.mjs`, en and ar | 28 of 28 pass: `data-ins-docstatus` 0, 1, 2; Submit, Delete, Cancel, Amend tagged in their own state only; workflow Approve and Reject tagged; `data-ins-new`; no ribbon in production. Log `actions.log` | VERIFIED |
| Desk with the shell script | `data-ins-shell="1"`, `data-ins-density="compact"` for a compact user, no page error | VERIFIED |
| `ruff check .` and `ruff format --check .` (0.16.8) | All checks passed; 104 files formatted. `ruff-check.log`, `ruff-format.log` | VERIFIED |
| `python3.14 -m compileall institutional_theme` | compiles | VERIFIED |
| Sass compile of every bundle outside the bench (dart-sass) | no error | VERIFIED (superseded by the bench build) |

## Failing test that is not mine

`institutional_theme_settings/test_institutional_theme_settings.py::test_audit_text_uses_labels_not_token_names` fails: it asserts `" border "` is absent from the audit text, but the label "Input border" (from `midad/labels.py`) legitimately contains it. Owner of the settings doctype tests must change the assertion (for example check for the token name `--input-border` instead). It also failed in `run-tests-1.log` before my later changes.

## Not verified

- Environment ribbon in a browser (needs `ins_environment` in `site_config.json`; shared file, not touched). The server side (`boot.environment`) is tested; the ribbon script is read, not run.
- Masked-field attributes in a browser (needs a doctype with masked fields).
- The Arabic wording of every string (no `ar.csv` entries yet).
- Install, uninstall and idempotence of `after_migrate` across a restore (gate script belongs to the bench agent). `before_uninstall` already removed the generated folder; not run by me.
- `identity.py` and the Jinja `ins_identity()` hook: not written (Phase 4, with the Letter Head). Identity write-through lives in `institutional_theme_settings/identity_sync.py` (not mine).
- `web_content.py` (ADR 0009), `web_include_css`, `email_css`: not in this task.
- `test_ensure_never_writes_the_database` patches `frappe.db.sql`; it passes, but I did not prove the patch intercepts writes (a known write was not used as a control).
- `after_migrate` regeneration is tested by the unit test, not by inspecting the migrate log for the folder.

## Selectors depended on (16.32.0)

| Selector | Used for | Source |
|---|---|---|
| `.page-head` inside `frm.page.wrapper` | scope of action tagging | `ui/page.html:1` |
| `button.primary-action` | Submit, Amend | `ui/page.html:85`; `form/toolbar.js:720-764` |
| `button.btn-secondary` | Cancel, Amend | `ui/page.html:71`; `page.js:152` |
| `.menu-btn-group .menu-item-label` (its `a`) | Delete | `ui/page.html:58-61`; `page.js:468-479`; `toolbar.js:500-510` |
| `.custom-actions button[data-label]`, `.inner-group-button .dropdown-item[data-label]` | custom and grouped buttons | `page.js:165, 566-571, 644-656` |
| `.actions-btn-group .menu-item-label` (its `a`) | workflow transitions | `ui/page.html:72-75`; `page.js:157-158` |
| `data-theme-mode` on `<html>` | Appearance page mode, core observer | `desk.js:110-118`; `theme_switcher.js:129` |
| `frm.page.wrapper`, `frm.fields_dict[name].wrapper`, `frm.meta.masked_fields` | status and mask attributes | `form.js:90, 1214-1220` |

## Strings (for `ar.csv`)

Python, in `api.py` and `preferences.py`:
- "The colour preset {0} is not available on this site." / ADR 0002 gives the Arabic.
- "Density must be Comfortable or Compact." / ADR 0002 gives the Arabic.
- "Custom" (already used by the settings doctype).

Appearance page (`ins_appearance.js`, page title in `ins_appearance.json`): "Appearance", "Mode", "Light", "Dark", "Automatic", "Density", "Comfortable", "Compact", "Colour preset", "Apply colour preset", "Selected", "Set by your administrator.", "Mode changed to {0}.", "Density changed to {0}.", "Colour preset changed to {0}." (Arabic for all in ADR 0002).

Shell (`public/js/shell/`): "Training", "UAT", "Staging", "Non-production", "Hidden for your role", and the action labels "Submit", "Cancel", "Amend", "Delete", "Approve", "Reject". ADR 0008 says `ar.csv` must add "اعتماد" for Approve and "رفض" for Reject: core has neither, and the button comparison relies on `__()` returning the same text the toolbar used.

## Markup contract for css-engineer (`desk/_appearance.scss`)

`.ins-appearance` (root), `h1[tabindex="-1"]`, `.ins-sr-only.sr-only` (the status region; no `.ins-sr-only` rule exists yet, define it), `fieldset.ins-appearance-group[data-group=mode|density|palette]` with `legend`, `.ins-appearance-option` holding a native `input[type=radio]` and a `label`, `.ins-appearance-name`, `.ins-swatch` with two `.ins-swatch-dot`, `.ins-selected` (holds `.ins-selected-icon` with a check glyph and `.ins-selected-text` "Selected", only on the checked option), `.ins-appearance-help`, `button.btn.btn-primary.btn-sm`. Each dot sets only the custom property `--ins-swatch-colour` through the CSS object model; the stylesheet must paint `background-color: var(--ins-swatch-colour)` with the 1px `--ins-border-control` border.

## Open risks

1. The settings doctype tests leave generated files and users in the test site (`rt-petrol@`, `kb-*`, `act-*`, `fp-*` users; custom doctypes `Ins Action Test` and `Ins Action Flow`, the Workflow and its states; a few files in `sites/midad.test/public/files/institutional_theme/`). Harmless on the test site; the install gate removes the folder on uninstall.
2. A custom palette cannot be made to fail contrast by any input I tried (white on white still passes, because lightness comes from the approved curves). The save-time rejection of ADR 0005 therefore never fires for valid hex input; this is a property of `midad/model.py`, not of this task, and the lead should confirm it is intended.
3. The Appearance page adds its own `h1` below core's page title, so the screen has two headings; ADR 0002 asks for the `h1`.
4. The memo in `site_files.ensure()` is per worker and keyed by the setting values, not `modified`; a change from another worker is picked up on the next request after the file is missing or the values differ.

## Fix round (upgrade advisories 1-3, a11y findings 5 and 6)

Changes (VERIFIED by the runs below unless stated):

- `guard_log.py` (new): `log_once(title)` logs the exception being handled with `defer_insert=True`, at most once per worker process per distinct (title, exception type, message), never raises. `boot.extend_bootinfo` and `site_files` use it.
- `site_files.on_settings_update` only clears the memo and registers `frappe.db.after_commit.add(...)` (`frappe/database/database.py:130` creates the `CallbackManager`, `:1194` runs it after `commit`, `:1203` resets it on rollback). `_regenerate` writes the files and calls `website.utils.clear_cache()` and never raises (a raising callback would stop the other commit callbacks, `utils/__init__.py:1103-1135`).
- `site_files.prune` deletes `ins_palette_custom.*.tmp` / `ins_fonts_uploaded.*.tmp` older than `TEMPORARY_MAX_AGE` (300 s); younger and foreign `.tmp` files are kept.
- `masked_fields.js`: a real `span.ins-masked-reason` (id `ins-masked-reason-N`) in the wrapper, `aria-describedby` on the field's input/textarea/select, idempotent. The `::after` generated text and `data-ins-masked-label` are removed (one reading of the reason, not two). `_masked.scss` styles the element with the same tokens. The reason stays visible (it is design text, not hidden): "visually hidden" was not needed because sighted users also benefit.
- `ins_appearance.js`: a failed mode, density or apply announces a message in the status region and moves focus to the restored radio or to the apply button; the post-reload message is announced in `on_page_show` together with the focus move. Heading: core 16.32 page head (`ui/page.html`) has a breadcrumb list and no `h1`/heading element (VERIFIED by reading the file), so the page's `h1` is the only heading on the screen. It is kept (ADR 0002); risk 3 above is withdrawn.

Commands and results:

- `tools/bench/b.sh run-tests --app institutional_theme`: 109 tests OK (the new ones: `test_a_persistent_failure_is_logged_once_per_process`, `test_a_different_failure_is_logged_again`, `test_a_log_call_that_raises_never_leaves_the_guard`, `test_the_files_wait_for_the_commit_and_a_rollback_writes_nothing`, `test_a_failure_after_the_commit_is_logged_once_and_does_not_raise`, `test_old_temporary_files_are_pruned_and_young_ones_kept`), then 140 OK in the second suite. `tests/helpers.py` now commits in `set_settings`/`reset_settings` because the files appear after the commit.
- `tools/bench/b.sh build --app institutional_theme` then `restart-web`: built bundles contain `ins-masked-reason`.
- `node tests/browser/appearance_keyboard.mjs`: all PASS (en and ar). `node tests/browser/actions.mjs`: all PASS. `node tests/browser/cascade.mjs`: pass 4256, fail 0 (fixture and the masked assertion updated: real element, display block, no `::after`).
- Failed-save probe (ad hoc script, requests aborted with Playwright routes): density and mode revert, focus on the restored radio, status "The density could not be saved. The previous density was restored." and the mode equivalent; apply failure re-enables the button, focus on it, status "The colour preset could not be applied. Try again." (VERIFIED live, en only).
- `uvx ruff@0.16.8 check .` and `format --check .`: clean.

Not verified: the masked-field markup on a real form with a masked field (only the fixture and the CSS cascade were run; the JS path was not exercised live); the Arabic text of the three new failure messages in the browser (strings are not yet in `ar.csv`); finding U4/U5 of the upgrade review were not part of this round.
