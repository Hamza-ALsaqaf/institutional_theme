# Upgrade review, Phase 1 architecture (ADR 0002 to 0005)

Reviewer: upgrade reviewer, 2026-10-13. Frappe paths are relative to `frappe/` in the `v16.32.0` clone, and every Frappe line cited was opened. "Proposal" lines refer to `docs/team/discussion/01-architecture.md`.

## Confirmed

- `/desk` is never page-cached (`www/desk.py:5, 47`; `website/utils.py:547`).
- The hook runs after `get_context` and before the render (`template_page.py:95, 99, 101`; `base_template_page.py:69-75`). Guests are redirected before the hook runs (`__init__.py:1314-1319`).
- `include_style` adds the `rtl_` prefix only to names containing `.bundle.`; a `/files/...` path passes through unchanged (`jinja_globals.py:151-157`).
- `extend_bootinfo` runs after the bootinfo cache has been written (`sessions.py:147, 169`).
- No core job deletes files that have no File row. The bench nginx template serves `/files` (`bench/config/templates/nginx.conf:89`).

## Findings

**1. BLOCKING. The Website Settings write-through fails for a System Manager.** Proposal :105-108.
- Only Website Manager may write Website Settings (`website_settings.json`, permissions). A System Manager without that role gets `PermissionError`, and the whole settings save rolls back.
- Even with the role, `save()` runs validators unrelated to identity. `validate_google_settings` and `validate_redirects` can throw (`website_settings.py:127-139`), and `validate_home_page` silently blanks `home_page` (`:76-85`).

*Fix:* after this app's own permission check, write only the changed keys with `frappe.db.set_single_value("Website Settings", {...})`, then clear the cache as `on_update` does (`:141-154`). Navbar Settings is System Manager-writable and has no `validate`, so `save()` is fine there.

**2. BLOCKING. Lazy regeneration in the render path can take down the desk.** Proposal :73, 79.
- The hook loop has no exception guard (`base_template_page.py:72-75`). One `OSError` returns HTTP 500 on `/desk` for every user.
- Concurrent plain writes from several workers can leave a half-written file under a content-hash name, which nginx serves and browsers may cache.
- `frappe.log_error` inside a GET is never committed (`app.py:428`).

*Fix:* wrap the hook in `try/except`; on failure, link nothing, so the user sees `midad`. Write to a temporary file and `os.replace` it into place. Log with `defer_insert=True`.

**3. ADVISORY. The hash name no longer matches the content after a degraded rebuild.** Proposal :72-73, 79. After a restore without files, the lazy path leaves out the missing faces but writes under the stored full-content hash, because it may not write to the database.
*Fix:* derive the name from the actual content at link time, cached on the settings `modified` value and on which uploads exist. Drop the stored name fields.

**4. ADVISORY. Detecting the desk by `app_include_css` is weak.** Proposal :39. The context is seeded from `site_config.website_context` (`base_template_page.py:16`), and pages of other apps were not checked.
*Fix:* also require `context.template == "www/desk.html"` (`template_page.py:185`). Add a test that fetches `/desk` and asserts the palette link is in `<head>`, so a 16.x change to `desk.py` fails CI instead of silently dropping the palette.

**5. ADVISORY. An in-place append to `web_include_css` leaks across requests.** This is the hooks list cached by each worker (`website_settings.py:231`; `__init__.py:1006-1009`; `utils/redis_wrapper.py:524-527`). Appending the login font link to it in place adds the link again on every request that worker serves.
*Fix:* always return a new list.

**6. ADVISORY. Cached website pages keep stale font links.** Non-login pages are cached for 30 minutes (`website/utils.py:529-551`). After two saves inside that window, the "keep one previous file" rule produces a 404 for the old link.
*Fix:* call `frappe.website.utils.clear_cache()` on save.

**7. ADVISORY. The cascade is independent of file order only if key-set parity holds.** Palette dark and automatic, at (0,3,1), re-declare every key that palette light sets, so the (0,2,1) tie with base dark never decides a value. The css-engineer is right. Two gaps remain:
- The custom preset is generated at runtime, and the audit never sees it.
- If a palette omits a base colour key, the `midad` value shows through.

*Minimal fix:* emit every block from one key list, the base colour keys, and add a unit test asserting the sets are equal. Add a CI test that loads the palette before `ins_desk` and gets identical computed values. Selectors stay as proposed.

**8. ADVISORY. The core-variable mapping has no stated specificity.** The table at :45-48 covers `--ins-*` only. A mapping on `html:root` (0,1,1) loses by load order to a later-installed brand app at (0,1,1) (`www/desk.py:39`; findings section 8).
*Fix:* use the palette shapes, (0,2,1) and (0,3,1).

**9. ADVISORY. A missing palette bundle produces a broken link.** A key absent from the manifest is emitted as-is (`jinja_globals.py:153-155`). This happens, for example, when a later release drops a palette that is still stored for users.
*Fix:* check `get_assets_json()` for the key and its `rtl_` twin before linking.

**10. ADVISORY. Uninstall leaves the identity behind**, against BRIEF section 6.1.
- Website Settings and Navbar Settings keep the emblem, name and favicon.
- `attach_files_to_document` adds File rows for this app's Single and for Website Settings (`core/doctype/file/utils.py:362-371`).

*Fix:* save the prior values with `frappe.db.set_global` at the first write-through, and restore them on uninstall if they are unchanged. Delete the File rows attached to this app's settings; the files stay on disk because their `content_hash` is shared (`file.py:605-620`).

**11. ADVISORY. The `sysdefaults` handling is sound.** With the `ins_` prefix and client code that reads only `frappe.boot.ins`, nothing leaks (`defaults.py:105-118`; `create_new.js:167`). Writing a default clears only that user's caches (`defaults.py:175-176, 270-273`).

## Could not verify

- ERPNext 16.33.0 and HRMS 16.20.1 `www` pages (their source is absent).
- Browser first paint (not run).
- The nginx template version on the owner's bench.
- Which app hooks run during `_new_site(source_sql=…)`.
- `has_value_changed` on a Single that has never been saved.
