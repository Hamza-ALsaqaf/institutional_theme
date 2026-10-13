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
8. Login and error content uses core's `banner_html`, `body_include` and `body_class` slots (ADR 0009). Deviation: the system name sits above the login card, not inside it as drawn. The error reference ID needs `"monitor": 1` in site_config; no ID on 404/403/503. Release line needs the new site_config key `ins_release`.
9. Phase 2 colour maths and audits started before the Phase 0 gate, by a second backend-engineer instance on disjoint files (pure Python, no bench needed). `main` is still only advanced at a passed gate.
10. Presets after the Phase 2 audits: midad, graphite, petrol, forest, plum ship; umber is dropped (status distinguishability 3.3 < 5.0 OKLab ΔE×100, dark, tritanopia, primary vs warning). Threshold 5.0 kept: lowering a threshold to keep a flagged preset would trade priority 2 for 5.
11. Chart palette gaps accepted as known gaps, not fixed by changing approved values: midad dark series 1-6 reach 4.4 (protanopia) / 4.9 (tritanopia); light series 7 vs 3 is 1.0 under tritanopia. Mitigation required in P1: secondary encodings (direct labels, dash patterns) where frappe-charts allows; documented in DESIGN_SYSTEM.
12. The custom-preset contrast rejection is a safeguard: no hue on the approved curves fails a required pair (scan in `docs/team/evidence/phase2/backend-pipeline.md`).
