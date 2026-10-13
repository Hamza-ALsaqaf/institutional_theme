# Upgrade and QA checklist

Generated from: `CLAUDE.md` (verified target), `.github/workflows/ci.yml` (unit and audit commands), `institutional_theme/midad/build.py` (`--check`), `institutional_theme/audits/__main__.py` (`--core-css`, `--write-core-snapshot`, `--strict`), `tests/browser/*.mjs` (usage headers), `tools/bench/b.sh`, `tools/bench/gate_install_uninstall.sh`, `tools/bench/README.md`, `docs/team/evidence/phase3/screens/` (screen set), `docs/BRIEF.md` (P0 list).

Labels: VERIFIED (the command exists in this repo and its usage was read), UNVERIFIED (not run in this document; check it on the bench before relying on it).

Run every command from the repository root `institutional_theme/` unless a line says otherwise. Bench commands run as the bench user (see `tools/bench/README.md`).

## A. Before the upgrade

| # | Step | Command or action | Pass when |
|---|---|---|---|
| A1 | Record the target | Compare the new Frappe, ERPNext and HRMS tags with the verified target: Frappe 16.32.0, ERPNext 16.33.0, HRMS 16.20.1 | Tags are known. If they differ, re-read `docs/research/frappe-16.32-findings.md` sections 2 and 5 and `docs/DEPENDENCY_MANIFEST.md` before going on |
| A2 | Keep a restore point | Take the site backup your bench provides (UNVERIFIED for this repo: no backup command is in the repo) | Backup exists |
| A3 | Record the current gate state | `python -m institutional_theme.midad.build --check` | Exit 0 |

## B. After the upgrade: repository checks (no bench needed)

| # | Step | Command | Pass when |
|---|---|---|---|
| B1 | Colour package and emitter unit tests | `python -m unittest discover -s institutional_theme/midad/tests -t .` | All OK (the CI job runs this) |
| B2 | Audit unit tests | `python -m unittest discover -s institutional_theme/audits/tests -t .` | All OK |
| B3 | Generated files are current | `python -m institutional_theme.midad.build --check` | Exit 0. If it fails, the generated file is stale; regenerate it from `design/tokens.json` with the build, do not edit it by hand |
| B4 | Refresh the core variable snapshot | With the upgraded compiled core stylesheets at paths `<CORE_CSS...>` (UNVERIFIED: the path of the compiled desk CSS on the upgraded bench is not recorded in the repo): `python -m institutional_theme.audits --core-css <CORE_CSS...> --write-core-snapshot` | Snapshot `institutional_theme/audits/data/core_vars_frappe_16.32.0.json` is rewritten; review the diff, and rename the file to the new version if the version changed |
| B5 | Dead-token and contrast audits | `python -m institutional_theme.audits` (add `--strict` to fail on chart-series gaps) | Exit 0. The audit fails on any dead variable (declared by the theme, neither in core nor used by the theme) and on a shipped preset that fails a contrast pair. Reports are written to `docs/audits/` |
| B6 | Read the audit counts | Open `docs/audits/dead_tokens.txt` | "dead: 0"; the overridden count is the number you expect (377 at the Frappe 16.32.0 snapshot) |

## C. After the upgrade: bench checks

Requires the bench built with the app installed on the test site. Commands run through `tools/bench/b.sh` (it takes the shared build lock).

| # | Step | Command | Pass when |
|---|---|---|---|
| C1 | Migrate | `tools/bench/b.sh migrate` | Completes. `after_migrate` runs without error (`institutional_theme.install.after_migrate`) |
| C2 | Build the app bundles | `tools/bench/b.sh build --app institutional_theme` | Completes. The asset manifests contain all 7 CSS keys and their `rtl_` keys (runtime evidence) |
| C3 | Restart the web process | `tools/bench/start_services.sh restart-web` | Web is up on port 8000 |
| C4 | Frappe test suite for the app | `tools/bench/b.sh run-tests --app institutional_theme` | All app tests pass. Record any failing test name; do not mark the run as passing with a known failure |
| C5 | Computed-style cascade against the compiled desk | `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/browser/cascade.mjs --bench <FRAPPE_BENCH_PATH>` (optional `--out DIR`) | Output shows `fail 0` (the last recorded run was pass 4256, fail 0) |
| C6 | Browser behaviour checks | `node tests/browser/first_paint.mjs`, `node tests/browser/appearance_keyboard.mjs`, `node tests/browser/actions.mjs` | Each prints PASS for every check. Run with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` as in C5 if the default browser path is absent |
| C7 | P0 screen captures | `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/browser/screens.mjs --inject` | 48 PNG files are written to `docs/team/evidence/phase3/screens/`. This overwrites the Phase 3 set: copy the old set first if you need it for comparison |
| C8 | Install, uninstall and reinstall gate | `tools/bench/gate_install_uninstall.sh [evidence-dir]` | Exit 0. The gate installs, uninstalls and reinstalls the app; the stock look after uninstall is compared with the "before" capture |
| C9 | Uninstall residue | Check the gate's `residue-after-uninstall.log` (in the evidence directory you passed) | No generated folder left under `sites/<site>/public/files/institutional_theme/` (`before_uninstall` removes it) |

## D. Manual QA matrix: P0 desk screens

Screens are the six P0 screen types from `docs/BRIEF.md` that the screen capture covers: desktop (apps), workspace, list, form, report, dialog. Each cell is one capture (C7) plus a manual look at the same screen in the live desk.

Columns are language × mode × density. Tick a cell only after you looked at it in the live desk and the capture has no clipped text, no missing status shape, and no core-blue leak in Dark.

Generated from: the file names in `docs/team/evidence/phase3/screens/` (`<lang>-<mode>-<density>-<screen>.png`) and the screen list in `tests/browser/screens.mjs`.

| Screen | en Light Comfortable | en Light Compact | en Dark Comfortable | en Dark Compact | ar Light Comfortable | ar Light Compact | ar Dark Comfortable | ar Dark Compact |
|---|---|---|---|---|---|---|---|---|
| Desktop (apps) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Workspace | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| List | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Form | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Report | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Dialog | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

Totals: 6 screens × 8 combinations = 48 cells.

Check items in every cell (from the P0 list in `docs/BRIEF.md`): page head and breadcrumbs; status pill (colour, label and shape together); sidebar; primary and secondary buttons; for forms, every field state that the screen shows (default, focus, filled, read-only, mandatory-empty, invalid with message); for lists, row states and sticky first column; for reports, datatable header and totals; for dialogs, the freeze overlay and message box.

## E. Manual QA: P0 web pages

These pages are not in the density matrix (no density control on the login pages). The web evidence records Light tokens for `ins_web`.

| Page | en | ar | Notes |
|---|---|---|---|
| Login | [ ] | [ ] | Letter-spacing is 0 in Arabic; password reveal is a keyboard button |
| Two-factor (2FA) | [ ] | [ ] | `#twofactor_div` and the verify token field |
| Forgot password | [ ] | [ ] | Reset-link sentence and send button |
| Session expired | [ ] | [ ] | UNVERIFIED: no capture in the repo; which page shows the message was not checked in the source |
| Not found (404) and error (500) | [ ] | [ ] | The 500 page shows a reference and the time of error; the trace ID equals the Error Log `trace_id` (UNVERIFIED end to end: see `docs/team/evidence/phase3/web/evidence.md`) |

Dark mode on the web pages is not in the Phase 3 capture set; mark it UNVERIFIED if you test it.

## F. Sign-off

| Item | Result | Evidence path |
|---|---|---|
| Repository checks B1 to B6 | | |
| Bench checks C1 to C9 | | |
| Manual matrix D (48 cells) | | |
| Manual web checks E | | |
| Frappe, ERPNext and HRMS tags recorded (A1) | | |

Do not mark a row as passed on the strength of an earlier run. Each run's log goes in the evidence directory with its date.
