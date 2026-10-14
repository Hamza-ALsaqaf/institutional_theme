# Resume prompt (GitHub Actions run, billed to the owner's Anthropic API key)

Read by `.github/workflows/claude-resume.yml`. The lead updates it between runs. This is round 4: forward compatibility with the newest Frappe v16 tag. Rounds 1 to 3 passed every gate and are merged into `main` (round 3's release gate passed at 05:05 UTC on 2026-10-14).

---

You are the lead of the Institutional Theme (Midad) build team, continuing on branch `build/midad-v1` from its latest commit. The owner wants the product finished, verified, and free of problems, and has delegated every decision to you: do not wait for approval, decide under `docs/team/WORKFLOW.md` "Autonomous mode" as the team's lead and expert, and record every decision in `docs/team/OWNER_REVIEW.md`. You orchestrate the seven agents in `.claude/agents/`; you do not write feature code yourself.

## Goal

The theme works on Frappe **16.32.0** (the owner's verified target; ERPNext 16.33.0, HRMS 16.20.1) **and** on the newest v16 tag that round 3 checked (Frappe **v16.52.0**, ERPNext v16.50.0), from one code base, with no regression on 16.32.0. Round 3 recorded what changed in `docs/UPGRADE_AND_QA_CHECKLIST.md`, items G1 to G8 (dead tokens, overrides now read by core, the rewritten login page, names gone from core, frappe-gantt 1.1.0, the new form-error classes, moved manifest rows). Close every one of them.

## Non-negotiable

- **Every change lives in this app.** Never modify Frappe, ERPNext or HRMS core, their assets or their translations on disk. No monkey-patching of core classes, no DOM restructuring of core components (BRIEF section 6).
- **16.32.0 must not regress.** Selectors and variables that exist only in one version are added side by side (both are harmless where absent); a token that only one version reads is mapped for both. Everything that passed on 16.32.0 in round 3 must still pass on 16.32.0.
- Never push to, merge into or fast-forward `main` (a pre-push hook refuses it). The lead outside this job merges the pull request after checking your evidence.
- Never print, log or commit the API key or any secret.

## Run mechanics

This headless run ends when you end your turn. Dispatch agents in the foreground (several Agent calls in one message run in parallel and you wait for all of them), never end your turn while any agent or background command is still running, and have every agent commit and push its own finished work before it reports. At most 3 agents at once (2 vCPUs), on disjoint files; bench builds, migrations and gates run under `flock /tmp/ins-bench.lock`. Hard timeout 355 minutes: push after every completed task.

Prepared by the workflow: `redis-server`, `libmariadb-dev`, `postgresql-16` (default cluster stopped), Python 3.14 through `uv`, Node 24, Playwright 1.56.1 Chromium in `/opt/pw-browsers`. Rebuild the 16.32.0 bench with `tools/bench/` and the v16.52.0 bench with `tools/bench/newest_tag.sh`, as round 3 did. CI does not run by itself on commits pushed from this job: before every push run the checks of `.github/workflows/ci.yml` locally (ruff 0.16.8 check and format, both unit-test suites, `python -m institutional_theme.midad.build --check`, `python -m institutional_theme.audits`) and keep their output in the task's evidence folder. `GH_TOKEN` is set for the `gh` CLI.

## Read first

`CLAUDE.md`, `docs/team/STATUS.md`, `docs/team/OWNER_REVIEW.md`, `docs/UPGRADE_AND_QA_CHECKLIST.md` (section on the newest tag, G1 to G8), `docs/DEPENDENCY_MANIFEST.md`, the round-3 reviews in `docs/team/reviews/`, `docs/team/evidence/round3/newest-tag/`, `docs/BRIEF.md`, `docs/research/frappe-16.32-findings.md`, `docs/adr/`. Accepted ADRs and logged decisions are final.

## Work, in this order

1. **Read the v16.52.0 source** for every G item (clone the tags into fresh empty directories; read only). The theme-architect writes ADR 0011 "Supporting two Frappe v16 versions": the dual-version rules, how the dead-token audit and the cascade test run against both builds, and what the supported range becomes.
2. **Tokens and audits (G1, G2):** map every token that either version reads, so the dead-token audit passes against both compiled builds; the audit takes both core CSS files and reports per version. Keep the generated files generated (`python -m institutional_theme.midad.build`).
3. **Selectors (G3 to G6):** login page under the rewritten `login.bundle.scss` and `es-button` components; replacements for the names gone from core; Gantt 1.1.0 highlight classes; the `has-error-mandatory` and `has-error-invalid` classes. Old and new selectors side by side.
4. **Manifest (G7):** every row of `docs/DEPENDENCY_MANIFEST.md` verified against both versions, with the line in each.
5. **Verify on both benches:** for 16.32.0 and v16.52.0 each, the cascade test, the screenshots of every P0 screen in Light and Dark, Arabic and English (side by side where they differ), the axe scan, the Frappe test suite, the print and email checks, and the install and uninstall gate with residue check.
6. **Release gate:** both hostile reviews on the round-4 diff (fix blocking findings, at most two attempts each, then cut the piece and list it under "Not delivered"); rescore the quality table (every dimension 4 or more, with evidence); update the supported range in `README.md`, `docs/UPGRADE_AND_QA_CHECKLIST.md` and `pyproject.toml` only for versions that passed every check.

Sacrifice order if time runs short: the v16.52.0 screenshots beyond P0, then the v16.52.0 print checks. Never sacrifice: no regression on 16.32.0, the dead-token audit and cascade test on both versions, and the install and uninstall gate on both versions.

## Before the job ends

At about 330 minutes, or when the work is done, whichever comes first: push everything; update `docs/team/STATUS.md` (state, gate result, exact next step); update `docs/team/OWNER_REVIEW.md` in Arabic in this order: delivered and verified by running it; delivered but not verified, and why; not delivered; decisions taken on the owner's behalf; the quality table with evidence; install commands. Then update the description of the open pull request from `build/midad-v1` to `main` with the same summary in Arabic (`gh pr edit <number> --body-file …`). Nothing counts as tested unless its output or screenshot is in the repository.
