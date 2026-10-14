# Phase 2 fix round (backend-engineer): status

Written 2026-10-13 after the unit work, before the bench was available. Labels: VERIFIED (ran it), COMPUTED (derived by the model code), ASSUMED. Nothing is committed; the lead commits.

## Result of the CI causes

| Item | Status | Evidence |
|---|---|---|
| `ruff check` F841/RUF059 unused `accepted` (`audits/colour_vision.py:349`) | fixed (`_accepted`) | `ruff-check.log` (ruff 0.16.8, as in `ci.yml`): All checks passed. VERIFIED |
| `test_model.py` asserted 362 contrast results | now 426, derived: 213 pairs x 2 modes = 181 + the 32 pairs the ADR 0010 group edits add (12+4+3+6+7); comment in the test; `test_every_pair_is_measured_in_both_modes` recomputes from the model | `unittest-midad.log` (125 tests OK on Python 3.14.8). VERIFIED, count COMPUTED in `adr0010.md` |
| `ruff format --check` (2 files needed formatting) | formatted | `ruff-format.log`: 85 files already formatted. VERIFIED |

## Items

| Item | Status | File:line | Evidence | Label |
|---|---|---|---|---|
| ADR 0010 token edits (two `--control-bg` mappings, `surface-selected-strong` dark 0.34, chart reorder 1,5,3,2,6,4, `contrast.groups`) | done, regenerated, 0 stale | `design/tokens.json` (`_approved` + `_deviation` on each), `midad/deviations.py:1-29`, `tests/test_colour.py`, `tests/test_emit.py` | `adr0010.md`, `build-check.log`, `audits.log` | VERIFIED (build, tests); ratios COMPUTED |
| Colour-vision baseline: fail on a new gap against a committed baseline | done | `audits/colour_vision.py` (`load_baseline`, `new_gaps`, `report`, `--write-baseline`), `audits/data/colour_vision_baseline.json`, `audits/tests/test_colour_vision.py`, `audits/__main__.py:81-90` | `unittest-audits.log` (15 tests), `audits.log` | VERIFIED |
| U1 (blocking): validate only changed font fields; magic check only for Uploaded | done | `institutional_theme_settings.py:249-282` (`changed`, `validate_fonts`, `check_font_file`) | Doctype tests `test_restore_without_files_still_saves_with_another_pairing` (:275), `test_a_changed_font_is_checked_while_the_pairing_stays_uploaded` (:303), `test_other_pairings_do_not_check_stale_font_fields` (:310): not run, no bench. The logic itself was exercised against a stub of `frappe` (throwaway, not committed): switching to IBM Plex with the files missing saves; unchanged Uploaded saves; a changed file and a switch to Uploaded are checked and rejected with `<bdi>` in the message. | stub run COMPUTED; doctype tests not verified |
| U2: print faces get private names | done: `Midad Print Plex Sans`, `Midad Print Plex Sans Arabic`, `Midad Print Plex Mono`, `Midad Print Uploaded Arabic`, `Midad Print Uploaded Latin` | `fonts.py:39-46` (constants), `fonts.py:182-260` (faces and `print_font_families`) | `tests/test_fonts.py` `test_print_faces_never_reuse_a_screen_family_name` and updated expectations; `unittest-midad.log` | VERIFIED. Scribe: `docs/FONTS.md` lists the print TTF rows under the screen names; they are now `Midad Print ...` |
| U3: equality check before writing the prior value on clear | done | `identity_sync.py:115-125` | Doctype tests `test_clearing_a_field_restores_the_original` (:424), `test_clearing_does_not_overwrite_an_administrators_later_edit` (:435): not run. Stub run: clear of an untouched target restores `Stock`; clear after an administrator edit leaves `Admin edit`; both globals emptied | stub COMPUTED; doctype tests not verified |
| U4 (dark re-declarations on descendants) | handed over to css-engineer (Phase 3/4 scoped blocks and probe elements in `cascade.mjs`) | not mine | none | n/a |
| U5 (focus-rule comments, autofill keep) | handed over to css-engineer (CSS only: `_base.scss:13,32`, `:-webkit-autofill:focus-visible`) | not mine | none | n/a |
| U6 (second-app fixture in `cascade.mjs`) | handed over to css-engineer (test fixture and `.btn-primary` specificity) | not mine | none | n/a |
| U7: "declared, never read" as its own category; pin | done: five categories (`declared-read`, `declared-only`, `read-only`, `theme`, `dead`); core read from a committed snapshot so CI needs no bench; `ruff==0.16.8` pinned; audits unit tests and the dead-token audit run in CI | `audits/dead_tokens.py:1-20`, `audits/data/core_vars_frappe_16.32.0.json`, `.github/workflows/ci.yml:30,54-63` (unit tests at :54, audits at :60-63) | `audits.log`: 377 variables, 266 declared and read, 111 declared only, 0 dead; `docs/audits/dead_tokens.txt` | VERIFIED (snapshot built from the bench build `G74HNZ4B` in the partial work; a point release that drops a variable is caught only when the snapshot is refreshed with `--core-css`, which is a manual step) |
| U8: wire `before_uninstall` | done, the only hook enabled; every CSS and JS include stays commented. `after_install` and `after_migrate` stay commented because `install.py` has no such function (nothing to install: install changes nothing) | `hooks.py:37`, `install.py:60-80` (restore identity, delete attachments, clear globals, clear user defaults, delete Version rows, remove site files; each step isolated and logged) | Doctype tests `test_before_uninstall_leaves_nothing_behind_and_is_idempotent` (:450), `test_before_uninstall_continues_after_a_failing_step` (:476), `test_restore_*` (:496, :509): not run. The gate script `tools/bench/gate_install_uninstall.sh` is not mine. | not verified |
| U9: `track_changes: 1` | done | `institutional_theme_settings.json:329` | `uninstall` deletes the Version rows (`install.py:45`, tested at :450, not run) | VERIFIED (file), uninstall part not verified |
| A11y 11: `<bdi dir="ltr">` on `{0}` in font, image, preset messages and the missing-font intro; labels in the contrast message | done: `_ltr()` helper | `institutional_theme_settings.py:64-67,76-82,104,143-144,190,214,278,282,291`; labels from `midad/labels.py` (new: `--control-bg`, `--control-bg-on-gray`, `--disabled-control-bg`, `--input-disabled-bg`, `surface-fill-hover`) | doctype tests assert `<bdi dir="ltr">` (:210, :256, :321, :341): not run; label coverage is asserted by the label tests in `unittest-midad.log` | label coverage VERIFIED; messages not verified |
| A11y 11, remainder | not done: `set_intro` is not announced (client script `institutional_theme_settings.js:6`, no verified live-region hook in Frappe for it); no Arabic-Indic digit option (needs an owner decision, BRIEF 8 asks only for it to be documented: scribe) | | | n/a |

## Commands run

All from the repository root. Logs in this folder.

- `python3.14 -m unittest discover -s institutional_theme/midad/tests -t .` : Ran 125 tests, OK (`unittest-midad.log`)
- `python3.14 -m unittest discover -s institutional_theme/audits/tests -t .` : Ran 15 tests, OK (`unittest-audits.log`)
- `python3.14 -m institutional_theme.midad.build --check` : 10 files checked, 0 stale (`build-check.log`)
- `python3.14 -m institutional_theme.audits` : audits passed; contrast 0 failing (5 shipped presets, both modes), parity 51/0, colour-vision 0 failures and 99 baselined gaps, dead-tokens 0 dead (`audits.log`; the run rewrote `docs/audits/*.txt|json`)
- `ruff check .` and `ruff format --check .` with ruff 0.16.8 : clean (`ruff-check.log`, `ruff-format.log`)
- `python3.14 -m compileall institutional_theme` : compiles (the `except A, B:` form in `identity_sync.py` needs 3.14, as the bench and CI use)

## Not run

- `bench --site midad.test run-tests --app institutional_theme`: see the last section.
- Every doctype test above, the uninstall path, `track_changes`, the install gate: not verified.
- wkhtmltopdf rendering of the print faces (`font-weight: 500 600`, `unicode-range`): not verified (carried from the upgrade review).

## Open risks

- The dead-token snapshot can go stale silently across a Frappe point release; refresh with `python -m institutional_theme.audits --core-css <built css> --write-core-snapshot`.
- The baselined gaps (99 over five presets) are accepted by ADR 0010 on the condition that charts get direct labels and dashes (css-engineer Phase 4); bars and pies rely on labels alone.
- ADR 0010 rule 1 (the `.btn` and `.form-control` rules by css-engineer) must land with the new mapping, or buttons turn white-on-white in Light.
