# Upgrade review, Phase 2 (f0d5790..e4015f7)

Run (VERIFIED): `ruff check` and `ruff format --check` clean; 122 unit tests OK (Python 3.13); `build --check` 0 stale; audits pass: parity 51/0, contrast 0 failing, dead-tokens 377 checked against `desk.bundle.G74HNZ4B.css`, 0 dead. Built LTR and RTL bundles are identical; font URLs are absolute. `!important`: 0 in compiled CSS. The 2 hits in `desk/_base.scss` are inside comments.

## Findings

**1. BLOCKING: after a restore without files, the settings cannot be saved.** `institutional_theme_settings.py:228-242` checks every font URL that is set, whatever the pairing. `fonts.file_kind` returns `None` for a missing file (`fonts.py:70-76`). After a restore without files, every save throws "… is not a WOFF2 or TrueType font file", and that includes switching the pairing to IBM Plex. This contradicts ADR 0004's restore contract. Fix: validate only font fields that changed in this save (`get_doc_before_save()`), and skip the magic-number check when the pairing is not `Uploaded`.

**2. ADVISORY (blocks Phase 4): print faces reuse the screen family names.** `fonts.py:33-35,173-188,209-216` declares full-range TTF faces as `Midad Plex Sans`, `Midad Plex Sans Arabic` and `Midad Plex Mono`. Print Style CSS goes into every desk boot (`frappe/boot.py:283-288`) and is injected as a `<style>` after the bundles (`public/js/frappe/desk.js:289-290`). Later faces win, so the desk swaps from the 235 KB WOFF2 subsets to about 1.4 MB of TTF, with a second font swap after boot. Fix: give print faces their own private names, for example `Midad Print Plex Sans`, and use those names in `print_font_families`.

**3. ADVISORY: clearing a field overwrites an administrator's later edit.** `identity_sync.py:116-119` writes the prior value back without checking that the target still holds the value this app wrote. `restore()` does check (`:151`). Fix: apply the same equality check before writing on clear.

**4. ADVISORY: dark-mode re-declarations on descendants are not covered, and the proof does not look there.** The map sets `--control-bg`, `--charts-stroke-width` and `--charts-dataset-circle-stroke` on the root (`_frappe_map.scss:592,708-709`). Core re-declares them on descendants in dark: `desk/dark.scss:174-175` (`.grid-body .editable-row`), `:189-193` (`.modal, .form-in-grid`), `:222-234` (`.chart-container`: `5px`, `#ffffff`, `white`). `frappe_datatable.scss:2` compiles `$primary` to a literal. In dark: 5px chart lines, white circle strokes, modal fields on `--gray-800`. `tests/browser/cascade.mjs` reads only `document.documentElement`. Fix: in Phase 3 and 4, add scoped blocks for every item in findings §2, and add probe elements inside `.modal`, `.chart-container` and `.grid-body .editable-row` to the fixture.

**5. ADVISORY: the focus rule's specificity is mislabelled and it removes every box-shadow.** `_base.scss:13` says (0,3,1). The rule at lines 15-24 is (0,4,2), because `:is()` takes its most specific argument (`a[href]`). It sets `box-shadow: none` on every focus-visible element, including the autofill mask (lines 50-55, (0,3,2)). A focused autofilled field therefore shows Chrome's autofill background. The selection comment (line 32) is also wrong: core has `[data-theme=dark] ::selection` (0,1,1). Fix: correct the comments, and on `:-webkit-autofill:focus-visible` keep the inset shadow and use the outline as the cue.

**6. ADVISORY: no test models the second app.** Findings §8: `tcsid-brand.css` sets `--font-stack` at (0,1,1), which loses to the map's (0,2,1) (COMPUTED). Its `[data-theme=light] .btn-primary` rules set properties directly at (0,2,0) and (0,3,0), so mapped variables cannot win against them. Fix: add a fixture stylesheet that reproduces the §8 rules, load it after `ins_desk` in `cascade.mjs`, and in Phase 3 give `.btn-primary` property rules at (0,3,1) or higher.

**7. ADVISORY: the dead-token audit overstates what it proves and does not run in CI.** `dead_tokens.py:81-84` passes any variable that core declares. 111 of the 377 mapped variables (ramps, `--ink-*`, `--outline-*`) are never read by any compiled Frappe or ERPNext CSS (COMPUTED), so they are inert. `.github/workflows/ci.yml:56-57` runs the audits without `--core-css`, so a point release that drops a variable passes CI. The committed report scanned a different build (`OJNSMEVS`); running the audit without `--no-write` rewrites it (I reverted my run). Fix: report "declared, never read" as its own category; in CI, build the core CSS or fetch a pinned copy, then pass `--core-css`; pin the `ruff` version (`ci.yml:30`).

**8. ADVISORY: uninstall leaves residue, and unreviewed code is on `main`.** `before_uninstall` is not wired. `hooks.py` enables nothing, and `identity_sync.py:22` defers the hook to Phase 3. Uninstalling after an identity save leaves this app's values in core settings, the `ins_identity_*` globals, and orphaned File rows. `origin/main` contains e4015f7 before any Phase 2 gate. Fix: wire `before_uninstall` in Phase 3, and keep `main` at the Phase 1 commit until this gate passes.

**9. ADVISORY: no audit trail.** The doctype JSON lacks `track_changes`. Fix: add `"track_changes": 1`.

Confirmed in source: dict `set_single_value` (`database.py:843-876`); `__global` defaults stay out of `sysdefaults` (`defaults.py:105-118`); empty Singles load defaults (`document.py:259-264`); rtlcss runs before minification (`esbuild.js:298-312`).

## Not verified

- `tcsid-brand.css` is not on this bench, so its exact rules could not be checked.
- Whether wkhtmltopdf parses `font-weight: 500 600` and `unicode-range` in print faces (`fonts.py:206`).
- Ring on script-focused `[tabindex]` containers; Chrome's dark autofill colour.
- The doctype tests (not re-run).
