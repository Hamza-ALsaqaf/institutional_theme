# Round 6, item 2: targeted cache clears on identity save (backend-engineer)

Evidence labels: VERIFIED (run, output in `logs/` or a command shown), COMPUTED (derived from source), ASSUMED.
Benches: 16.32.0 = `midad.test` (port 8000, `tools/bench/b.sh`), v16.52.0 = `midad52.test` (port 8001, `tools/bench/b52.sh`).
Code commit of the change: see "Commits" at the end.

## Decision

**TARGETED clears are kept** (the acceptance condition holds: all 12 race tests, every identity test and the loaded and
unloaded full runs are green on both versions). Two facts the lead should know before reading it as a large win:

1. **The identity save still triggers whole-site cache clears inside the save, from core, not from this app.** The three
   bookkeeping globals (`ins_identity_prior`, `ins_identity_written`, `ins_identity_files`) are written with
   `frappe.db.set_global`; core's `set_default` -> `add_default` -> `_clear_cache('__global')` then calls
   `frappe.clear_cache()` with no argument, which is the whole site cache (`frappe/defaults.py:171,191,232,272-273`,
   identical in v16.52.0; VERIFIED by a spy, section 1). Removing those would mean writing the `DefaultValue` rows
   without core's API, which the role rules forbid ("record what was shipped with `frappe.db.set_global`"). I did not
   do it.
2. **What the change removes** is the clearing that the app itself added: the whole-site clear at the end of the save
   (round 5, `identity_sync._clear_website_caches`), the whole-site clear again **after the commit** (the one decision 82 is
   about, made while requests are in flight), and the extra `clear_routing_cache()` calls of `frappe.website.utils.clear_cache()`
   (the call that reaches core's `redis_cache` race, `utils/caching.py:191-198`). Measured with a spy on `frappe.clear_cache` and
   `clear_routing_cache`, one identity save plus its commit (`count_clears.py`, `logs/count_clears-*.log`, VERIFIED on both):

   | | whole-site `frappe.clear_cache()` | `clear_routing_cache()` | per-user clears |
   |---|---|---|---|
   | round 5, in the save | 4 | 7 | 2 |
   | round 5, at the commit | **1** | 6 | 3 |
   | round 6, in the save | 3 (all from core's `set_default`) | 3 | 0 |
   | round 6, at the commit | **0** | 2 | 1 |

   The 2 routing clears left at the commit come from `site_files._regenerate` (`frappe.website.utils.clear_cache()` after every
   settings save, round 3), not from the identity path.

## 1. What is cleared now (`identity_sync.py`, `_clear_website_caches`, now and again after the commit or rollback)

Derived from what `identity_sync.apply` writes (Website Settings `app_name`, `app_logo`, `splash_image`, `favicon` with
`frappe.db.set_single_value`; Navbar Settings `app_logo` with `save()`; the three globals, which `cache_guard` already handles)
and from where core reads those values. Source lines are in `docs/DEPENDENCY_MANIFEST.md` section 6, rows R8 to R11, for
16.32.0 and v16.52.0. The set of core files that read Website Settings, Navbar Settings or `get_app_logo` is identical in both
trees (`diff` of the two `grep -rl` lists, COMPUTED).

| Cleared | Why (reader) | Source 16.32.0 / v16.52.0 |
|---|---|---|
| `document_cache::Website Settings::Website Settings`: Redis key, `frappe.local.cache`, `frappe.db.value_cache`, the in-process copy of `frappe.client_cache`, `frappe.local.website_settings` | `frappe.get_website_settings` (desk title `www/desk.py`, login page, e-mail brand, website context) | `__init__.py:1519-1527` / `:1522-1530`; `www/desk.py:60-62` / `:90-92`; `model/document.py:2320-2341` / `:2323-2344`; `utils/redis_wrapper.py:572-592` (both) |
| the same for `Navbar Settings` | `get_app_logo` (`navbar_settings.py:26-39` / `:28-41`), `bootinfo["navbar_settings"]` (`sessions.py:184` / `:185`) | as above |
| `bootinfo` hash of every user (`frappe.cache.delete_value("bootinfo")`) | it holds `app_logo_url` (`boot.py:118` / `:121`), cached per user (`sessions.py:139,147` / `:140,148`); core deletes it the same way (`cache_manager.py:49,93` / `:59,104`) | |
| `website_page::*` (`website.utils.delete_page_cache()`) | rendered pages hold favicon and splash (`templates/base.html:15-18`, `includes/splash_screen.html:2`) | `website/utils.py:34-38`, `:526-555` / `:528-557` |

**Not cleared** (none of them reads a value the write-through writes, COMPUTED from the source above): routes and routing caches
(`website.utils.clear_cache`, `clear_routing_cache`), doctype and meta caches, permissions, user caches, the `metadata_version` of the
desk. A step that fails is logged once (`guard_log`) and does not stop the others; the clear never raises. The semantics of round 5 are
kept: the clear runs now, and again through `cache_guard.after_transaction` after a commit and after a rollback. Unchanged: the
`defaults::__global` cache (`cache_guard.forget_defaults`) and the user caches of `cache_guard.set_user_default`.

Limit (COMPUTED): a third-party app that caches the app name or logo under a key of its own was covered by the whole-site clear
and is not covered now. None exists in Frappe, ERPNext or HRMS (no `clear_cache` or `website_clear_cache` hook in `frappe/hooks.py`
or `erpnext/hooks.py` of the benches; HRMS not checked).

## 2. Tests (`institutional_theme/tests/test_identity_caches.py`, 11 tests, live site)

- Website page: a Web Page is rendered through core's renderer with the page cache on, the favicon is written through, the page shows the new
  favicon. The write goes through `identity_sync.apply` directly, because a settings save also makes `site_files` clear the website caches
  after the commit, which would hide the effect.
- Boot payload: `frappe.sessions.get()` is served from the cached payload, then shows the new `app_logo_url` and `navbar_settings.app_logo`
  after a settings save and a commit.
- `frappe.get_website_settings`, `frappe.client_cache.get_doc`, `get_cached_value`, `get_app_logo` and the `www/desk.py` title are fresh at once.
- A refill with the old values between the write and the commit (boot hash, page, both in-process documents) does not survive the commit.
- The caches are cleared again after a rollback.
- Nothing wide is cleared: routes, meta, `metadata_version` and a sentinel key survive; `frappe.clear_cache`, `website.utils.clear_cache`,
  `clear_routing_cache`, `clear_doctype_cache` are never called by the identity clear; no whole-site clear happens when the save commits.
- A failing step is logged and the others still run; the callback is queued once.

Test isolation (root cause of two failures I found, not "flaky"): the first version of these tests read a core document back after a commit
through the shared Redis. Under the request load of `load.py`, a request that began before the commit read the old rows afterwards and refilled
the shared cache with the old document (PostgreSQL REPEATABLE READ; the same mechanism as round 5, section 1, for a core document the app cannot
guard), and the tests failed (two failures in the first loaded run, in `test_every_reader...` and `test_the_desk_boot_payload...`, with the premise
or the logo of the previous test read back). The tests now give each test a private Redis key prefix (`use_private_cache_namespace`:
`frappe.local.conf["db_name"]` is what `RedisWrapper.make_key` prefixes keys with, `utils/redis_wrapper.py:55-59`); the database is the real
one. After that, 10 loaded runs of the module in a row passed (`/tmp` logs summarised below) and the four full runs are green.
Negative control: the same tests against `identity_sync.py` of round 5 (`negative_control.sh`, `logs/negative_control-16.32.0.log`):
**6 of 11 fail** (the ones that pin the targeted behaviour: no whole-site clear at the commit, routes and `metadata_version` untouched, the
new API); the freshness tests pass on the old code too, as expected, because a whole-site clear is a superset.

## 3. Results

Full `run-tests --app institutional_theme` (177 integration tests = 166 + 11 new, then 322 unit tests; commit 813811d):

| Run | Version | Integration | Unit | Exit | Log |
|---|---|---|---|---|---|
| loaded (`loaded_run.sh`, `load.py`, 1344 requests, 200: 1107, 404: 234, 500: 3) | 16.32.0 | 177 OK (184.3 s) | 322 OK | 0 | `logs/run-16.32.0-1.log`, `logs/load-16.32.0-1.log(.summary,.errors)` |
| unloaded | 16.32.0 | 177 OK (139.4 s) | 322 OK | 0 | `logs/unloaded-16.32.0-1.log` |
| loaded (1837 requests, 200: 1481, 404: 350, 500: 6) | v16.52.0 | 177 OK (233.7 s) | 322 OK | 0 | `logs/run-v16.52.0-1.log`, `logs/load-v16.52.0-1.log(.summary,.errors)` |
| unloaded | v16.52.0 | 177 OK (186.2 s) | 322 OK | 0 | `logs/unloaded-v16.52.0-1.log` |

Per module in each of the four logs (counted from the ticks): `test_cache_race` 12 of 12, `test_cache_guard` 6 of 6, `test_identity` 9 of 9,
`TestInstitutionalThemeSettings` (the identity write-through tests among them) 49 of 49, `test_identity_caches` 11 of 11. Nothing skipped,
disabled or loosened; no existing test was edited. The 500 responses in the load logs are core's (round 5, section 5, "The 500 pages"); none of
them is a test failure (the runs exit 0).
10 loaded runs of the new module on 16.32.0 (the load of `load.py` on port 8000, 9940 requests) all passed after the isolation fix; their logs are in
`/tmp` and not kept; the pass/fail line of each run is `logs/module-loaded-loop-16.32.0.out`, the load summary `logs/module-loaded-loop-16.32.0.load.summary`. The full loaded runs above are the main evidence.

## 4. Live check across two processes (`live_http_check.py`)

The script logs in over HTTP, reads the desk page of the running web server, saves an identity in its own process through the settings
document (the same code path as the form), reads the web server again, clears the identity and reads a third time.

- v16.52.0 and 16.32.0, **web server not under load**: PASS, the web server shows the new title, the new `app_logo_url`, the new
  Navbar Settings logo and the login page within 1 s (core's invalidation message is not instant, `redis_wrapper.py` class doc); and shows the
  old values again within 1.5 s after the clear. `logs/live_http_check-16.32.0.log` (first run, before the settle loop existed), `logs/live_http_check-v16.52.0.log`
  (this one is the FAIL of the targeted code described below, not a PASS), and the control with the round-5 clear `logs/live_http_check-v16.52.0-round5-control.log` (PASS, same timings).
  Re-runs: 3 + 2 PASS with the targeted clear, 2 PASS with the round-5 control (not kept as files, printed in this session).
- **Web server under request load (VERIFIED, and NOT caused by this change):** with `load.py` running against the web server, the check **fails for
  both the targeted clear and the round-5 clear**: 8 of 8 runs, the web server kept the old desk title or the old Navbar Settings logo for more than 10 s
  (`logs/live_http_check-v16.52.0-under-load.out`; one run polled for 240 s: the title and `app_logo_url` became fresh, the Navbar Settings
  logo in `bootinfo["navbar_settings"]` was still old at 240 s, `logs/live_http_check-v16.52.0-under-load-240s.log`). Cause (COMPUTED from source plus the observation, not
  separately probed): a desk request that began before the commit reads the old rows after it (REPEATABLE READ), finds the key just
  deleted, and `ClientCache.get_doc` stores that old document in Redis without an expiry (`redis_wrapper.py:559-570`, `:572-581`). The same
  mechanism as round 5, section 1, for documents core owns. Both the old and the new code clear before and at the commit and cannot close it.
  An earlier unloaded FAIL of the targeted code on v16.52.0 (two runs right after the full suites, the web server serving a stale title for 10 s) was
  not reproduced in the 5 unloaded runs that followed; I attribute it to the same refill after the heavy suite runs, but did not prove it.

**Open risk for the lead (not fixed here, pre-existing, same with `frappe.clear_cache()`):** on a busy site an administrator's identity save can leave the old
Navbar Settings or Website Settings document in Redis, and the web workers then show the old logo or name until the next whole-site clear
(a cache clear of any kind, an upgrade, `bench clear-cache`). A real fix is a delayed second clear after the longest in-flight request (a
background job queued with `enqueue_after_commit`), or checking the `modified` stamp of the two core documents at the point where the app reads
them (as `cache_guard.settings_doc` does for its own document); neither is part of this item and neither was built.

## 5. Pre-existing observation (test hygiene, not touched)

`test_identity_changed_elsewhere_is_not_overwritten_by_an_unrelated_save` (`test_institutional_theme_settings.py`) sets Website Settings
`app_name` to "Changed by an administrator" and the suite's reset does not put the original back, so after a full suite run the bench site
shows that name as its application name (seen on both benches). It is not a failure; screenshots taken after a suite run show it.

## 6. Other checks

- No new user-visible string: nothing to add to `translations/ar.csv`.
- No new hook, no User doctype change, no whitelisted override. New Frappe dependencies are in the manifest (R8 to R11).
- `tools/ci/local_ci.sh` output: `logs/local_ci.log`.
- Reproduce: `docs/team/evidence/round6/cache-clears/loaded_run.sh <label> <b.sh|b52.sh> <url> <n>`, `negative_control.sh <log> [b.sh|b52.sh]`,
  `count_clears.py <site>`, `live_http_check.py <site> <url>` (run as the bench user from the bench's `sites` folder).
