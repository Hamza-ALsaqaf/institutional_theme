# Phase 2 evidence: colour package, build pipeline, audits

Author: backend-engineer. Base commit `923484f` (nothing committed by this task). Python 3.14 at
`/root/.local/share/uv/python/cpython-3.14-linux-x86_64-gnu/bin/python3.14` (`$PY` below), run from
`/home/user/institutional_theme`. Labels: VERIFIED = run in this session; COMPUTED = derived from
verified output; NOT VERIFIED = not run.

## Files written

- `institutional_theme/midad/{__init__,colour,model,emit,build,labels}.py`, `midad/generated/model.json`
- `institutional_theme/midad/tests/{__init__,test_colour,test_model,test_emit}.py`
- `institutional_theme/audits/{__init__,__main__,contrast,parity,colour_vision,dead_tokens}.py`
- `institutional_theme/public/scss/generated/{_tokens,_frappe_map,_scale,_literals}.scss`,
  `ins_palette_{graphite,petrol,forest,plum}.bundle.scss`
- `docs/audits/{contrast.txt,contrast.json,parity.txt,colour_vision.txt,dead_tokens.txt,presets.txt}`

## 1. Unit tests (VERIFIED)

```
$ $PY -m unittest discover -s institutional_theme/midad/tests -t . -v
Ran 81 tests in 1.494s
OK                                   exit 0   (wall 1.6 s)
```

16 in `test_colour`, 33 in `test_model`, 32 in `test_emit`. No Frappe, no network.

Fixture reproduction (`test_colour.FixtureReproduction`, the first test class):

- all 170 primitive hex values (15 ramps) equal `design/reference/tokens.resolved.json`;
- all 242 hex semantic values (121 tokens x Light and Dark) equal the fixture;
- the 12 non-hex values (scrim, elevations) resolve: `rgba(9, 16, 24, 0.45)` and `rgba(5, 8, 12, 0.7)`
  for the scrims, light shadows verbatim, dark shadows with `@border` replaced by the dark border hex;
- `test_emit.GeneratedFiles.test_tokens_scss_midad_values_equal_the_fixture_byte_for_byte` parses the
  generated `_tokens.scss` and compares the same 242 values.

No rounding or gamut-mapping difference was found: JS `Math.round` is `floor(x + 0.5)` (ported), and the
24-step binary search and the +/-0.0005 tolerance are ported unchanged. Golden values for the other
functions (`oklch_to_hex` with the clipped flag, `hex_to_oklch`, `contrast`, `simulate` for four
deficiencies, `delta_e`, `composite`) were produced by running `design/reference/color.mjs` under Node 22
and are asserted in `test_colour.ColourMaths`.

Also asserted: the "indicative" hex values of `tokens.json` (button, brand, dark button, accent) are
reproduced exactly for all six presets, which confirms the chroma-multiplier reading of the presets.

## 2. Build, twice, and `--check` (VERIFIED)

```
$ rm model.json generated/* presets.txt ; $PY -m institutional_theme.midad.build
wrote ... (10 files)   build: 10 file(s), 10 written, 0 removed          exit 0
$ $PY -m institutional_theme.midad.build
build: 10 file(s), 0 written, 0 removed                                  exit 0   (0.16 s)
$ sha256sum <10 files> | diff - <sums of the first run>                  IDENTICAL (also after a clean rebuild)
$ $PY -m institutional_theme.midad.build --check
build --check: 10 file(s) checked, 0 stale                               exit 0
```

Negative checks (VERIFIED): appending a line to `_scale.scss` gives `stale: .../_scale.scss`, exit 1; a leftover
`ins_palette_umber.bundle.scss` (a dropped preset) gives `stale`, exit 1; the next build removes it.
Unit tests cover the same (`test_a_stale_file_is_detected`, `test_a_leftover_bundle_...`).

The generated SCSS was also compiled standalone with the bench's sass 1.69.5
(`/home/frappe/frappe-bench/apps/frappe/node_modules/sass`): all four partials and all four palette bundles
compile; the rtl ignore pair survives in the bundles; no `color-mix`. The real bundle build through
`bench build` was NOT run (no `ins_*.bundle.scss` entry exists yet).

## 3. Audits (VERIFIED)

```
$ $PY -m institutional_theme.audits --core-css /home/frappe/frappe-bench/apps/frappe/frappe/public/dist/css
contrast  midad     light pass (0 failing)     contrast  midad     dark  pass (0 failing)
contrast  graphite  light pass (0 failing)     contrast  graphite  dark  pass (0 failing)
contrast  petrol    light pass (0 failing)     contrast  petrol    dark  pass (0 failing)
contrast  forest    light pass (0 failing)     contrast  forest    dark  pass (0 failing)
contrast  plum      light pass (0 failing)     contrast  plum      dark  pass (0 failing)
contrast  umber     light pass (0 failing) (not shipped)   ... dark pass (0 failing) (not shipped)
contrast: 0 failing pair(s) in shipped presets
parity: 51 checks, 0 failed
colour-vision: 0 status failure(s), 67 chart gap(s) in shipped presets
dead-tokens: 377 variables checked, 0 dead
audits: passed                                                           exit 0   (0.2 s)
$ $PY -m institutional_theme.audits         (no --core-css)
dead-tokens: not run (no --core-css PATH given)                          exit 0
```

- Contrast: 181 pairs x 2 modes per preset (every pair of the 41 `groups` and the one `max` rule). `midad`:
  zero failures in both modes; closest margins are `--scrollbar-thumb-color` on `--scrollbar-track-color`
  3.04:1 (light, needs 3) and `text-placeholder` on `surface-sunken` 4.61:1 (light, needs 4.5). 2 pairs
  (light) and 6 pairs (dark) are below their advisory target, not their minimum.
- Dead tokens: all 377 overridden variables are declared by core's compiled CSS (desk, email, login, print,
  print_format, report, web_form, website bundles of the bench at `/home/frappe/frappe-bench`).
- The audit exits 1 when a generated file is missing or a dropped preset leaves a bundle behind (seen once
  while testing).

### Colour vision

Distance is the OKLab Euclidean distance x 100 after simulating the deficiency (Machado et al. 2009). One
threshold, 5.0, for both checks.

- Status check (fatal; the build drops a failing preset): the primary against the `status-<role>-solid` of every
  chromatic role whose ramp hue is within 45 degrees of the primary hue, Light and Dark, normal vision and
  protanopia, deuteranopia, tritanopia. Closest approach per preset: midad 7.7, graphite 7.1, petrol 8.1, forest 7.4, plum 8.5, umber 3.3. `forest` passes (closest 7.4
  vs teal, 8.3 vs success). `umber` FAILS: dark mode, tritanopia, `primary` vs `status-warning-solid` 3.3
  (see `docs/audits/presets.txt`); it is dropped and has no bundle.
- Chart check (reported, not fatal): closest pair of series, sets "series 1-6" and "series 1-8".
  `midad` series 1-6: light 15.0 normal, 10.7 protanopia, 12.1 deuteranopia, 12.1 tritanopia; dark 12.0
  normal, **4.4 protanopia** (chart-3 vs chart-4), 6.8 deuteranopia, 4.9 tritanopia (chart-2 vs chart-4).
  This reproduces the design README figures (4.4 dark protanopia, 10.7 light protanopia: the README
  measured series 1-6). Against the 5.0 threshold, dark protanopia (4.4) and dark tritanopia (4.9) are gaps.
  Series 1-8 adds: chart-3 vs chart-7 (teal.600 vs cyan.600, same lightness) 4.9 normal, 4.5 prot/deut and
  1.0 tritanopia in Light; chart-1 vs chart-7 3.9 normal, 1.8 deuteranopia in Dark; chart-3 vs chart-8 2.1
  protanopia in Dark. Grayscale: chart-5 vs chart-6 (L 0.634 vs 0.635) is 0.3 in Light and chart-2 vs chart-4
  0.3 in Dark, so the claim in `tokens.json` that series differ in lightness holds only partly.
  The 67 "gaps in shipped presets" count every (preset, set, mode, vision) line below 5.0; the chart colours
  other than `chart-1` do not depend on the preset, so most repeat across presets.

## 4. Custom preset (VERIFIED by unit tests and a hue scan)

`model.custom_preset(primary_hex, accent_hex)` follows ADR 0005: hue of the input kept, chroma multiplier
`min(1, C_input / C_ramp[nearest step in lightness])`, lightness from the approved curves, neutral hue 255.
It returns `(params, palette, failures)`; `failures` holds one entry per (fg, bg, mode) with English labels
from `labels.py`, `ratio_text` rounded to the failing side, the required ratio and `adjust`
(`primary` or `accent`). `custom_palette_css()` raises `PaletteRejected` unless every pair passes.

Finding: with the approved maths no hue can fail. A scan of primary hue 0 to 358 and accent hue 0 to 358 in 2
degree steps at chroma multiplier 1 found zero failing pairs (the multiplier never exceeds 1 and lightness is
fixed), and saturated inputs (`#cfe3ff`, `#ffff00`, `#00ff00`, `#ff0000`, `#0000ff`, `#ffd700`) all pass.
The ADR 0005 test "a pale custom primary is rejected" cannot be met by input alone; the rejection path is
tested by tightening a requirement in a copy of the model. The gate stays as a safeguard.

## 5. Lint (VERIFIED)

```
$ uvx ruff check institutional_theme/midad institutional_theme/audits     All checks passed!
$ uvx ruff format --check institutional_theme/midad institutional_theme/audits   16 files already formatted
$ uvx ruff format --check          (whole repo)   1 file would be reformatted
```

The one file is `institutional_theme/hooks.py`, not touched by this task and already unformatted at the base
commit (`git diff` after `ruff format` showed only it). It was restored.

## 6. Not verified

- Anything inside Frappe or a real `bench build` (no consumer of the generated files exists yet).
- The CI edit (`.github/**`, owned by the other instance) and `fonts.py`, `site_files.py`, the doctype: later tasks.
- The language of the Arabic strings: `labels.py` holds English source strings only (`all_strings()` lists 102 for the scribe).
