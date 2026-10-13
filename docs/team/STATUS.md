# Build status

Updated by the lead at every gate and whenever a task finishes. A fresh session continues from the "Next step" line.

## Environment (verified 2026-10-13)

- Frappe source for reading: `/home/user/src/frappe-16.32.0` (shallow clone of tag v16.32.0, outside the repository; re-create with `git clone --depth 1 --branch v16.32.0 https://github.com/frappe/frappe /home/user/src/frappe-16.32.0`).
- Tooling present: Python 3.14.6 via `uv python install 3.14`, PostgreSQL 16 (`/usr/lib/postgresql/16/bin`), Redis, Node 22, Yarn. GitHub reachable.
- Evidence lives in `docs/team/evidence/phaseN/`; reviews in `docs/team/reviews/`; discussion in `docs/team/discussion/`.

## Phases

| Phase | State | Gate commit |
|---|---|---|
| 0 Bench and baseline | in progress | |
| 1 Analysis and discussion | ADRs 0002-0008 and PLAN accepted; 0006 (bench) and 0009 (login content) pending | |
| 2 Foundations | not started | |
| 3 P0 | not started | |
| 4 P1, P2, proof | not started | |
| 5 Documentation and hostile review | not started | |

## Tasks in flight

- Phase 0 / backend-engineer: test bench script, CI workflow, install and uninstall on the test site.
- Phase 0 / theme-architect: DONE (`docs/research/phase0-reverification.md`; two findings differ: data-label, per-Print-Format pdf_generator).
- Phase 1: proposals, replies, both reviews, ADR 0002-0008, PLAN: DONE. ADR 0009 (login and error-page content) in flight.

## Next step

Wait for both Phase 0 tasks, read their evidence, decide the Phase 0 gate.

## Lead decisions log (to be carried into OWNER_REVIEW.md, Arabic)

1. Phase 1 overlapped the tail of Phase 0 (documents only), to save wall-clock. No code was written before the Phase 0 gate.
2. ADR 0003 replaces the "root attribute set before first paint" premise of ADR 0001 Q2: the server links the user's palette stylesheet in the desk `<head>` via `update_website_context`. Reason: no script runs before the splash paints (verified in source). Consequence: changing preset reloads the page.
3. All blocking review findings of Phase 1 accepted (upgrade #1 write-through via `set_single_value`; #2 guarded hook with atomic writes; a11y #1 native radio group instead of core's theme dialog; #2 uploaded fonts need all four faces; #3 `color-scheme` in every mode block).
4. Custom brand preset keeps the official hue but caps chroma to the approved curve, so the exact official hex may not be reproduced (ADR 0005). Contrast safety wins over hex fidelity (BRIEF priority 2 over 5).
5. Environment ribbon is set from `site_config` (`ins_environment`), not from the settings form, so a restored production database cannot show a training ribbon by mistake (ADR 0005).
6. Consequential-action tagging matches translated labels; a false positive is accepted over a miss. Arabic collisions (Delete/Remove, Cancel/Revoked) are known (ADR 0008).
7. Test records are created only on the test site by `tools/bench/test_fixtures.py`, never through the app `fixtures` hook.
