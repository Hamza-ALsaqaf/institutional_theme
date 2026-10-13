# Team workflow

How the build team works in this repository. The lead session orchestrates; seven specialised agents are defined in `.claude/agents/`. Each agent's model and reasoning effort are set in its definition and are chosen to protect the owner's usage limit: the expensive model thinks, the mid model builds, the cheap model does mechanical work.

## The team

| Role | Agent | Model | Effort | Owns |
|---|---|---|---|---|
| Lead and orchestrator | the main session | Opus | high | Phase plan, gates, merging decisions, the final report. Writes no feature code. |
| Architect | `theme-architect` | Opus | high | `docs/adr/`, token architecture, cascade strategy, the prose of `docs/DESIGN_SYSTEM.md` |
| Desk CSS | `css-engineer` | Sonnet | medium | `institutional_theme/public/scss/` (desk), the interactive proof |
| Backend and settings | `backend-engineer` | Sonnet | high | Python package, token pipeline, audits, settings doctype, `public/js/`, test bench, CI |
| Print, email, portal | `print-web-engineer` | Sonnet | medium | Print Style, Letter Head, email bundle, web and login bundle, SVG assets |
| Accessibility and RTL | `a11y-rtl-reviewer` | Sonnet | high | Review only: `docs/team/reviews/a11y-*.md` |
| Upgrade safety | `upgrade-reviewer` | Opus | medium | Review only: `docs/team/reviews/upgrade-*.md` |
| Documentation and data | `scribe` | Haiku | medium | Token tables, the manifest tables, `translations/ar.csv`, `FONTS.md`, checklists |

File ownership is exclusive. If a task needs a file another agent owns, ask the lead; do not edit it.

## Rules that keep usage down

1. At most **three agents run at the same time**, and only when their files do not overlap.
2. Every dispatch names the exact files to read and the exact files to write. No "explore the repository".
3. One discussion round per phase, in writing, with word limits (below). No open-ended debate.
4. Reviewers run **once per phase**, on the phase diff. A second pass happens only for findings marked blocking.
5. Mechanical work (tables, translations, manifests, changelogs) always goes to `scribe`.
6. An agent that is blocked stops and reports to the lead. It does not retry the same approach more than twice. The lead then decides; it does not wait for the owner.
7. The lead does not re-do an agent's work to check it; it reads the agent's evidence (command output, audit result, screenshot path).

## Discussion protocol

Agents cannot talk to each other directly, so discussion happens in files under `docs/team/discussion/`.

1. The architect posts a proposal (`NN-topic.md`, 600 words at most): the decision, two alternatives, the reason.
2. Each affected engineer and each reviewer appends a reply (200 words at most): agree, or the specific objection with evidence (a file and line in Frappe source, a measurement, a failing case).
3. The architect revises once and records the outcome as an ADR. The lead breaks ties using the priority order in `docs/BRIEF.md` section 3.

Objections without evidence are noted and overruled.

## Phases and gates

Each phase ends at a gate. The lead writes a five-line status in `docs/team/STATUS.md` at every gate, fast-forwards `main` to the verified commit, and continues with the next phase without waiting (see Autonomous mode).

### Phase 0 — Bench and baseline
`backend-engineer`: a script that builds a test bench from scratch (Frappe 16.32.0 pinned, a test site, this app installed), and a CI workflow that runs lint and the audits. Record what was run and how long it took.
`theme-architect`: re-verify the ten findings the design depends on most (cascade order, bundle discovery, RTL, indicator colours, datatable geometry, login load order, PDF generator, masking, `data-label`, `form-refresh`) against the pinned source. Record any that differ.
**Gate**: the app installs and uninstalls cleanly on the test site with the stock look unchanged.
**Fallback if a full bench cannot be built** (database or Python version unavailable): clone Frappe 16.32.0, install its node dependencies and build only its CSS and JS assets, then verify the theme in a static harness that loads the real compiled core CSS (LTR and RTL) plus this theme, with a headless browser for computed-style assertions and screenshots. Python paths are then covered by unit tests with Frappe imported but no site. Record in `OWNER_REVIEW.md` that nothing was verified on a live site.

### Phase 1 — Analysis and discussion
`theme-architect` proposes ADR 0002 to 0007 (the open questions at the end of `0001`). One discussion round. Engineers each post a 200-word feasibility note for their area. Both reviewers critique the proposals before any code exists.
**Gate**: ADRs accepted; a file-by-file ownership plan exists in `docs/team/PLAN.md`.

### Phase 2 — Foundations
`backend-engineer`: colour maths in Python reproducing `design/reference/tokens.resolved.json` exactly; the token pipeline generating SCSS and the resolved JSON; the contrast audit, the dead-token audit and the colour-vision audit; fonts with licences; the settings doctype.
`css-engineer` (after the pipeline exists): the token layer bundle and the cascade proof (computed-style assertions that the theme wins in Light, Dark and Automatic).
`scribe`: token tables generated into the docs.
**Gate**: all audits pass for `midad` in both modes with zero failures; each other preset is either passing or formally dropped; key-set parity between light and dark holds.

### Phase 3 — P0
In parallel, disjoint files: `css-engineer` (shell, page head, list, form, controls, dialogs, reports), `backend-engineer` (preset and font runtime, boot info, the small shell script, install and uninstall), `print-web-engineer` (login, website, error pages).
**Gate**: both reviewers pass P0 with no blocking finding; screenshots exist for every P0 screen in Light and Dark, Arabic and English, comfortable and compact.

### Phase 4 — P1, P2 and the proof
`css-engineer`: dashboards, charts, Kanban, Calendar, Tree, Gantt, global states, then the interactive proof. `print-web-engineer`: Print Style, Letter Head, email, SVG assets. `backend-engineer`: idempotent shipping of print records, opt-in behaviours, tests.
**Gate**: PDF output verified under both generators; proof matches the product; size budgets met.

### Phase 5 — Documentation and hostile review
`scribe` builds every table and checklist from the code. `theme-architect` writes the prose. The two reviewers and the lead then review as three hostile readers: a sceptical senior official (lead), an accessibility auditor, and a Frappe engineer planning the next upgrade. Fix, re-run every audit, fill in the quality table from `docs/BRIEF.md` section 10.
**Gate**: every dimension scores 4 or more, with evidence.

## Evidence standard

A task is done when its agent can point to something that was run: an audit output file, a test result, a screenshot path, a diff of computed styles. "Looks right" is not evidence. Anything not run is reported as not verified, in those words.

## Autonomous mode (the default)

The owner starts the run and is not available until it ends. Nobody will answer a question, so nothing may wait for one.

- **Never stop to ask.** When a decision is needed, the lead decides using the priority order in `docs/BRIEF.md` section 3, picks the most conservative option that keeps the product working, and records it in `docs/team/OWNER_REVIEW.md`: what was decided, why, what the alternative was, and how to reverse it.
- **Run every phase in order, 0 to 5, in one run.** Do not end the session at a gate; record the gate in `docs/team/STATUS.md` and continue.
- **`main` is always shippable.** Work on the branch `build/midad-v1`. Commit and push after every completed task. Each time a gate passes, fast-forward `main` to that commit and push it. `main` therefore always holds the last state that was verified by running it, and an interrupted run still leaves a working product.
- **A gate that cannot pass does not block the run.** Fix what is blocking, at most two attempts per finding. If it still fails, cut the failing piece out (leave its hook disabled), list it in `OWNER_REVIEW.md` under "Not delivered", and move on. Never merge a failing state into `main`.
- **Protect the core first.** If time or usage runs short, the order of sacrifice is: extra font pairings, extra colour presets, P2, P1. The `midad` preset in Light and Dark, Arabic and English, on every P0 screen, installing and uninstalling cleanly, is never sacrificed.
- **Make the run resumable.** `docs/team/STATUS.md` is updated at every gate and whenever a task finishes, with the exact next step, so a fresh session can continue from the repository alone.

Decisions that would otherwise go to the owner, and their default:

| Situation | Default |
|---|---|
| An approved design value cannot survive contact with Frappe | Make the smallest change that works, keep the original in a comment in the decision record, list it under "Design deviations" |
| A colour preset cannot pass the audits | Drop it; never ship it with a warning |
| A requirement is impossible in 16.32 without touching core | Do not touch core. Deliver the closest supported behaviour and list the gap |
| The full test bench cannot be built in this environment | Use the fallback in Phase 0 and label everything that needed a live site as "not verified on a live site" |
| Two agents disagree after the discussion round | The lead decides by the priority order |

## Honest reporting

The final message and `docs/team/OWNER_REVIEW.md` state, in this order: what is delivered and verified by running it; what is delivered but not verified, and why; what was not delivered; every decision taken on the owner's behalf; and the exact install commands. No item is described as tested unless its command output or screenshot exists in the repository.
