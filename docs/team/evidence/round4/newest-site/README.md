# Newest-tag verification site (round 4)

A persistent site, `midad52.test`, on the v16.52.0 bench, running this repository's working copy. Every round-4 check can run on both
versions. Built and verified on 2026-10-14 in this container (4 cores). Labels: VERIFIED means the command was run and its output is in this
folder.

## What exists

| Item | 16.32.0 bench (unchanged) | Newest bench (new) |
|---|---|---|
| Bench directory | `/home/frappe/frappe-bench` | `/home/frappe/newest-bench` |
| Frappe, ERPNext | v16.32.0, v16.33.0 | v16.52.0, v16.50.0 |
| Site | `midad.test` | `midad52.test` |
| Web port | 8000 | **8001** (no reloader, background) |
| Redis cache, queue | 13000, 11000 | **13003, 11003** (own servers, `logs/redis-*.pid`) |
| Database | PostgreSQL 5432 (shared server, own database per site) | same server, own database |
| App | `apps/institutional_theme` -> repository | `apps/institutional_theme` -> the same repository (`uv pip install -e`, `sites/apps.txt`) |
| Other ports in use (not touched) | | 8010 and 13001/11001 (`fresh_install.sh`), 8011 and 13002/11002 (`newest_tag.sh` stage site) |

Administrator password `admin` (test only). Setup wizard completed with the same fictional data as the 16.32.0 bench (Test Institution,
Saudi Arabia, SAR, English). Test fixtures: `tools/bench/test_fixtures.py` does not exist in the repository, so there are none to apply
(this site mirrors midad.test as built by `build_test_bench.sh`, which creates none).

## Files

| File | Use |
|---|---|
| `tools/bench/newest_site.sh [stage...]` | Setup, idempotent. Stages `preflight config redis site erpnext wizard app build install web verify`. Also `start`, `stop`, `restart-web`, `status`. |
| `tools/bench/env52.sh` | Sourced: points `BENCH_DIR`, `BENCH_REAL_DIR`, `SITE`, `WEB_PORT` at the newest bench, then sources `env.sh`. Overridable: `NEWEST_BENCH`, `NEWEST_SITE`, `NEWEST_PORT`, `NEWEST_REDIS_CACHE`, `NEWEST_REDIS_QUEUE`. |
| `tools/bench/b52.sh <bench args>` | `bench --site midad52.test <args>` as the bench user under `/tmp/ins-bench.lock` (works from the runner through sudo). |
| `tools/bench/gate52.sh [dir]` | The install and uninstall gate against the newest site. Re-runs itself as root under the lock. |
| `tools/bench/sync_assets.sh` and `.py` | Keeps the two benches' `assets.json` in step (see "Shared dist folder"). |
| `tools/bench/capture.mjs` | Changed: the host mapped to loopback is taken from the base URL (was hard-coded `midad.test`). Same behaviour for `midad.test`. |

`gate_install_uninstall.sh`, `build_test_bench.sh` and `b.sh` already read `BENCH_DIR`, `BENCH_REAL_DIR`, `SITE` and `WEB_PORT` from the
environment, so the defaults are unchanged and the newest bench is reached by overrides only. `b.sh` gained one thing: after a
`build` it runs `sync_assets.sh` when the newest bench exists (`INS_NO_SYNC=1` disables it).

## How to run things against it

```
tools/bench/newest_site.sh                       # first setup, or a repair: every stage, about 30 s when nothing is missing
tools/bench/newest_site.sh start | stop | restart-web | status
tools/bench/b52.sh list-apps
tools/bench/b52.sh migrate
tools/bench/b52.sh build --app institutional_theme       # then syncs midad.test's assets.json
tools/bench/b52.sh run-tests --app institutional_theme   # needs allow_tests: set by the site stage
tools/bench/b52.sh execute frappe.db.get_single_value --args "['System Settings','language']"
tools/bench/gate52.sh docs/team/evidence/round4/<task>/gate
source tools/bench/env52.sh && <any script that reads SITE, BENCH_DIR, WEB_PORT>
```

Browser tools: base URL `http://midad52.test:8001` (the hosts entry is added by the `web` stage; `capture.mjs` maps the host to
127.0.0.1 itself, so Playwright needs nothing). `tests/browser/*.mjs` have their own host handling; pass them this base URL and check how
each maps the host before relying on it (not changed here). Playwright and Pillow for the gate come from `ci_prereqs.sh`
(`PW_NODE_PATH=/opt/pw-node/node_modules`, `PIXDIFF_PYTHON=/opt/pixvenv/bin/python`, picked up by `env52.sh` when the folders exist).

`stop` stops only the web server and the two Redis servers of this site. PostgreSQL and everything of `midad.test` are left running.

## Shared dist folder (important)

Both benches symlink `apps/institutional_theme` to the same working copy, so they share `institutional_theme/public/dist`. Observed
(VERIFIED): **every** `bench build --app institutional_theme` produces new hashed file names, even with unchanged sources (the
`sourceMappingURL` comment carries the previous hash), and deletes the old files. The other bench's `sites/assets/assets.json` then names
files that no longer exist, so its desk stylesheet answers 404 (seen: `midad.test` after the first build on the newest bench). The
theme's SCSS imports no Frappe SCSS, so the output does not depend on the Frappe version and the entries can be copied:
`sync_assets.sh` copies the `ins_*` and `rtl_ins_*` entries of whichever bench is consistent into the other and clears both caches.
It runs automatically after `b.sh build`, `b52.sh build` and the `build` stage of `newest_site.sh`. After a build run by any other
route (plain `bench build` as the bench user, `bench migrate` is not affected), run `tools/bench/sync_assets.sh`.
`python3 tools/bench/sync_assets.py --check /home/frappe/frappe-bench /home/frappe/newest-bench` reports without writing.
Evidence: `b52-build-sync.txt` (both ports answer 200 for the new stylesheet after a build from either side).

## Results (all VERIFIED, 2026-10-14)

Setup run (`setup.log`, `commands.tsv`), exit 0, 374 s in total. 236 s of that is the `preflight` stage waiting for `/tmp/ins-bench.lock`: another
agent's command (`flock /tmp/ins-bench.lock tools/bench/b.sh build ...`) took the lock and then `b.sh` waited for the same lock, a
deadlock (b.sh locks by itself; do not wrap it in `flock`). I ended the deadlocked wrapper and its child; that agent's build did not run
and has to be repeated. Without the wait the setup took about 140 s:

| Stage | Seconds |
|---|---|
| config / redis | 6 / 0 |
| site (`new-site`, PostgreSQL) | 29 |
| erpnext (`install-app`) | 58 |
| wizard | 26 |
| app (symlink, `uv pip install -e`, `apps.txt`) | 2 |
| build (`bench build --app institutional_theme`) | 5 |
| install (`install-app institutional_theme`) | 8 |
| web (background) | 2 |
| verify | 2 |

Second run of `newest_site.sh` (idempotency, `rerun.log`): exit 0, 27 s, every stage printed "already ..." or was a no-op (the build
stage rebuilds, which is its job).

What responded (`run.log`, `ins_desk-links.txt`):

- `GET /login` -> 200, the page links `/assets/institutional_theme/dist/css/ins_desk.bundle.<hash>.css` (and the other `ins_*` bundles).
- `POST /api/method/login` -> 200; `GET /app` (logged in, redirects followed) -> 200, the page links the `ins_desk` stylesheet in both the
  LTR and the RTL folder, and the `ins_desk.bundle.css` and `rtl_ins_desk.bundle.css` names.
- `newest_site.sh status` after `start` reports web 8001, Redis 13003 and 11003 up; after `stop` all three down while `midad.test` on 8000
  still answered `/login` 200.
- Screenshot, Light desk, `screenshots/newest-light-todo.png` (To Do list, 1366x768, themed; `newest-light-login.png` next to it;
  `assets-newest-light.txt` lists the stylesheets). `/app` shows `data-theme-mode="light"`.

Install and uninstall gate (`gate52.sh`, `gate/`, `gate-run.out`): exit 0, 80 s, every command exit 0. `RESIDUE: none` after uninstall
(`gate/residue-after-uninstall.log`). Pixel comparison: `before` and `after-uninstall` identical for /login and /app/todo (0 differing
pixels); `installed` differs as expected. Kept-record path: Letter Head kept after uninstall and rendered to HTML in English and Arabic (`kept-print.log`, `KEPT PRINT: ok`; PDF not verified, wkhtmltopdf is not installed). The app was
left installed.

Frappe test suite on the newest site (`b52.sh run-tests --app institutional_theme`, `run-tests.log`): exit 0, 158 s, `Ran 148 tests ... OK`
(Frappe integration tests) and `Ran 196 tests ... OK` (unit tests).

CI checks of `.github/workflows/ci.yml` run locally before the push (`ci/`): ruff 0.16.8 check and format (exit 0), both unit suites (130 and 66
tests, OK), `midad.build --check` (12 files, 0 stale), `institutional_theme.audits` as CI runs it, without a built dist
(`audits-ci-like.txt`: contrast, parity, colour vision and the dual-version dead-token audit pass, budgets skipped, exit 0).
`docs/audits/budgets.txt`, which the audits rewrite, was restored with `git checkout`.

**Open finding, not mine:** the same audits against the dist folder of this working copy (`audits-with-local-dist.txt`) exit 1:
`budgets FAIL ins_web.bundle.css (ltr and rtl): raw 67258 B exceeds 61440 B (60 KB)`. The bundle was built from the committed SCSS
(`git status` clean for `institutional_theme/`; last SCSS commit `22cfd0b`, the round-4 login selectors). CI does not see it (no dist), the
Phase-4 budget audit on a built bench does.

## Not verified

- `tests/browser/*.mjs` (cascade, axe, first paint) against port 8001: not run here; only `capture.mjs` was adapted.
- HRMS is not installed on the newest site (not asked for; `hrms.sh` targets the 16.32.0 bench).
- Arabic and Dark screenshots and the print checks on this site: not part of this task.
- A site reached by a Host other than `midad52.test` or `localhost` (it is the default site, so any Host reaches it; not tested).

## Risks

- A build on either bench changes the shared dist for both; `sync_assets.sh` covers the known routes only.
- `/tmp/ins-gate-state.json` is shared by both gates; they are serialised by the lock, but never run two gates at once outside it.
- Any command wrapped in `flock /tmp/ins-bench.lock` that itself calls `b.sh`, `b52.sh` or `gate52.sh` deadlocks (they lock themselves).
