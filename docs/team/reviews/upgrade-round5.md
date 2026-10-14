# Upgrade review, round 5 (release gate): `git diff 610edf4..37931be`

Scope: the round-5 diff without binary evidence (`-- . ':!*.png' ':!*.pdf'`) and the files it touches. That is:
- the cache-race fix: `cache_guard.py`, `api.py`, `identity.py`, `install.py`, `identity_sync.py`, `preferences.py`, `print/ship.py`, `site_files.py`, `web_content.py`;
- the test changes: `test_cache_race.py`, `test_cache_guard.py`, and the edits to five existing test files;
- `side_panel_status.js` and its init line;
- the `_status.scss`, `_list.scss` and `_shell.scss` additions;
- the manifest rows;
- the HRMS bench tooling and `local_ci.sh`;
- the evidence READMEs in `docs/team/evidence/round5/{cache-race,print-clip,v1652-items,v1652-items/fix1,hrms52}/`.

Sources, opened:
- Frappe 16.32.0: `/home/frappe/frappe-bench/apps/frappe` (`git describe`: `v16.32.0`).
- Frappe v16.52.0: `/tmp/frappe-newest/frappe-src` (`git describe`: `v16.52.0`).
- Bootstrap 4.6.2 in both benches' `node_modules`.

Read-only bench actions only:
- one `SELECT` on `tabSingles` of `midad.test`;
- `ls` of the generated-files folder of `midad52.test`;
- `ps` of one pid.

I built, migrated, restarted and tested nothing.

Evidence labels: VERIFIED (I ran or opened it), COMPUTED (derived from source), ASSUMED.

## What holds

**`after_commit` / `after_rollback` are real and identical in both versions (VERIFIED).**
- `database.py:129-132` creates the four `CallbackManager`s.
- `commit()` at `:1176-1194`:
  - resets the rollback queues at `:1182-1183`;
  - runs `after_commit` after `COMMIT` and `begin()` at `:1194`.
- `rollback()` at `:1196-1215`:
  - resets the commit queues at `:1202-1203`;
  - runs `after_rollback` at `:1215`.
- A savepoint rollback runs neither queue (`:1198-1200`).
- `CallbackManager.run` pops callbacks in insertion order (`utils/__init__.py:1103-1142`). A callback added while the queue runs is run in the same loop.
- I diffed `commit`/`rollback`, `CallbackManager`, `defaults.py` and `get_cached_doc`/`clear_document_cache` between the two trees: no difference. Only line numbers move: `document.py:2278-2340` against `:2281-2343`, and `cache_manager.clear_defaults_cache` at `:113` against `:124`.
- PostgreSQL REPEATABLE READ: `postgres/database.py:196` in both trees.

**Rollback behaviour.**
- `cache_guard.after_transaction` (`cache_guard.py:36-47`) queues the callback on both outcomes. Core drops the other queue on each outcome, so the callback runs exactly once.
- Every queued callback only deletes cache keys, so running on rollback is harmless.
- Each is guarded:
  - `_forget_defaults`, `_forget_user`;
  - `_clear_website_caches_guarded` (`identity_sync.py:141-146`);
  - `_clear_cache_guarded` (`install.py:93-97`).
  So one failing clear cannot stop the core callbacks queued behind it. `test_a_failing_cache_clear_never_breaks_the_commit` pins this.
- `site_files.on_settings_update` keeps `after_commit` only (file writes must not happen on rollback). That is right.

**Outside a request.**
- migrate (`after_migrate`, then `ship.safe_ship`, then `set_global`), RQ jobs and `install_app` all end in a `commit`, so the queued clears run.
- During `install_app`, `clear_defaults_cache(None)` is a no-op (`cache_manager.py:117`), and `_clear_cache` returns early (`defaults.py:270-273`). Harmless.
- Uninstall: `before_uninstall` queues a full `frappe.clear_cache()`. It runs after `remove_app` commits, when the app is already gone from `installed_apps`. `clear_cache` calls no app code.
- Tests that never commit: the callbacks accumulate and run at the class rollback. Harmless.
- `_disable_transaction_control`: the queues are neither run nor reset (`:1177-1179`) until control returns. Harmless.

**The settings-document stamp check works and costs one indexed read per request (VERIFIED).**
- `tabSingles` holds `modified` for `Institutional Theme Settings`: a `SELECT` on `midad.test` returned `2026-10-14 14:13:48.754097`. `update_single` writes every valid field (`document.py:780-795`).
- `get_single_value` serves repeats from `db.value_cache` (`database.py:900-901`). That cache is cleared on commit (`:1193`) and by `clear_document_cache` (`document.py:2321`).
- So the boot, `update_website_context`, `web_content` and the `ins_identity` Jinja method share one query per request.
- `test_a_current_settings_document_is_served_from_the_cache` asserts that the steady state does not drop the cache.

**Boot is not a residual risk.** `extend_bootinfo` runs on every request, after the cached `bootinfo` is read (`sessions.py:139-147`, `:169-170`). So `frappe.boot.ins` is never stored stale.

**The deterministic race tests are real.**
- `logs/new-tests-without-fix-16.32.0.log`: 12 of 12 fail (11 failures and 1 error) with the eight product files stashed. The messages are the expected stale values (`'midad' != 'graphite'`, `'x' is not None`, the round-4 `TypeError ... NoneType`), not import errors.
- `test_cache_race.py` has not changed since 0e24f12, so that log covers today's file.
- The tests plant stale values with core's own cache API (`frappe.client_cache.set_value`, `frappe.cache.set_value`) and read back through core's cached readers (`frappe.db.get_global`, `get_defaults_for`, `frappe.cache.get_value`) after a real `commit`. They are not loosened.

**Existing test edits keep their meaning.**
- **`frappe.db.get_global` → `cache_guard.get_global` (`test_institutional_theme_settings.py`, `test_print_ship.py`); `get_defaults_for` → `user_defaults` (`test_api.py`, `test_preferences.py`).** Same expected values.
  - The cached-path property they lost (inside an uncommitted test transaction, other requests can legitimately refill the cache) is now asserted after commit in `test_cache_race.py`.
  - I accept the swap.
- **"Temporary-file assertions look at this process's files only" (`test_site_files.py:28-31`).** Justified, and I verified the cause.
  - The one committed v16.52.0 failure lists `ins_palette_custom.e1a90fb09e3f.css.72026.140037878445760.tmp`.
  - `/home/frappe/newest-bench/logs/web.pid` is `72026`, and `ps` shows it is `frappe --site midad52.test serve --port 8001`, the web server, not the test runner. That file was in flight.
  - `_write_atomic` names temporary files `<target>.<pid>.<thread>.tmp` (`site_files.py:142`), and the test's threads share its pid, so a leak by the code under test is still caught.
  - The folder holds no leftover `.tmp` now (`ls`).
- **"Site-file tests do not assume nobody else writes".**
  - `setUp` now resets the settings before it empties the folder.
  - The rollback test compares against `before`. With no load `before` is `[]`, which is the old assertion.
  - The audit-failure test passes the document to `ensure` and to `_regenerate` directly. That is the code under test, and it now also exercises the after-commit path.
  - None of the three weakens the property tested.

**Selectors (VERIFIED in both trees).**
- `kanban_column.html:3-6`: the dot badge is a direct child of `.kanban-column-title`, and the count has `.kanban-column-count`. 16.32.0 has `span.kanban-col-dot.indicator` and no `.es-badge`.
- `embedded_list.js:288-296`: `td > es-badge`, direct child. 16.32.0 has no `embedded-list`.
- `side_panel.js:610-614`: `this.preview` is set before `set_header`. `:742-747` empties the host and appends the badge. `:814-818` is the lazy singleton.
- `indicator.js:71-78`: the Draft and Cancelled filters.
- v16.52.0 `list.scss:1-8,814-835` and 16.32.0 `list.scss:1-10,600-607,651-654`.
- v16.52.0 `sidebar.scss:73-75,493-511` and `sidebar.js:719-744`. 16.32.0 `sidebar.scss:219-232`.

**Media queries and specificity (VERIFIED).**
- `max-width: 576px` is exactly core's `map-get($grid-breakpoints, "sm")`.
- `767.98px` is Bootstrap 4.6.2 `media-breakpoint-down(sm)` (the `sm` and `md` keys at `bootstrap/scss/_variables.scss:195-201`; 4.6.2 in both benches).
- Specificity is `(0,6,1)` and up, against core's `(0,5,0)`.
- No `!important`, no datatable geometry, logical properties only.

**Cascade (read, not re-run).** `fix1/cascade/*/cascade-*.json`: 16.32.0 4576 of 4576, v16.52.0 7680 of 7680, `rtlIdentical` true, no sass warnings.

**Manifest rows** exist and are correct for every new selector and for `frappe.ui._side_panel`:
- `DEPENDENCY_MANIFEST.md:359-364`.

**HRMS tooling is test-bench only.**
- With `HRMS_ENV` unset, `hrms.sh` behaves as in round 3: `env.sh`, `v16.20.1`, round-3 evidence path, `HRMS_LOCK=0`. The default changed in one way: the `verify` login is now a press of Enter. That works on both versions.
- `env52_hrms.sh` pins `v16.50.0` and gives the reason.
- Nothing on disk in core or HRMS is edited:
  - `hrms_install.py` swaps one function in memory;
  - `hrms_stock_patch_check.py` runs the stock patch and rolls back.
- Disclosed side effect: `hrms` is in the newest bench's `apps.txt` and virtualenv, but not in `midad52.test`'s `installed_apps`.

**`local_ci.sh` equals `ci.yml`.** There are two differences, and both are equivalent:
- `--dist <empty>`: the CI runner has no bench to find.
- `diff -r` of `docs/audits` against HEAD's copy: stricter than `git status --porcelain`, because it also catches new files.

## 1. Blocking

**B1. BLOCKING (release gate, evidence, not code): no passing loaded run on v16.52.0, and no committed loaded series of the final code on 16.32.0.**
- **Requirement:** RESUME item 1 requires five passing loaded runs on 16.32.0 and one on v16.52.0, all passing.
- **v16.52.0:** the only committed run is `cache-race/logs/run-v16.52.0-1.log`, at 8d65da2. It **failed**: `test_concurrent_calls_leave_complete_files_whose_hash_equals_their_name`, line 79 and line 218. The cause is understood and fixed in 725a227 (verified above). But no run after that commit exists.
- **16.32.0:**
  - Series `c` (5 of 5 OK, 166 tests) ran on 5747ec4 to af3388d. That is before 725a227 (test filter) and before 5d00af9 (CSS only).
  - Series `d` (the final code) is in the working tree, untracked. I did not count it.
- **Documentation gap:** `cache-race/README.md:48` points to "section 5" for the loaded runs. The committed README has no section 5: it goes from section 4 to section 6.
- **Failure if released now:** the gate claims "every run passes on both versions" with only a failed v16.52.0 run behind it.
- **Smallest correction:**
  - commit series `d` (five runs) and one v16.52.0 loaded run at HEAD, both passing, with their `load-*.summary` files;
  - write README section 5. Include the 500s diagnosis (N3) and the pid attribution above.
- **Nothing in the product code needs to change for this.**

No product-code finding is blocking.

## 2. Should fix

**S1. `side_panel_status.js:23-35` runs a full-document `querySelector` on every DOM mutation batch, forever, on both versions.**
- **Where:** the `document.body` observer (`childList`, `subtree`) calls `watch()` synchronously. `watch()` calls `document.querySelector(".side-panel-indicator")`.
- **Cost on 16.32.0, and on v16.52.0 until a side panel is opened:** the selector never matches, so each batch walks the whole desk DOM.
  - That includes datatable re-renders while scrolling, list refreshes, typing, and realtime updates.
  - It is never disconnected.
- **Cost after the host is found:** the scan continues anyway, because `host === watched` returns only after the query.
- **Comparison:** `a11y_names.js:60-72` (the one body observer the design allowed) looks only at `addedNodes` and batches with `defer()`.
- **Failure:** no visible defect. It is steady CPU overhead on every desk page, for a v16.52.0-only feature. It grows with DOM size, so large reports and Kanban boards are the worst case.
- **Smallest correction (pick one):**
  - disconnect the body observer once the host is found. Core never removes the panel: `hide()` only toggles classes, `side_panel.js:800-811`.
  - or test `record.addedNodes` for the class instead of querying the document.
  - or keep one live `document.getElementsByClassName("side-panel-indicator")` and read `[0]`.
- **Related, upgrade risk (NOTE level):**
  - `frappe.ui._side_panel` is private. The public accessor `frappe.ui.get_side_panel()` (`side_panel.js:814-818`) returns the same singleton, and it cannot create a second panel once `.side-panel-indicator` exists, because the host only exists after construction.
  - Using the accessor removes one private name. `preview.doc` and `current.doctype` stay internal.
  - The fallback when they change is graceful: try/catch, no attribute, core's red look.
- **BRIEF section 6:** not broken. The script writes one attribute of our own and patches nothing. This is the same pattern as `form_status.js`.

**S2. The embedded-list host paints labels as statuses on two of the three core embedded lists in v16.52.0. This is the round-4 B1 defect class.**
- **Where:** the `.embedded-list-table td > .es-badge` arm of `$ins-badge-host` (`_status.scss:144`).
- **Proof in v16.52.0.** All three core `type: "badge"` columns render the same markup (`embedded_list.js:290-296`):
  - `form/doctype_settings/tabs/naming.js:300-305` "Status" (gray or green): **a real status**.
  - `views/workspace/workspace.js:719-724` "Access": Standard is `blue`, Public is `green`, private is `gray`. **A label.** The theme gives "Public" the success check and "Standard" the progress dot.
  - `core/doctype/role/role.js:459-463` "Type": Custom is `blue`. **A label.** "Custom" gets the progress dot.
- **Failure:** in the workspace manager list, "Public" reads as a completed workflow state and "Standard" as in-progress. This is the false meaning that round-4 B1 rejected for tags (BRIEF section 3 rule 1). The a11y round 5 (finding 6) saw the Role case, and `fix1/README.md` §6 left it as "documented", but no document carries it yet.
- **Note on the comment:** `_status.scss:142-143` cites ERPNext Work Order statuses as the reason. The cost is falsely coded labels on core screens.
- **Smallest correction:**
  - drop the embedded-list arm. That returns to the round-4 accepted state (F3: status text kept, neutral look) and keeps the README entry for third-party badges.
  - Or, if the lead keeps it, record the Workspace "Access" and Role "Type" mislabelling in the manifest row (`DEPENDENCY_MANIFEST.md:362`, which today names only the "grey" failure) and as a decision in `OWNER_REVIEW.md`.

**S3. The cache fix's core dependencies have no manifest or checklist rows.**
- **Missing:** the backend's proposed rows (`cache-race/README.md` §6) were not applied. Today `DEPENDENCY_MANIFEST.md:449` covers `frappe.db.after_commit` for `site_files` only. These have no row:
  - `after_rollback`;
  - the FIFO, no-exception contract of `CallbackManager`;
  - `cache_manager.clear_defaults_cache` and `frappe.client_cache` (`defaults::<parent>`);
  - `defaults.set_default` / `clear_default` clearing once and before the commit;
  - `get_single_value(..., "modified")` on a Single (`settings_doc`);
  - PostgreSQL REPEATABLE READ (`postgres/database.py:196`).
  A grep of the manifest finds 0 hits for each of `cache_guard`, `after_rollback`, `client_cache`, `clear_defaults_cache` and `REPEATABLE`.
- **Failure:** at the next tag nobody re-checks that `rollback()` still runs `after_rollback`, or that `modified` is still stored in `tabSingles`. If `modified` stopped being stored:
  - `settings_doc` would see `None` against a datetime on every call;
  - it would drop and reload the document every request, a silent performance regression;
  - and it would raise no error.
- **Smallest correction:**
  - apply §6 of the cache-race README;
  - add the checklist step "re-run `institutional_theme.tests.test_cache_race` and `test_cache_guard`".

**S4. The checklist is not updated for round 5.** The diff does not touch `docs/UPGRADE_AND_QA_CHECKLIST.md`.
- `:211` still says the wkhtmltopdf clip of "Quotation Modern with Images" is "NOT VERIFIED". Round 5 verified it: core alone.
- **B12 (`:34`) says any other 16.32.0 movement "needs its own manifest row and a decision".** Round 5 moves 16.32.0 in two places, and neither is in B12:
  - **The ≤576 px list rules (`_list.scss:134-158`).**
    - On 16.32.0 the subject link now becomes a block ellipsis with `unicode-bidi: plaintext`, and rows are capped at the container width. Before, `.list-row-container` was `width: fit-content` inside an `overflow-x: auto` container (16.32.0 `list.scss:7-9`, `:603-604`).
    - `fix1/README.md` §1 shows truncated rows on 16.32.0 with an ellipsis. The manifest row (`:363`) says "harmless there (measured)". That is true for clipping, but it is still a visible change.
  - **The closed-drawer rule (`_shell.scss:90-96`).** On 16.32.0 it removes the closed drawer's controls from the tab order. That is an intended improvement.
- The fix1 z400 re-run on 16.32.0 timed out (`fix1/README.md`, "Checks"). So the final row-cap rules are measured on 16.32.0 only by `narrow.mjs` at 320 px.
- **Smallest correction:**
  - apply the print-clip wording proposed in `print-clip/README.md`;
  - add both movements to B12;
  - apply the "Known on v16.52.0" wording from `v1652-items/README.md`.

## 3. Notes

**N1. Residual race, documented and accepted.** A request whose REPEATABLE READ snapshot predates the commit can render and cache a Guest website page with the old links after the after-commit clear. `cache-race/README.md` §2 states this. Core has the same property. Old palette files are kept by `prune`, so the page is old, not broken.

**N2. Caching lost, measured in queries (COMPUTED).**
- **Logged-in desk boot and logged-in web pages:** +2 queries per request.
  - one `tabSingles` read (`settings_doc`, `cache_guard.py:143`), shared in the request through `value_cache`;
  - one `DefaultValue` read (`user_defaults`, `:104-117`).
  Before, both came from `client_cache` with no query.
- **Guest pages:** +1 query, and only on a page-cache miss.
- `DefaultValue` has indexes on `parent` and `defkey` (`core/doctype/defaultvalue/defaultvalue.py:30,36`).
- Acceptable. It is the price of not trusting a shared cache that the app cannot invalidate in time across processes: `ClientCache` says "do not expect sub-second invalidation guarantees across processes" (`utils/redis_wrapper.py:466-468`).

**N3. Doubled full cache clears increase exposure to a core race.**
- **Where:** an identity save now runs `frappe.clear_cache()` twice, before and after the commit (`identity_sync.py:131-153`). Uninstall does too (`install.py:114-115`).
- **Core race:** core's `redis_cache` returns `None` when a key is deleted and then re-set between `get_value` and `exists` (`utils/caching.py:191-198`).
- **Failure:** this produces the website 500s seen under test load:
  - `spy-server-exceptions-16.32.0.txt`: `router.py` `get_dynamic_web_pages()` / `get_published_web_forms()` give `TypeError: 'NoneType' object is not iterable`;
  - both are `@redis_cache` (`web_page.py:288`, `web_form.py:1199`).
- **Assessment:** this is core's defect, triggered by any cache clear. In production it happens only on an administrator save, so it is rare. Record it in README section 5 (B1).

**N4. A wrong docstring.**
- `cache_guard.py:40` says the callback "runs now as well when there is no transaction to wait for".
- `:43-44` returns without running it when `frappe.db` is `None`.
- No harm today: every caller clears once at once before it queues the callback. But the sentence is false. Fix: delete it, or call `callback()` in that branch.

**N5. "Core alone" for the print clip is adequately proven.**
- The process-level removal is enough, because the theme reaches a PDF through only four channels:
  - the `ins_identity` Jinja method: asserted absent in `render.py`;
  - the Print Style and Letter Head records: not used by `core` or `noapp`;
  - `ar.csv`: the English renders decide the question;
  - Print Settings: never touched (`ship.py:18`). No hook such as `pdf_header_html` or `before_print` exists in `hooks.py`.
- `core` (theme installed, Standard style) and `noapp` both clip like `themed`: A4 en max x 584.1 against 583.9, and "Amount" missing in all three (`v16.52.0-implicit/overflow.txt`).
- A never-installed site would add nothing.
- **Script hazard:** the `noapp` patch is safe on these benches only because `developer_mode: 1` selects the process-local `site_cache` for hooks (`frappe/__init__.py:1005-1006`). On a production-mode site the same script would write app-less hooks into the shared `client_cache` (`:1008-1011`) for every worker. Put a warning in the script header.
- **Also worth carrying into the checklist:** "Finding 1". Naming the format pins Chrome; wkhtmltopdf is reached only when the caller omits `print_format`.

**N6. `hrms_stock_patch_check.py` relies on the stock patch failing.**
- On a tag where `update_employee_advance_status.execute()` succeeds and commits internally, "Nothing is committed" (`:6`) would not hold.
- On v16.50.0 it fails before any write (`stock_patch_check.log`).
- Test bench only. Add "only on a site without Employee Advance rows" to the docstring.

**N7. Bundle headroom.**
- `ins_desk` is 146.4 of 150 KB (97.6 %, 17.0 KB gzip). It was 143.4 in round 4.
- `ins_shell.bundle.js` is 21.5 of 24 KB (`docs/audits/budgets.txt`).
- The next desk fix has 3.6 KB.

## 4. Scores (BRIEF section 10, my dimensions)

| Dimension | Round 4 final | Round 5 | Evidence |
|---|---|---|---|
| Upgrade-safety | 5 | **4** | **Holds:** the cache fix uses only core APIs that I opened and diffed: identical in 16.32.0 and v16.52.0 (`database.py:1176-1215`, `CallbackManager`, `defaults.py`, `document.py` cache functions). Rollback-safe; no core edit, monkey patch or whitelisted override. The race tests fail 12 of 12 without the fix (VERIFIED log). Every new selector resolves in the cited tree with the stated specificity and breakpoints; manifest rows are present for them; no `!important`; no datatable geometry; cascade 4576/4576 and 7680/7680. **Held below 5 by:** one new private dependency (`frappe.ui._side_panel`, graceful fallback), S2 (labels coded as statuses on two core screens), and S3 (cache dependencies not in the manifest, so the next tag will not re-check them). |
| Performance | 4 | **4** | Budgets pass. The stamp check is one cached primary-key read per request, and the steady state keeps the cached document (VERIFIED test, source). +1 or +2 indexed queries per request (N2). **Held below 5 by:** S1 (full-DOM query per mutation batch, never disconnected, also on 16.32.0) and 3.6 KB of desk headroom. Fixing S1 keeps this at 4; leaving it is the one item that could take Performance below 4 on very large desks. |
| Documentation | 4 | **3** | **Good:** manifest rows for every CSS and JS dependency (`:359-364`); the print-clip README is careful (process-level removal stated as such, generator pinning found); the HRMS README pins and justifies the tag. **Below 4 because:** the release gate's documents are not updated. The checklist still says the print clip is NOT VERIFIED (`:211`); B12 misses two 16.32.0 movements (S4); the cache dependencies have no rows (S3); the cache-race README lacks the loaded-run section it cites (B1); and `cache_guard.py:40` is false (N4). Each item is a text edit. Applying S3, S4 and B1's README section restores 4. |
| Craft | 5 | **4** | `cache_guard` is small, guarded and single-purpose. It clears now and again after the outcome, and it reads the app's own rows from the table instead of extending a shared cache it cannot invalidate across processes. The race tests are deterministic (no threads, no timing) and plant through core's own APIs. The site-file test changes were diagnosed to the pid (verified) rather than retried. **Held below 5 by:** S1 (the body observer ignores the pattern `a11y_names.js` set) and S2 (a broad host chosen for one ERPNext form). |

**Gate on my dimensions:** not passed. The causes:
- B1, missing gate evidence;
- Documentation at 3.

Neither needs a product-code change. Closing B1 and applying S3, S4 and N4 (all text) brings every dimension to 4 or more. S1 and S2 are product changes: SHOULD-FIX, each a few lines. If S2 is kept as it is, it needs a recorded decision.

## 5. Not verified

- No loaded test run, build, cascade, axe or z400 run of my own. I read the logs. Series `d` (untracked) is not counted.
- S1's CPU cost: COMPUTED from the code. Not profiled.
- S2 on a live site: COMPUTED from the three core call sites. The workspace manager list and the Role form were not rendered by me.
- The website-500 race (N3): read from the spy log and `caching.py`; not reproduced.
- MariaDB: the benches are PostgreSQL. The fix does not depend on the isolation level (README §6), but nothing was run on MariaDB.
- The owner's other custom apps: whether any reads `frappe.ui._side_panel`, or renders status badges inside an embedded list.
- HRMS v16.50.0 screens: read from `hrms52/README.md` and its `analysis.txt` summary, not re-run.

Last commit reviewed: **37931be** (`docs: CI log for the a11y round 5 fix round 1`). The working tree also holds untracked series-`d` logs from the backend engineer's run in progress. Those were not reviewed.

## Re-check after fix rounds

Range: `git diff 42e260c..f82b05b -- . ':!*.png' ':!*.pdf'`. The product and test changes are in:
- 878e2a4 (docstring);
- e17dd5d (`side_panel_status.js`, `_status.scss`, cascade fixture and assertion).

The documents are 878e2a4, 9968cb2 and f82b05b. Evidence read:
- `cache-race/README.md` section 5 and `logs/run-v16.52.0-d-1.log`;
- `v1652-items/fix2/README.md`.

I re-opened v16.52.0 `side_panel.js:414-415` (`appendTo(document.body)`) and `side_panel.html:1-8`. I checked the manifest citations R2 (`utils/__init__.py:1120`), R5 (`database.py:843,904`) and R6 (`document.py:1482`) in the v16.52.0 tree; all match. I did not run any bench.

| # | State | Evidence |
|---|---|---|
| B1 | **Closed** | `cache-race/README.md` section 5 now exists. It tabulates every run and counts none twice: series D on 16.32.0 has five passes in a row (`run-16.32.0-d-1..5`, 166 integration and 322 unit tests, exit 0, each with its load summary), and `run-v16.52.0-d-1.log` passes on v16.52.0 (header `commit 37931be`, exit 0, 828 load requests). The failed `v16.52.0-1` and series B stay in the table with their test-side causes; nothing was retried until green. The v16.52.0 pass predates e17dd5d, but e17dd5d changes only JS, SCSS and the browser fixture. No Python and no test module changed after 725a227 except the docstring, so the run covers the cache code at HEAD. |
| S1 | **Closed** | `side_panel_status.js:24-47`. Without a host at start-up it adds one `childList` observer on `<body>` (no subtree). That observer inspects only `addedNodes` and disconnects on the first match. If the host already exists, no body observer is made. Core appends the panel to `<body>` directly, once (`side_panel.js:415`), so a direct-child observer is enough. On 16.32.0 the remaining cost is one callback per direct child added to `<body>`, such as modals and dropdowns, with no document query. The private read is now a fallback behind the public `frappe.ui.get_side_panel()` (`side_panel.js:814-818`). Both names live in the same lazy bundle, so the fallback is effectively dead code. That is harmless, and if core renames both, the try/catch keeps the old graceful degradation. `fix2/16.52.0-after/probe.json`: 12 of 12 side-panel cases, opened through the lazy bundle, so the observer found a host added after start-up. |
| S2 | **Closed** | The embedded-list arm is removed from `$ins-badge-host` (`_status.scss:142-144`), and the comment gives the reason. Cascade now asserts that the embedded-list cell is neutral with no `::before`. The fix2 README notes this assertion failed once against a build that still had the arm. That is a real guard. Manifest row rewritten ("NOT a status host"). README and checklist "Known on v16.52.0" updated. `fix2/README.md`: cascade 16.32.0 4576/4576, v16.52.0 7680/7680. |
| S3 | **Closed** | Manifest section 6, rows R1 to R7, cover `after_commit` and `after_rollback`, `CallbackManager` (FIFO, no `try`), `clear_defaults_cache` and `defaults::<parent>`, `set_default` and `clear_default` clearing once, `get_single_value(..., "modified")`, the document-cache second clear, and REPEATABLE READ, each with lines in both versions. R5 names the silent failure I described. Checklist B13 holds the source check plus `test_cache_race`. C4 names both cache test modules and the loaded runner. |
| S4 | **Closed** | Checklist "Known on v16.52.0" carries the print-clip result, including the Chrome pinning. The NOT VERIFIED sentence is gone. B12 items (4) and (5) list both 16.32.0 movements with their sources: the 576 px list rules, and the 767.98 px closed drawer leaving the tab order. Manifest rows 363 and 364 are reworded to match. README "Printing" has the user-facing line. |
| N1, N2, N3 | Notes, unchanged | The 500 diagnosis (N3) is now in `cache-race/README.md` section 5, "The 500 pages". |
| N4 | **Closed** | `cache_guard.py:37-42`: the docstring now says the callback is not queued without a database connection. |
| N5 | Note, carried | The print-clip result and the generator pinning are in the checklist and the README. I did not check whether the production-mode warning for `render.py` was added. It is test tooling only, so this does not block. |
| N6 | **Closed** | `hrms_stock_patch_check.py:8-9` restricts the script to sites without Employee Advance rows and explains why. |
| N7 | Open (note) | `budgets.txt`: desk 146.4 of 150 KB. Removing the embedded-list arm saved a few bytes; under 4 KB of headroom remains. |

### Final scores (my dimensions)

| Dimension | Score | Evidence |
|---|---|---|
| Upgrade-safety | **5/5** | Every core API the cache fix uses is listed with lines in both versions (R1 to R7), identical in both trees (VERIFIED diff), and re-checked by B13 and the race tests. No private Frappe name is required any more (`get_side_panel()` first, guarded fallback). The status host list is back to badges that are statuses on every core call site. No `!important`, no datatable geometry, no core edit. Cascade passes on both versions. |
| Performance | **4/5** | S1 is closed: no document query per mutation. Cache cost: +1 query per request using the settings (`tabSingles`, shared in the request), +1 indexed `DefaultValue` query for logged-in requests (N2). Budgets pass. **Held below 5 by:** desk CSS at 97.6 % of budget (N7). |
| Documentation | **4/5** | B1, S3, S4 and N4 are closed. Loaded runs, failures and their causes are tabulated without omission. Every new core dependency has a manifest row in both versions, and the checklist names each 16.32.0 movement. **Held below 5 by:** the README `grep` pattern of round 4 (R5) and the `render.py` production-mode caveat (N5), neither of which I re-checked as fixed. |
| Craft | **5/5** | The fix-round changes are minimal and well aimed. The observer is reduced to the exact core mounting point (a direct child of `<body>`, disconnect on find). The host list drops the ambiguous arm instead of adding exceptions. The cascade assertion was inverted into a negative test that was seen failing. Test-side failures were explained by pid and by mechanism, not retried. |

**Gate on my dimensions: passed.** Every dimension is at 4 or above, and no blocking finding is open.

**Release gate run:** `docs/team/evidence/round5/final/gate/` has no README yet. It exists only untracked in the working tree, with build and audit logs and no summary. The gate result was **pending** when I finished, so this re-check does not cover it.

Last commit reviewed: **f82b05b**.
