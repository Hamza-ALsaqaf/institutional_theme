# 0010 — Contrast corrections, Phase 2

Status: accepted, 2026-10-13. Resolves a11y-phase2 BLOCKING 1, 2, advisory 10. Ratios COMPUTED (`midad.model`).

## Context

- The artboards draw fields on `surface-field` (`midad.css:186,194`; on grey, `List.dc.html:24`). `tokens.json` maps `--control-bg` → `surface-fill` and `--control-bg-on-gray` → `surface-fill-hover`.
- Core reads `--control-bg` for `.form-control` (`desk/variables.scss:46`) and other field parts. It also reads it for buttons: `.btn-default` (`common/buttons.scss:107`), `.btn-secondary` (`:81`) and `.btn:active` (`:19`). `--btn-default-bg` is read only by `desktop.scss:743-819` and `grid.scss:299`.
- `--control-bg-on-gray`: print-builder and list-filter fields (`Preview.vue:132`, `list_sidebar.scss:87`), Ace active line (`controls.scss:252`).
- Core `.form-control` has `border: none`.

## Decision

**1. Fields on `surface-field`.** Preference (a): no value changes.

| JSON path | old | new |
|---|---|---|
| `frappe.vars["--control-bg"]` | `@surface-fill` (both modes) | `@surface-field` (both modes) |
| `frappe.vars["--control-bg-on-gray"]` | `@surface-fill-hover` (both modes) | `@surface-field` (both modes) |

The css-engineer adds two rules in the same commit:

- `:is(.btn, .filter-chart, .avatar-action, .ql-mention-list-item, .ql-editor .mention) { --control-bg: var(--ins-surface-fill); }`. Buttons and chips keep today's fill (core's own pattern, `grid.scss:299`). Core declares `--control-bg` only on ancestors (`dark.scss:174,191`, `grid.scss:285,299`), so this wins.
- `.form-control { border: 1px solid var(--ins-border-control); }` at (0,1,0). Loaded after core, it beats `border: none`; it loses to `.datatable .form-control` (0,2,0) and `.grid-body .editable-row .form-control` (0,3,0), so cells stay borderless. Without it, Light fields are white on white.

Effect: inputs, selects, Bootstrap custom checkbox, Link button, Quill, Ace (active line untinted, as in core Dark), signature, attach, `kbd` move to `surface-field`. Native checkboxes read no `--control-bg` (`checkbox.scss:4-35`): unchanged. Phase 3 gives Quill, Ace and signature `border-control` (core: `--border-color`) and sets `--control-bg` in its `.modal, .form-in-grid`, `.editable-row` blocks. Until then Dark dialog fields stay on today's `night.800` (placeholder 4.80, border 3.41).

**2. Dark selected-and-hovered row.** Preference (c): nothing maps this token yet. `semantic.surface.surface-selected-strong.dark` changes from `oklch(0.35 0.065 252)` (`#1f3c5b`) to `oklch(0.34 0.065 252)` (`#1d3958`).

One value; follows each preset's primary hue; all six presets pass (lowest 4.56). Lightening `night.400` would move three tokens. Cost (rule 1 accepts it): hover-on-selected against selected drops 1.21 → 1.16; hover is feedback, not state.

**3. Charts.** frappe-charts 2.0.0-rc27 (`src/js/`):

- **Dashes.** Each line series is `g.dataset-line.dataset-N` (`ChartComponents.js:370`). `.line-graph-path` has only `stroke`, `stroke-width` inline (`draw.js:100-110,629`): CSS `stroke-dasharray` works. Bars use it internally (`draw.js:477`): never dash bars. Legend swatches are solid rects (`draw.js:228-236`).
- **Markers.** Circles only (`draw.js:584`).
- **Labels.** `valuesOverPoints`, lines and bars (`AxisChart.js:52,270`); core sets it from Dashboard Chart `show_values_over_chart` (`chart_widget.js:697`).

Series 1-6 reorder to 1,5,3,2,6,4 (deviations). Every neighbour (6→1 included) then passes 5.0 in all visions, modes and presets: worst 0.3 → 5.9.

**Accepted gap** (non-neighbours, new numbering): grayscale chart-2/5 0.3 (Light), chart-4/6 0.3, chart-2/6 0.6, chart-2/4 1.0 (Dark); protanopia chart-3/6 4.4 (Dark); series 7-8 down to 1.0 (tritanopia) and 0.3 (grayscale); bars and pies have labels only. No data-table toggle.

## Ratios, Light / Dark (bold fails)

| pair | before | after |
|---|---|---|
| `text-placeholder` on `--control-bg` | **4.41** / 4.80 | 4.87 / 5.88 |
| `text-placeholder` on `--control-bg-on-gray` | **4.07** / **4.36** | 4.87 / 5.88 |
| `border-control` on `--control-bg` | 3.04 / 3.41 | 3.36 / 4.18 |
| `border-control` on `--control-bg-on-gray` | **2.81** / 3.10 | 3.36 / 4.18 |
| `text-muted` on `surface-selected-strong` | 5.40 / **4.49** | 5.40 / 4.69 |

## `contrast.groups` edits (minimum after)

- "Body text and headings": add `--control-bg`, `--control-bg-on-gray`, `surface-fill`, `surface-fill-hover` (7.40).
- "Help, caption and placeholder text": add `--control-bg`, `--control-bg-on-gray` (4.87).
- "Help text on hover and selected rows": add `surface-selected-strong`, `surface-active`, `surface-fill` (4.69).
- "Input, checkbox and switch boundary": add `--control-bg`, `--control-bg-on-gray`, `surface-hover` (3.04).
- "Disabled text stays legible": add fg `text-placeholder` and bg `--disabled-control-bg`, `--input-disabled-bg` (3.70; inactive controls are exempt).

## Design deviations

| JSON path (`semantic.…`) | approved, verbatim | new |
|---|---|---|
| `surface.surface-selected-strong.dark` | `oklch(0.35 0.065 252)` | `oklch(0.34 0.065 252)` |
| `chart.chart-2` light / dark | `amber.700` / `amber.500` | `purple.500` / `purple.400` |
| `chart.chart-4` | `red.800` / `red.400` | `amber.700` / `amber.500` |
| `chart.chart-5` | `purple.500` / `purple.400` | `orange.500` / `orange.600` |
| `chart.chart-6` | `orange.500` / `orange.600` | `red.800` / `red.400` |

**Fixture rule.** `design/reference/tokens.resolved.json` stays the approved record. The fixture test asserts equality for every key except `sem.dark.surface-selected-strong` (`#1d3958`) and `sem.{light,dark}.chart-{2,4,5,6}`, which it asserts equal to the new values.

## Rejected

- `--control-bg` set only on field selectors: a missed field keeps the failing grey.
- Darker `text-placeholder` or `border-control`: changes values to fix a mapping error.

## Consequences

- **backend-engineer**: the edits, fixture exceptions, and a colour-vision check failing on any failing neighbour or any GAP absent from a baseline in `audits/data/`.
- **css-engineer**: the two rules now; Phase 4: dashes on series 2-6, frappe-charts manifest entry, protanopia and grayscale screenshots per chart.
- **scribe**: documents `show_values_over_chart`.

## Verification

Audits pass for every preset. `cascade.mjs` asserts in Light and Dark: `.form-control` background `surface-field`, border `border-control`; `.btn-default` background `surface-fill`; `.datatable .form-control` border `none`.
