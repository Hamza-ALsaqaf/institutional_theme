# Round 2 bench (GitHub Actions runner, 2026-10-13)

VERIFIED 21:36 UTC: bench rebuilt with `tools/bench/build_test_bench.sh` (log `bench-build.log`), app installed and built (`install.log`), `list-apps` shows frappe 16.32.0, erpnext 16.33.0, institutional_theme 0.1.0; `/api/method/ping` returns pong.

- Bench `/home/user/frappe-bench` (symlink to `/home/frappe/frappe-bench`), site `midad.test`, `http://midad.test:8000`, Administrator / `admin` (test only). ERPNext is installed.
- Frappe and ERPNext source at the pinned tags: `/home/user/frappe-bench/apps/frappe`, `/home/user/frappe-bench/apps/erpnext`.
- One bench command for the site, as the bench user, under the lock: `tools/bench/b.sh <args>` (for example `tools/bench/b.sh build --app institutional_theme`, `tools/bench/b.sh execute ...`, `tools/bench/b.sh run-tests --app institutional_theme`).
- Restart the web server after a `hooks.py` or Python change: `sudo -E env PATH="$PATH" flock -o /tmp/ins-bench.lock tools/bench/start_services.sh restart-web`.
- Playwright: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, module at `/opt/pw-node/node_modules/playwright-core` (`NODE_PATH=/opt/pw-node/node_modules`). Never run `playwright install`.
- Pillow and numpy: `/opt/pixvenv/bin/python`.
- sudo resets PATH: always `sudo -E env PATH="$PATH" ...`.
