# Build status

Updated by the lead at every gate and whenever a task finishes. A fresh session continues from the "Next step" line.

## Environment (verified 2026-10-13)

- Frappe source for reading: `/home/user/src/frappe-16.32.0` (shallow clone of tag v16.32.0, outside the repository; re-create with `git clone --depth 1 --branch v16.32.0 https://github.com/frappe/frappe /home/user/src/frappe-16.32.0`).
- Tooling present: Python 3.14.6 via `uv python install 3.14`, PostgreSQL 16 (`/usr/lib/postgresql/16/bin`), Redis, Node 22, Yarn. GitHub reachable.
- Evidence lives in `docs/team/evidence/phaseN/`; reviews in `docs/team/reviews/`; discussion in `docs/team/discussion/`.

## Phases

| Phase | State | Gate commit |
|---|---|---|
| 0 Bench and baseline | PASSED (install/uninstall/reinstall clean, 0 px diff; `docs/team/evidence/phase0/`) | e4015f7 |
| 1 Analysis and discussion | PASSED (ADR 0002-0009 accepted, `docs/team/PLAN.md`) | e4015f7 |
| 2 Foundations | built; audits pass (midad 0 failures, umber dropped, parity 51/51); reviews pending | |
| 3 P0 | not started | |
| 4 P1, P2, proof | not started | |
| 5 Documentation and hostile review | not started | |

## Tasks in flight

- Phase 2 reviews DONE: a11y 3 blocking (placeholder/border on the real control bg; dark help text on selected-strong; checkbox focus ring), upgrade 1 blocking (restore without files blocks settings save). Arabic settings strings DONE.
- Fix round 1 in flight: theme-architect ADR 0010 (contrast corrections); backend-engineer (U1 font validation, U2 print font names, U3, U7 dead-token snapshot + ruff pin, U8 before_uninstall, U9 track_changes, bidi strings); css-engineer (checkbox focus ring, autofill on focus, comments).
- After ADR 0010: backend-engineer applies tokens.json edits, widens contrast groups, fixture test with deviation list, regenerates; css re-runs cascade.

## Next step

Read the Phase 2 reviews; fix blocking findings (max two attempts each); fast-forward main at the Phase 2 gate; then Phase 3 with css-engineer, backend-engineer, print-web-engineer in parallel per `docs/team/PLAN.md` "Parallel work in Phase 3".

## Bench

`tools/bench/build_test_bench.sh && tools/bench/start_services.sh` (6-8 min cold, COMPUTED); bench at `/home/frappe/frappe-bench` (symlink `/home/user/frappe-bench`), site `midad.test`, Administrator/admin, port 8000. Run bench commands as the `frappe` user.

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
13. Focus: core's literal grey focus box-shadows on .btn/.form-control/.custom-select/.page-link/badges are set to none so exactly one ring (the outline) shows. Consequence: .btn-default loses its inset highlight while focused. One ring wins (BRIEF §8 focus).
14. Fonts: Plex default 234 KB WOFF2 (budget 350). Tajawal has no 600 weight: its 700 file serves 600-700 (a heavier semibold than designed, only when Tajawal is selected). Noto and Tajawal pairings print in Plex (only Plex has TTFs for wkhtmltopdf).
15. main was fast-forwarded to e4015f7 at the Phase 0 and Phase 1 gates. That commit already held inert Phase 2 code (no CSS or JS hook enabled; install/uninstall verified clean on it). The settings doctype on that commit can write identity values through to Website Settings without restoring them on uninstall (upgrade review Phase 2 #8); fixed in the Phase 2 fix round. Recorded as a lapse in strictness, not repeated: main now advances only at a full phase gate.
16. Phase 2 deferrals to Phase 3 (owner: css-engineer unless noted): Arabic typography rules (letter-spacing reset, Arabic leading, size compensation, tabular numerals), read-only vs disabled distinction, inline-start scroll-padding for sticky first column, descendant re-declarations in dark (`_scoped_variables.scss`) with descendant-level cascade assertions, forced-colors coverage of checkbox/switch fills and selected rows, brand-app coexistence test (findings §8). Reduced-motion spinner substitute deferred to Phase 4 (global states).
17. Checkbox focus: ring kept outside (+2px) inside datatable/grid/list; 3:1 against the row backgrounds, not against the checked fill (not adjacent; the 2px gap separates them). Clipping in real datatable/grid cells to be verified in Phase 3 screenshots.
