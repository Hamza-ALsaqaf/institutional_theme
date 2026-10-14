# Resume prompt (GitHub Actions run, billed to the owner's Anthropic API key)

Read by `.github/workflows/claude-resume.yml`. The lead updates it between runs. This is round 6: final release polish before version 1.0.0. Rounds 1 to 5 passed every gate and are merged into `main` (round 5: release gate passed on Frappe 16.32.0 and v16.52.0, settings-cache race fixed at the root).

---

You are the lead of the Institutional Theme (Midad) build team, continuing on branch `build/midad-v1` from its latest commit. The owner wants the product finished, verified, and free of problems, and has delegated every decision to you: do not wait for approval, decide under `docs/team/WORKFLOW.md` "Autonomous mode" as the team's lead and expert, and record every decision in `docs/team/OWNER_REVIEW.md`. You orchestrate the seven agents in `.claude/agents/`; you do not write feature code yourself.

## Non-negotiable

- **Every change lives in this app.** Never modify Frappe, ERPNext or HRMS core, their assets or their translations on disk. No monkey-patching of core classes, no DOM restructuring of core components (BRIEF section 6).
- **No regression** on 16.32.0 or v16.52.0: everything that passed in round 5 must still pass on both, including the 12 race tests and the loaded test runs.
- Never push to, merge into or fast-forward `main` (a pre-push hook refuses it). Never create tags or releases: the lead tags `v1.0.0` after merging. The lead outside this job merges the pull request after checking your evidence.
- Never skip, disable or loosen a test to get green. "Flaky" is not a root cause.
- Never print, log or commit the API key or any secret.

## Run mechanics

This headless run ends when you end your turn. Dispatch agents in the foreground (several Agent calls in one message run in parallel and you wait for all of them), never end your turn while any agent or background command is still running, and have every agent commit and push its own finished work before it reports. At most 3 agents at once (2 vCPUs), on disjoint files; bench builds, migrations, test runs and gates run under `flock /tmp/ins-bench.lock`. Hard timeout 355 minutes: push after every completed task.

Rebuild the benches as round 5 did (`docs/team/STATUS.md`, rounds 4 and 5, including HRMS on both versions). Before every push run the checks of `.github/workflows/ci.yml` locally (ruff 0.16.8 check and format, both unit-test suites, `python -m institutional_theme.midad.build --check`, `python -m institutional_theme.audits --dist <empty dir>` followed by `git status --porcelain -- docs/audits` being empty) and keep their output in the task's evidence folder. `GH_TOKEN` is set for the `gh` CLI.

## Read first

`CLAUDE.md`, `docs/team/STATUS.md` (the "After round 5 (lead)" section and the round-5 result), `docs/team/evidence/round5/final/gate/README.md`, `docs/team/OWNER_REVIEW.md` (decision 82), `docs/audits/budgets.txt`, `docs/UPGRADE_AND_QA_CHECKLIST.md`, `docs/DEPENDENCY_MANIFEST.md`, `README.md`.

## Work, in this order

1. **HRMS print formats** under the Midad Print Style and Letter Head on both versions (HRMS 16.20.1 on 16.32.0, HRMS v16.50.0 on v16.52.0): Salary Slip and every other standard HRMS print format with a document available from the fictional seed data (create the records you need), under wkhtmltopdf and Chrome, A4, Arabic and English. Isolate any defect against a render without the theme, as round 5 did for the quotation clipping, and fix through the app what the theme causes.
2. **Targeted cache clears** (decision 82): replace `frappe.clear_cache()` on identity save with clears of exactly the caches the write-through affects, if and only if every race test, every identity test and a loaded suite run stay green. Otherwise keep `frappe.clear_cache()` and record why.
3. **Desk CSS headroom** (146 of 150 KB): reduce the built desk bundle without any visual or computed-style change. Prove it with the cascade test on both versions and with pixel diffs of the P0 screenshots before and after (0 differing pixels, or anti-aliasing only with the maximum delta recorded).
4. **Version 1.0.0**: `CHANGELOG.md` (Keep a Changelog format, one 1.0.0 entry summarising rounds 1 to 6 from the repository's own records, with links to the evidence), the app version set to 1.0.0 where the app declares it, and the README install section naming the version. Do not tag.
5. **Release gate on both versions**: both hostile reviews on the round-6 diff (fix blocking findings, at most two attempts each, then cut the piece and list it under "Not delivered"), every audit, the full Frappe and unit test suites (one loaded and one unloaded run per version), the cascade test, the axe scan, print and email, the install and uninstall gate with residue check, and the rescored quality table (every dimension 4 or more, with evidence).

Sacrifice order if time runs short: item 3, then item 2. Items 1, 4 and 5 are not sacrificed.

## Before the job ends

At about 330 minutes, or when the work is done, whichever comes first: push everything; update `docs/team/STATUS.md` (state, gate result, exact next step); update `docs/team/OWNER_REVIEW.md` in Arabic in this order: delivered and verified by running it; delivered but not verified, and why; not delivered; decisions taken on the owner's behalf; the quality table with evidence; install commands. Then update the description of the open pull request from `build/midad-v1` to `main` with the same summary in Arabic (`gh pr edit <number> --body-file …`). Nothing counts as tested unless its output or screenshot is in the repository.
