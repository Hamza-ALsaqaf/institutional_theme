# Design source: Midad

The approved design. The owner reviewed these artboards and approved them on 2026-10-13. Build what is here; propose changes in a decision record, do not drift.

Design canvas (private to the owner): <https://claude.ai/artifact/HhB7LWgy7aisqbR7K52GUL>

## What is in this folder

| Path | What it is |
|---|---|
| `tokens.json` | The single source of truth for every colour, type, spacing, radius, elevation and motion value, the mapping onto Frappe's own variables, the colour presets, and the contrast pairs that must pass. Authored in OKLCH. |
| `canvas/midad.css` | The resolved tokens for Light and Dark plus the atoms used by the artboards (buttons, status pills and their CSS shapes, fields, tables, sidebar, page head, the closing rule). **This is the visual specification in executable form.** It uses illustrative class names, not Frappe's. |
| `canvas/*.dc.html` | One artboard per screen. `Main` is the identity board. `Login`, `Home`, `List`, `Form`, `Report`, `States`, `Print` are the screens. Files ending in `Dark` only import the same source with `theme="dark"`. Open them as text: the markup and inline styles are the layout specification. |
| `canvas/canvas.json` | Artboard layout index of the canvas. |
| `reference/color.mjs` | Reference implementation of the colour maths (OKLCH to sRGB with chroma-reducing gamut mapping, WCAG contrast, colour-vision simulation, OKLab distance). To be ported, see below. |
| `reference/tokens.resolved.json` | Every primitive and semantic token of the default preset resolved to hex, both modes. Use it as a test fixture for the port. |

## The identity in one page

**Midad (مداد, "ink")**: ink on paper, closed with a seal.

- **Primary, Prussian ink** (hue 252). Button `#1b5086`, brand `#0f3a65`. In dark the primary is a light ink (`#a7c9f0`) carrying dark text.
- **Accent, antique brass** (hue 82), `#997324` in light, `#d5ae63` in dark. Under 5% of any screen: the closing rule and the active-item marker. Never text.
- **Neutrals**: `slate` for light (cool, hue 255) and `night` for dark, tuned by hand. Dark surfaces: sunken `#0b1119`, base `#111820`, raised `#171e28`, overlay `#1d252f`. Elevation is a lighter tone plus a hairline, never a shadow.
- **Semantic hues** share one lightness curve: viridian (success), terracotta (pending), ochre (warning), oxide red (danger), azure (submitted, links), violet (amended).
- **Type**: IBM Plex Sans Arabic, IBM Plex Sans, IBM Plex Mono. 14px body and form text, 13px table data, 12px minimum, weights 400 / 500 / 600 only.
- **Shape**: 4px controls, 6px containers, 8px overlays. 1px hairlines. 4px grid.
- **Focus**: one ring, 2px solid, 2px offset, drawn with `outline` so it survives forced-colors.
- **Motif, the closing rule**: a 3px ink rule over a 1px ink rule with a 48px brass lead segment at the inline start. It is also the real double rule above grand totals.

### Status language

Colour, label and a shape drawn in pure CSS (see `.pill` and `.p-*` in `canvas/midad.css`).

| Status | Role | Shape |
|---|---|---|
| Draft / مسودة | neutral | ring |
| Pending approval / بانتظار الاعتماد | pending | half disc |
| Approved / معتمد | success | check |
| Rejected / مرفوض | danger | cross |
| Submitted / مُرحَّل | progress | dot |
| Cancelled / ملغى | muted | square |
| Amended / معدَّل | special | diamond |
| On hold / معلَّق | warning | two bars |
| Overdue / متأخر | danger | triangle |
| Completed / مكتمل | success | target |

Core emits Draft and Cancelled both as red and gives the workflow "Inverse" style no rule at all. Getting to this table needs the hooks described in `docs/research/frappe-16.32-findings.md` section 4.

## Colour presets

`tokens.json` → `palettes`. `midad` is the default and must stay byte-for-byte the approved design. The other five are the owner-requested calm, formal alternatives; their hex values are indicative until the pipeline computes and audits them. `forest` and `umber` carry a flagged risk and are dropped if they fail the distinguishability check.

## What the artboards are not

They are design comps drawn with illustrative markup. They follow the structure of Frappe 16.32 (sidebar, sticky page head, no top bar, no dock) but they do not use Frappe's DOM or CSS. The interactive proof built during implementation must use Frappe's real class names on top of the real compiled core CSS, so that approving the proof equals approving the product.

Known gaps in the approved comps, to be closed during the build:
- English, LTR versions of the screens were not drawn.
- Compact density was not drawn.
- The chart palette for dark mode needs tuning for colour-vision deficiency (minimum OKLab distance 4.4 under protanopia; light mode reaches 10.7).
- The Desktop (apps) screen, Kanban, Calendar, Tree and Gantt were not drawn.

## Porting the colour maths

The owner wants presets and a custom brand colour selectable at runtime, so the same maths must run on the server when settings are saved. Implement it once, in dependency-free Python, and use that one implementation for the build pipeline, the audits and the runtime. `reference/color.mjs` is the specification and `reference/tokens.resolved.json` is the fixture: the Python port must reproduce every hex in it exactly.
