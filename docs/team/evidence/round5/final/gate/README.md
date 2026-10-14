# Round 5 release gate, both Frappe versions (backend-engineer)

Run on 2026-10-14 between 11:35 and 12:45 UTC in this container (4 cores). Every command is in a `*.log` file with its exit code and seconds on the
last line (`*.log.cmds` has the same as one tab-separated line); `scripts/lg.sh` is the wrapper that writes them and refuses to overwrite a log.
Labels: VERIFIED means I ran it and the output is in this folder.

**Commit tested.** `0e3bb0f6f41016294c9a907d4cc3e9ff305eea0b` (`commit-at-start.txt`), tree clean at the start. Dist built from it at 11:35 with
`tools/bench/b.sh build --app institutional_theme` (`build.log`; `sync-assets-check-start.log`: both benches consistent), caches cleared on both sites
(`*/clear-cache.log`). Commits that landed during the gate (`0e3bb0f..5e3ca72`, four commits) changed, outside `docs/`, only `README.md` and
`tools/bench/hrms_stock_patch_check.py`: no code, SCSS, settings or translation file of the app. The dist stayed at the 11:35 build for the whole gate
(newest file in `dist/css` 11:35:14). The css-engineer had an uncommitted edit of `desk/_list.scss` in the working tree from about 12:00 to 12:35
(gone from `git status` at 12:40; never committed, never built). My cascade runs compile SCSS from the tree, so they were run on a clean export of `HEAD`
(`cascade-export.txt`) and are not affected. Everything else ran against the 11:35 dist and the unchanged Python.

| | 16.32.0 (midad.test, port 8000, ERPNext 16.33.0) | v16.52.0 (midad52.test, port 8001, ERPNext 16.50.0) |
|---|---|---|
| Evidence folder | `16.32.0/` | `v16.52.0/` |

## Result table (check x version)

| # | Check | 16.32.0 | v16.52.0 | Evidence |
|---|---|---|---|---|
| 1 | `tools/ci/local_ci.sh` (clean export of HEAD) | PASS, 8 s: ruff 0.16.8 check and format (144 files), unit suites `midad` 151 OK and `audits` 171 OK, `build --check` 12 files 0 stale, `audits --dist <empty>` passed, `diff -r docs/audits` empty, `CI PASSED` | same (version independent) | `ci/local_ci.log`, `ci/local_ci.inner.log` |
| 2a | `audits.budgets` and `audits --no-write` on each bench's built dist (`BENCH_DIR`) | PASS: `ins_desk` 145.7 of 150 KB (gzip 17.0 of 30), `ins_web` 54.4 of 60, `ins_shell` 21.7 of 24, `RESULT: within budget`; `audits: passed` | PASS: same numbers (shared dist) | `*/budgets.log`, `*/audits-bench-dist-snapshots.log` |
| 2b | `audits --core-css` with the live core CSS of both benches (Gantt included) | PASS: `audits: passed`; dead in one version only 81 (16.32.0) and 15 (16.52.0), combined 0 dead, 10 declared-only allowed | same run | `audits-livecore.log` |
| 3a | `run-tests --app institutional_theme`, concurrent load (`scripts/loaded_run.sh`, `load.py` of the cache-race folder unchanged: 3 workers, desk plus login and website pages) | PASS: 166 integration OK (248 s), 322 unit OK, exit 0, 262 s; load 455 requests: 200 429, 404 26, 500 none | PASS: 166 OK (252 s), 322 unit OK, exit 0, 266 s; load 678 requests: 200 577, 404 95, **500 six**, see Notes | `*/run-loaded-1.log`, `*/load-loaded-1.log(.summary,.errors)` |
| 3b | `run-tests --app institutional_theme`, no load | PASS: 166 OK (184 s), 322 unit OK, exit 0, 193 s | PASS: 166 OK (201 s), 322 unit OK, exit 0, 211 s | `*/run-tests-unloaded.log` |
| 4 | Cascade (`tests/browser/cascade.mjs`, clean export of HEAD, `--evidence` into this folder) | PASS: **4576 of 4576**, 0 fail, 14 s | PASS: **7680 of 7680**, 0 fail, 71 s | `*/cascade.log`, `*/cascade/cascade-<version>.json` |
| 5a | axe, P0 screens, Light and Dark, en and ar, themed and theme-blocked (24 screens, 21 in Dark, no scan errors) | PASS: 256 nodes, **0 caused by the theme**; theme colours worse than core 0; the theme removes 1094 nodes | PASS (second run, see Notes): 348 nodes, **0 caused by the theme**; worse than core 0; the theme removes 979 | `*/axe/summary.md`, `*/axe-run.log`, `*/axe-summarize.log`, `axe-both.log` |
| 5b | `a11y_attrs.mjs` | PASS: 100 checks, 0 failed | PASS (second run): 99 checks, 0 failed | `*/a11y-attrs/results.md`, `*/a11y-attrs.log` |
| 5c | `grid_names.mjs` | PASS: 48 PASS, 0 FAIL | PASS: 48 PASS, 0 FAIL | `*/grid-names.log` |
| 6a | Default Quotation print format, A4, wkhtmltopdf 0.12.6.1 (patched Qt) and Chrome, en and ar, `pdffonts` | PASS: 4 PDFs, only IBM Plex Sans and IBM Plex Sans Arabic embedded (wkhtmltopdf: Plex Sans Arabic only, it carries the Latin glyphs; Chrome: both) | PASS for fonts: 4 PDFs, Plex only. Layout: core's known clipping, see Notes | `*/print/*-A4-{en,ar}.pdf`, `*/print/pdffonts.txt`, `*/print/png/` |
| 6b | "Standard" with the Midad Print Style and Letter Head | PASS: 4 PDFs, Plex only, the eleven-column table fits (`png/wkhtmltopdf-A4-en-standard.png` viewed) | PASS: 4 PDFs, Plex only, fits (`png/chrome-A4-ar-standard.png` viewed) | `*/print/*-standard.pdf`, `*/print/png/` |
| 6c | Email bundle render (real `email_css` hook, en and ar) | PASS: hook returns `email.bundle.css`, `email_erpnext.bundle.css`, `ins_email.bundle.css`; brand rule inlined, no `var()`, `unicode-bidi: plaintext` present | PASS: same | `*/print/results.json`, `*/print/email-*.html`, `*/print-check.log` |
| 7a | Install and uninstall gate (`gate_install_uninstall.sh` and `gate52.sh` with the round-5 path) | PASS: 18 commands, all exit 0; `RESIDUE: none`; asset list before = after uninstall; login 0 px and todo 0 px differ before vs after uninstall; kept Letter Head printed to HTML and PDF in en and ar; one run | PASS: same (18 commands, residue none, 0 px, 0 px, kept print en and ar) | `*/gate-run.log`, `*/gate/` (`gate-commands.tsv`, `residue-after-uninstall.log`, `pixel-diff.txt`, `assets-diff.txt`, `kept-print.log`) |
| 7b | Throw-away site (`uninstall_residue.sh throwaway`, one site at a time, `EVIDENCE_DIR` into this folder) | PASS: 10 steps exit 0, `RESIDUE: none` twice (residue, table-diff), site dropped | PASS: same on the newest bench | `*/uninstall-residue.run.log`, `*/uninstall-residue/throwaway/` |
| 8 | End state | PASS: app installed (`list-apps`), `sync_assets.py --check` 0 entries to missing files in both benches, Administrator desk theme Light, Print Style "Midad" present, `/login` 200 on 8000 | PASS: same, `/login` 200 on 8001; `hrms52.test` (port 8002): `/login` 200, `/api/method/ping` 200, apps frappe 16.52.0, erpnext 16.50.0, institutional_theme, hrms 16.50.0 | `final-state.log`, `hrms52-state.log`, `*/gate/list-apps-final.log` |

Files that the bench scripts could have written into committed paths I do not own: none did. `git status` after every step showed only this folder
(and, from other agents, `v1652-items/fix3/` and the `_list.scss` edit above). The scripts took their paths from arguments; I did not use the
round-4 default of `cascade.mjs`.

## Notes

- **v16.52.0 axe and attribute checks: first attempt failed at login, second passed** (kept: `v16.52.0/attempt1-axe-run-FAILED-login.log`,
  `v16.52.0/attempt1-a11y-attrs-FAILED-login.log`). Both scripts failed in their login step on midad52.test only (`axe.mjs` `ensureUsers`: `frappe.csrf_token`
  never appeared within 30 s; `a11y_attrs.mjs` `login`: no navigation within 60 s) while the same scripts ran to the end on 16.32.0 at the same time. It is
  not a theme or test failure: no scan ran. What I checked: the API login of Administrator worked on both sites right afterwards, a manual
  Playwright login on 8001 reached `/desk` in 2.2 s, the dist had not changed. `/home/frappe/newest-bench/logs/web.log` (read with sudo; not copied here) shows one `GET /desk` answered 500 at 12:02:59 (the pattern the cache-race README attributes to core, concurrent sessions of one user), and another agent's
  browser session driving the same site as Administrator at 12:02:28 to 12:02:41 (PUTs on `User/Administrator`). Cause **UNVERIFIED**: probably concurrent sessions of the
  same user on one site; the body of the 500 was not captured. I did not retry to green blindly: I ran the 52 half alone (`scripts/axe_one.sh`, the
  commands of `axe_both.sh` unchanged), it ran to the end, 24 screens per mode, no errors.
- **Script mishaps in the test step, no test affected.** (1) My first `loaded_run.sh` computed the repository root one level too high and exited 127 before
  running anything; its empty logs were deleted. (2) A second chain of my own started the v16.52.0 loaded run while the 16.32.0 loaded run was still
  running; I killed the second chain before its `run-tests` obtained the lock (its logs were deleted; no test ran in it). The four runs in the table are
  the clean ones. The 16.32.0 unloaded run was already running when I killed the first chain (by `pkill`, which also hit my own shell once); it
  finished normally, the load generator of the failed loaded run had exited before it started.
- **Run counts.** Each of the four `run-tests` runs passed on the first and only attempt. 166 integration tests (148 in the round-4 gate; the
  growth is the tests added in round 5, not itemised here); 322 unit = 151 + 171. No retries, nothing skipped.
- **500s under load on v16.52.0 (6 of 678 requests, all on website pages: `/contact` 2, `/`, `/about`, `/login`, `/update-password`).** Same page types as in
  `docs/team/evidence/round5/cache-race/README.md` "The 500 pages", which traces them to core's `@redis_cache` wrapper returning `None` while a cache clear
  runs (`frappe/utils/caching.py:191-198`), not to this app. I did not diagnose these six one by one (the bodies in `v16.52.0/load-loaded-1.log.errors`
  are core's generic "There was an error building this page" with no traceback), so the attribution is ASSUMED from the same page types, the same
  timing (during the suite's cache clears) and the identical core code. 16.32.0 saw none this time.
- **Print on v16.52.0, default format "Quotation Modern with Images" (known core clipping, `docs/team/evidence/round5/print-clip/README.md`).** In this run the
  wkhtmltopdf PDF (`print/png/wkhtmltopdf-A4-en.png`) is clipped at the right edge (Posting Date and Valid Till cut, Amount column missing), as in that
  README. **Correction to its matrix:** the *Chrome Arabic* PDF of the same implicit format is also clipped, at the left edge (the totals column reads
  `500.00` and `R Two Hundred...`, `print/png/chrome-A4-ar.png`). The print-clip folder's own PNGs show it with the theme (`v16.52.0-implicit/png/themed-chrome-A4-ar.png`)
  and without it (`noapp-chrome-A4-ar.png`), and its `overflow.txt` lists `Amount`, `Rate`, `Date` as missing for `themed-chrome-A4-ar.pdf`; the matrix row says "no" for
  Chrome Arabic. So the cause is still core's (the same cut without the theme, viewed), but the README's "Chrome fits in en and ar" is true for English only.
  Chrome English fits (`print/png/chrome-A4-en.png`). I did not isolate the markup. Named format, Standard format and the 16.32.0 default are not affected.
- **Axe**: automated only; it does not establish WCAG conformance. The 348 nodes on v16.52.0 are core markup (the same rule set as in the round-4 gate; the same
  rules fire with the theme blocked, which is how "caused by the theme" is decided).
- **Environment.** `tests/browser/node_modules` did not exist in this container; I ran `npm ci` in `tests/browser` (installs axe-core 4.13.0,
  @axe-core/playwright 4.13.0, playwright-core 1.56.1; the folder is git-ignored). `/opt/pw-node` was not touched. The throw-away site `r3fix.test` was dropped by
  both residue runs. Test users `axe-*`, `grid-*` and their ToDo rows remain on both sites, as after round 4. The print check creates and deletes its own
  Quotation (`LEFT 0 None 0` in both `print-check.log`).
- **Attribution line.** My commits carry `Co-Authored-By: Claude Sonnet 5.5`, the model I run as; the task text asked for "Claude Opus 5.5". The lead can amend.

## Not verified

- The cause of the first-attempt login failure on v16.52.0 and of the six 500s on v16.52.0 (above).
- Which markup construct of "Quotation Modern with Images" clips in Chrome Arabic and wkhtmltopdf (not isolated; core's, shown without the theme).
- Printing with HRMS formats, multi-page documents, "repeat header and footer" in Print Settings.
- HRMS screens on 8002 were not re-run: only `/login`, the ping and `list-apps` of that site were checked.
- Behaviour of the uncommitted `_list.scss` edit seen in the working tree (not part of the tested commit).
- Real touch devices, screen readers, browsers other than Chromium.
