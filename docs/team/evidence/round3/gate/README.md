# Round 3 release gate (backend-engineer H)

Bench: `/home/frappe/frappe-bench`, site `midad.test`, Frappe 16.32.0, ERPNext 16.33.0, HRMS present. Branch `build/midad-v1`. Steps run in order; this file is updated after each step.

## Preparation

| Command | Result |
|---|---|
| `redis-cli -p 11000 DBSIZE` then `FLUSHALL` (port 11000 = `redis_queue` in `sites/common_site_config.json`; the cache and socketio Redis on 13000 were not touched) | 625 keys before, 0 after, `OK`. VERIFIED. Same action as round 2, decision 46. |
| `git checkout docs/team/evidence/phase2/css-cascade.json` | restored (timing-only change). Repeated after step 4. |

## Steps

| # | Command | Exit | Duration | Result |
|---|---|---|---|---|
| 1 | `tools/ci/local_ci.sh docs/team/evidence/round3/gate/ci.log` | 0 | 3 s | ruff check and format: pass (123 files). Unit tests: midad 130 OK, audits 48 OK. `build --check`: 12 files, 0 stale. Audits passed (see step 3 for the numbers). `CI PASSED`. VERIFIED. Log: `ci.log`. |
| 2 | `tools/bench/b.sh run-tests --app institutional_theme` | 0 | 150 s | 148 integration tests OK (146.6 s), then 178 unit tests collected from the app OK (2.0 s); 0 failures, 0 errors. VERIFIED. Log: `run-tests.log`. |
| 3a | `tools/bench/b.sh build --app institutional_theme` | 0 | 3 s | built, all `ins_*` bundles written. VERIFIED. Log: `build.log`. |
| 3b | `python3 -m institutional_theme.audits` | 0 | <1 s | contrast 0 failing (5 shipped presets x 2 modes, plus umber not shipped, passes), avatars 216 measurements 0 failing, parity 55 checks 0 failed, colour-vision 0 failures (99 baselined), dead tokens 377 variables 0 dead, budgets 0 problems measured from the bench build (`ins_web.bundle.css` 59.7 of 60 KB raw, the tightest). `docs/audits/*` rewritten with no diff; no other tracked file changed. `audits: passed`. VERIFIED. Log: `audits.log`. |
| 4 | `NODE_PATH=/opt/pw-node/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/browser/cascade.mjs` | 0 | 11 s | 4256 total, 4256 pass, 0 fail, no Sass warnings, RTL identical for desk and graphite. VERIFIED. Log: `cascade.log`. |
| 5a | `sudo env "PATH=$PATH" PW_NODE_PATH=/opt/pw-node/node_modules PIXDIFF_PYTHON=/opt/pixvenv/bin/python tools/bench/gate_install_uninstall.sh docs/team/evidence/round3/gate/install-uninstall` | 0 | 74 s | All 17 recorded commands exit 0 (`install-uninstall/gate-commands.tsv`, run log `install-uninstall.run.log`). Uninstall residue check: `RESIDUE: none`. Asset lists before vs after uninstall: identical. Kept-record print path: `KEPT PRINT: ok` (HTML only; PDF not verified, wkhtmltopdf not installed). Reinstall and final install exit 0; app left installed. Pixels (1366x768): login before vs after uninstall 0 px differ; todo before vs after uninstall **5 px differ, max channel delta 6**, bbox x 974-1305, y 82-166 (round 2 recorded 0). This is anti-aliasing-level noise, not a style difference, but it is not byte-identical: reported as observed, not explained (not investigated). Before vs installed differ as expected (login 810277 px, todo 381308 px). VERIFIED. |
| 5b | `EVIDENCE_DIR=$PWD/docs/team/evidence/round3/gate/uninstall-residue tools/bench/uninstall_residue.sh throwaway` | 0 | 35 s | Throw-away site `r3fix.test` (created, app installed, identity seeded, Website Settings saved, administrator's file attached, uninstalled, dropped); 11 steps all exit 0; `RESIDUE: none`; table diff `RESIDUE: none` (only comment, deleted-document, permission-log and version rows differ, ignored as record activity). `midad.test` was not touched and the site was dropped (`ls sites` shows only `midad.test`). VERIFIED. Log: `uninstall-residue.run.log`, `uninstall-residue/throwaway/`. |
| 5c | after the gate: `tools/bench/b.sh build --app institutional_theme`; `sudo env "PATH=$PATH" flock -o /tmp/ins-bench.lock tools/bench/start_services.sh restart-web`; `curl localhost:8000/api/method/ping`; `b.sh --site midad.test list-apps` | 0, 0, pong, 0 | 4 s, 4 s | `{"message":"pong"}`; apps: frappe 16.32.0, erpnext 16.33.0, hrms 16.20.1, institutional_theme 0.1.0 (installed). VERIFIED. Logs `post-*.log`. |

### Notes on step 5

- My first invocation of `uninstall_residue.sh` was malformed (a stray argument, default evidence folder) and I interrupted it while `new-site` was running. `new-site` finished by itself, and the second, correct run began with its own `drop-stale` step. The stray folder it created was deleted before commit. No effect on the results above.
| 6a | `cd tests/browser && PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH=/opt/pw-node/node_modules node axe.mjs --variant=themed --out=<gate>/axe-final` | 0 | 401 s | Themed runs, 4 language-mode pairs, 24 screens (21 in dark): 0 screen errors, 272 nodes. VERIFIED. Log `axe-final/run-themed.log`. |
| 6b | `node axe.mjs --variant=core --screens=form-row-editor --out=<gate>/axe-final-core-row-editor` (log `axe-final-core-row-editor.log`) | 0 | 42 s | The stored core (theme blocked) runs predate the `form-row-editor` screen: without them `input[data-target="Role"]` was wrongly classed "theme" (8 nodes, rules `aria-required-attr` and `aria-valid-attr-value`). The same rules fire on the same selector with the theme blocked. Those four screens were merged into `axe-final/run-core-*.json`. VERIFIED. |
| 6c | `node axe.mjs --summarize --out=<gate>/axe-final` | 0 | <1 s | **Caused by the theme: 0 nodes.** 272 nodes, all also present with the theme blocked (core markup). By rule: listitem 220 (awesomplete lists in search and notifications), aria-allowed-attr 20, aria-required-children 12, aria-required-attr 8, aria-valid-attr-value 8, document-title 4. Theme colours worse than core: 0. Present only with the theme blocked: 1170 nodes (`classified.json` `fixedByTheme`). Files `axe-final/summary.md`, `classified.json`. The other four `run-core-*.json` screens are copied from `../axe-rescan/` (same copy as the rescan; core markup does not depend on the theme build; VERIFIED as a classification, COMPUTED as a comparison against stored core runs, not re-scanned today). |
| 6d | `node a11y_attrs.mjs --out <gate>/axe-final/a11y-attrs` | 0 | 105 s | 100 checks, 0 failed (`axe-final/a11y-attrs/results.md`, log `axe-final/a11y-attrs.log`). VERIFIED. |
| 6e | `node grid_names.mjs --out <gate>/axe-final/grid-names` | 0 | 26 s | 48 PASS, 0 FAIL lines (`axe-final/grid-names.log`). VERIFIED. |

### Observations to weigh

- Compared with the wave-2 rescan (`../axe-rescan/`: 312 nodes, 0 theme): now 272 nodes, 0 theme. `meta-viewport` (48 nodes, core markup) no longer appears; I did not investigate why (a later change or a different state of the page). `aria-required-attr` and `aria-valid-attr-value` on the row editor / search count 8 each against 4 each then; both classed core. Not investigated.
- Axe is automated only: it cannot establish WCAG conformance; the remaining 272 nodes are core markup the theme does not own.
- The todo-page 5 px difference in step 5a is the only step result that is not an exact pass.

## Not run / not verified

- Nothing in the list was skipped. PDF printing is not verified (no wkhtmltopdf on the bench). Stored core axe runs were reused for 20+ screens per mode, as in the rescan.
- The full Frappe suite ran the 148 integration tests of `institutional_theme/tests` and the doctype test; the 178 unit tests of `midad`, `audits` are collected by the same command (CI runs 130 + 48 = 178 separately in step 1; counts agree).
