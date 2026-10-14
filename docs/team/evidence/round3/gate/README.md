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
