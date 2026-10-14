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
| 4 P1, P2, proof | PASSED in round 2 (23:47 UTC): Tree, Gantt, P1 states, forced colours rendered; Print Style and Letter Head shipped idempotently, PDFs under wkhtmltopdf 0.12.6.1 (patched Qt) and Chrome, ar/en; email bundle; budgets audit 0 problems; proof parity 0 mismatches; P2 website and portal pages; opt-in banners; editors (`docs/team/evidence/round2/`) | 1087b93 |
| 5 Documentation and hostile review | PASSED in round 2 (23:58 UTC): both hostile reviews 0 blocking after fix round 1; every BRIEF section 10 dimension 4 or more (`docs/team/reviews/upgrade-round2.md`, `a11y-round2.md`); 142 Frappe + 164 unit tests OK; audits pass; gate clean incl. kept Letter Head after uninstall (`docs/team/evidence/round2/gate-final/`) | 1087b93 |

## Tasks in flight

None. Round 5 finished at about 13:40 UTC 2026-10-14 (GitHub Actions, pull request #5).

## Round 5 (robustness and the last known gaps) result

Gate: PASSED on Frappe 16.32.0 and v16.52.0. Evidence `docs/team/evidence/round5/final/gate/README.md` (tested commit `0e3bb0f`; section "Addendum: final commit" re-runs the browser checks on the one later product change, `94ec765`, CSS at 576 px and below). Reviews: `docs/team/reviews/upgrade-round5.md`, `docs/team/reviews/a11y-round5.md` (both 0 blocking after their re-checks; every BRIEF section 10 dimension 4 or more).

| Item | Result | Evidence |
|---|---|---|
| 1 Flaky runs | Root cause confirmed: core's `set_default`/`clear_default` clear `defaults::<parent>` once before the commit, and PostgreSQL REPEATABLE READ lets a request that began earlier refill the settings document after core's clear. Fix: `institutional_theme/cache_guard.py` clears now and again after commit or rollback; the app reads its own globals and user defaults from the table and checks the cached settings by `modified`. 12 deterministic race tests fail without the fix and pass with it; 5 loaded runs in a row on 16.32.0 and 1 on v16.52.0 pass, then 1 loaded and 1 unloaded run per version in the gate. Website 500s under load traced to core's `redis_cache` race | `round5/cache-race/` |
| 2 wkhtmltopdf clip | Core alone (same clip with the app removed from the render); the format is pinned to Chrome by core and fits when requested by name. No app change | `round5/print-clip/`, gate Notes |
| 3 Known v16.52.0 items | Kanban v1 dot and side-panel Draft/Cancelled fixed; list badges at 400% fixed with subject ellipsis, ring inside the clip, closed drawer out of the tab order, date kept; embedded-list badges neutral by decision | `round5/v1652-items/` (`fix1/` to `fix3/`) |
| 4 HRMS on v16.52.0 | HRMS v16.50.0 on `hrms52.test` (port 8002), round-3 screens 0 flagged of 84 | `round5/hrms52/` |
| 5 Release gate | CI, audits, budgets, run-tests loaded and unloaded, cascade 4576/4576 and 7680/7680, axe 0 theme-caused, attributes, grid names, print and email, install/uninstall and residue: PASS on both | `round5/final/gate/` |

Decisions 78-89 are recorded in `docs/team/OWNER_REVIEW.md` section 4 (Arabic). Bench on this runner: as in round 4, plus `hrms52.test` on the newest bench (`tools/bench/env52_hrms.sh`, `tools/bench/hrms.sh`); build logs `docs/team/evidence/round5/bench/`.

## Round 4 (forward compatibility with Frappe v16.52.0) result

Gate: PASSED. All 13 checks of ADR 0011 R7 pass on Frappe 16.32.0 and on v16.52.0 (ERPNext v16.50.0) from one code base; evidence `docs/team/evidence/round4/final/gate/README.md` and `final/p0/README.md`. Tested commits `70a62dd` (code) to `dc2764f` (one ar.csv row); later commits are documentation, plus ar.csv wording rows verified by translation lookup.

| Item | Result | Evidence |
|---|---|---|
| ADR 0011 (two v16 versions) | Accepted: side-by-side names, union deadness, one snapshot per version, cascade per version, range rule R7 | `docs/adr/0011-two-frappe-v16-versions.md`, `round4/source/token-map.md` |
| G1, G2 tokens and audits | 0 dead in combined verdict (15 dead on v16.52.0 alone, all live on 16.32.0); 26 remaps, 47 new keys, no approved value moved; 16.32.0 effective map unchanged (798/798) except two accepted radius readers; F2 counterparts 30 pairs 0 findings; audit holes closed | `round4/tokens/`, `audit-infra/`, `fix1-backend/` |
| G3 login, G4 names, G5 Gantt, G6 form errors, G8 shell | Side-by-side selectors; primary ink blue 8.27:1 on both; es-badge status shapes on real status hosts only; toast, dock, sidebar, control heights 32/44 | `round4/login/`, `selectors/`, `desk/`, `fix1/`, `fix2/`, `fix2-login/`, `fix3/` |
| G7 manifest | Every row with a 16.32.0 and a 16.52.0 line; 0 UNVERIFIED apart from HRMS rows | `docs/DEPENDENCY_MANIFEST.md`, `round4/manifest/` |
| Verification, both versions | cascade 4576/4576 and 7520/7520; 72 P0 captures no theme defect; axe 0 theme-caused (256 and 348 core nodes); run-tests 148 + 322 on both (16.32.0 passed on the third run after two flaky failures); print and email; install/uninstall gate and residue clean on both | `round4/final/` |
| Hostile reviews | Upgrade: B1/R1 closed after two attempts, final scores 5/4/4/5. A11y: blocking login overlap closed, every dimension 4 | `docs/team/reviews/upgrade-round4.md`, `a11y-round4.md` |
| Range | README and checklist: verified on 16.32.0 and v16.52.0; `pyproject.toml` constraint unchanged (`>=16.32.0,<17`) | `README.md`, `docs/UPGRADE_AND_QA_CHECKLIST.md` |

Decisions 63-77 are recorded in `docs/team/OWNER_REVIEW.md` section 4 (Arabic). Not delivered: the CI step that checks committed reports are current (`docs/team/evidence/round4/fix1-backend/ci-step-proposed.patch`, needs `workflows` permission).

Bench on this runner: 16.32.0 at `/home/frappe/frappe-bench` (site `midad.test`, port 8000, `tools/bench/b.sh`); v16.52.0 at `/home/frappe/newest-bench` (site `midad52.test`, port 8001, `tools/bench/newest_site.sh`, `b52.sh`, `gate52.sh`). Build both with `sudo env PATH="$PATH" SYSTEM_PYTHON_SRC=$(dirname $(dirname $(readlink -f $(uv python find 3.14)))) tools/bench/build_test_bench.sh`, then `tools/bench/newest_tag.sh clone bench` with `EVIDENCE_DIR=docs/team/evidence/round4/newest-bench` (tags pinned in its `tags.env`), then `tools/bench/newest_site.sh`.

## Round 3 (release hardening) result

| Item | Result | Evidence |
|---|---|---|
| 1 Clean install | PASSED: fresh bench (Frappe 16.32.0), Frappe-only and ERPNext sites, README commands literally, install/build/migrate/uninstall all exit 0, no table residue; README corrected; uninstall residue bug found and fixed (theme-made File copies only) | `docs/team/evidence/round3/fresh-install/`, `fix-uninstall/` |
| 2 HRMS 16.20.1 | PASSED: installed with fictional records; 84 screenshots, 0 flagged; two text-utility contrast fixes. HRMS defects on PostgreSQL documented (not theme) | `hrms/`, `hrms-screens/` |
| 3 Newest tag | CHECKED: v16.52.0; theme installs and uninstalls cleanly there, but the dead-token audit fails (15 dead); range unchanged (16.32.0); work list G1-G8 in the checklist | `newest-tag/` |
| 4 Coexistence | PASSED: Midad wins font stack and primary button; navbar border fixed; the rest documented in README Troubleshooting | `coexistence/` |
| 5 axe-core | PASSED: 1154 to 272 nodes, 0 caused by the theme; remaining nodes are core markup (checklist) | `axe/`, `axe-rescan/`, `fix-shell/`, `gate/axe-final/` |
| 6 Remaining gaps | Grid-row checkbox names delivered; Gantt month names not possible without core (documented); proof extended to 7 screens (parity 0 mismatches) | `grid-names/`, `proof/` |
| 7 Release gate | PASSED 05:05: CI checks; 148 Frappe + 178 unit tests OK; audits pass; cascade 4256/4256; install/uninstall gate clean (login 0 px; todo 5 px anti-aliasing, max delta 6); residue none; both hostile reviews 0 blocking after two fix rounds; every BRIEF section 10 dimension 4 or more | `gate/README.md`, `docs/team/reviews/upgrade-round3.md`, `a11y-round3.md` |

Decisions 47-62 are recorded in `docs/team/OWNER_REVIEW.md` section 4 (Arabic).

## Next step

The lead outside the job checks the round-5 evidence on pull request #5 and, if satisfied, merges it into `main` (never done by the build job) and confirms CI on GitHub. Optional follow-ups: a formal accessibility audit with screen readers and Windows High Contrast; targeted cache clears instead of `frappe.clear_cache()` on identity save (decision 82); desk CSS headroom (146 of 150 KB); HRMS print formats on both versions; upstream contributions (Gantt Arabic month names, core-markup axe findings, the `redis_cache` race, the "Quotation Modern with Images" clipping).

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

## Round 2 (started by the lead after the owner said to continue without waiting for approval)

Round 2 ran 21:29 UTC 2026-10-13 to about 00:20 UTC 2026-10-14. Bench rebuilt (`docs/team/evidence/round2/BENCH.md`). Waves: blockers and render checks; print, email, proof, budgets, P2, opt-in; web bundle size; hostile reviews; fix round 1; improvement wave (accessible names, reflow, targets, reduced motion, Arabic strings); final gate (`docs/team/evidence/round2/gate-end/`). Decisions 34-46 are recorded in `docs/team/OWNER_REVIEW.md` section 4 (Arabic). Reviews: `docs/team/reviews/upgrade-round2.md`, `a11y-round2.md`.


- Lead decisions: login, website and error pages are light only by platform constraint and design, not a dark-parity defect; the Dark calendar chips may use a narrowly scoped, manifest-justified `!important` against Frappe's inline colours if nothing else works; the test site's own `site_config.json` may be edited for verification and restored.
- Order of work and the end-of-job routine are in `docs/team/RESUME_PROMPT.md` (round 2). `main` stays unchanged; pull request #2 stays open for the owner.

## After round 2 (lead)

- 00:30 UTC 2026-10-14: every phase gate passed with evidence (round 2). The lead re-ran CI's own checks on `f3faf4d` (ruff 0.16.8 check and format, 130 + 34 unit tests, `build --check` 0 stale, all audits passed). With the owner's explicit authorisation to merge, pull request #2 is merged into `main`. Before that, `main` was `24a8b35` (the unverified snapshot merged from pull request #1, CI red).
- Next step: round 3, release hardening and independent verification (`docs/team/RESUME_PROMPT.md`), on a new pull request from `build/midad-v1` to `main`; the lead merges it only after verifying its evidence. All changes stay inside this app; Frappe core is never modified.
- 00:22 UTC 2026-10-14: pull request #2 merged into `main` (merge commit `0b605da`) after CI passed on `f07990c` (Ruff, tests and audits). Round 3 starts on a new pull request from `build/midad-v1`; its scope is in `docs/team/RESUME_PROMPT.md`.

## After round 3 (lead)

- 05:15 UTC 2026-10-14: the lead re-ran CI's own checks on `01b7c18` (ruff 0.16.8 check and format, 130 + 48 unit tests, `build --check` 0 stale, all audits including avatars passed), confirmed that the HRMS PostgreSQL workaround (`tools/bench/hrms_install.py`) is test-bench only and edits nothing on disk, and merges pull request #3 into `main` under the owner's authorisation.
- Next step: round 4, forward compatibility with the newest v16 tag (v16.52.0) while keeping 16.32.0 fully supported (`docs/UPGRADE_AND_QA_CHECKLIST.md` G1 to G8).
- 05:12 UTC 2026-10-14: pull request #3 merged into `main` (merge commit `713cf80`) after CI passed on `caec1ed`. Round 4 (forward compatibility with v16.52.0, no regression on 16.32.0) starts on a new pull request; scope in `docs/team/RESUME_PROMPT.md`.

## After round 4 (lead)

- 09:40 UTC 2026-10-14: the lead re-ran CI's checks on `dd035f9` (ruff 0.16.8, 130 + 48 unit tests, `build --check` 0 stale, audits passed), applied the proposed CI step "Committed reports are current" to `.github/workflows/ci.yml` after verifying it passes without a bench (budgets are skipped and the committed report kept when no build exists), and merges pull request #4 into `main` under the owner's authorisation.
- The two flaky 16.32.0 test runs are treated as a real defect, not a flake: the app clears its settings caches before the saving transaction commits, so a concurrent request can refill a cache with the old values. Round 5 fixes the root cause (clear after commit as well) with a deterministic test, isolates the wkhtmltopdf clipping of the v16.52.0 default print format, and closes the known v16.52.0 items.
- 09:38 UTC 2026-10-14: pull request #4 merged into `main` (merge commit `76afa23`) after CI passed on `96c88f2`. Round 5 (root cause of the flaky runs, wkhtmltopdf clipping on v16.52.0, known v16.52.0 items, HRMS on v16.52.0, release gate on both versions) starts on a new pull request; scope in `docs/team/RESUME_PROMPT.md`.

## After round 5 (build job)

- 13:40 UTC 2026-10-14: round 5 gate passed on both versions; pull request #5 updated with the Arabic summary. `main` untouched.
