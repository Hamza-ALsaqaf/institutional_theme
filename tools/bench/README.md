# Test bench

Builds and runs a throw-away Frappe bench for the theme: Frappe v16.32.0, ERPNext v16.33.0, PostgreSQL 16, site
`midad.test` (administrator password `admin`, test only), this repository symlinked in as an app.
Everything lives outside the repository except these scripts.

| File | Purpose |
|---|---|
| `env.sh` | All paths, versions and test-only credentials. Override by exporting a variable first. |
| `build_test_bench.sh [step...]` | Builds the bench. Steps, in order: `preflight user cli postgres bench services site erpnext wizard app build`. Idempotent: a finished step skips its work. Prints `STEP name END <seconds>`. |
| `start_services.sh [stop\|restart-web]` | Starts PostgreSQL, the two bench Redis servers and the web server in the background on port 8000. |
| `gate_install_uninstall.sh [dir]` | Phase 0 gate: capture, install, capture, uninstall, capture, diff, reinstall. Leaves the app installed. |
| `uninstall_residue.sh [label]` | Round 3 fix: on a throw-away site of the test bench (`r3fix.test`, created and dropped), install, write the identity through, save Website Settings, attach an administrator's file with the emblem's bytes, uninstall, and list File rows and files left (`gate_state.py residue`) and the table diff. `GATE_ADMIN_TARGET` moves the administrator's file; `OLD_IDENTITY_SYNC` swaps in an older `identity_sync.py` for the uninstall command only (negative control). |
| `b.sh <bench args>` | One bench command for the test site as the bench user, under the lock, from the runner or the root container. |
| `newest_site.sh [stage...\|start\|stop\|restart-web\|status]` | Round 4: a persistent verification site `midad52.test` on the newest-tag bench (`/home/frappe/newest-bench`, Frappe v16.52.0, ERPNext v16.50.0) running this working copy (symlink, `uv pip install -e`, `apps.txt`), installed and built. Web on 8001, own Redis 13003 and 11003, same PostgreSQL. Stages `preflight config redis site erpnext wizard app build install web verify`, idempotent. Never touches `midad.test`, port 8000 or Redis 13000 and 11000. Needs the bench from `newest_tag.sh tag clone bench`. |
| `env52.sh`, `b52.sh`, `gate52.sh` | The newest site's environment (`NEWEST_BENCH`, `NEWEST_SITE`, `NEWEST_PORT`, ...), `b.sh` against it (`tools/bench/b52.sh run-tests --app institutional_theme`), and the install and uninstall gate against it (evidence default `docs/team/evidence/round4/newest-site/gate`). The 16.32.0 scripts keep their defaults. Details: `docs/team/evidence/round4/newest-site/README.md`. |
| `fresh_install.sh [stage]` | Round 3: a second, fresh bench (Frappe v16.32.0, own Redis 13001 and 11001, web on 8010) with two fresh sites, `fresh.test` (Frappe only) and `fresherp.test` (with ERPNext). Runs the `README.md` install and uninstall commands literally (`APP_URL`, `APP_BRANCH`), timed, with the checks in `verify`, the table-by-table residue diff of `fresh_check.py`, screenshots, `bench remove-app`. Records every command in `$EVIDENCE_DIR/commands.tsv`. Never touches `midad.test`. |
| `fresh_check.py` | Row counts of every table of a site (`snapshot`) and their difference (`diff`); used by `fresh_install.sh`. |
| `newest_tag.sh [stage...]` | Round 3: shallow clone of the newest Frappe v16 tag outside the repository, a throw-away bench (`/home/frappe/newest-bench`) to compile its desk CSS (LTR, RTL, with the newest ERPNext), the dead-token audit against it and `manifest_selectors.py`. Does not touch the committed snapshot. |
| `manifest_selectors.py`, `dead_token_diff.py` | Helpers of `newest_tag.sh`: citations and selectors of `docs/DEPENDENCY_MANIFEST.md` against a Frappe tree; category changes of the overridden variables between two core CSS sets. |
| `ci_prereqs.sh` | Playwright-core and a Pillow venv for the gate captures on a machine without them (GitHub runner). |
| `capture.mjs`, `pixel_diff.py` | Playwright capture of asset lists and screenshots; pixel comparison. |
| `write_source_readers.sh` | Round 4 fix 1: writes the committed snapshots of what Frappe, ERPNext, HRMS and the self-styling libraries read outside the compiled CSS (`audits/source_readers.py`, `source_readers_frappe_<version>.json`) and of what the website pages read (`audits/web_scope.py`, `web_reads_frappe_<version>.json`), one pair per supported version, from the source trees and the built bundles. Paths are overridable variables at the top of the script. |
| `web_style_capture.mjs`, `web_style_diff.py` | Round 4 fix 1: the computed style (colour, line, shadow, shape, type, spacing properties) of every element of the login pages in English and Arabic, the 404, the update-password page, the portal pages and two web forms, plus the resolved value of every mapped custom property on `html`; and the comparison of two such captures. Used to show that the website bundle without the desk-only names renders every page identically. |

## Why it looks the way it does

- **Bench user.** `bench` refuses to run as root, so the scripts create the user `frappe` and run every bench, git, uv and
  node command as it (`as_bench` in `env.sh`). The real bench is `/home/frappe/frappe-bench`; `/home/user/frappe-bench` is a symlink to it.
  `/root` is not readable by that user, so the Python 3.14 interpreter, `uv` and the proxy CA bundle are copied to `/opt` and `/usr/local/bin`.
- **Node 24.** Frappe 16.32.0 declares `node >=24` in `package.json`; the image has Node 22, so Node 24.21.0 is
  downloaded (sha256 checked) to `/opt/node24`. Playwright runs on the image's Node 22.
- **libmariadb-dev.** `mysqlclient` is a hard Frappe dependency and compiles against the MariaDB client headers, although
  only PostgreSQL is used (the client library is installed, not the server).
- **App registration.** `apps/institutional_theme` is a symlink to the repository, then `uv pip install -e`, then a line
  in `sites/apps.txt` (findings section 7). The repository subtree `institutional_theme/` is made group-writable for `frappe` so builds can write `public/dist`.
- **ERPNext on PostgreSQL** installed without errors in the run recorded here. To go Frappe only: `WITH_ERPNEXT=0 tools/bench/build_test_bench.sh`.
- **Setup wizard** is completed non-interactively with fictional data, otherwise `/app` only shows the wizard.
- The web server runs without the reloader. After installing or removing a Python package, or editing `hooks.py`, run
  `tools/bench/start_services.sh restart-web`.

## Durations (this container, 4 cores, warm network)

| Step | Time |
|---|---|
| preflight (+ libmariadb-dev) | 1 to 20 s |
| user (Python copy, Node 24 download, git config) | 7 s |
| cli (`uv tool install frappe-bench`) | 8 s |
| postgres (initdb and start) | 1 s |
| bench (`bench init`: pip, yarn, asset build) | about 68 s |
| site (`new-site`, PostgreSQL) | 41 s |
| erpnext (`get-app` and `install-app`) | 185 s |
| wizard | 34 s |
| app | 2 s |
| build (`bench build`) | 31 s |
| full re-run, everything already done | 44 s |
| gate script | about 80 s |

Expect about 6 to 8 minutes from an empty container. These were measured in pieces (see `docs/team/evidence/phase0/bench-build.log`), not in one run from scratch.

## Fresh container

```
tools/bench/build_test_bench.sh        # about 6 to 8 minutes; safe to re-run after an interruption
tools/bench/start_services.sh          # PostgreSQL, Redis, web on :8000
curl http://midad.test:8000/api/method/ping
```

If the container only restarts (files kept): `tools/bench/start_services.sh`. Run bench commands as the bench user:
`runuser -u frappe -- bash -c 'cd /home/user/frappe-bench && bench --site midad.test list-apps'`.
Browser: `http://midad.test:8000` (the script adds it to `/etc/hosts`) or `http://localhost:8000`; the site is the default site, so any Host works.
Login `Administrator` / `admin`.

If `/home/user/src/frappe-16.32.0` (a clone at the tag) does not exist, `bench init` clones Frappe from GitHub instead.

## Lock

Use `flock -o /tmp/ins-bench.lock <command>` (`-o` keeps the lock descriptor away from the command). Without `-o`, daemons started by the command (PostgreSQL, Redis, web) inherit the descriptor and hold the lock for ever.

## GitHub Actions runner

`sudo -E flock -o /tmp/ins-bench.lock tools/bench/build_test_bench.sh`, then `tools/bench/b.sh <command>`. The gate needs `PW_NODE_PATH=/opt/pw-node/node_modules PIXDIFF_PYTHON=/opt/pixvenv/bin/python` (from `ci_prereqs.sh`) and `env PATH="$PATH"` after sudo so Node 24 is found. `as_bench` unsets `SUDO_USER`: yarn otherwise reads the invoking user's home.
