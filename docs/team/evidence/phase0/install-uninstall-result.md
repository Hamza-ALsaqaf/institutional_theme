# Phase 0 gate: install and uninstall leave the stock look unchanged

Result: **PASS** (VERIFIED by running; all output files are in this folder).

Site `midad.test` on Frappe 16.32.0 + ERPNext 16.33.0, PostgreSQL 16, setup wizard completed, viewport 1366x768,
Chromium from `/opt/pw-browsers` driven by Playwright 1.56.1. The app was hook-free at the time (`hooks.py` fully commented).
Everything was run by `tools/bench/gate_install_uninstall.sh`; the table is `gate-commands.tsv`.

## Commands, exit codes, durations

| Step | Command (run as the `frappe` user inside `/home/user/frappe-bench`) | Exit | Seconds | Output |
|---|---|---|---|---|
| clean start | `bench --site midad.test uninstall-app institutional_theme --yes --no-backup` (a previous run had left the app installed) | 0 | 3.3 | `preclean-uninstall.log` |
| before | `bench --site midad.test list-apps` | 0 | 1.8 | `list-apps-before.log` (frappe, erpnext only) |
| before | `node tools/bench/capture.mjs before ...` | 0 | 7.7 | `assets-before.txt`, `before-login.png`, `before-todo.png` |
| install | `bench --site midad.test install-app institutional_theme` | 0 | 4.1 | `install.log` |
| installed | `node tools/bench/capture.mjs installed ...` | 0 | 8.3 | `assets-installed.txt`, `installed-*.png` |
| uninstall | `bench --site midad.test uninstall-app institutional_theme --yes --no-backup` | 0 | 3.2 | `uninstall.log` |
| after | `node tools/bench/capture.mjs after-uninstall ...` | 0 | 8.1 | `assets-after-uninstall.txt`, `after-uninstall-*.png` |
| reinstall (leave installed) | `bench --site midad.test install-app institutional_theme` | 0 | 4.5 | `reinstall.log` |
| final | `bench --site midad.test list-apps` | 0 | 1.9 | `list-apps-final.log` (app installed, 0.1.0) |

## Asset lists

`assets-before.txt`, `assets-installed.txt`, `assets-after-uninstall.txt` list every `<link rel=stylesheet>` and
`<script src>` in the raw server HTML of `/login` (logged out) and `/app` (logged in as Administrator), the `data-theme`
attributes in that HTML, and the live-DOM values after `/app/todo` rendered. `assets-diff.txt` compares the three
(first line, the label, excluded): **all three comparisons are identical**. `data-theme="light"` and
`data-theme-mode="light"` appear on the desk in all three; `/login` has none.

## Screenshots, pixel diff (`pixel-diff.txt`, tool `tools/bench/pixel_diff.py`)

| Pair | Differing pixels |
|---|---|
| before vs installed, `/login` | 0 |
| before vs after-uninstall, `/login` | 0 |
| before vs installed, `/app/todo` | 0 |
| before vs after-uninstall, `/app/todo` | 0 |

## Limits of this evidence

- The app ships no hooks yet, so "unchanged" is expected; this gate proves install, uninstall and reinstall work and
  that the harness detects a change. Re-run `tools/bench/gate_install_uninstall.sh` after hooks are added (the stock
  look will then differ while installed, and must return to identical after uninstall).
- Uninstall output shows only Module Def, Desktop Icon and Workspace Sidebar removal; no settings exist yet, so
  orphan-setting cleanup is NOT verified.
- Realtime (socket.io) is not running in this bench; the browser logs 404 polling errors for it. Desk screenshots are
  unaffected.
- Light mode only; Arabic/RTL and dark were not captured at this phase.
