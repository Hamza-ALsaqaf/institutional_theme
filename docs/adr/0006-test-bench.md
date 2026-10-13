# 0006 — Test bench

Status: accepted, 2026-10-13. Settles ADR 0001 question 5. Every fact below comes from the Phase 0 run in `docs/team/evidence/phase0/`.

## Context

Visual and install checks need a live desk at the pinned versions. Cloud sessions are disposable root containers: PostgreSQL 16, Redis 7 and Python 3.14 are present, MariaDB server is not, the image's Node is 22, and the proxy blocks the GitHub API.

## Decision

`tools/bench/build_test_bench.sh` builds the bench in idempotent steps (`preflight user cli postgres bench services site erpnext wizard app build`); `tools/bench/start_services.sh` starts PostgreSQL, the two Redis servers and the web server on port 8000.

- **Database**: PostgreSQL 16, site `midad.test`, `new-site --db-type postgres`. `libmariadb-dev` (client headers only) is installed because Frappe depends on `mysqlclient` (log, attempt 1).
- **Python**: 3.14.6 via `uv`; bench CLI by `uv tool install frappe-bench`.
- **Node**: Frappe v16.32.0 requires Node 24 (yarn rejected 22, log attempt 2). Node 24.21.0 is downloaded, sha256-checked (log line 210, `OK`) and unpacked to `/opt/node24`.
- **User**: bench refuses root, so a `frappe` user runs every bench command. Real bench `/home/frappe/frappe-bench`; `/home/user/frappe-bench` is a symlink to it.
- **Frappe**: `bench init --frappe-branch v16.32.0 --no-backups` (no `crontab` in the container, attempt 3). **ERPNext v16.33.0** from its full git URL (the short name needs the GitHub API). **HRMS is not installed.**
- **App**: `apps/institutional_theme` symlinked to the repository, `uv pip install -e`, appended to `sites/apps.txt` (findings §7). Installing it on the site is the gate script's job.
- **Setup wizard** completed non-interactively with fictional data.

Measured step times: `bench init` about 68 s, site 41 s, ERPNext 185 s, wizard 34 s, app 2 s, build 31 s; a full idempotent re-run 44 s. Cold start from an empty container is **estimated** at 6 to 8 minutes (COMPUTED from the parts). No single from-scratch run was recorded: wiping the finished bench to time one was not permitted in this session.

## Alternatives rejected

- **MariaDB**: not installed in the image; adding a server adds a service and setup time while PostgreSQL is already present and supported (findings §7).
- **SQLite**: experimental and off in core CI; ERPNext on SQLite is not credible (findings §7).
- **Static harness only** (WORKFLOW, Phase 0 fallback): cannot prove install, uninstall, boot or hooks. It is kept as the CI method, where a bench is too slow.

## Consequences

- **HRMS 16.20.1 is not on the bench, so HRMS pages are not verified on a live site.** HRMS selectors rest on source reading; `OWNER_REVIEW.md` must say so. Adding HRMS needs a new script step.
- **backend-engineer**: owns the scripts; after changing `hooks.py` or installing a package, run `start_services.sh restart-web` (no reloader).
- **css-engineer, print-web-engineer**: capture against `http://midad.test:8000`, user `Administrator` / `admin` (test only).
- **reviewers**: socket.io is not running; its 404 polling errors in the browser console are not defects. This app should contain no database-specific SQL, since only PostgreSQL is exercised here.
- **lead**: the 6 to 8 minute figure stays an estimate until one clean run is logged.

## Evidence

- VERIFIED: `bench-build.log` (step times, failed attempts and their fixes, Node checksum), `list-apps-final.log` (frappe 16.32.0, erpnext 16.33.0, institutional_theme 0.1.0; no hrms), `/home/user/frappe-bench` symlink present.
- VERIFIED: install, uninstall, reinstall all exit 0 (`gate-commands.tsv`); 0 differing pixels and identical asset lists (`install-uninstall-result.md`), on a hook-free app.
- COMPUTED: the cold-start estimate. Verify by running `build_test_bench.sh` in a fresh container and recording its `TOTAL`.
