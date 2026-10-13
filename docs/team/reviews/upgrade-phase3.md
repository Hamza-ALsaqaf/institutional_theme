# Upgrade review, Phase 3 and Phase 2 fix round (bd42d23..HEAD)

Checked against the Frappe 16.32.0 source (VERIFIED, opened): `update_website_context` is called with the context, and a non-empty return is passed to `context.update` (`website/page_renderers/base_template_page.py:69-75`). `extend_bootinfo(bootinfo=…)` is called at `sessions.py:169-170`. `before_uninstall` takes no arguments (`installer.py:445-446`). `after_migrate` runs per app (`migrate.py:202`). `include_style`/`bundled_asset` pass `/files/` URLs through (`utils/jinja_globals.py:132-144`). `banner_html`, `body_include` and `body_class` are read in `templates/base.html:57-62,115`. `log_error(..., defer_insert=)` is at `utils/error.py:44-98`. `clear_cache` is at `website/utils.py:381`, `get_assets_json` at `utils/__init__.py:950`, and `get_defaults_for` at `defaults.py:235`. The desk is `no_cache` (`www/desk.py:5`). Built CSS has 0 `!important` (VERIFIED, all 8 bundles). No rule sets `height` or `line-height` on `.dt-*` (VERIFIED, compiled `ins_desk`). The gate residue is "none" and the post-uninstall login screenshot is pixel-identical to the one taken before install (evidence files read, not re-run).

Previous findings: U1, U2, U3, U7 and U9 are fixed in code. U8 is fixed, and the gate residue log confirms it. U4: there are scoped blocks (`_scoped_variables.scss:10-27`), and the fixture now probes inside `.modal`, the chart and the editable row (`cascade.mjs:227-230`). U5: the comments are corrected (`_base.scss:10-16`). U6: there is a fixture and a `.btn-primary` rule at (0,4,1) (`_actions.scss:33-37`, `harness/second_app.css`).

## Findings

**1. ADVISORY: the error handlers can raise, and one desk failure logs on every load.** `boot.py:38` and `site_files.py:301` insert the Error Log synchronously. `website.py:50` and `web_content.py:166` defer it through Redis (`utils/error.py:95-98`). On Postgres, an aborted transaction makes that insert raise inside the `except`. The exception then leaves `extend_bootinfo` and the boot fails, which defeats the guard. A persistent fault also writes one Error Log row per desk load. Fix: put each `log_error` call in its own `try/except Exception: pass`. Use `defer_insert=True` in `boot.py`. Log once per worker and process (a module flag).

**2. ADVISORY: the file regeneration and the cache clear run before commit.** `on_settings_update` (`site_files.py:292-301`) runs in `on_update`, inside the transaction. `website.utils.clear_cache()` fires before the commit, so a concurrent web request can re-cache the page with the old link. If the save then rolls back, a file has been written for a state that was never saved. Fix: `frappe.db.after_commit.add(lambda: (ensure(doc), clear_cache()))` (`database/database.py:130,1194`).

**3. ADVISORY: orphan temporary files are never pruned.** `_write_atomic` (`site_files.py:139-148`) removes the `.tmp` file in `finally`. A killed worker skips that cleanup. `prune` matches only `*.css` (`:227`). Uninstall's `rmtree` covers this; a running site does not. Fix: in `prune`, also delete `<prefix>.*.tmp` files older than 60 s.

**4. ADVISORY: the HTML-cached web pages keep `/files/` links.** `www/404.py` has no `no_cache`, and the template page is wrapped in `cache_html` (`template_page.py:88`). After a restore without files, a cached page links `ins_palette_custom.<h>.css`. That file only comes back when an uncached render calls `ensure()`. Until then, those pages show stock colours (they do not break). Fix: call `site_files.ensure()` from `before_request`, guarded and memoised. Alternatively, document running `bench clear-website-cache` after a restore.

**5. ADVISORY: the link order is shared with other apps.** `website.py:43,48` appends to the list it receives, so the hooks of apps that ran earlier are kept (correct). An app that runs later and returns a fresh `web_include_css`/`app_include_css` built from `get_hooks` drops the palette and font links silently. Fix: add a note to `docs/DEPENDENCY_MANIFEST.md`, and assert in `cascade.mjs`/the curl evidence that the palette link is the last stylesheet.

No BLOCKING findings.

## Not verified

- Whether Frappe's Postgres layer uses a savepoint around `get_cached_doc` failures (this decides how real finding 1 is).
- Whether `bench restore` clears the Redis page cache (finding 4).
- The 3-pixel difference after uninstall on `/todo` (max delta 2, near x=974). I take it to be antialiasing and did not inspect it.
- The JS shell (`actions.js` MutationObserver) is not in this diff and was not reviewed.
- `run-tests` and the gate were read from logs, not re-run. wkhtmltopdf handling of the print faces is still unverified.
