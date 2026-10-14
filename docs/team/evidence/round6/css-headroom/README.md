# Desk CSS headroom, phase A (code, unit tests, local CI)

Branch worktree `agent-aa024d900b213286d`, base `490dd98`. Code commit `4814fd7`, amended in step B1 (below) by a commit that adds the explicit Dark root selector to the shared block. Nothing in phase A ran on a bench; B1 captures the "before" baseline (`before/`).

Labels: VERIFIED = ran it here, COMPUTED = derived from files here, ASSUMED = not checked.

## The change

`institutional_theme/public/scss/generated/_frappe_map.scss` declared all 424 mapped Frappe variables three times (light, dark, automatic). Every value is a `var(--ins-*)` expression (or a literal), and a custom property holding `var()` is resolved on the element that declares it. Re-declaring an identical expression on the same element changes nothing, so the file is now:

1. one shared block with all 424 declarations (light values), selector list `html:root[dir], html[dir] [data-theme="light"], html:root[dir][data-theme="dark"], html[dir] [data-theme="dark"]` (the union of the old light and dark selectors; no bare `[data-theme]`, no nested automatic). The explicit Dark root selector was added in step B1 so the Dark root keeps (0,3,1) for every name; the dark block follows at the same specificity and wins for the differing names;
2. a dark block (`html:root[dir][data-theme="dark"], html[dir] [data-theme="dark"]`) with only the declarations whose dark value differs from the light value;
3. the same declarations inside `@media (prefers-color-scheme: dark)` for `html:root[dir][data-theme="automatic"]`.

Correction to the brief: the differing set is **79 of 424**, not the 11 grays. Data-driven from `tokens.json` (`emit.dark_delta`): surface 24, ink 18, gray 11, outline 11, diff 3, and 1 to 2 each of scrollbar, code, avatar, skeleton, light, sidebar, yellow, timeline, kanban (COMPUTED). Nothing is hard-coded to grays; no variable had to be kept in the dark blocks beyond the differing ones, because the static analysis below found no outcome that changes.

Generator guard: `build._check_map_values_are_independent` fails the build if a mapped value reads another variable of the map (that would break the equivalence). The 424 real values read only `--ins-*` (VERIFIED by the unit test `test_the_real_map_reads_no_variable_of_the_map`).

`_frappe_map_light.scss` (website, light only) is byte-identical to before (VERIFIED: `build --check` 0 stale; `ins_web` compiled CSS byte-identical before and after).

## Sizes (COMPUTED, sass 1.85.0 `--style=compressed --no-source-map`, `@import` warnings ignored)

| file | before | after | change |
|---|---|---|---|
| `_frappe_map.scss` source | 52472 B | 24615 B | -27857 B |
| `ins_desk.bundle` compiled raw | 149222 B | 122490 B | -26732 B (-17.9 %) |
| `ins_desk.bundle` gzip -9 | 17364 B | 17045 B | -319 B |
| `ins_desk.bundle` gzip -6 | 17619 B | 17257 B | -362 B |
| `ins_web.bundle` compiled raw | 55266 B | 55266 B | identical (cmp) |

The bench measures 146.2 KB for the shipped desk bundle (`docs/audits/budgets.txt`, after rtlcss and the bench minifier). Projection by subtracting the 26.1 KB saving: about 120 KB, headroom about 30 KB (ASSUMED that the bench post-processing removes the same bytes; phase B measures the real file). The gzip budget (30 KB) was never the constraint.

## Static proof that nothing computes differently

### Effective values (VERIFIED)

`audits/effective_diff.py` now evaluates a map text by the cascade of its own rules on five element kinds (root Light, root Dark, root Automatic under a dark OS, nested light, nested dark). Old text (HEAD, three full blocks) against the new text, all 424 names:

```
effective declarations: old 2120 new 2120 equal: True
```

Full output, including the two shipped Frappe versions: `effective-equivalence.txt` (16.32.0 and 16.52.0: changed 0, removed 0, added 0, "does not move"). Automatic under a light OS gets only the shared root block, as before.

### Specificity: where the cascade could differ

After step B1 only one cell changes: on the root element in Automatic under a dark OS, the 345 non-differing names are declared at (0,2,1) (shared block) instead of (0,3,1). Everything else keeps its specificity: Light root (0,2,1) both; explicit Dark root (0,3,1) for every name, both (shared block, then the dark block later at the same specificity); nested light (0,2,1) both; nested dark (0,2,1) both; the 79 differing names are still declared at (0,3,1) on the Automatic root. An outcome in that one cell can change only if another rule declares the same name on the same element with a specificity from (0,2,1) up to, and including when loaded earlier, (0,3,1). Every declaration of a mapped name that can reach those elements:

| source | rules that declare a mapped name | can match `html` or a nested `[data-theme]` element at >= (0,2,1)? |
|---|---|---|
| this theme, `ins_desk.bundle` (compiled expanded, `scan-theme-before.txt` / `scan-theme-after.txt`) | the 3 map blocks; 9 other rules: `.modal/.form-in-grid` (0,3,1), `.grid-body .editable-row` (0,4,1), `.chart-container` (0,3,1), `.fc-theme-standard` (0,3,1), `:is(.btn, ...)` (0,2,0), `.es-toast` (0,3,1), `.es-toast[data-type] > svg` (0,4,2), `.es-button:not(...)` (0,5,1), `.btn.btn-danger` (0,4,1) | No: each subject compound needs a class that `html` does not carry. They set the variable on a descendant, where it replaces the inherited value in both versions. The 9 rule lines are identical before and after (diff of the two scans). |
| `_scale.scss`, `ins_fonts_noto/tajawal`, the 4 palette bundles | none (they declare `--ins-*` only; scan of the compiled expanded CSS found no mapped name) | n/a |
| custom preset CSS written at runtime (`ins_palette_custom.<h>.css`) | none: `midad.palette_css` writes `--ins-*` keys through `emit_family("palette")`, which this change did not touch | n/a |
| `public/js`, `*.py` | no `setProperty` or inline style of a mapped name (grep) | n/a |
| Frappe 16.32.0 core (`/home/user/src/frappe-16.32.0`, tag v16.32.0; `scan-core-16.32.0.txt`) | root-capable selectors are `:root`, `[data-theme="light"]`, `[data-theme="dark"]`, all (0,1,0); the rest are descendant selectors (`.editable-row`, `.modal`, `.chart-container`, ...) | No rule reaches (0,2,1) on the root. |
| Frappe 16.52.0 core (`/home/user/src/frappe-16.52.0`; `scan-core-16.52.0.txt`) | `:root`, `[data-theme="light"]`, `[data-theme="dark"], .dark`, all (0,1,0) | No. (`tokens.json` calls core's `--desk-sidebar-bg` redeclaration (0,2,0); (0,2,0) < (0,2,1) either way, and `test_the_map_shapes_beat_core` asserts every map selector is >= (0,2,0).) |
| HRMS 16.20.1 (`/home/user/src/hrms-16.20.1`; `scan-hrms-16.20.1.txt`) | none | n/a |

Outcome per element kind, before and after (COMPUTED from the rule list above):

| element | rules that match | before | after | same? |
|---|---|---|---|---|
| root, Light | `html:root[dir]` | light value | light value | yes |
| root, Dark, differing names | shared (0,2,1), dark (0,3,1) | dark value | dark value | yes |
| root, Dark, other names | shared, at the explicit Dark root selector (0,3,1) | same expression at (0,3,1) | same expression at (0,3,1) | yes, same specificity too |
| root, Automatic, light OS | `html:root[dir]` | light value | light value | yes |
| root, Automatic, dark OS | shared (0,2,1), automatic media block (0,3,1) | dark value (all names at (0,3,1)) | dark value (differing, (0,3,1)) or same expression at (0,2,1) | yes, unless a rule competes in (0,2,1) to (0,3,1); none found |
| nested light, in Dark or Light | `html[dir] [data-theme="light"]` (0,2,1) | light value | light value | yes |
| nested dark, in Light or Dark | `html[dir] [data-theme="dark"]` (0,2,1); after: shared then dark block, same specificity, later wins | dark value | dark value | yes |
| nested automatic | no selector in either file | inherits | inherits | yes |

The root selectors (`html:root[dir]...`) never match a nested element, and the nested selectors keep their specificity, so the nested rows cannot move. Because the declared values are `var(--ins-*)` expressions, each is resolved on its own element against that element's `--ins-*` (which `_tokens.scss` and the palette files switch per mode), so repeating the identical expression is a no-op.

### Residual exposure

Remaining cell: Automatic under a dark OS, 345 non-differing names at (0,2,1) instead of (0,3,1). No rule can exploit it in the code scanned:

- Frappe 16.32.0 and 16.52.0 core: root rules are (0,1,0) (above).
- ERPNext 16.33.0 (`/home/user/frappe-bench/apps/erpnext`, `scan-erpnext-16.33.0.txt`) and 16.50.0 (`/home/frappe/newest-bench/apps/erpnext`, `scan-erpnext-16.50.0.txt`; the second bench ships 16.50.0, not 16.52.0): the only declarations of mapped names are in the compiled banking single-page app CSS (`public/banking/assets/index-*.css`): `:root`, `:host` and `.dark`, all (0,1,0), on that page only. VERIFIED by reading files, nothing run.
- HRMS (source 16.20.1 above; bench copy `scan-hrms-bench.txt`): the `/hrms` and `/roster` single-page apps declare `:root` and `[data-theme=dark]` (0,1,0) on their own pages.
- A third-party app that declares one of those names on the root with a specificity of (0,2,1) to (0,3,1) would differ in Automatic-dark only (ASSUMED none; the coexistence fixtures in `tests/browser` use `html[lang=ar], html[dir=rtl] { --font-stack }`, (0,1,1)).
- Phase B2 dumps `getComputedStyle(documentElement)` of all 424 names in every mode before and after, including Automatic with the OS emulated dark and light.

## Code changes and test expectation changes

- `midad/emit.py`: `SHAPES["map"]`, `dark_delta`, `emit_map_family`. Palette shapes and `emit_family` unchanged (palette bundles and custom preset still use them).
- `midad/build.py`: `render_frappe_map`, `_check_map_values_are_independent`; the file's comment explains the shape.
- `audits/parity.py`: `check_map_family` replaces `check_family` for `_frappe_map.scss`. Same three check names, so `docs/audits/parity.txt` is unchanged (VERIFIED: audits run, `docs/audits` unchanged). It asserts: selector shapes of the three blocks; every dark key is a key of the shared block; effective Dark key set equals the Light key set; dark keys in map order; automatic block equals dark block; no dark declaration repeats the light value; the dark block equals exactly the model's dark delta; no `color-scheme`. The var-reference and names checks read the first block (now the shared one with all 424).
- `audits/effective_diff.py`: `effective_declarations`, `CONTEXTS`; `compare` works on effective values and groups moves by name and values (so the report says which element kinds move together). Labels are `root Light`, `root Dark`, `root Automatic (dark OS)`, `nested light`, `nested dark`.
- `tools/docs/token_tables.py`: reads the shared block overlaid with the dark delta. The generated `docs/DESIGN_SYSTEM.md` was identical for the old and the new map (VERIFIED, ran the tool on a HEAD export and on the worktree). The committed `docs/DESIGN_SYSTEM.md` is already stale against the generator at HEAD (missing ramp steps 450 and 950, other rows); that is not caused by this change and I did not regenerate it.
- Expectations changed because they asserted the old text shape (none weakened, replacements assert the same facts on effective values):
  - `midad/tests/test_emit.py::LightOnlyPartials::test_website_map_is_the_light_block_without_the_desk_only_names`: `web.selectors == full.selectors` became `web.selectors == SHAPES["palette"]["light"]` and `full.selectors == SHAPES["map"]["shared"]` (the desk map's first block carries the extra nested-dark selector).
  - `midad/tests/test_round4_map.py::DarkSpecificity::test_the_generated_dark_block_declares_the_sidebar_background`: asserted two lines inside the dark block text; `--desk-sidebar-bg` is the same in both modes and is no longer in the dark block. Replaced by an effective-value assertion for all five element kinds plus "in shared, not in dark". Added `test_the_map_shapes_beat_core`.
  - `audits/tests/test_effective_diff.py`: `GeneratedMap` counted equal variable counts per block (3 equal blocks); now shared > dark == automatic and every element kind holds the same variables. `test_the_two_16_32_0_radius_readers_are_covered_explicitly`: 6 accepted declarations (2 names x 3 blocks) became 2 grouped entries, each naming all five element kinds. The `BEFORE`/`AFTER` fixtures (old shape) still pass unchanged, so old-shape texts stay comparable.
- New tests: `FrappeMapShape` (emit shape, shared list is the union, missing key raises, delta order, effective equality with the model for all five element kinds, delta is data-driven and larger than the 11 grays, independence guard, parity catches a redundant, missing or foreign dark declaration) and `Effective` (three full blocks equal shared plus delta; a delta that forgets a dark value or the media block is a movement; grouping).

## Commands run (VERIFIED)

- `python3.14 -m institutional_theme.midad.build` then `--check`: "12 file(s) checked, 0 stale".
- Unit suites before the final commit: midad 162 tests OK, audits 177 tests OK. Ruff 0.16.8 check and format: clean.
- `python3.14 -m institutional_theme.audits --dist <empty dir>`: "audits: passed", `docs/audits` unchanged.
- Full `tools/ci/local_ci.sh` on the final commit: `phaseA-local_ci.log` in this directory.
- Compile for the sizes: `sass@1.85.0` installed in a scratch directory (`npm i sass@1.85.0`), `--style=compressed --no-source-map --load-path=institutional_theme/public/scss`.

## Not verified yet (phase B)

- Bench cascade in a real browser: `tests/browser/cascade.mjs` (it compiles the SCSS text and works unchanged with the new shape, but I did not run it).
- Computed-style dump of all 424 names on `documentElement` and on nested `[data-theme]` elements in Light, Dark, Automatic-light, Automatic-dark, before and after, with ERPNext and HRMS installed.
- Pixel diffs of the shipped screens, RTL bundle, the bench-built `ins_desk.bundle.css` size and `docs/audits/budgets.txt` (needs a bench build; the file is not regenerated by CI with an empty dist).
