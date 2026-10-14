# Round 3 dispatch rules (lead, 2026-10-14, second attempt)

Binding for every agent dispatched in round 3. Scope: `docs/team/RESUME_PROMPT.md`. Ownership: `docs/team/PLAN.md` "Round 3". Earlier rules in `docs/team/RUN_RULES.md` apply except where this file differs.

## Differences from RUN_RULES

- **You commit and push your own finished work** before you report (the lead's job ends when its turn ends; unpushed work is lost). Stage only your own paths: `git add <your paths> && git commit -m "<prefix>: …" -- <your paths>`. If `.git/index.lock` exists, wait a few seconds and retry; never delete it while another git process runs. Then `git push origin HEAD:build/midad-v1`. Never push to `main`. End every commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, after a blank line.
- **Before each push** run `tools/ci/local_ci.sh docs/team/evidence/round3/<area>/ci-<n>.log` (the checks of `.github/workflows/ci.yml` on a clean export of HEAD, about 5 s) after committing, then commit that log too. If it fails because of your change, fix it before pushing.
- Stay in the foreground: do not leave background processes running when you report (except the bench services started by `tools/bench/start_services.sh`).
- **Time box:** report by the UTC time in your dispatch (check `date -u`). A partial, honest, pushed report on time beats a complete one late.

## Bench on this runner

- Built by the lead at the start of this attempt: `/home/frappe/frappe-bench` (symlink `/home/user/frappe-bench`), site `midad.test`, `http://localhost:8000` (Host header or `/etc/hosts` maps `midad.test`), Administrator / `admin`, PostgreSQL 16. Frappe 16.32.0, ERPNext 16.33.0, `institutional_theme` installed and built. Log: `docs/team/evidence/round3/bench2/`. If `curl -s localhost:8000/api/method/ping` does not answer pong, wait: the lead's build may still be running (`/tmp/r3/install.log` ends with `DONE` when finished).
- One bench command: `tools/bench/b.sh <args>` (bench user, under the lock `/tmp/ins-bench.lock`). Long multi-step work: `sudo flock -o /tmp/ins-bench.lock runuser -u frappe -- …`.
- On this runner `sudo` resets PATH: use `sudo env "PATH=$PATH" …` for the repository scripts. The runner exports `UV_CACHE_DIR=/home/runner/work/_temp/setup-uv-cache`, which the `frappe` user cannot read: unset it or point it at a directory the bench user owns (`env -u UV_CACHE_DIR` or `UV_CACHE_DIR=/home/frappe/.cache/uv`) for every bench or uv command run as `frappe` (this is why the first attempt's `bench get-app hrms` failed).
- Restart the web after Python or hooks changes: `sudo env "PATH=$PATH" flock -o /tmp/ins-bench.lock tools/bench/start_services.sh restart-web`.
- Playwright: `NODE_PATH=/opt/pw-node/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node <script>` (never `playwright install`). Pillow and numpy: `/opt/pixvenv/bin/python`.
- 2 vCPUs are shared by three agents: no parallel builds, keep headless browsers to one at a time per agent.

## Evidence

`docs/team/evidence/round3/<area>/`, with a `README.md` per area: what was run (commands, exit codes, durations), results labelled VERIFIED / COMPUTED / ASSUMED, "Selectors depended on" (16.32.0 file:line), "Strings" (new user-visible source strings for `ar.csv`), and what is not done. Screenshots as PNG, small (clip to the region that matters when possible).
