# Round 4 release gate, both Frappe versions (backend-engineer)

Run on 2026-10-14 between 08:39 and 09:25 UTC, in this container (4 cores), after the css-engineer's final screenshots (`/tmp/r4logs/p0-final.done`
appeared at 08:47). Every command is in a `*.log` file with its exit code and seconds on the last line (`*.log.cmds` has the same as one
tab-separated line). The scripts are those of `docs/team/evidence/round4/verify/` unchanged.

**Commit tested.** Code and settings: `70a62dd` for the CI run and the built dist; every commit after it up to `dc2764f` changes only `docs/` and
the root `README.md` (`git diff --name-only 70a62dd HEAD | grep -v '^docs/'` prints `README.md` only), except `dc2764f`, which adds the single row
`Expand sidebar,توسيع الشريط الجانبي` to `institutional_theme/translations/ar.csv`. The CI checks were run twice: on `70a62dd`
(`ci/local_ci.log`) and on `dc2764f` (`ci/local_ci-final.log`); both PASS. The bench runs (tests, axe, print, gates) used the working copy at
`85340fa` plus the uncommitted ar.csv row, i.e. the same code as `dc2764f`. Dist built at 08:39 by the css-engineer: `ins_desk` 143.4 KB.

| | 16.32.0 (midad.test, port 8000, ERPNext 16.33.0) | v16.52.0 (midad52.test, port 8001, ERPNext 16.50.0) |
|---|---|---|
| Evidence folder | `16.32.0/` | `v16.52.0/` |

## Result table (check x version)

| # | Check | 16.32.0 | v16.52.0 | Evidence |
|---|---|---|---|---|
| 1a | ruff 0.16.8 check and format (clean export of HEAD) | PASS: all checks passed, 138 files formatted | same (version independent) | `ci/local_ci-final.inner.log`, `ci/local_ci.inner.log` |
| 1b | Unit suites, CI's Python 3.14 | PASS: `midad` 151 OK, `audits` 171 OK | same | same |
| 1c | `midad.build --check` | PASS: 12 files checked, 0 stale | same | same |
| 1d | `python -m institutional_theme.audits` | PASS: `audits: passed`, contrast 0 failing pairs, 0 dead tokens in the combined verdict (dead in one version only: 81 on 16.32.0 and 15 on 16.52.0, each live in the other version; wording corrected by the lead), 10 allowed declared-only | same | same |
| 1e | `audits` and `audits.budgets` on each bench's built dist | PASS: `ins_desk` 143.4 of 150 KB (gzip 16.8 of 30), `ins_web` 54.4 of 60 KB, `ins_shell` 20.8 of 24 KB, `RESULT: within budget`, `budgets: 0 problem(s)` | PASS: identical (the dist is shared) | `16.32.0/budgets.log`, `v16.52.0/budgets.log`, `*/audits-bench-dist-snapshots.log` |
| 1f | `audits --core-css` with the live core CSS of both benches (Gantt included) | PASS: `audits: passed`; dead tokens 16.32.0 81, 16.52.0 15, combined 0 | same run | `audits-livecore.log` |
| 2 | `bench run-tests --app institutional_theme` | PASS on the third run: 148 integration tests OK (153 s), then 322 unit tests OK (151 + 171); exit 0, 161 s. Two earlier runs failed, see "Flaky runs" | PASS on the first run: 148 OK (174 s), 322 unit OK; exit 0, 183 s | `16.32.0/run-tests.log`, `16.32.0/run-tests-attempt1-1-error.log`, `v16.52.0/run-tests.log` |
| 2b | `bench migrate` after the tests (print records) | PASS: exit 0; Print Style and Letter Head "Midad" present before and after | PASS: same | `*/migrate-after-tests.log` |
| 3a | axe, P0 screens, Light and Dark, en and ar, themed and theme-blocked (24 screens, 21 in Dark, no scan errors) | PASS: 256 nodes, **0 caused by the theme** (round-4 verify: 256, 0); theme colours worse than core: 0; theme removes 1107 nodes | PASS: 348 nodes, **0 caused by the theme** (verify: 348, 0); worse than core: 0; theme removes 993 nodes | `*/axe/summary.md`, `*/axe-run.log` |
| 3b | Attribute checks `a11y_attrs.mjs` | PASS: 100 of 100 | **PASS: 99 of 99** (verify: 96 of 99; the three Arabic names of finding F2 now pass) | `*/a11y-attrs.log`, `*/a11y-attrs/results.md` |
| 3c | Child-table checkbox names `grid_names.mjs` | PASS: 48 PASS, 0 FAIL | PASS: 48 PASS, 0 FAIL | `*/grid-names.log` |
| 4a | Default Quotation print format, A4, wkhtmltopdf 0.12.6.1 (patched Qt) and Chrome, en and ar, `pdffonts` | PASS: 4 PDFs, only IBM Plex Sans and IBM Plex Sans Arabic embedded | PASS: 4 PDFs, only IBM Plex fonts embedded (verify: Inter and DejaVu, finding F1, now closed). Visual note below | `*/print/*-A4-{en,ar}.pdf`, `*/print/pdffonts.txt`, `*/print/png/` |
| 4b | "Standard" format with the Midad Print Style and Letter Head | PASS: 4 PDFs, Plex only, the eleven-column table fits (F3 closed, seen in `png/wkhtmltopdf-A4-en-standard.png` and `png/chrome-A4-ar-standard.png`) | PASS: same | `*/print/*-standard.pdf`, `*/print/png/` |
| 4c | Email bundle render (real `email_css` hook, en and ar) | PASS: brand rule inlined, no `var()`, `unicode-bidi: plaintext` present | PASS: same | `*/print/results.json`, `*/print/email-*.html` |
| 5a | Install and uninstall gate (`gate_install_uninstall.sh`, `gate52.sh`) | PASS: 18 commands, all exit 0; `RESIDUE: none`; asset list before = after uninstall; login 0 px and todo 0 px differ before vs after uninstall; kept Letter Head printed to HTML and PDF in en and ar; one run, no retry | PASS: 18 commands, all exit 0; `RESIDUE: none`; asset lists identical; login 0 px, todo 0 px; kept print en and ar | `*/gate-run.log`, `*/gate/` (`gate-commands.tsv`, `residue-after-uninstall.log`, `pixel-diff.txt`, `assets-diff.txt`, `kept-print.log`) |
| 5b | Throw-away site residue check (`uninstall_residue.sh throwaway`, one site at a time) | PASS: 10 steps exit 0, `RESIDUE: none`, table diff clean, site dropped | PASS: same, on the newest bench | `*/uninstall-residue.run.log`, `*/uninstall-residue/throwaway/` |
| 6 | `ar.csv` row `Expand sidebar,توسيع الشريط الجانبي`; source string checked at `frappe/public/js/frappe/ui/sidebar/sidebar.js:767` in `/tmp/src/frappe-16.52.0` (`__("Expand sidebar")`; the string does not exist in 16.32.0) | not applicable | PASS: `b52.sh execute frappe.utils.translations._ --kwargs "{'msg':'Expand sidebar','lang':'ar'}"` returns `توسيع الشريط الجانبي` (shown escaped in the log; first call returned the English string because of the translation cache, `clear-cache` fixed it) | `v16.52.0/translation-expand-sidebar.log` |
| 7 | End state | PASS: app installed (`list-apps`), dist consistent (`sync_assets.py --check`: 0 entries to missing files in both benches), Administrator desk theme Light, `/login` 200 | PASS: same | `final-state.log`, `sync-assets-check.log`, `*/gate/list-apps-final.log` |

## Flaky runs (16.32.0 `run-tests`, two failures, then PASS)

- Run 1 (08:41, `16.32.0/run-tests-attempt1-1-error.log`): `test_identity_is_written_through_by_a_system_manager_without_website_manager` raised
  `TypeError: the JSON object must be ... not NoneType` at `test_institutional_theme_settings.py:411` (the global `ins_identity_prior` read back as `None`).
- Run 2 (08:44): `test_website_pages_get_the_site_default_in_a_new_list` failed, `test_website_hook.py:91`, `result = None`. The log of this run was overwritten
  by my own wrapper before I noticed; the failure text above is from my terminal. Not kept.
- Both passed in the same runs elsewhere and in run 3 (08:48), with no code change between. At the time of runs 1 and 2 the css-engineer's headless
  Chromium was taking screenshots of the same site (7 `headless_shell` processes in `ps`; none at run 3). Both tests read state that other sessions can
  also write (a Single's global default and the settings cache). UNVERIFIED hypothesis: concurrent web requests refilled the shared Redis cache between
  the test's write and read. It did not recur on v16.52.0 (run once, after the screenshots, passed) and not in run 3. Not reproduced on demand.

## Notes

- **wkhtmltopdf and the v16.52.0 default format.** The Chrome PDFs of ERPNext's "Quotation Modern with Images" fit the page and carry the Letter Head
  and the watermark. The wkhtmltopdf PDF is clipped at the right edge (Posting Date, Valid Till and the Amount column cut), with Plex now embedded
  (`v16.52.0/print/png/wkhtmltopdf-A4-en.png`). The round-4 verify rendering of the same format is clipped in the same way
  (`../../verify/v16.52.0/print/png/wkhtmltopdf-A4-en.png`), so it is not new; it was not isolated against a render without the theme, so whether
  core's format alone does this under wkhtmltopdf is NOT VERIFIED. The 16.32.0 default format is not affected.
- **Axe**: automated only; it does not establish WCAG conformance. v16.52.0 core markup causes 348 nodes (listitem 200, aria-allowed-attr 124,
  aria-required-attr 8, aria-valid-attr-value 8, aria-command-name 4, aria-required-children 4), the same set as in the verify run.
- **F4 (the 60 s capture timeout)** did not occur in this run: no gate step needed a repeat.
- Throw-away sites `r3fix.test` were dropped by both residue runs. The test users `axe-*`, `grid-*` and their ToDo rows remain on both sites.

## Not verified

- A real Arabic translation of `Expand sidebar` rendered in the v16.52.0 desk (checked through `frappe.utils.translations._` only).
- The cause of the two flaky runs.
- Printing with HRMS formats (HRMS not installed), multi-page documents, Print Settings "repeat header and footer".
- wkhtmltopdf rendering of the v16.52.0 default format without the theme (see Notes).
