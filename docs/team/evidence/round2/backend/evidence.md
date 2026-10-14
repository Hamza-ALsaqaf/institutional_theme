# Backend round 2 evidence (2026-10-13, 21:37 to 22:15 UTC)

Labels: VERIFIED (run or opened), NOT VERIFIED. Test bench `midad.test`, Frappe 16.32.0, ERPNext 16.33.0. Users `be-r2-en@midad.test`, `be-r2-ar@midad.test` (System Manager, plus Sales User for the Customer form).

## Part A, verification on the real build

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Masked field on a real form | VERIFIED. Property Setter `mask=1` on Customer `tax_id` (test site, deleted afterwards, 202/202). The user sees core's placeholder `XXXXXXXX`; `data-ins-masked="1"`, one `.ins-masked-reason` ("Hidden for your role" / "مخفي لدورك"), `aria-describedby` resolves to it, a second `form-refresh` adds nothing. FINDING: the described element is the hidden `.control-input` input; the visible value is a static `.control-value` div (not a control), so the link does nothing for assistive tech. The reason is adjacent in reading order ("Tax ID XXXXXXXX tax_id Hidden for your role"). | `a1_masked.mjs`, `a1_masked.json`, `shots/a1-masked-{en,ar}.png` |
| 2 | Appearance announcements, Arabic | VERIFIED, every string Arabic. Success: "تم تغيير الكثافة إلى مضغوطة." / "تم تغيير الوضع إلى داكن." / "تم تغيير مجموعة الألوان إلى مداد." (after reload). Failed (route to 417): "تعذّر حفظ الكثافة. تمت استعادة الكثافة السابقة." / "تعذّر حفظ الوضع. تمت استعادة الوضع السابق." / "تعذّر تطبيق مجموعة الألوان. حاول مرة أخرى."; the radio and the root attribute are restored and focus returns to the restored radio. Region: `role=status`, `aria-live=polite`. Note: the mode change calls core `switch_theme`, not `set_appearance`; both were routed. | `a2_appearance_ar.mjs`, `a2_appearance_ar.json`, `shots/a2-*.png` |
| 3 | Noto and Tajawal pairings | VERIFIED, ar and en, 16/16 checks: exactly one `ins_fonts_*` link (the selected one), computed `font-family` starts with the private family, `document.fonts` shows `Midad Noto Sans`/`Midad Noto Sans Arabic` and `Midad Tajawal`/`Midad Tajawal Latin` as `loaded`. Original pairing (IBM Plex) restored. Once, in 6 runs, the Tajawal pages still linked Noto; not reproduced in 40 further save-and-fetch sequences (`a3_stale_check.mjs`, 36 sequences with 0 stale) nor in 4 more runs. Cause not found; most likely a concurrent change by another agent on the shared site. NOT VERIFIED. | `a3_fonts.mjs`, `a3_fonts.json`, `shots/a3-*.png` |
| 4 | Environment ribbon | VERIFIED, ar/en x Light/Dark (12/12): one `body > .ins-env-ribbon`, `role="note"`, text "Training" / "تدريب" in the accessibility tree, fixed, 24 px, `--ins-z-ribbon` 1021, colours per mode (light `rgb(87,63,12)` on `rgb(252,246,235)`, dark `rgb(243,221,181)` on `rgb(47,37,18)`). No web restart was needed: `site_config` is read per request. FINDING (from the screenshot, not measured): the fixed ribbon covers the top 24 px of the sidebar header (`shots/a4-ribbon-ar-dark.png`); `body` padding-block-start is 0. For css-engineer. | `a4_ribbon.mjs`, `a4_ribbon.json`, `shots/a4-ribbon-*.png` |
| 4b | Error reference with `"monitor": 1` | VERIFIED for `www/message.html` with a status (core's `/message?id=` cache entry): the footer reference equals the `X-Frappe-Request-Id` header, en and ar. DEFECT FOUND: the core 403 page (`/me` as Guest, `NotPermittedPage`) shows neither a reference nor "Time of error", only the environment word. Cause: `not_permitted_page.py` sets `self.http_status_code = 403` after `super().__init__` and its context has no `http_status_code` or `error_code`, so `web_content._status()` returns 0. `web_content.py` is not in my list; proposed fix: also treat a `www/message.html` context with `indicator_color == "red"` as an error (core sets it for every status over 300, `respond_as_web_page`, and `NotPermittedPage` sets it). The Arabic label on screen is "مرجع", the ADR table says "الرقم المرجعي" (scribe). | `a4b_error_reference.mjs`, `.json`, `shots/a4b-*.png` |
| 4c | `site_config.json` restored | VERIFIED byte-identical (`cmp`), sha256 before and after `7c3e5567...f2e1`; the diff while edited was only `ins_environment` and `monitor`. | `site_config.diff.before-restore.txt`, `site_config.sha.{before,after}.txt`, `site_config.restore.txt` |

## Part B, Phase 4 print shipping

| # | Item | Result | Evidence |
|---|---|---|---|
| 5 | `identity.py`, `ins_identity()`, `jinja` hook | VERIFIED. Six keys, strings. Shape confirmed in `frappe/utils/jinja.py:223-250`: a function path exposes that function (a module path would expose every function). Rendered through `frappe.utils.jinja.render_template` as `printview.py:231-241` does, en and ar. | `render_letterhead.py`, `letterhead_render.json`, `test_identity.log` |
| 6 | `print/ship.py` | VERIFIED: `after_migrate` shipped both records; second migrate left `modified` unchanged; a changed bundle updates an untouched record; `after_install` and the settings `on_update` hook are registered (hook test). | `migrate2.log`, `ship_update_path.log` |
| 7 | Tests | VERIFIED. `test_print_ship.py` 18 tests (ships once; second run no-op; admin edit kept; foreign record kept; deleted record not recreated; missing bundle and missing templates skip; manifest lookup; never default; uninstall removes untouched, keeps changed and linked) and `test_identity.py` 9, all OK. Full `run-tests --app institutional_theme`: 136 integration tests OK, then 140 unit tests OK (`run-tests-final.log`). `unittest` of `midad/tests` (125) and `audits/tests` (15): OK. `ruff check` and `ruff format --check` on `institutional_theme/` and this folder: clean. | `run-tests-final.log`, `test_print_ship.log` |
| 8 | `email_css` enabled | VERIFIED: `ins_email.bundle.scss` exists; `tools/bench/b.sh build --app institutional_theme` lists `ins_email.bundle.css` (1.90 Kb) and `assets.json` has it (`build.log`); `frappe.get_hooks("email_css")` is `['email.bundle.css', 'email_erpnext.bundle.css', 'ins_email.bundle.css']`; Premailer inlined our rules (`email_inline.txt`). | `build.log`, `email_inline.txt` |
| - | End to end print | VERIFIED as HTML (font-face block, `.print-format` family, letter head and footer tables present, en and ar) and as PDF through `frappe.get_print(..., style="Midad", letterhead="Midad", as_pdf=True)`; the page image shows the letter head (company name, placeholder emblem) and a Plex-style face. `pdffonts` lists nothing for the pypdf-merged file, so embedded font names are NOT VERIFIED here (print-web ran `pdffonts` on its own files). Before the family rule was added the PDF fell back to DejaVu. | `print_e2e.py`, `print_e2e.json`, `shots/print-e2e-*.png` |

Web restart and `tools/bench/b.sh migrate` ran after the Python and hook changes: no error.

## Decisions

1. Never set a default: the Letter Head is created with `is_default` 0 under `frappe.flags.in_migrate` (core would otherwise switch it to source "Image" and make the first Letter Head the default, `letter_head.py:38-60`); Print Settings is untouched. The administrator chooses them.
2. An administrator's change is detected by checksum (`ins_print_shipped` global, JSON, one SHA-256 per record). Changed, deleted, or pre-existing records of the name "Midad" are skipped and logged (`frappe.logger("institutional_theme")`), never overwritten or recreated. A record that already holds the shipped content is adopted.
3. Uninstall (`before_uninstall`, step before the globals are cleared): an untouched, unlinked record is deleted; a changed one, or one another document links to (`LinkExistsError`), is kept and logged. `clear_globals` now also removes `ins_print_*`.
4. Letter Head HTML is written with `frappe.db.set_value` after the insert, because HTML Editor fields are sanitised on save (`base_document.py:1307-1347`) and would alter Jinja-bearing markup. A later save in the UI sanitises it and counts as an administrator change.
5. Print Style CSS = header comment + `fonts.print_font_css` + `.print-format { font-family: <print_font_families()["sans"]> }` + the built bundle without its source-map comment (as print-web requested).
6. `ins_identity()`: no settings field was added. `address` is the default company's primary address (empty without ERPNext, company or address) since the settings have none; `institution_name` falls back to the default company; the Arabic name and `system_name` have no fallback (Website Settings `app_name` is "Frappe" on a stock site). The emblem is offered only if public (`/files/...`), percent-encoded.
7. The settings save calls ship too (the font block follows the pairing); it runs in the save transaction inside a guard.

## Selectors and hooks depended on (16.32.0)

`utils/jinja.py:223-250` (jinja hook); `www/printview.py:231-241, 421-442, 592-609` (Letter Head render, `get_letter_head`, Print Style append); `printing/doctype/letter_head/letter_head.py:38-60` (`before_insert`, `validate_disabled_and_default`), `:43` `on_trash`; `printing/doctype/print_style/print_style.py:24-35`; `model/base_document.py:1307-1347`; `model/delete_doc.py:172, 376` (link check); `email/email_body.py:477` (`email_css`); `model/meta.py:199-218`, `desk/form/meta.py:80`, `public/js/frappe/form/form.js:1214-1220` (masking); `website/page_renderers/not_permitted_page.py` and `website/serve.py:31` (403 page); `www/message.py` (`?id=` message).

## Strings

No new `_()` or `__()` source string. Print Style and Letter Head are named "Midad" (a product name).

## Manifest rows

Hooks: `jinja.methods`, `after_install`, `doc_events["Institutional Theme Settings"].on_update` (two handlers), `email_css`. Records: Print Style "Midad", Letter Head "Midad". Global: `ins_print_shipped`. Core behaviours relied on: Letter Head `before_insert` and default rule, HTML Editor sanitising, `LinkExistsError` on delete. UNVERIFIED: whether `bench update` builds before it migrates (if it migrates first, the shipped CSS is one migrate behind until the next migrate or settings save); real `bench uninstall-app` (only the unit tests of `ship.remove()` ran; I did not run the gate script).

## Open points for the lead

- `ruff check .` (CI) fails on print-web's `docs/team/evidence/round2/print-web/*.py` (cleanup, email_render, preview_render, preview_setup). Not mine.
- `tools/bench/gate_state.py` `residue()` does not check Print Style "Midad", Letter Head "Midad" or the `ins_print_%` globals; add them so the gate proves "no orphan".
- The 403 defect in `web_content.py` and the ribbon/sidebar overlap above.
- The first full-suite run had one settings test fail (`test_restore_gives_back_prior_values...`, `original = 'Changed by an administrator'`): Website Settings `app_name` had been left in that state before the run. Later runs passed. The settings tests leave that value behind when a run is interrupted.
- The test bench's `test_print_ship.py` deletes the real "Midad" records in `setUp` and `tearDown`; run `tools/bench/b.sh migrate` after it to ship them again (done).
