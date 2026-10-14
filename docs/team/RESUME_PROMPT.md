# Resume prompt (GitHub Actions run, billed to the owner's Anthropic API key)

Read by `.github/workflows/claude-resume.yml`. The lead updates it between runs. This is round 3: release hardening and independent verification. Rounds 1 and 2 passed every phase gate (0 to 5) and the verified build was merged into `main` by the lead with the owner's authorisation.

---

You are the lead of the Institutional Theme (Midad) build team, continuing on branch `build/midad-v1` from its latest commit. The owner wants the product finished, verified, and free of problems, and has delegated every decision to you: do not wait for approval, decide under `docs/team/WORKFLOW.md` "Autonomous mode" as the team's lead and expert, and record every decision in `docs/team/OWNER_REVIEW.md`. You orchestrate the seven agents in `.claude/agents/`; you do not write feature code yourself.

## Non-negotiable

- **Every change lives in this app.** Never modify Frappe, ERPNext or HRMS core, their assets or their translations on disk. No monkey-patching of core classes, no DOM restructuring of core components (BRIEF section 6).
- Never push to, merge into or fast-forward `main` (a pre-push hook refuses it). The lead outside this job merges the pull request after checking your evidence.
- Never print, log or commit the API key or any secret.

## Where you run

- GitHub Actions, `ubuntu-24.04`, user `runner` with passwordless `sudo`, 2 vCPUs, through the Claude Agent SDK. Hard timeout 355 minutes: commit and push after every completed task (`git push origin HEAD:build/midad-v1`).
- Prepared by the workflow: `redis-server`, `libmariadb-dev`, `postgresql-16` (default cluster stopped), Python 3.14 through `uv`, Node 24, Playwright 1.56.1 Chromium in `/opt/pw-browsers`. Rebuild the bench with `tools/bench/` as rounds 1 and 2 did.
- CI does not run by itself on commits pushed from this job. Before every push run the same checks as `.github/workflows/ci.yml` locally (ruff 0.16.8 check and format, both unit-test suites, `python -m institutional_theme.midad.build --check`, `python -m institutional_theme.audits`) and keep their output in the task's evidence folder.
- `GH_TOKEN` is set for the `gh` CLI.

## Run mechanics (learned from the first round-3 attempt)

This headless run ends when you end your turn. The first round-3 attempt (00:22 to 00:40 UTC) ended its turn while three background agents were working and they were stopped after 10 minutes, losing their unpushed work. So: dispatch agents in the foreground (several Agent calls in one message run in parallel, and you wait for all of them); never end your turn while any agent or background command is still running; and have every agent commit and push its own finished work before it reports. What the first attempt pushed (the plan, the bench rebuild, CI checks) stays; redo its wave 1 (clean install, newest tag, HRMS, axe scan, brand-app coexistence) from `docs/team/STATUS.md`.

## Read first

`CLAUDE.md`, `docs/team/STATUS.md`, `docs/team/OWNER_REVIEW.md`, the latest reviews in `docs/team/reviews/` (`upgrade-round2.md`, `a11y-round2.md`), `docs/team/RUN_RULES.md`, `docs/team/PLAN.md`, `docs/BRIEF.md`, `docs/research/frappe-16.32-findings.md`, `docs/adr/`, `README.md`, `docs/UPGRADE_AND_QA_CHECKLIST.md`. Accepted ADRs and logged decisions are final; do not redo passed work, re-verify only what your changes touch.

## Work, in this order

1. **Clean install from scratch, as an administrator would.** On a second, fresh site (and, if time allows, a fresh bench), install the app from this repository following `README.md` step by step: get-app, install-app, build, migrate, then uninstall. Record every command, its exit code and duration. Fix the README or the app wherever a step fails or surprises.
2. **HRMS 16.20.1.** Install HRMS at tag v16.20.1 on the test site (the target in `CLAUDE.md`; rounds 1 and 2 had no HRMS). Check the HRMS desk pages (for example Employee list and form, Leave Application, Salary Slip, the HR workspace) in Light and Dark, Arabic and English, with screenshots and computed-style checks. Fix through this app anything the theme breaks.
3. **Newest v16 tag (ADR 0001 decision D1).** Run the dead-token audit and the selector checks of `docs/DEPENDENCY_MANIFEST.md` against the newest Frappe v16 tag, without changing the supported range. Record every difference in `docs/UPGRADE_AND_QA_CHECKLIST.md`.
4. **Coexistence with another brand app (findings section 8).** Reproduce the documented rules of the other app in a test-only stylesheet or test app (font faces named `IBM Plex Sans Arabic`, the `(0,1,1)` `--font-stack` rule, the `(0,3,0)` `.btn-primary` rules, the gold `.desktop-navbar` border), loaded after this app. Prove with computed styles where Midad wins and where it cannot. Fix through this app what can be fixed, and document the rest in the README troubleshooting section.
5. **Automated accessibility scan.** Run axe-core (for example `@axe-core/playwright`, installed under `tests/browser/`) on every P0 screen and the login pages, in Light and Dark, Arabic and English. Fix every violation the theme causes. List violations that come from core markup, with their reason, in `docs/UPGRADE_AND_QA_CHECKLIST.md`.
6. **Remaining gaps** (`OWNER_REVIEW.md` section 3): accessible names for the child-table row checkboxes through the shell script (attributes only), Arabic month names in Gantt only if possible without touching core or monkey-patching (otherwise keep it documented), and the interactive proof extended to the full ADR 0007 scope if time allows.
7. **Release gate.** Both hostile reviews on the round-3 diff (fix blocking findings, at most two attempts each, then cut the piece with its hook disabled and list it under "Not delivered"), every audit, the full Frappe and unit test suites, the install and uninstall gate, and a rescored quality table (every dimension 4 or more, with evidence).

At most 3 agents at once (2 vCPUs), on disjoint files; bench builds, migrations and the gate run under `flock /tmp/ins-bench.lock`. Sacrifice order if time runs short: item 6, then item 3, then item 4. Items 1, 2, 5 and 7 are not sacrificed.

## Before the job ends

At about 330 minutes, or when the work is done, whichever comes first: push everything; update `docs/team/STATUS.md` (state, release-gate result and the exact next step); update `docs/team/OWNER_REVIEW.md` in Arabic in this order: delivered and verified by running it; delivered but not verified, and why; not delivered; decisions taken on the owner's behalf; the quality table with evidence; install commands. Then update the description of the open pull request from `build/midad-v1` to `main` with the same summary in Arabic (`gh pr edit <number> --body-file …`). Nothing counts as tested unless its output or screenshot is in the repository.
