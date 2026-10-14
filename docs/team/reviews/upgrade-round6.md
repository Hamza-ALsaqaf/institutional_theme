# Upgrade-safety review, round 6

Reviewer: upgrade-safety and Frappe engineering (hostile). Diff: `git diff origin/main..HEAD -- . ':!docs/team/evidence'` at `490dd98` (12 files). Sources read: Frappe `v16.32.0` and `v16.52.0`, HRMS `v16.20.1` and `v16.50.0`, shallow clones at those exact tags. Labels: VERIFIED means I opened the line or ran the command in this review. COMPUTED means derived from source. ASSUMED means not checked. The desk CSS headroom change is out of scope; it arrives as an addendum.

## What holds

- **Cache coverage is complete within Frappe, in both versions (VERIFIED).** The write-through sets Website Settings `app_name`, `app_logo`, `splash_image` and `favicon`, and Navbar Settings `app_logo`. I traced every core reader of those fields.
  - `get_website_settings` reads `client_cache.get_doc("Website Settings")` into `frappe.local.website_settings` (`frappe/__init__.py:1519-1527` / `:1522-1530`).
  - `get_app_logo` is at `core/doctype/navbar_settings/navbar_settings.py:26-39` / `:28-41`.
  - Boot uses `bootinfo.app_logo_url` (`boot.py:118` / `:121`), `bootinfo["navbar_settings"]` from `client_cache` (`sessions.py:184` / `:185`) and the per-user `bootinfo` hash (`sessions.py:139,147` / `:140,148`).
  - The desk title is set in `www/desk.py:60-62` / `:90-92`, which has `no_cache = 1`. `desk/page/desktop/desktop.py:12` reads through `get_single_value` and `get_cached_doc`, so it uses the same `document_cache::` key. `www/login.py:51-53`, `update_password.py:12` and `email/email_body.py:708,712` / `:710,714` also read these fields.
  - Rendered pages live under `website_page::*` (`website/utils.py:34-38`).
  - None of the `@redis_cache` or `@site_cache` functions under `website/` or in `boot.py` caches a value that identity sets: `boot.py:423`/`:590`, `web_page.py:290`, `web_form.py:1278`, `document_page.py:86` and `metatags.py:73` cache routes and tree doctypes only.
  - `website_404` stores only a flag per URL (`not_found_page.py:24`).
  - Both document-cache writers use the key the app deletes (`model/document.py:2316-2317`, `redis_wrapper.py:572-578`).
  - The app keeps no Redis cache of its own for identity (grep of `institutional_theme/`).
  - Every reader location, and every line cited in manifest rows R8 to R11, matches both trees. I spot-checked `defaults.py:270-273`, `redis_wrapper.py:572,588,630`, `website/utils.py:526-527`, `cache_manager.py:49,93` and `database.py:876`.
- **Core already clears the document cache on the write.** `set_single_value` calls `clear_document_cache` (`database/database.py:876`, both versions), and that function clears again after commit and after rollback (`model/document.py:2320-2334`). The app's `_drop_document` adds what core leaves to asynchronous invalidation: the in-process `client_cache` copy (`redis_wrapper.py:588-592`). That step is correct and guarded.
- **The decision-82 negative control is real for what it claims, but narrower than it looks.** I read `logs/negative_control-16.32.0.log`: `FAILED (failures=3, errors=3)`. Two failures pin behaviour: `Called 4 times` (no whole-site clear from the identity clear) and the whole-site call at commit (`[call()] != []`). The third (`expected call not found`) pins which callback is queued. The 3 errors are `AttributeError` on the new private API (`_identity_documents`, `_drop_boot_payloads`). They prove nothing about behaviour. See N1.
- **The authors' own evidence is candid.** It states that three whole-site clears still happen inside the save, from core (`defaults.py:273`, R8). It states that the live check fails under load for both the old and the new code. It flags the third-party-cache limit. I found nothing hidden.
- **The print selectors exist in both HRMS tags (VERIFIED).** I extracted the `css` field of `salary_slip_{classic,detailed,compact}.json`. HRMS 16.20.1 and v16.50.0 are byte-identical except for one added line, `.ss-timesheets { margin-top: 20px; }` in Classic. Every physical side the app mirrors is present in HRMS's CSS:
  - `.ss-meta td + td { padding-left: 40px }`
  - `.ss-net { border-left: 3px }`
  - `.ss-split td.l { padding-right; border-right }`
  - `.ss-strip td { border-right }`
  - `.ss-section td.rule { padding-left: 12px }`
  - `.ss-foot td { padding-right: 18px }` and `td.ref`
  - `.ss-ledger tr.ss-sec td.c`

  `.ss-classic` appears only in the Classic markup (6 times), as the app expects. The rules set absolute values, so an HRMS that mirrors itself would not be flipped twice.
- **The print bundle respects wkhtmltopdf's limits.** It uses no CSS custom properties (SCSS literals only), no flex, no grid and no logical properties. The `@supports` block is skipped by QtWebKit 534, which does not know the at-rule; Chrome applies it. No new `!important`; core's `!important` padding is left alone (`templates/styles/standard.css:146-149` on 16.32.0; `:146-155` on 16.52.0 has no `!important`). The whole file is inside `/*rtl:begin:ignore*/`, so rtlcss cannot flip the physical pairs. The specificity is right:
  - `.print-format .ss-doc` (0,2,0) beats HRMS's `.ss-doc` (0,1,0).
  - `[dir="rtl"] .print-format .ss-ledger td` (0,3,1) beats HRMS's `.ss-ledger td` (0,1,1).
  - Neither depends on load order.
- **The test-isolation fix is correct.** `test_institutional_theme_settings.py:88-91,99,103-107` snapshots the core fields in `setUp` and puts them back with `set_single_value(..., update_modified=False)`; that keyword exists in both versions (`database.py:843-852`). `test-isolation/final-site-values.log` shows no test name left on the three sites.
- **Version and range.** `__init__.py` is 1.0.0. `pyproject.toml:9` reads the version dynamically. `pyproject.toml:20` holds `>=16.32.0,<17.0.0`, as the CHANGELOG says.
- **CHANGELOG spot-check: five claims checked, all match the records, and every evidence link resolves.**
  - "175 KB to 59.7 KB": `round2/print-web3/evidence.md:6`, 175392 B to 61091 B.
  - "84 captures, 0 flagged": `STATUS.md:63`.
  - "12 deterministic race tests": `STATUS.md:32`.
  - "48 P0 desk screenshots": `STATUS.md:18`.
  - "26 colour variables remapped": `STATUS.md:47`.
  - Also checked: the five presets in `design/tokens.json`, and the install constraint.

## Blocking

None.

## Should fix

### S1 (major). The stale identity on a busy site is missing from every owner-facing document

- **Repository:** `CHANGELOG.md`, Known limitations (lines 60-64); `docs/team/OWNER_REVIEW.md:249` (decision 82 still says the identity save clears the whole cache twice).
- **Frappe proof:** `utils/redis_wrapper.py:572-578` (`ClientCache.get_doc` fills through `get_value(..., generator=...)`) and `:559-562` (`set_value` writes the Redis key with no expiry). The same lines exist in v16.52.0. The authors' own observation is `round6/cache-clears/README.md` section 4: under load, 8 of 8 live checks failed, and the Navbar Settings logo in `bootinfo["navbar_settings"]` was still old after 240 s.
- **Failure a site would see:** on a busy site, an administrator changes the emblem or the system name. The desk keeps showing the old logo or name indefinitely, until any cache clear, an upgrade or `bench clear-cache`. The reason: a request that began before the commit refills the core document after both of the app's clears, and the refilled key never expires. Round 5's code has the same failure, so this is not a regression. But the release notes list only the 500 errors and present the identity as fixed.
- **Smallest correction:** add a Known-limitations line to `CHANGELOG.md` and an entry in OWNER_REVIEW section 3: "after an identity save on a busy site, run `bench --site <site> clear-cache` if the old name or logo persists". Correct the decision-82 text. Optional code mitigation for a later round: a third clear in a short job, `frappe.enqueue(identity_sync._clear_website_caches, queue="short", enqueue_after_commit=True)` (`utils/background_jobs.py:84,205`, both versions). It narrows the window but does not close it.

### S2 (major). The upgrade checklist does not re-check what round 6 depends on

- **Repository:** `docs/UPGRADE_AND_QA_CHECKLIST.md:35` (B13 says "compare with manifest section 6 rows R1 to R7") and `:61` (C4 names `test_cache_race` and `test_cache_guard`, not `test_identity_caches`). No row covers the HRMS `.ss-*` classes or the Chrome watermark re-measurement.
- **Frappe and HRMS proof:**
  - R9 and R10 depend on `frappe.client_cache`, which its own docstring calls "internal to Frappe Framework and is subjected to change without any notice" (`redis_wrapper.py:452-453`).
  - R11 depends on `frappe.db.value_cache` (`database/database.py:125`) and on `frappe.local.website_settings`.
  - The print rules depend on undeclared HRMS CSS (`hrms/payroll/print_format/salary_slip_*/salary_slip_*.json`, `css` field).
  - The watermark depends on an unexplained Chrome clipping that was measured, not read (manifest row added at `DEPENDENCY_MANIFEST.md:149`).
- **Failure a site would see:** on the next point release, if core renames the client cache or its key, `_drop_document` deletes a key nobody reads. Nothing errors, and the in-process copy goes stale for up to the 10-minute local TTL. If HRMS renames `.ss-*`, the Arabic slips collide again (amounts against component names). If Chrome's header-page logic moves, Draft PDFs printed in Chrome lose their mark. The checklist would pass all three.
- **Smallest correction:**
  - Extend B13 to "rows R1 to R11".
  - Add `institutional_theme.tests.test_identity_caches` (11 tests) to C4.
  - Add one print row: render an Arabic Salary Slip Classic and a Draft Expense Claim with both generators. The slip's amounts must sit at the left edge; the Draft box must be visible in both generators. Cite `round6/hrms-print/README.md` for how to re-measure.

### S3 (minor). The wkhtmltopdf watermark at `top: 118mm` falls off short pages

- **Repository:** `institutional_theme/public/scss/ins_print.bundle.scss:364`.
- **Frappe proof:** Frappe's PDF page size is administrator-selectable (Print Settings `pdf_page_size`). The old rule (`40%`) stayed on the page at every size. COMPUTED: the box is about 40 mm tall (96 px text, padding, 6 px border). On a page whose content area is shorter than about 160 mm, the box starts below the content or is cut. Examples: A5 landscape and A6 with the default 15 mm margins, about 118 mm of content.
- **Failure a site would see:** a Draft or Cancelled document printed through wkhtmltopdf at a small page size carries no visible mark, so a draft can pass for a final document. UNVERIFIED: not rendered, because only A4 was rendered this round.
- **Smallest correction:** render one Draft at A5 landscape. If the mark is missing, state "A4 and Letter only" in the manifest row at `DEPENDENCY_MANIFEST.md:149` and in the checklist, or choose a smaller length that still clears the rows of a short A4 document.

### S4 (minor). The Arabic salary slip uses different rule colours from the English one

- **Repository:** `ins_print.bundle.scss:470` (`.ss-net` bar `$ins-text-strong`), `:481` (Classic split `$ins-border-strong`) and `:491` (strip `$ins-border-strong`).
- **HRMS proof:** the left-to-right originals are `#1a1a1a` and `#e2e2e2` (`salary_slip_classic.json` and `salary_slip_detailed.json`, `css` field, identical in 16.20.1 and v16.50.0). The literals in `generated/_tokens_light.scss:22,34` are `#141b25` and `#b8bec7`.
- **Failure a site would see:** an HR officer prints the same slip in English and in Arabic. The Arabic separators are visibly darker (`#b8bec7` against `#e2e2e2`). It looks like two documents.
- **Smallest correction:** either mirror the side only and leave the colour as HRMS's (`border-right-color: inherit` is not available; repeat HRMS's literal and record it in the manifest), or apply the same theme colours to the left-to-right sides as well. Pick one rule for both directions.

## Notes

- **N1. The negative control proves the narrowing, not the coverage.** The freshness tests pass on round 5's code, which is expected because a whole-site clear is a superset. No mutation run shows that each of the three steps is necessary. COMPUTED from reading the tests:
  - Dropping `_drop_website_pages` or `_drop_boot_payloads` fails `test_a_refill_with_the_old_values...`.
  - Dropping only the `client.delete_value` line in `_drop_document` is probably not caught: `frappe.cache.delete_value` removes the Redis key, and the in-process copy then goes through Redis invalidation, which is not instant.

  Cheap addition: a test that patches `frappe.cache.delete_value` to a no-op for the document key and asserts that `frappe.client_cache.get_doc` is fresh.
- **N2. Other apps' `website_clear_cache` hooks no longer run on an identity save.** Website Settings `on_update` would have run them (`website/utils.py:413`). Other apps' `clear_cache` hooks still run, because core's whole-site clear inside the save calls them (`cache_manager.py:308`, through R8). HRMS has neither hook in either tag (VERIFIED: `hrms/hooks.py`), which closes the "HRMS not checked" gap in the evidence README. The owner's second brand app was not checked.
- **N3. The tool usage text is wrong.**
  - `tools/bench/hrms_print_render.py:3,8` documents `[JOBS_FILE]` as optional, with a default of "every DOC line printed by hrms_print_seed.py". But `:19` reads `sys.argv[4]` unconditionally, which raises `IndexError` when it is omitted.
  - The seed prints `DOC <doctype>|<name>` (`hrms_print_seed.py:46-47`, two fields), while the job format is three fields (`Doctype|Name|Print Format`).
  - Test tooling only; fix the docstring.
- **N4. The private test namespace changes the database name in the configuration.** `test_identity_caches.py:77-79` mutates `frappe.local.conf["db_name"]`. That value is also what `frappe.connect()` and `get_db` use. A reconnect during the test (a lost connection) would target `<db>_ins_cache_test` and fail with a misleading error. Keys under that prefix that `frappe.clear_cache()` does not enumerate stay in Redis on test benches. Acceptable for tests; one comment line would save the next maintainer an hour.
- **N5. The manifest's `.ss-*` row says the wrong thing about 16.32.0.** `DEPENDENCY_MANIFEST.md:150` says "not on 16.32.0". HRMS 16.20.1 ships the same CSS (VERIFIED identical, except `.ss-timesheets`). Only Frappe 16.32.0's renderer fails on these formats (`TypeError: Can't compile non template nodes`, authors' log). The template line they cite is identical in both trees (`templates/print_format/print_header.html:21-22`), so the difference lies upstream in how `layout.header` is built. Saying "HRMS 16.20.1: same classes, VERIFIED" would make the row hold on a 16.3x Frappe that fixes the renderer.
- **N6. Decision 82 only partly removes the whole-site clears (R8).** Three clears inside the save remain, from `defaults._clear_cache`. The authors state this. The exposure to core's `redis_cache` race during an identity save is reduced, not removed.
- **N7 (carried).** Desk CSS headroom is pending the addendum. It is not reviewed here.
- Round 5 notes N1, N2, N3 and N5 are unchanged by this diff.

## Scores

| Dimension | Round 5 (final) | Round 6 | Evidence |
|---|---|---|---|
| Upgrade-safety | 5 | **4** | **Holds:** no core edit, no patched class, no whitelisted override. Every core reader of the identity fields is covered in both versions (traced above). The `@supports` split is safe in both generators. The selectors exist in both HRMS tags. **Held below 5 by:** new reliance on `frappe.client_cache` (documented as subject to change without notice) and on `frappe.db.value_cache`, both with manifest rows but not in the upgrade checklist (S2). The print fix depends on HRMS's undeclared CSS. The Chrome watermark position rests on a measured, unexplained clipping. |
| Performance | 4 | **4** | The commit-time whole-site clear is gone (round 5: 1, round 6: 0), and routing clears at commit drop from 6 to 2 (`count_clears` logs, the authors' table). Three whole-site clears remain inside the save, from core (N6). The print SCSS adds about 70 lines to a stylesheet that is not a desk bundle. The desk budget is unchanged here (N7, addendum pending). |
| Documentation | 4 | **3** | **Good:** manifest rows R8 to R11 and two print rows, with lines in both versions that I re-opened. The cache-clears README is exact and honest about its own failures. Five CHANGELOG claims match the records, and every link resolves. **Below 4 because:** the owner-facing limits omit the stale identity under load, and decision 82's text is now wrong (S1). The checklist was not extended (S2). The `.ss-*` row understates 16.32.0 (N5). The render tool's usage text is wrong (N3). Fixing S1 and S2 restores 4. |
| Craft | 5 | **4** | `identity_sync` is small: each step is isolated and logged once, nothing raises, and the document list is derived from `TARGETS` rather than hard-coded. The test-isolation diagnosis is by mechanism (REPEATABLE READ refill), not by retry. **Held below 5 by:** the RTL slip colours do not match the left-to-right ones (S4), half of the negative control fails on missing names (N1), and the test namespace trick mutates `db_name` (N4). |

## Not verified

- I did not render any PDF in this review. The watermark positions, the A5 and A6 case (S3), the mirrored slips and the fonts in `pdffonts` rely on the authors' logs and PNGs, which I did not open.
- I did not run any test, the negative control, the live HTTP check or the load runs. I read their logs only (the negative control and test-isolation results).
- I did not check ERPNext v16.33.0 and v16.50.0 for readers or caches of the identity fields; the authors state they found none. Nor did I check the owner's second brand app for `website_clear_cache` or its own caching of the app name or logo (N2).
- I did not trace why Frappe 16.32.0 fails to render the builder salary slips, given that `print_header.html` is identical in both trees (N5).
- I did not check whether QtWebKit in the patched wkhtmltopdf 0.12.6.1 ignores `@supports`. COMPUTED from the WebKit version; the authors' render shows it.
- ClientCache behaviour across processes (invalidation latency) is taken from its docstring and the authors' live check; I did not measure it.
- MariaDB: every cache trace is from source. The authors' benches are PostgreSQL. Under MariaDB's default REPEATABLE READ the S1 refill is ASSUMED to behave the same way.

## Re-check after fix round

Branch `claude/exciting-ride-33ufyd` at `ab5ac37`. Commits checked: `9a0c3fe` (print), `ae4705b` (print-fix evidence), `4e2eb05` (docs).

| Finding | State | Evidence |
|---|---|---|
| S1 (stale identity under load) | **Closed as a documented limitation.** OWNER_REVIEW decision-82 text is **pending** (the lead's final Arabic update), not open | `CHANGELOG.md` Known limitations now names the effect, the cause (a request that started before the save refills core's cache, which keeps the entry until the next clear) and the remedy (`bench --site <site> clear-cache`). `README.md` Troubleshooting adds "The old system name or logo still shows after saving the identity" with the same remedy. The lead's reasons for not adding the queued third clear are sound: it narrows the window but does not close it, and the test bench runs no workers to verify it. |
| S2 (checklist) | **Closed** | `docs/UPGRADE_AND_QA_CHECKLIST.md`: B13 now covers R1 to R11, names `frappe.client_cache` (marked internal by core) and `frappe.db.value_cache`, and runs `test_identity_caches`. C4 lists the 11 identity-cache tests. New row C46 renders an Arabic and an English Classic slip and a Draft Leave Application and Expense Claim with both generators. It names the `.ss-*` source (`salary_slip_*.json`, `css` field), the expected results and the Chrome watermark re-measure. |
| S3 (watermark on small pages) | **Closed as a documented limitation** | `print-fix/README.md` item 5: rendered on 16.32.0 with wkhtmltopdf. A5 landscape loses the box below the content; A6 cuts it; A4 and Letter are whole. The manifest row, the CHANGELOG, the README "Known print limits" and the SCSS comment (`ins_print.bundle.scss:386-387`) all say "A4 and Letter". Not rendered on 16.52.0 (the authors state this). |
| S4 (rule colours) | **Closed** | `ins_print.bundle.scss:55-63`: the left-to-right `.ss-net` `border-left-color` and the `.ss-split td.l` and `.ss-strip td` `border-right-color` take the theme colours. Widths and sides stay HRMS's, and the specificity (0,2,0) and (0,2,1) beats HRMS's (0,1,0) and (0,2,1) without `!important`. `print-fix/rule-colours.txt`: the Classic vertical rule is `(184,190,199)` in both English and Arabic after the fix (it was `(226,226,226)` in English before). The Detailed strip rules match in both directions. Setting a colour on a side with no border style (the Detailed `td.l`, the `.ss-strip td.last` `none`) draws nothing. |
| `9a0c3fe` extras | **Hold** | Caption colour `$ins-text-secondary` and 10 px (`:39-52`). Their selectors exist in the HRMS CSS of both tags: `.ss-label`, `.ss-net .words`, `.ss-hero .words`, `.ss-strip .ss-label`, `.ss-ledger tr.ss-sec td`. The Arabic `letter-spacing: 0` list (`:450-456`) extends a rule that already existed. The Chrome watermark is at `top: 3mm` (`:422`); the manifest row cites the 0 to 20 mm sweep on both versions, and the README states the risk of a printer's unprintable edge. No `!important` added (grep: the only hits are comments, at `:14,137,551`). |
| N1 (negative control) | Open (note) | Unchanged. |
| N2 (other apps' `website_clear_cache` hooks) | Open (note) | Unchanged. |
| N3 (render tool usage text) | **Open (note)** | `tools/bench/hrms_print_render.py:3,8` still documents `[JOBS_FILE]` as optional with a default; `:19` still reads `sys.argv[4]` unconditionally. |
| N4 (test namespace) | Open (note) | Unchanged. |
| N5 (`.ss-*` manifest row) | **Closed** | The row now says HRMS 16.20.1 ships the same classes and values, byte-identical to v16.50.0 except `.ss-timesheets`, VERIFIED. |
| N6 | Note | Unchanged (core). |
| N7 (desk headroom) | **Closed** | `docs/audits/budgets.txt:5,15`: `ins_desk` is 120.1 KB of 150 KB, both directions. See the addendum. |

## Addendum: desk CSS headroom

Diff: `git diff 490dd98..ab5ac37 -- institutional_theme/midad institutional_theme/audits institutional_theme/public/scss/generated tests/browser/harness tools/docs`. Evidence: `docs/team/evidence/round6/css-headroom/README.md`.

### What holds

- **The reasoning behind the equivalence is correct.** Every mapped value is a `var(--ins-*)` expression or a literal, and the browser resolves it on the element that declares it. For the 345 names whose light and dark expressions are equal (same text), the dark declarations were no-ops. The `--ins-*` underneath switch per mode in `_tokens.scss` and the palette files, which the change does not touch. `build._check_map_values_are_independent` (`build.py`) is conservative and fails the build on a self-reference.
- **The specificity on the explicit Dark root is unchanged.** The shared list (`emit.SHAPES["map"]["shared"]`) contains `html:root[dir][data-theme="dark"]` at (0,3,1). The dark block follows in the same generated file at the same specificity, so source order inside one file decides the 79 differing names, not load order across bundles. The nested light and dark elements keep (0,2,1).
- **Core cannot compete in the one changed cell (VERIFIED).** It declares mapped names on the root only at (0,1,0): `:root`, `[data-theme="light"]` and `[data-theme="dark"]`, plus `.dark` on 16.52.0. That matches the authors' scans `scan-core-16.32.0.txt` and `scan-core-16.52.0.txt`, and the root selectors of both trees.
- **What the Dark root actually uses, confirmed in core source.** In Automatic mode core resolves the attribute in JavaScript: `frappe.ui.set_theme` sets `data-theme` to `"dark"` or `"light"` from `prefers-color-scheme` (`public/js/frappe/ui/theme_switcher.js:154-163` / `:174-183`). Desk calls it on start and whenever `data-theme-mode` changes (`desk.js:105-118` / `:106-119`). So once desk JS has run, an Automatic page in a dark OS is matched by the explicit Dark root (0,3,1), not by the `[data-theme="automatic"]` media block. The (0,2,1) cell the authors identify exists only between first paint and `setup_theme`, because the server sends `data-theme="automatic"` (`www/desk.html:2`, both versions). The real exposure is therefore smaller than the README states.
- **The parity audit guards what it should.** `parity.check_map_family` asserts:
  - the exact selector tuples and media of all three blocks;
  - no duplicate keys;
  - dark keys are a subset of the shared keys, in shared order;
  - automatic equals dark;
  - no dark declaration repeats the light value;
  - the dark block equals the model's dark delta exactly.

  The shared block's values are not re-checked against the model by parity, but `build --check` (0 stale) catches any hand edit of the generated file. `docs/audits/parity.txt` is unchanged.
- **The measured result.** Computed-style dumps of all 424 names on `html` and on nested `[data-theme]` elements differ in 0 of 58 (16.32.0) and 0 of 34 (16.52.0). The only element differences are the Roles-editor checkbox swap the authors recorded as nondeterministic before the change. Pixel deltas of at most 3 sit on glyph edges, reproduced between two runs of the old CSS. Cascade passes 4576/4576 and 7680/7680. Budget: 146.2 to 120.1 KB raw. The website map `_frappe_map_light.scss` and the compiled `ins_web` CSS are byte-identical (the authors' `cmp`).
- **Other apps.** A second brand app that sets brand variables at `:root` or `[data-theme=...]` (0,1,0), or at `html[lang=ar], html[dir=rtl]` (0,1,1) as in the coexistence fixture, loses to this map in every mode, as before. Nothing in this change alters the font-family registration.

### Findings

- **A1 (minor). The B2 Automatic-dark dumps do not test the cell the change moved.**
  - Repository: `docs/team/evidence/round6/css-headroom/README.md`, "Residual exposure" (last bullet) and the B2 table.
  - Frappe proof: `theme_switcher.js:154-163`; the dump `after/16.32.0/dumps/en-automatic-osdark-comfortable-desktop.json.gz` records `"data-theme":"dark"` with `"data-theme-mode":"automatic"`.
  - Failure: none on a site today. The dumps exercised the explicit Dark root (unchanged specificity), so the equivalence of the Automatic media block rests only on the static proof and the cascade model. If a future core stops resolving `data-theme` in JavaScript (for example, it starts relying on CSS `prefers-color-scheme` only), the (0,2,1) cell becomes the steady state for every Automatic user. Nothing captured so far would have shown that.
  - Smallest correction: correct the README sentence. Add one capture with desk JS's resolution suppressed: load the page with `data-theme` forced to `"automatic"` after load, then dump the 424 names. Or add an upgrade-checklist note to B12 or B13: "if `frappe.ui.set_theme` no longer writes the resolved theme to `data-theme`, re-run the Automatic-dark dumps".
- **A2 (minor). The cascade harness now decides layers by selector text, not by specificity.**
  - Repository: `tests/browser/harness/css_model.mjs:41-48` (`family()`).
  - Failure: none today. A block that lists the plain root is now always the light layer, and the dark delta layers on top by family. If a later edit dropped `html:root[dir][data-theme="dark"]` from the shared list, the 345 names on the Dark root would fall to (0,2,1), but the harness would still layer them as before and pass. Only `parity.check_map_family`'s selector-shape check catches that edit. The guard still exists, but in one place instead of two.
  - Smallest correction: one harness assertion (or a unit test next to `test_the_map_shapes_beat_core`) that the Dark root's specificity for a non-differing name is (0,3,1), computed from the generated selector list.
- **A3 (note). The committed `docs/DESIGN_SYSTEM.md` is stale against its generator.** The authors report it (ramp steps 450 and 950 missing) and say this change does not cause it, which I accept. It should be regenerated before the tag or listed as known. I did not verify it.

### Not verified in the addendum

I did not run the build, the audits, the cascade test or the dump comparison. I relied on the authors' logs, plus the one dump I decompressed. I did not open the ERPNext and HRMS bench scans beyond their summary in the README. I did not check the second brand app on the owner's bench. The pre-JS flash in Automatic mode was not observed: COMPUTED, no competing rule found.

## Scores after the fix round and the addendum

| Dimension | Round 6 (first pass) | Re-check | Evidence |
|---|---|---|---|
| Upgrade-safety | 4 | **4** | S2 closed: R8 to R11, `test_identity_caches` and the HRMS print row C46 are now in the checklist the next tag will run. The map change keeps every specificity except a pre-JS transient, and core cannot reach that cell in either version. **Held below 5 by:** reliance on `frappe.client_cache` (internal, subject to change), on HRMS's undeclared `.ss-*` CSS, and on a measured, unexplained Chrome clipping (watermark at 3 mm). All are now listed and re-checked, but each can break on a point release without an error. A1 also leaves the Automatic cell depending on core's JavaScript behaviour without a capture that would catch a change. |
| Performance | 4 | **5** | Desk bundle 146.2 to 120.1 KB raw, 16.7 KB gzip, 29.9 KB headroom (`budgets.txt:5,15`). Zero whole-site clears at the identity commit. The three clears inside the save come from core (R8, N6), not from the app. |
| Documentation | 3 | **4** | S1, S2, S3 and N5 are closed with exact wording in CHANGELOG, README Troubleshooting and Known print limits, the manifest and the checklist. The headroom README gives sizes, scans and both versions. **Held below 5 by:** the OWNER_REVIEW decision-82 text (pending the lead), N3 (the tool's usage text is still wrong), A1 (the README overstates what the Automatic-dark dumps tested) and A3. |
| Craft | 4 | **4** | S4 is closed with colour-only overrides, no `!important` and pixel-checked results. The map change is data-driven (79 names from the model, not a hand list), guarded by a build check and exact parity, and proven by the static, computed and pixel layers. The harness failure was diagnosed to its cause rather than loosened. **Held below 5 by:** N1 (half of the negative control fails on missing names), N4 (test namespace via `db_name`) and A2 (one guard where there were two). |
