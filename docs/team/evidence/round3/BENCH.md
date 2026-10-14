# Round 3 bench (GitHub Actions runner, 2026-10-14)

VERIFIED 00:31 UTC: bench rebuilt with `tools/bench/build_test_bench.sh` (`bench-build.log`, TOTAL 201 s, EXIT 0). The first attempt (`bench-build-attempt1.log`) failed because `/home/user` does not exist on the runner; the script now creates the symlink's parent. `install-app institutional_theme`, `build --app institutional_theme` and `restart-web` succeeded (`install.log`). `list-apps`: frappe 16.32.0, erpnext 16.33.0, institutional_theme 0.1.0. `/api/method/ping` returns pong; `/login` links `ins_web.bundle` and `ins_shell.bundle`.

Usage is unchanged from `docs/team/evidence/round2/BENCH.md`. Playwright: `NODE_PATH=/opt/pw-node/node_modules`, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` (from `tools/bench/ci_prereqs.sh`).

Note: `build_test_bench.sh` registers the app (`apps.txt`, editable install) but does not install it on the site; run `tools/bench/b.sh install-app institutional_theme` after it.
