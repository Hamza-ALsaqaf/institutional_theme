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
| 2 Foundations | PASSED 19:18 UTC: audits pass (contrast 0 failing over 426 pairs, parity 51/0, colour vision 0 failures + 99 baselined gaps, dead tokens 0); 140 unit tests OK; 88 Frappe tests OK; cascade 4256/4256 (static core build); install/uninstall gate clean (`docs/team/evidence/resume/`) | ceb4128..HEAD |
| 3 P0 | PASSED 20:00 UTC: both reviews (upgrade 0 blocking; a11y 2 blocking fixed and re-checked on the real build); 109 Frappe + 140 unit tests OK; cascade 4256/4256; gate clean, residue none; 48 P0 desk screenshots (en/ar, Light/Dark, comfortable/compact) on the real build (`docs/team/evidence/phase3/`) | HEAD at 20:00 |
| 4 P1, P2, proof | PARTIAL: charts (dashes), Kanban, Calendar verified; Tree, Gantt, states written not rendered; print, email, Letter Head, proof, budgets NOT delivered | |
| 5 Documentation and hostile review | NOT PASSED: docs written, both final reviews have 0 blocking; two dimensions score 3 (clarity and hierarchy, dark parity), see `docs/team/OWNER_REVIEW.md` | |

## Tasks in flight

None. Run ended 20:45 UTC; final report in `docs/team/OWNER_REVIEW.md` (Arabic) and on pull request #2.

## Next step

Owner reviews pull request #2. To continue: fix the two score-3 items in `docs/team/reviews/a11y-final.md` (Appearance page heading and selected tag; calendar chips in Dark), then the "Not delivered" list in OWNER_REVIEW.md section 3 in this order: Print Style and Letter Head, email bundle, proof, size budgets, P2 website pages.

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
18. 15:41 UTC: the owner set a 5-hour deadline (20:40 UTC) and authorised the full budget. Concurrency raised from three to seven agents on disjoint files; a build lock (`/tmp/ins-bench.lock`) serialises bench builds, migrations and the gate; CSS agents iterate by injecting compiled CSS into the live desk. Time boxes in `docs/team/RUN_RULES.md`.
19. The Phase 2 fix-round backend agent was stopped by an accidental interruption; its uncommitted work was kept and a new agent (backend-R1) finishes it before starting the Phase 3 runtime.
20. ADR 0010 accepted: fields drawn on `surface-field` as in the approved artboards (mapping fix, no value change); one approved value changed (`surface-selected-strong` dark 0.35→0.34 L); default chart series reordered 1,5,3,2,6,4 (deviation); remaining chart gaps accepted and baselined.
21. Paused on the owner's instruction to stop consuming cloud session credits. This session's model usage cannot be routed through an API key stored in the repository, so the run was stopped and the owner informed before spending more.
22. 16:30 UTC: the owner chose to continue on their own Anthropic API key. Added `.github/workflows/claude-resume.yml` (Claude Code in GitHub Actions with the `ANTHROPIC_API_KEY` secret; starts when a pull request from `build/midad-v1` to `main` is opened, reopened or labelled `claude-resume`; a pre-push hook refuses pushes to `main`) and `docs/team/RESUME_PROMPT.md` (the instructions that run follows). No cloud agents were restarted.
23. 16:45 UTC: the owner merged pull request #1 into `main` (merge commit `24a8b35`), so `main` now holds the unverified snapshot and CI is red on it. The first Actions run failed because the key secret is named `INSTITUTIONAL_THEME`, not `ANTHROPIC_API_KEY`; the workflow now reads `INSTITUTIONAL_THEME`. The run is started by a new draft pull request from `build/midad-v1` to `main`, which is not to be merged before the final report.
24. 17:15 UTC: the owner's key carries promotional credits that cover the Agent SDK and the API but not Claude Code, so `claude-code-action` failed with "Credit balance is too low". The resume workflow now runs Claude through the Claude Agent SDK (`tools/ci/run_agent.mjs`, engine `sdk`), with `claude -p` as an automatic fallback, after a one-turn smoke test that must succeed before the build starts. A local plumbing test of the runner unintentionally used this cloud session's own credentials (about 0.23 USD); no further local API calls are made.
25. 17:33 UTC: resume run started in GitHub Actions, 33 minutes after 17:00, so every time box in RESUME_PROMPT is shifted by 33 minutes (final report 21:13 UTC, inside the 355-minute job limit). The stray `mkusers.sh` and the `adm.jar` cookie jar it produced were removed from the repository root.
26. 19:18 UTC: Phase 2 gate passed (evidence in the phase table). The one failing Frappe test (`test_audit_text_uses_labels_not_token_names`) was a test bug: the word "border" is both a token name and an English word in the label "Input border"; the assertion now checks hyphenated token names only. Calendar event text keeps core's own `!important` blue (`calendar.scss:71,99`): the theme does not add an `!important` to fight it; contrast of that pair is not computed (P1, listed as a gap).
27. 19:20 UTC: to save an agent cycle, `web_content.py` (ADR 0009 Python) is written by print-web-engineer together with its templates, instead of backend-engineer. Reverse by moving ownership back in PLAN.md; no behaviour depends on who wrote it.
28. The custom brand preset's contrast rejection cannot fire for any hex input (lightness comes from the approved curves; `#FFFFFF` on `#FFFFFF` saves). Kept as a safeguard (decision 12), not a bug.
29. 20:00 UTC: Phase 3 gate passed. Login a11y blockers fixed inside this app: a small web script wraps core's pointer-only password icon in a real button (label rendered server-side, because `__()` has no messages on website pages); Arabic login letter-spacing reset by repeating the body class (no `!important`). App rows in `ar.csv` that only repeated core's Arabic were dropped; rows that correct core's Arabic (Light, Dark, Automatic, Draft, Submitted, Cancelled, Completed) were kept and apply desk-wide.
30. Phase 4 cut to charts only because of the deadline (sacrifice order: P2 first, then P1). Print Style, Letter Head, email bundle, the interactive proof, Kanban, Calendar, Tree, Gantt and the global-state pages are not delivered.
31-33. See `docs/team/OWNER_REVIEW.md` section 4 (error-page link, desktop icons, background agents cut off at 17:45).
