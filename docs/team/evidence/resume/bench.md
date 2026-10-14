# Bench on the GitHub Actions runner (bench agent, 2026-10-13)

Result: VERIFIED. Bench `/home/frappe/frappe-bench` (symlink `/home/user/frappe-bench`), site `midad.test`, Frappe 16.32.0, ERPNext 16.33.0, PostgreSQL 16, this app installed (gate leaves it installed), web on :8000.
`curl -s -H 'Host: midad.test' localhost:8000/api/method/ping` returned `{"message":"pong"}` (VERIFIED, 19:02 UTC and again after the gate).

## Why the earlier attempt hung (VERIFIED)
1. `yarn --version` as the bench user failed with EACCES on `/home/runner/.yarnrc`: under `sudo`, yarn resolves the home of `SUDO_USER`. Fix: `as_bench` in `env.sh` now unsets `SUDO_USER SUDO_UID SUDO_GID SUDO_COMMAND`.
2. The PostgreSQL started by the first instance under `flock` inherited the lock descriptor, so every later `flock /tmp/ins-bench.lock` waited for ever (`fuser` showed the postgres processes holding it). Fix: use `flock -o`; PostgreSQL was stopped with `pg_ctl stop -m fast` and restarted by the script.

## Changes (tools/bench/ only)
- `env.sh`: SUDO_* unset in `as_bench`.
- `b.sh` (new): one bench command for the site as the bench user under `flock -o`.
- `README.md`: lock rule, runner section.

## Commands and durations (VERIFIED, logs `bench-build-3..6.log`)
Build, each as `sudo -E flock -o /tmp/ins-bench.lock tools/bench/build_test_bench.sh <steps>`:
- `preflight user cli postgres`: 3 s
- `bench services site`: 66 s (bench init 45 s from the local clone, new-site 21 s)
- `erpnext wizard app`: 98 s (ERPNext 77 s, wizard 19 s, app 2 s)
- `build`: 16 s, then web restarted
Total about 3 minutes of build. ERPNext installed; WITH_ERPNEXT stayed 1.

Bench command prefix (also in `/tmp/ins-bench-ready`):
`sudo -E flock -o /tmp/ins-bench.lock runuser -u frappe -- env HOME=/home/frappe PATH=/opt/node24/bin:/home/frappe/.local/bin:/usr/local/bin:/usr/bin:/bin bash -c 'cd /home/user/frappe-bench && bench --site midad.test <command>'`
Shorthand: `tools/bench/b.sh <command>` (same thing).

## Migrate (`migrate-pre.log`, 15 s)
`bench --site midad.test migrate` ran with the app not yet installed: completed, exit 0 (VERIFIED). Not re-run after the gate (the gate's install-app does its own migrate).

## Tests
`tools/bench/b.sh run-tests --app institutional_theme`:
- `run-tests-1.log`, app NOT installed on the site: 44 site-bound tests FAILED with 50 errors, all "DocType Institutional Theme Settings not found / Module import failed" (expected: the DocType is created by install-app; install first). The 140 pure tests were OK.
- `run-tests-2.log`, app installed (after the gate), 41 s: 88 tests (site-bound) with 1 FAILURE and the 140 pure tests OK.
  FAIL `test_audit_text_uses_labels_not_token_names` (`institutional_theme/doctype/institutional_theme_settings/test_institutional_theme_settings.py` line 323). The assertion `assertNotIn(" border ", text)` matches the label text "Input border on Hover background" produced by the audit summary. Text under test: `426 of 426 contrast pairs pass. Tightest: Input border on Hover background, Light mode, 3.04:1 ...`. The token name `border` is also an ordinary English word in the label, so the test, not the product text, is probably wrong. Not fixed (not my area).
  The app code was edited by other agents during my run (git status shows modified hooks.py and install.py), so this run is of the working tree at 19:05 UTC.

## Gate (`tools/bench/gate_install_uninstall.sh`, 42 s, evidence in `gate/`, `gate-run.log`)
Run as `sudo -E flock -o /tmp/ins-bench.lock env PATH="$PATH" tools/bench/gate_install_uninstall.sh docs/team/evidence/resume/gate` with `PW_NODE_PATH=/opt/pw-node/node_modules PIXDIFF_PYTHON=/opt/pixvenv/bin/python`.
- Every step exit 0: list-apps, capture before, install, doctype present after install, capture installed, seed-state, uninstall, doctype gone after uninstall, residue, capture after-uninstall, reinstall, list-apps.
- Residue after uninstall: `RESIDUE: none` (Website Settings app_name back to "Frappe", logos/favicon null).
- Pixel diff before vs after-uninstall: login and todo identical (0 differing pixels). Before vs installed: login identical, todo differs by 21.3 percent (the theme is active; expected).
- Asset diff before vs installed: adds `ins_desk.bundle` CSS and `ins_shell.bundle` JS only. Before vs after-uninstall: see `gate/assets-diff.txt`.
- App left installed: `list-apps` shows frappe 16.32.0, erpnext 16.33.0, institutional_theme 0.1.0.

## Not verified
- A from-scratch run of all steps in one command (steps were run in groups).
- Whether `bench build` output is the same after the other agents' later hooks.py edits (the web server was not restarted after them; run `tools/bench/start_services.sh restart-web` when hooks.py changes).
- `migrate` with the app installed.
