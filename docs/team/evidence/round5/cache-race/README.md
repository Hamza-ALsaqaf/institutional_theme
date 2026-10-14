# Round 5, item 1: the cache race (backend-engineer)

Evidence labels: VERIFIED (run, output in `logs/`), COMPUTED (derived from source), ASSUMED.

## 1. Diagnosis

The lead's diagnosis was: the app clears its caches before the transaction commits, a concurrent request refills
a cache with the old committed rows, and the value outlives the commit. **Confirmed for the defaults cache
(both flaky tests' mechanism for the first one), confirmed with a wider cause for the settings document cache.**

### Frappe 16.32.0 behaviour (read from source; the same lines in v16.52.0, see section 4)

| Fact | Where |
|---|---|
| `set_default` (behind `frappe.db.set_global` and `set_user_default`) clears the defaults cache **once, immediately**, through `_clear_cache` and `clear_defaults_cache`. No `after_commit`. | `frappe/defaults.py:149-176`, `:270` |
| `clear_default` does the same: one immediate clear. | `frappe/defaults.py:194-232` |
| `get_defaults_for` reads `frappe.client_cache` (in-process copy of a Redis key); on a miss it reads the table in the **caller's own snapshot** and stores the result for everybody. | `frappe/defaults.py:235-265` |
| `frappe.db.get_global` / `get_default` read through `get_defaults_for`. | `frappe/database/database.py:1136-1165` |
| `Document.clear_cache` (`clear_document_cache`) **does** clear again after commit and after rollback. So the document cache is covered for a refill *before* the commit. | `frappe/model/document.py:2320-2335` |
| `get_cached_doc` fills the cache with whatever its own snapshot reads, TTL 3600 s. | `frappe/model/document.py:2278-2296` |
| PostgreSQL connections use **REPEATABLE READ**: a request keeps the snapshot of its first query until it ends. | `frappe/database/postgres/database.py:196` |
| `commit()` runs `after_commit` callbacks in the order they were added, and an exception in one stops the ones behind it. | `frappe/database/database.py:1176-1194`, `frappe/utils/__init__.py:1103-1143` (`CallbackManager`) |
| `frappe.cache.get_value` also keeps a per-process copy in `frappe.local.cache`; `delete_value` pops it. | `frappe/utils/redis_wrapper.py:64-98`, `:136-150` |
| `frappe.db.get_single_value` caches only in `frappe.db.value_cache` (per connection, cleared on commit and by `clear_document_cache`), not in Redis. | `frappe/database/database.py:878-926` |
| The boot payload is cached per user (`bootinfo` hash) **before** `extend_bootinfo` hooks run, so `frappe.boot.ins` is built per request and is not stored in that cache. | `frappe/sessions.py:139-147`, `:169-171` |

### The two mechanisms

1. **Defaults cache (flake 1: global `ins_identity_prior` read back as `None`, `test_institutional_theme_settings.py:411`).**
   `identity_sync._store` writes the global; core clears `defaults::__global` at once; a request served in the
   window reads the old rows and refills the key; the test's own read (`frappe.db.get_global`) and the app's own
   next `_load` read that refill, not their own uncommitted row. Nothing clears the key at commit. VERIFIED by a
   deterministic test that reproduces the exact failure text of round 4
   (`TypeError: the JSON object must be str, bytes or bytearray, not NoneType`) on the unfixed code:
   `logs/new-tests-without-fix-16.32.0.log`, `test_the_identity_record_is_not_cached_old_after_the_commit`.
   This is also a correctness bug of the app, not only of the test: `apply()` is a read-modify-write of
   `ins_identity_prior`; with a stale read it would record the already-written value as the "prior" one.
2. **Settings document cache (flake 2: `test_website_pages_get_the_site_default_in_a_new_list`, result `None`).**
   Core does clear this cache again after the commit, so a refill *before* the commit is not the cause. The cause is
   REPEATABLE READ: a request that began before the commit still sees the old Singles rows after it, and
   `get_cached_doc` puts the old document back **after** core's after-commit clear. Probe with two threads, two
   connections, real `frappe.get_cached_doc` (VERIFIED, `snapshot_probe.py`, `logs/snapshot_probe-16.32.0.log`):
   `isolation = 'repeatable read'`, the reader read `Comfortable` before the commit, the writer saved `Compact`
   and committed (cache empty right after the commit), then the reader's `get_cached_doc` returned
   `Comfortable` and left it in the cache; the database says `Compact`.
   The page test then sees `default_palette = midad` instead of `petrol`, so the hook returns `None`.
   That the flaky run really was this exact interleaving is **not verified** (it was not reproduced in the
   loaded runs below, see section 5); the mechanism itself is verified and the tests below pin it.

The lead's wording "the app clears before the commit" is therefore right for globals and user defaults, and for
the settings document the app needed a second line of defence, because core's own clear-after-commit cannot
close a snapshot race.

## 2. Cache inventory (app code, 16.32.0 tree; file:line is the code after the fix)

| # | Cache or cached read | Written / read at | Stale-refill risk before | Now |
|---|---|---|---|---|
| 1 | Settings document, `frappe.get_cached_doc` (Redis `document_cache::...`, + `frappe.local.cache`) | read: `site_files.get_settings` (`site_files.py:54`), `identity._settings` (`identity.py:53`), `web_content._get_settings` (`web_content.py:34`); cleared by core on save (`Document.clear_cache`) | core clears after commit, but a snapshot-older request refills after that (probe) | all three go through `cache_guard.settings_doc` (`cache_guard.py:133`): the cached copy is compared with the table's `modified`; a stale copy is dropped and re-read. `site_files._regenerate` also drops it first, before the website caches (`site_files.py:337`) |
| 2 | Defaults cache `defaults::<parent>` (`client_cache`), globals | write: `identity_sync._store` (`identity_sync.py:82`), `ship._store` (`print/ship.py:218,220`), `identity_sync.restore` (`:248`), `delete_attachments` (`:298`), `ship.remove` (`print/ship.py:395`); read: `identity_sync._load` (`:71`), `ship._load` (`print/ship.py:206`) | cleared once, before commit (`defaults.py:176`, `:222`): refilled old, outlives the commit (flake 1) | writes go through `cache_guard.set_global`/`clear_global` (clear now and again after commit and rollback); the app's own reads use `cache_guard.get_global`, a table read |
| 3 | Defaults cache of the user (`defaults::<user>`) and the user's cache hashes (`bootinfo`, `defaults`, ...) | write: `api.set_appearance` (`api.py:35,37`); read: `preferences.stored` (`preferences.py:70`) | same as 2: a stale `defaults::<user>` keeps the old palette or density in boot and in `www/desk` | write through `cache_guard.set_user_default` (`cache_guard.py:120`): defaults cache dropped again after the transaction, and `frappe.clear_cache(user=...)` again; read is a table read (`cache_guard.user_defaults`, `:104`) |
| 4 | Defaults cache cleared by uninstall helpers | `install.clear_globals` (`install.py:41`), `install.clear_user_defaults` (`install.py:49`) delete rows with `frappe.db.delete` and relied on a later full clear | rows gone, cache still holds them | `cache_guard.forget_defaults` now and after the transaction |
| 5 | Whole-site cache clear on uninstall | `install.before_uninstall` (`install.py:114`) | refilled before commit | repeated after the transaction (`install.py:115`) |
| 6 | Website caches (page cache `website_page::*`, routes, Guest caches, full `frappe.clear_cache()`) written after an identity change | `identity_sync.clear_website_caches` (`identity_sync.py:131-153`), `site_files._regenerate` (`site_files.py:333-341`, already after commit since round 3) | the identity path cleared only before commit | identity path repeats the clear after commit and rollback (guarded, never raises); `_regenerate` drops the settings document first |
| 7 | Boot payload | `boot.build` (`boot.py:20`) reads items 1 and 3 per request; nothing of the app is stored in the core `bootinfo` cache (`sessions.py:139-171`) | inherits 1 and 3 | inherits the fixes |
| 8 | Website context inputs | `website.update_website_context` (`website.py`), `web_content.update_website_context` read items 1 and 3 and `get_assets_json` (core's cache, read only) | inherits 1 and 3 | inherits the fixes; residual risk below |
| 9 | Process-local memos | `site_files._memo` (`site_files.py:42`, keyed by site, settings state and font files present, validated by `_files_exist`), `functools.lru_cache` on `site_files._custom_css` (pure in its two inputs), `functools.cache` on `preferences._swatch` and `midad.model.load_model` (pure) | none: keyed by their inputs | unchanged |
| 10 | `frappe.db.get_single_value` in `identity_sync.apply` / `restore` / `_owned_copies` | `identity_sync.py:174,232,263` | per-connection `value_cache`, cleared on commit, never shared | unchanged |
| 11 | Not used by the app | `frappe.get_cached_value`, `frappe.cache.set_value` directly, `frappe.client_cache` directly, `frappe.clear_cache` outside the paths above | n/a | n/a (grep of `institutional_theme/`, see commit) |

Residual risk (COMPUTED, not fixable without core): a website page rendered by a request whose snapshot is older
than the commit is stored in the page cache with the old stylesheet links until the next website cache clear.
Core has the same property for every page it caches. The old palette file is kept by `site_files.prune`, so the
page is old, not broken.

## 3. The fix (`institutional_theme/cache_guard.py`)

- `after_transaction(cb)`: `frappe.db.after_commit.add(cb)` and `after_rollback.add(cb)`. The callbacks never raise.
  The immediate clear stays in place; the clear after commit is added.
- Writers: `set_global`, `clear_global`, `set_user_default`, `forget_defaults`.
- Readers that never trust a shared cache for a value the app writes: `get_global`, `user_defaults` (table reads) and
  `settings_doc` (cached document validated by `modified`; one primary-key read per request, remembered in
  `frappe.db.value_cache`).
- API verified in both versions: `frappe.db.after_commit`/`after_rollback` at `database/database.py:130,132` and
  `:1183-1215` are line for line the same in 16.32.0 and v16.52.0; `defaults.py`, `redis_wrapper.py`,
  `clear_document_cache` and `get_cached_doc` are identical (`diff` of the two trees, section 4).
- No core edit, no monkey patch, no change to the User doctype, no whitelisted override.

## 4. Tests (`institutional_theme/tests/test_cache_race.py`, 12 tests)

Each plants the old value in the cache exactly as the concurrent request would, commits, and reads back through the
normal cached path. No threads, no timing.

| Test | Mechanism pinned |
|---|---|
| `test_the_identity_record_is_read_back_after_a_refill_with_the_old_rows` | flake 1, read-modify-write inside the save |
| `test_the_identity_record_is_not_cached_old_after_the_commit` | flake 1, the exact round-4 traceback |
| `test_a_print_record_that_is_cleared_stays_cleared_after_the_commit`, `test_the_print_record_is_read_back_after_a_refill_with_the_old_rows` | print shipping state |
| `test_a_palette_saved_through_the_api_is_not_cached_old_after_the_commit`, `test_a_palette_choice_is_read_from_the_table_not_from_the_defaults_cache` | user choice, boot cache |
| `test_uninstalling_the_globals_...`, `test_uninstalling_the_user_choices_...` | uninstall helpers |
| `test_the_settings_document_is_fresh_after_a_late_refill_with_the_old_one`, `test_website_pages_get_the_new_default_after_a_late_refill_with_the_old_settings` | flake 2 |
| `test_the_settings_document_is_dropped_before_the_website_caches_are_cleared` | order in `_regenerate` |
| `test_the_website_caches_are_cleared_again_after_the_identity_write` | identity website caches |

- With the fix: `logs/new-tests-with-fix-1.log`: 12 of 12 pass (VERIFIED, 16.32.0).
- Without the fix (the eight app source files stashed, tests kept; `fail_without_fix.sh`, one lock for stash, run
  and restore): `logs/new-tests-without-fix-16.32.0.log`: **12 of 12 fail** (VERIFIED, 16.32.0).
- Test-side fragility: the existing tests that read a global or a user default back through core's cache
  (`frappe.db.get_global`, `get_defaults_for`) or the cached settings document now read the table through the
  same `cache_guard` functions the app uses (`test_institutional_theme_settings.py`, `test_print_ship.py`,
  `test_api.py`, `test_preferences.py`, `test_site_files.py`). Every assertion keeps its expected value.
- Full suite, unloaded, with the fix: `logs/full-unloaded-with-fix-16.32.0.log`: 160 integration tests (148 + 12) OK,
  322 unit tests OK.

## 6. Proposed wording for the lead (checklist and manifest; I did not edit those files)

`docs/UPGRADE_AND_QA_CHECKLIST.md`, upgrade checks (every Frappe upgrade, both versions):

- Core cache APIs this app relies on are unchanged: `frappe.db.after_commit` and `after_rollback`
  (`frappe/database/database.py`, `CallbackManager` in `frappe/utils/__init__.py`), `frappe.cache_manager.clear_defaults_cache`,
  `frappe.clear_document_cache`, `frappe.get_cached_doc`, `frappe.defaults.get_defaults_for`. Re-run
  `institutional_theme.tests.test_cache_race` (12 tests): a failure means core changed how or when it clears these caches.
- The database isolation level is still REPEATABLE READ on PostgreSQL (`frappe/database/postgres/database.py`, search
  `ISOLATION_LEVEL`). If it changes to READ COMMITTED the late-refill tests in `test_cache_race.py` still pass; the
  `modified` check in `cache_guard.settings_doc` is then only a belt.
- The suite must pass while the site is under request load (`docs/team/evidence/round5/cache-race/loaded_run.sh`).

`docs/DEPENDENCY_MANIFEST.md`, "Core behaviour this app depends on":

| Item | Location | Status |
|---|---|---|
| `set_default` / `clear_default` clear the defaults cache once, before the commit | `frappe/defaults.py:149-176`, `:194-232` (both versions) | VERIFIED by reading and by `test_cache_race`; the app clears again with `frappe.db.after_commit` / `after_rollback` and reads its own values from the table |
| `Document.clear_cache` clears the document cache again after commit and rollback | `frappe/model/document.py:2320-2335` (16.32.0), `:2323-2335` (v16.52.0) | VERIFIED by reading |
| PostgreSQL REPEATABLE READ lets a request that began before a commit refill the document cache with the old document after core's clear | `frappe/database/postgres/database.py:196`; probe `docs/team/evidence/round5/cache-race/snapshot_probe.py` | VERIFIED on 16.32.0 (`logs/snapshot_probe-16.32.0.log`) |
