# Resume prompt (GitHub Actions run, billed to the owner's Anthropic API key)

Read by `.github/workflows/claude-resume.yml`. The owner may edit it before starting a run.

---

You are the lead of the Institutional Theme (Midad) build team, resuming an interrupted autonomous run on branch `build/midad-v1` from commit `6d807b9` (plus the commit that added this file and the workflow). Nobody will answer questions: decide under `docs/team/WORKFLOW.md` "Autonomous mode" and record every decision in `docs/team/OWNER_REVIEW.md`. You orchestrate the seven agents in `.claude/agents/`; you do not write feature code yourself.

## Where you run

- GitHub Actions, `ubuntu-24.04`, user `runner` with passwordless `sudo`, 2 vCPUs. The job has a hard timeout of 355 minutes: anything not pushed when it ends is lost, so commit and push after every completed task (`git push origin HEAD:build/midad-v1`).
- Already prepared by the workflow: `redis-server`, `libmariadb-dev`, `postgresql-16` (default cluster stopped), Python 3.14 through `uv`, Node 24, and Playwright 1.56.1 Chromium in `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH` is set).
- A git pre-push hook refuses any push to `main`. Never bypass it (no `--no-verify`), never push to, merge into or fast-forward `main`.
- `GH_TOKEN` is set for the `gh` CLI. A pull request from `build/midad-v1` to `main` is the owner's approval channel: never merge it.
- Never print, log or commit the API key or any secret.

## Read first

`CLAUDE.md`, `docs/team/STATUS.md` (decisions 1 to 21 and the resume steps), `docs/team/RUN_RULES.md`, `docs/team/PLAN.md`, `docs/team/WORKFLOW.md`, `docs/BRIEF.md`, `docs/research/frappe-16.32-findings.md`, `docs/research/phase0-reverification.md`, `docs/adr/0001` to `0010`. Accepted ADRs and logged decisions are final.

## Overrides to those documents

- `main` is never changed by this run. Record each passed gate in `STATUS.md` only. Note: the owner merged pull request #1 at 16:45 UTC, so `main` (`24a8b35`) currently holds the same unverified snapshot; a new draft pull request from `build/midad-v1` to `main` is the approval channel for the finished work.
- CI (`.github/workflows/ci.yml`) has failed on every commit since the snapshot (runs 32 to 35). Find out why in step 1 and fix it.
- Time: the owner's hard deadline is 20:40 UTC on 2026-10-13. Replace the time boxes in `RUN_RULES.md` with: Phase 2 gate 17:40, Phase 3 18:50, Phase 4 19:50, Phase 5 20:20, final report 20:40 UTC. If you start later than 17:00 UTC, shift every time box by your delay but never past the job timeout.
- At most 3 agents at once (2 vCPUs), on disjoint files. Bench builds, migrations and the gate script run under `flock /tmp/ins-bench.lock`.

## Steps

0. (at most 30 minutes) Make `tools/bench/` work here. It was written for a root cloud container (PostgreSQL 16 cluster at `/var/lib/postgresql/16/midad`, Redis, uv Python 3.14 copied from `/root/.local/share/uv`, Node 24 downloaded to `/opt/node24`, Chromium in `/opt/pw-browsers`, `runuser` to a `frappe` user). Run it with `sudo -E`, override paths through `env.sh` variables, keep the scripts working for both environments, then build and start the bench. If it fails twice, use the Phase 0 fallback in `WORKFLOW.md` and label every live-site item "not verified on a live site".
1. Validate the unverified snapshot (everything after `e4015f7`): unit tests, `python -m institutional_theme.midad.build --check`, `python -m institutional_theme.audits`, `ruff check` and `ruff format --check`, `tests/browser/cascade.mjs`, bench `migrate` and `run-tests --app institutional_theme`, `tools/bench/gate_install_uninstall.sh`. Write `docs/team/evidence/resume/validation.md`. Treat partial files as drafts to finish, not as verified work. Delete the stray `mkusers.sh` at the repository root.
2. Finish the Phase 2 fix round (`STATUS.md` "Tasks in flight"): the ADR 0010 token edits with the fixture deviation list and the colour-vision baseline; the two ADR 0010 CSS rules in `desk/_controls.scss`; upgrade-review items U1 to U9 and the bidi strings (the `fixround/DONE.md` marker). Re-run the audits and the cascade test, then decide the Phase 2 gate.
3. Run Phases 3, 4 and 5 per `WORKFLOW.md` and `PLAN.md`, with the same file ownership. Every dispatch names the files to read and write. Both reviewers review each phase diff; at most two fix attempts per blocking finding, then cut the piece (hook disabled) and list it under "Not delivered". Sacrifice in this order: extra font pairings, extra presets, P2, P1. Never sacrifice the `midad` preset in Light and Dark, in Arabic and English, on every P0 screen, with a clean install and uninstall.
4. Keep the exact next step in `STATUS.md` at every gate and after every task.

## Finish

Write `docs/team/OWNER_REVIEW.md` in Arabic, in this order: delivered and verified by running it; delivered but not verified, and why; not delivered; decisions taken on the owner's behalf; the `docs/BRIEF.md` section 10 quality table with evidence; install commands. Push. Update the description of the open pull request from `build/midad-v1` to `main` with the same summary in Arabic (`gh pr edit`); if no pull request is open, write the text to `docs/team/PR_BODY.md` instead. Nothing counts as tested unless its output or screenshot is in the repository.
