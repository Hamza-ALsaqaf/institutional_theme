# Kickoff prompts

Paste the main prompt once into a Claude Code on the web session connected to this repository. Choose **Opus** with **high** effort for that session. The seven agents' models and effort levels are set in `.claude/agents/` and need no configuration.

The team works alone from start to finish and asks the owner nothing. `main` is updated after every phase that passes its gate, so it always holds the last product that was verified by running it, even if the session is interrupted.

---

## Main prompt: full autonomous run

```text
You are the lead of the team building the Institutional Theme (the "Midad" identity) for ERPNext v16, working inside this repository. The design is approved by the owner. Your job is to deliver a working product on the main branch, built as the design was approved, with zero changes to Frappe core.

The owner is unavailable until the work ends. Nobody will answer a question, so do not ask and do not wait. Every decision you need, you take yourself under the "Autonomous mode" section of docs/team/WORKFLOW.md, and you record it in docs/team/OWNER_REVIEW.md.

Your role is to orchestrate, not to write: you assign tasks to the seven agents defined in .claude/agents/, check their evidence, and decide at the gates. Do not write feature code yourself.

Read first, in this order:
1. CLAUDE.md
2. docs/BRIEF.md
3. docs/research/frappe-16.32-findings.md
4. design/README.md
5. docs/adr/0001-owner-decisions.md
6. docs/team/WORKFLOW.md

Then run every phase from 0 to 5, in order, in this one run, as described in docs/team/WORKFLOW.md. Do not end the session at a gate: record it and continue.

Delivery rules:
- Work on the branch build/midad-v1. Commit and push after every completed task.
- Each time a phase passes its gate with evidence that was actually run, fast-forward main to that commit and push it. main never receives a state whose gate failed.
- A gate that cannot pass does not stop the run: at most two fix attempts per finding, then cut the failing piece out (leave its hook disabled), list it under "Not delivered" in OWNER_REVIEW.md, and continue.
- If time or usage runs short, sacrifice in this order: extra font pairings, extra colour presets, P2, P1. Never sacrifice the midad preset in Light and Dark, in Arabic and English, on every P0 screen, with a clean install and uninstall.
- If a full test bench cannot be built in this environment, use the fallback described in Phase 0 and label everything that needed a live site as "not verified on a live site".

Usage economy rules (binding):
- At most three agents at the same time, and only when their files do not overlap.
- Every dispatch names the files to read and the files to write. No "explore the repository".
- One written discussion round per phase, within the word limits in WORKFLOW.md.
- Mechanical work (tables, translations, manifests, checklists) always goes to scribe.
- The two reviewers run once per phase on the phase diff, and a second time only for findings marked blocking.
- Do not redo an agent's work to check it; read its evidence (command output, audit result, screenshot path).

Keep the run resumable: update docs/team/STATUS.md at every gate and whenever a task finishes, and write the exact next step in it.

At the end, write docs/team/OWNER_REVIEW.md and then give me a final message, in this order: what was delivered and verified by running it; what was delivered but not verified, and why; what was not delivered; the decisions you took on my behalf; the quality table from docs/BRIEF.md section 10; and the install commands. Do not describe anything as tested unless its output or screenshot exists in the repository.

Write docs/team/OWNER_REVIEW.md and your final message in Arabic, because the owner reads Arabic. Everything else in the repository (code, comments, documentation, agent dispatches) stays in English.
```

---

## Resume prompt: if the session stopped before the end

Paste into a new session on the same repository. It continues from where the work stopped.

```text
You are the lead of the team building the Institutional Theme in this repository, and the run was interrupted before it finished. The owner is unavailable: do not ask and do not wait.

Read CLAUDE.md, then docs/team/STATUS.md, then docs/team/WORKFLOW.md, then docs/team/PLAN.md and the accepted records in docs/adr/. Check out the branch build/midad-v1 and confirm its latest commit and where main points.

Continue from the "next step" written in STATUS.md through the end of Phase 5, under the same "Autonomous mode" rules: push after every task, fast-forward main at every gate that passes with evidence, and cut out and record what cannot be fixed. At most three agents at once with non-overlapping files; mechanical work goes to scribe.

At the end, update docs/team/OWNER_REVIEW.md and give me the final message in the order given under "Honest reporting" in WORKFLOW.md. Write both in Arabic; everything else stays in English.
```

---

## Before starting

1. Push this repository to GitHub and connect it to Claude Code on the web.
2. In the cloud environment settings, set network access so that GitHub, PyPI and npm are reachable. Building the test bench needs them.
3. Do not add a branch protection rule on `main` that blocks direct pushes, or the team cannot update it and the work will stay on `build/midad-v1`.
4. The experimental "agent teams" feature is not required: the team is a lead with subagents, and discussion happens in writing, in files.
