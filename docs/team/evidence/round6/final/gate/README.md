# Round 6 release gate, both Frappe versions (backend-engineer)

Run on 2026-10-14 between 20:06 and 21:32 UTC in this container (4 vCPUs, root). Every command is in a `*.log` file with its exit code and seconds on the
last line (`*.log.cmds` has the same as one tab-separated line); `scripts/lg.sh` writes them and refuses to overwrite a log, so failed attempts are kept
(`attempt1-*`). Labels: VERIFIED means I ran it and the output is in this folder.

**Commit tested.** `ab5ac37af4fa8be44991fb127b85d3e77760865b` at my start (`commit-at-start.txt`), branch `claude/exciting-ride-33ufyd`, tree clean.
HEAD moved to `da90422` during the gate; `git diff --name-only ab5ac37 HEAD | grep -v '^docs/'` prints only `CHANGELOG.md`, so no code, SCSS, settings or
translation file changed (the loaded 16.32.0 run's first line says `commit da90422` for that reason). Dist built from HEAD at 20:06:29 with
`tools/bench/b.sh build --app institutional_theme` (`build.log`; `sync-assets-check-start.log`: both benches 0 entries to missing files), caches cleared on both
sites (`*/clear-cache.log`; the third site `hrms52.test` has no cache clear of its own in this folder: it shares the dist and its Redis was not touched by any step). The dist did
not change afterwards (newest file in `dist/css` still 20:06:29 at the end). The cascade runs compile SCSS from the tree, so they ran on a clean export of HEAD
(`cascade-export.txt`).

| | 16.32.0 (midad.test, 8000, ERPNext 16.33.0, HRMS 16.20.1) | v16.52.0 (midad52.test, 8001, ERPNext 16.50.0; HRMS v16.50.0 on hrms52.test, 8002) |
|---|---|---|
| Evidence folder | `16.32.0/` | `v16.52.0/` |

## Result table (check x version)

| # | Check | 16.32.0 | v16.52.0 | Evidence |
|---|---|---|---|---|
| 1 | `tools/ci/local_ci.sh` (clean export of HEAD) | PASS, 12 s: ruff 0.16.8 check and format, unit suites `midad` **162** OK and `audits` **177** OK, `build --check`, `audits --dist <empty>` passed, `diff -r docs/audits` empty, `CI PASSED` | same (version independent) | `ci/local_ci.log`, `ci/local_ci.inner.log` |
| 2a | `audits.budgets` and `audits --no-write` on each bench's built dist | PASS: `ins_desk` **120.1** of 150 KB raw (gzip 16.7 ltr, 16.8 rtl, of 30), `ins_web` 54.4 of 60, `ins_shell` 21.7 of 24, `RESULT: within budget`; `audits: passed` | PASS: same (shared dist) | `*/budgets.log`, `*/audits-bench-dist-snapshots.log` |
| 2b | `audits --core-css` with the live core CSS of both benches (Gantt included) | PASS: `audits: passed`; dead in one version only 81 (16.32.0) and 15 (16.52.0), combined 0 dead, 10 declared-only allowed | same run | `audits-livecore.log` |
| 3a | `run-tests --app institutional_theme` under concurrent load (`scripts/loaded_run.sh`, `load.py` of the round-5 cache-race folder unchanged, 3 workers) | **FAIL, 1 of 177**: `test_site_files.TestSiteFiles.test_the_files_wait_for_the_commit_and_a_rollback_writes_nothing`, 339 unit OK, exit 1, 330 s; load 1871 requests, 500 once (`/`). Root cause below; not retried | PASS: 177 integration OK (309 s), 339 unit OK, exit 0, 321 s; load 1805 requests, 500 four (`/about` 2, `/contact`, `/update-password`) | `*/run-loaded-1.log`, `*/load-loaded-1.log(.summary,.errors)`, `16.32.0/diag-palette-hash-2.log` |
| 3b | `run-tests --app institutional_theme`, no load | PASS: 177 integration OK (319 s), 339 unit OK, exit 0, 332 s | PASS: 177 OK (301 s), 339 unit OK, exit 0, 312 s | `*/run-tests-unloaded.log` |
| 4 | Cascade (`tests/browser/cascade.mjs`, clean export of HEAD, `--evidence` into this folder) | PASS: **4576 of 4576**, 0 fail, 27 s | PASS: **7680 of 7680**, 0 fail, 96 s | `*/cascade.log`, `*/cascade/` |
| 5a | axe, P0 screens, Light and Dark, en and ar, themed and theme-blocked (24 screens, 21 in Dark, no scan errors) | PASS: 272 nodes, **0 caused by the theme**, theme colours worse than core 0; the theme removes 1110 | PASS: 348 nodes, **0 caused by the theme**, worse than core 0; the theme removes 995 | `*/axe/summary.md`, `*/axe-run.log`, `*/axe-summarize.log` |
| 5b | `a11y_attrs.mjs` | PASS: 100 checks, 0 failed | PASS: 99 checks, 0 failed | `*/a11y-attrs/results.md`, `*/a11y-attrs.log` |
| 5c | `grid_names.mjs` | PASS: 48 PASS, 0 FAIL | PASS: 48 PASS, 0 FAIL | `*/grid-names.log` |
| 6a | Default Quotation print format, A4, wkhtmltopdf 0.12.6.1 (patched Qt) and Chrome, en and ar, `pdffonts` | PASS: 4 PDFs, only IBM Plex Sans and IBM Plex Sans Arabic embedded | PASS for fonts: 4 PDFs, Plex only. Layout: core's known clipping in Chrome Arabic (viewed, `print/png/chrome-A4-ar.png`; see Notes) | `*/print/*-A4-{en,ar}.pdf`, `*/print/pdffonts.txt`, `*/print/png/` |
| 6b | "Standard" with the Midad Print Style and Letter Head | PASS: 4 PDFs, Plex only, table fits (`png/wkhtmltopdf-A4-en-standard.png` viewed) | PASS: 4 PDFs, Plex only, fits (`png/chrome-A4-ar-standard.png` viewed) | `*/print/*-standard.pdf` |
| 6c | Email bundle render (real `email_css` hook, en and ar) | PASS: hook returns `email.bundle.css`, `email_erpnext.bundle.css`, `ins_email.bundle.css`; brand rule inlined, no `var()`, `unicode-bidi: plaintext` present | PASS: same | `*/print/results.json`, `*/print/email-*.html`, `*/print-check.log` |
| 6d | HRMS Salary Slip Classic (Arabic, with en) and Draft Leave Application `HR-LAP-2026-00001`, themed, `tools/bench/hrms_print_render.py` | **Classic: no PDF, 4 of 4 renders fail** with core/HRMS `TypeError: Can't compile non template nodes` (also with Standard style and no letter head: `16.32.0/diag-classic.log`), the round-6 defect 1, not the theme. Leave: 4 PDFs, Plex only, whole watermark frame (Chrome en and ar: two horizontal and two vertical bands, `hrms-print/watermark-frame.log`). Salary Slip "Standard" (HRMS) as the available slip: 4 PDFs, Plex only | PASS: Classic 4 PDFs (wkhtmltopdf requests return Chrome output on this version, same byte sizes), Leave 4 PDFs, all Plex only, Chrome Leave frame whole (bands 13-17 and 183-187 at 100 dpi, as in the print-fix evidence) | `*/hrms-print-render.log`, `*/hrms-print/` (`pdffonts.txt`, `pdfinfo.txt`, `png/`, `watermark-frame.log`) |
| 7a | Install and uninstall gate (`gate_install_uninstall.sh`, `gate52.sh`) | PASS: 18 commands, all exit 0; `RESIDUE: none`; asset list before = after uninstall (diff "identical"); login 0 px differ before vs after uninstall; todo 3 px (max channel delta 2, see Notes); kept Letter Head printed to HTML and PDF in en and ar; app left installed | PASS: 18 commands exit 0, `RESIDUE: none`, assets identical, login 0 px, todo 0 px, kept print en and ar | `*/gate-run.log`, `*/gate/` |
| 7b | Throw-away site (`uninstall_residue.sh throwaway`, one site at a time) | PASS: 10 steps exit 0, `RESIDUE: none` twice (residue, table-diff), site dropped | PASS: same on the newest bench | `*/uninstall-residue.run.log`, `*/uninstall-residue/throwaway/` |
| 8 | End state | PASS: app installed, `sync_assets.py --check` 0 entries to missing files (both benches), Administrator desk theme Light, Print Style "Midad" present, `/login` 200 on 8000 | PASS: same, `/login` 200 on 8001; `hrms52.test` (8002): `/login` 200, ping 200, apps frappe 16.52.0, erpnext 16.50.0, institutional_theme, hrms 16.50.0 | `final-state.log`, `hrms52-state.log` |

Unit and integration counts. Round 5: 166 integration and 322 unit (151 + 171). Round 6: **177 integration (+11) and 339 unit (162 + 177, +17)**. Source of the
growth (`git diff e826515 HEAD`, `def test_` counted before and after): +11 integration = the new `institutional_theme/tests/test_identity_caches.py` (0 to 11, commit
`813811d`); +11 `midad` unit = `midad/tests/test_emit.py` 42 to 51 and `test_round4_map.py` 16 to 18 (the shared Frappe-map block, `4814fd7`, `24b03a4`); +6 `audits`
unit = `audits/tests/test_effective_diff.py` 17 to 23. Each run printed the same totals.

Files written into committed paths outside this folder: none. `git status` after the last step shows only `docs/team/evidence/round6/final/gate/`.

## Failure: 3a on 16.32.0, root cause

`test_the_files_wait_for_the_commit_and_a_rollback_writes_nothing` (`institutional_theme/tests/test_site_files.py:181`) failed at line 188: after `doc.save()` and before any
commit, `generated(PALETTE_PREFIX)` listed `ins_palette_custom.2438def10b0c.css` where it had been empty (`16.32.0/run-loaded-1.log` lines 217-236).

What I computed (`scripts/diag_palette_hash.py`, `16.32.0/diag-palette-hash-2.log`, read-only, bench Python, `site_files.palette_content` and `file_name`):

- The test's own state (`#1F3A5F` / `#8A6D1F`) names its file `ins_palette_custom.f5541a462b9c.css`. The stray file is not that one, so the save did not write
  early and the product's "write after commit" rule held.
- The stray name is the file of `#2A4A6E` / `#8A6D1F`. The only test that commits that state is `test_saving_the_settings_writes_the_file_through_the_on_update_hook`
  (line 82: `set_settings(custom_primary="#2A4A6E")`), and the log shows it ran immediately before the failing test.
- So the file is the previous test's committed palette, written lazily (`site_files.ensure`, the path a desk request takes) after this test's `setUp` had reset the
  settings and emptied the folder. This is the race the `setUp` comment of that class already describes (lines 38-43: the order "committed state first, folder second" narrows it;
  a request that read the old state before the reset commit and writes after the `rmtree` is not excluded).

Not established: that the writer was a request of the load generator. That is the only other process on the site and the only way the name can appear, but I did not
catch the write itself (the folder is removed by the class's `tearDownClass`, and `ensure` logs nothing). Label: the hash arithmetic and the test order are VERIFIED; the writer is ASSUMED.
Evidence that it is a load-timing flake and not a regression: the same test passed in the unloaded run on 16.32.0, in both runs on v16.52.0 (one of them loaded, 1805
requests), and in the round-5 loaded runs (the test file was last changed on 2026-10-14 11:00, before the round-5 gate). I did not retry: the task forbids retrying a test failure
to green. The loaded run is red on 16.32.0 for this commit as it stands. A fix would be in the test (assert on the names that this save adds, as the last assertion of the same test
already does, or hold the committed palette steady for the duration of the test); I did not touch tests.

## Failed attempts kept (both infrastructure, both diagnosed before the retry)

1. **`allow_tests` was off on midad.test** (`16.32.0/attempt1-*-FAILED-allow-tests-off.log`, `attempt1-tests-chain.out`): both `run-tests` of 16.32.0 exited 0 after 2 and 3 s
   with "Testing is disabled for the site!" (exit 0 but no test ran: not a pass). `site_config.json` of midad.test (rewritten 19:24 by the round-6 bench resume) had no `allow_tests`;
   midad52.test has it (`newest_site.sh` sets it, `build_test_bench.sh` does not). Fix: `tools/bench/b.sh set-config allow_tests true` (`16.32.0/set-allow-tests.log`), a test-site
   setting, no repository file. **Not recorded in the bench README**: `build_test_bench.sh` does not set it; a fresh container will hit the same.
2. **CA variables unreadable by the bench user** (`v16.52.0/attempt1-run-loaded-1-FAILED-ca-unreadable.log`): the same chain had gone on to the v16.52.0 loaded run, which ran 82 tests with 6
   `setUpClass` errors, all `RuntimeError: Environment variable HTTPLIB2_CA_CERTS not a valid file` (the shell's CA variables point at `/root/.ccr/ca-bundle.crt`, unreadable by `frappe`; `User.insert` reaches
   httplib2). Fix: `scripts/env_ca.sh` (the variables set to `/opt/proxy-ca-bundle.crt`, as in the resume chain), sourced before every later step. The 16.32.0 build and the clear-cache, which ran
   before and do not use httplib2, were not affected.
   I also killed that first chain with `pkill -f` and the pattern matched my own shell once (exit 144, nothing lost); the v16.52.0 loaded run it had already started was left to finish, its logs are the `attempt1-*` ones.
   The reruns of check 3 (the four runs in the table) are the first complete runs; none was repeated after that.

## Notes

- **Print on v16.52.0, default format "Quotation Modern with Images" (core's known clipping, round-5 print-clip evidence).** Chrome Arabic is clipped at the left edge (totals read `,500.00`), as in round 5; the 16.32.0
  default prints whole in Chrome Arabic (viewed). The named formats (6b) and HRMS formats fit.
- **Fonts.** In the 6a/6b folders the only PDFs with fonts other than IBM Plex are the four `*-standard-core.pdf` controls (Standard style, no theme: Inter, DejaVu Sans), as intended;
  the eight themed PDFs per version embed Plex only (`scripts/non_plex_fonts.sh`, output in `*/non-plex-fonts-print.log` and `*/non-plex-fonts-hrms-print.log`: only `*-standard-core.pdf` lines in the first, none in the second).
  The `hrms-print/` PDFs are all themed: Plex only, 16 files.
- **HRMS Classic on 16.32.0** cannot be rendered by this Frappe/HRMS pair with or without the theme (`16.32.0/diag-classic.log`, both calls `TypeError: Can't compile non template nodes`); the Arabic slip was therefore
  checked on 16.32.0 through "Salary Slip Standard" (viewed in round 6, fonts checked here), and on v16.52.0 through Classic (viewed `hrms-print/png/themed__salary-slip-salary-slip-classic__chrome-ar.png`: bands, Arabic
  captions, net-pay bar on the right edge). The period line still reads `30-09-2026 إلى For the period 01-09-2026` with the `dd-mm-yyyy` date format (round-6 finding 3, workaround recorded there).
- **Todo screenshot after uninstall on 16.32.0 differs by 3 px** (`gate/pixel-diff.txt`, max channel delta 2, at x 974, y 82-84: values 244, 246, 249 against 243, 243, 248, the anti-aliased edge of a rounded corner;
  round 5 had 0). The asset lists before and after are identical and the login page is 0 px, so I treat it as render noise; the cause was not isolated.
- **500s under load** (16.32.0: 1 of 1871 on `/`; v16.52.0: 4 of 1805 on `/about`, `/contact`, `/update-password`). The same page types as `docs/team/evidence/round5/cache-race/README.md` "The 500 pages"
  (core's `@redis_cache` wrapper during a cache clear); not diagnosed one by one (the error bodies in `*/load-loaded-1.log.errors` are core's generic page), so the attribution is ASSUMED from the page types.
- **Axe**: automated only; it does not establish WCAG conformance. The nodes are core markup (the same rules fire with the theme blocked). 272 on 16.32.0 (round 5: 256) and 348 on v16.52.0 (same as round 5): the 16 extra
  nodes on 16.32.0 were not itemised; the theme-caused count is 0.
- **Environment.** `tests/browser/node_modules` was missing; `npm ci` installed it (`npm-ci.log`, git-ignored). Test users `axe-*`, `grid-*` remain on both sites as before. The print check creates and deletes its
  own Quotation (`LEFT 0 None 0`). The throw-away site was dropped by both residue runs. `/tmp/r6gate-export` (the clean export) and `/tmp/r6gate-cascade-*` are left in `/tmp`.
- **Attribution line.** Commits carry `Co-Authored-By: Claude Opus 5.5` as the task asked; this agent runs as Sonnet 5.5.

## Not verified

- That a request of the load generator wrote the stray palette file (above); whether the test fails again on a repeat (I did not repeat it).
- The cause of the 3 px difference and of the five 500s under load.
- HRMS Salary Slip Classic on 16.32.0 (does not render); wkhtmltopdf output of the HRMS builder slips on 16.52.0 (the request returns Chrome output).
- Letter size, Cancelled variant, multi-page documents, paper or photocopy; real touch devices, screen readers, browsers other than Chromium.
- The 16 extra axe nodes on 16.32.0 against round 5.
