# Run rules for Phases 3 to 5 (lead)

Binding for every agent dispatched after 2026-10-13 15:45 UTC. The owner set a hard deadline of 20:40 UTC and authorised more parallel agents; these rules keep parallel work safe.

## Time boxes (check `date -u` regularly)

| Work | Report to the lead by (UTC) |
|---|---|
| Phase 2 fix round (ADR 0010) | 16:25 |
| Phase 3 P0 (all agents) | 17:40 |
| Phase 3 review fixes | 18:30 |
| Phase 4 (P1, P2, proof) | 19:15 |
| Phase 5 (documentation, hostile review) | 20:10 |

At your time box, stop and report what is done, what is verified, and what is missing. A partial, honest report on time beats a complete one late.

## Files

- You write only the files named in your dispatch. If you need another file, say so in your report; do not edit it.
- Never commit or push. The lead commits.
- No `!important` (if one is truly unavoidable, stop and explain in your evidence; the lead decides). Logical properties only. Never set frappe-datatable row or cell height. No literal colours outside generated files: use `var(--ins-*)` or the mapped Frappe variables.
- Every structural Frappe selector you depend on goes in your evidence file under "Selectors depended on", with the 16.32.0 source file and line (the scribe builds `docs/DEPENDENCY_MANIFEST.md` from these).
- Every new user-visible source string goes in your evidence file under "Strings" (the scribe writes `ar.csv`).
- Evidence goes in `docs/team/evidence/phase3/<your-area>/` (or the folder your dispatch names).

## The bench (shared by everyone)

- Bench `/home/user/frappe-bench` (symlink to `/home/frappe/frappe-bench`), site `midad.test`, `http://localhost:8000`, Administrator / `admin` (test only).
- Bench commands run as the `frappe` user: `runuser -u frappe -- bash -lc 'cd /home/user/frappe-bench && PATH=/opt/node24/bin:$PATH bench --site midad.test <command>'`.
- **Build lock.** Every `bench build`, `migrate`, `install-app`, `uninstall-app`, `restart-web` (`tools/bench/start_services.sh restart-web`) and the gate script runs under the lock: `flock /tmp/ins-bench.lock <command>`. Build only this app: `bench build --app institutional_theme`.
- Only the agent named in its dispatch may run `migrate`, install, uninstall, `restart-web` or the gate script. Everyone else asks the lead.
- **Iterate without building.** Compile your SCSS with the bench's own Sass (`/home/user/frappe-bench/apps/frappe/node_modules/sass`, same load paths as Frappe's esbuild), run `rtlcss` (`apps/frappe/node_modules/rtlcss`) for RTL pages, and inject the result into the live desk with Playwright `page.addStyleTag({ content })`. The live desk gives the real core CSS and the real DOM. Final screenshots use the real build once the hooks are enabled.
- **Browser.** Playwright with the pre-installed Chromium (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; never `playwright install`). `tests/browser/package.json` already provides `playwright-core`.
- **Users.** Create your own test users (prefix with your area, for example `css-list-ar-dark@midad.test`, System Manager, `send_welcome_email: 0`) through the REST API as Administrator. Never change Administrator's language or theme: other agents use it.
- **Data.** Fictional only, no real institutions or people. `tools/bench/test_fixtures.py` (backend) creates the shared records; until it exists, create the minimum you need yourself, with fictional Arabic and English names.

## Evidence standard

VERIFIED (you ran it or opened the line), COMPUTED, or ASSUMED. Anything not run is reported as not verified, in those words.
