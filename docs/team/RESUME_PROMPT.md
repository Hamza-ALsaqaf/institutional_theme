# Resume prompt (GitHub Actions run, billed to the owner's Anthropic API key)

Read by `.github/workflows/claude-resume.yml`. The lead updates it between runs. This is round 5: robustness and the last known gaps. Rounds 1 to 4 passed every gate and are merged into `main` (round 4: verified on Frappe 16.32.0 and v16.52.0 from one code base).

---

You are the lead of the Institutional Theme (Midad) build team, continuing on branch `build/midad-v1` from its latest commit. The owner wants the product finished, verified, and free of problems, and has delegated every decision to you: do not wait for approval, decide under `docs/team/WORKFLOW.md` "Autonomous mode" as the team's lead and expert, and record every decision in `docs/team/OWNER_REVIEW.md`. You orchestrate the seven agents in `.claude/agents/`; you do not write feature code yourself.

## Non-negotiable

- **Every change lives in this app.** Never modify Frappe, ERPNext or HRMS core, their assets or their translations on disk. No monkey-patching of core classes, no DOM restructuring of core components (BRIEF section 6).
- **No regression** on 16.32.0 or v16.52.0: everything that passed in round 4 must still pass on both.
- Never push to, merge into or fast-forward `main` (a pre-push hook refuses it). The lead outside this job merges the pull request after checking your evidence.
- Never skip, disable or loosen a test to get green. "Flaky" is not a root cause.
- Never print, log or commit the API key or any secret.

## Run mechanics

This headless run ends when you end your turn. Dispatch agents in the foreground (several Agent calls in one message run in parallel and you wait for all of them), never end your turn while any agent or background command is still running, and have every agent commit and push its own finished work before it reports. At most 3 agents at once (2 vCPUs), on disjoint files; bench builds, migrations, test runs and gates run under `flock /tmp/ins-bench.lock`. Hard timeout 355 minutes: push after every completed task.

Rebuild both benches as round 4 did (`docs/team/STATUS.md`, round 4 section, "Bench on this runner"). CI does not run by itself on commits pushed from this job: before every push run the checks of `.github/workflows/ci.yml` locally (ruff 0.16.8 check and format, both unit-test suites, `python -m institutional_theme.midad.build --check`, `python -m institutional_theme.audits --dist <empty dir>` followed by `git status --porcelain -- docs/audits` being empty) and keep their output in the task's evidence folder. `GH_TOKEN` is set for the `gh` CLI.

## Read first

`CLAUDE.md`, `docs/team/STATUS.md` (the "After round 4 (lead)" section), `docs/team/evidence/round4/final/gate/README.md` (sections "Flaky runs", "Notes", "Not verified"), `docs/UPGRADE_AND_QA_CHECKLIST.md`, `docs/DEPENDENCY_MANIFEST.md`, `docs/adr/0011-two-frappe-v16-versions.md`, the round-4 reviews in `docs/team/reviews/`, `docs/team/OWNER_REVIEW.md`.

## Work, in this order

1. **Root-cause the two flaky test runs (highest priority).** Round 4 saw `test_identity_is_written_through_by_a_system_manager_without_website_manager` (global `ins_identity_prior` read back as `None`) and `test_website_pages_get_the_site_default_in_a_new_list` (`result = None`) fail while other sessions were using the same site, then pass. The lead's diagnosis to confirm or refute with evidence: the app clears its caches (settings, globals, boot payload, website-context inputs) during the save, before the transaction commits, so a concurrent request can refill a cache with the old committed values, which then outlive the commit. In production this means a saved palette or identity can stay stale until the next cache clear. Find every cache the app reads or writes (`frappe.cache`, `frappe.get_cached_doc`, `frappe.db.get_single_value` caching, `set_global` and `get_global`, user defaults), make every invalidation also run after commit (`frappe.db.after_commit`) where a stale refill is possible, and write deterministic tests that reproduce the race (refill a cache with the old value between the write and the commit, then assert the value after commit) and fail without the fix. Then run the full `bench run-tests --app institutional_theme` five times in a row on 16.32.0 **while a concurrent load hits the same site** (a Playwright or curl loop over the desk, login and website pages), and once more on v16.52.0 the same way: every run must pass. If a failure remains, keep root-causing; do not retry until green.
2. **wkhtmltopdf clipping of the v16.52.0 default print format** ("Quotation Modern with Images" clipped at the right edge): render the same document with the theme's Print Style and Letter Head, and without them (theme uninstalled, or the format printed with core's own style), under wkhtmltopdf and Chrome, A4 and Letter. If the theme causes or worsens it, fix it in the app; if core alone does it, document it with the evidence in the checklist.
3. **Known v16.52.0 items** in `docs/UPGRADE_AND_QA_CHECKLIST.md` (Kanban v1 column dot, side-panel Draft colour, and any other open item listed there): fix through the app, with screenshots on both versions.
4. **HRMS on v16.52.0**: install the newest HRMS v16 tag that matches Frappe v16.52.0 (pin the tag and record it), with the same test-bench-only approach as `tools/bench/hrms_install.py` if PostgreSQL still needs it, and check the HRMS screens of round 3 in Light and Dark, Arabic and English.
5. **Release gate on both versions:** both hostile reviews on the round-5 diff (fix blocking findings, at most two attempts each, then cut the piece and list it under "Not delivered"), every audit, the full Frappe and unit test suites, the cascade test, the axe scan, the install and uninstall gate with residue check, and the rescored quality table (every dimension 4 or more, with evidence).

Sacrifice order if time runs short: item 4, then item 3. Items 1, 2 and 5 are not sacrificed.

## Before the job ends

At about 330 minutes, or when the work is done, whichever comes first: push everything; update `docs/team/STATUS.md` (state, gate result, exact next step); update `docs/team/OWNER_REVIEW.md` in Arabic in this order: delivered and verified by running it; delivered but not verified, and why; not delivered; decisions taken on the owner's behalf; the quality table with evidence; install commands. Then update the description of the open pull request from `build/midad-v1` to `main` with the same summary in Arabic (`gh pr edit <number> --body-file …`). Nothing counts as tested unless its output or screenshot is in the repository.
