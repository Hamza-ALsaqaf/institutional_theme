# Phase 2 evidence: desk CSS cascade (css-engineer)

Labels: COMPUTED = read from getComputedStyle in headless Chromium (Playwright 1.56.1 core, `/opt/pw-browsers` chromium-1194) against the real compiled core CSS. Nothing here is a screenshot.

## Commands

```
cd tests/browser && npm install            # playwright-core only; node_modules is git-ignored
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node cascade.mjs
```

`cascade.mjs` compiles `ins_desk.bundle.scss` and `generated/ins_palette_graphite.bundle.scss` with the bench's sass 1.69.5 (`renderSync`, `quietDeps: true`, the same options as `esbuild/sass_options.js`; no custom importer is needed for these files), runs rtlcss 4.1.1 on each, and loads them after core's `desk.bundle.OJNSMEVS.css` (LTR) or `css-rtl/desk.bundle.T3V3SNHK.css` (RTL), names taken from `assets.json` and `assets-rtl.json`. Expected values come from the generated SCSS (`harness/css_model.mjs` parses the partials and resolves `var()` chains), not from the browser.

## Compile

- Sass warnings or debug messages: **0** (collected through the `logger` hook; any entry fails the run).
- `ins_desk.bundle.css`: 81,500 bytes (includes the font faces from `fonts/_plex.scss`). `ins_palette_graphite.bundle.css`: 2,342 bytes.
- `!important` in the output of `desk/_base.scss`: **0**.
- rtlcss LTR vs RTL, comments and whitespace stripped: **identical** for both bundles.

## Matrix

LTR and RTL x palette run {midad only; graphite after ins_desk; graphite BEFORE ins_desk} x {Light; Dark; Automatic with prefers-color-scheme light; Automatic with dark} = 24 pages, 1008 assertions: **1008 pass, 0 fail**.

| Check (per page unless noted) | Pass | Fail |
|---|---|---|
| all N custom properties from generated partials | 24 | 0 |
| --bg-color | 24 | 0 |
| --fg-color | 24 | 0 |
| --text-color | 24 | 0 |
| --border-color | 24 | 0 |
| --control-bg | 24 | 0 |
| --gray-500 | 24 | 0 |
| --gray-900 | 24 | 0 |
| --primary | 24 | 0 |
| --btn-primary | 24 | 0 |
| --scrollbar-thumb-color | 24 | 0 |
| --text-muted | 24 | 0 |
| --modal-bg | 24 | 0 |
| --focus-default | 24 | 0 |
| color-scheme | 24 | 0 |
| html background = --bg-color | 24 | 0 |
| .form-control background = --control-bg | 24 | 0 |
| body background (info) = --bg-color | 24 | 0 |
| body colour = --text-muted (core body rule) | 24 | 0 |
| font-synthesis | 24 | 0 |
| scroll-padding-block-start = head + 8px | 24 | 0 |
| ::placeholder colour | 24 | 0 |
| caret-color | 24 | 0 |
| focus ring on #id | 144 | 0 |
| no second ring (box-shadow) on #id | 144 | 0 |
| modal shell is not ringed | 24 | 0 |
| reduced-motion: .page-head transition collapsed | 24 | 0 |
| reduced-motion: --ins-duration | 24 | 0 |
| no-preference: --ins-duration | 24 | 0 |
| forced-colors: media active | 24 | 0 |
| forced-colors: ring still drawn | 24 | 0 |
| forced-colors: badge keeps an outline shape | 24 | 0 |

"all N custom properties" compares every custom property declared in the generated partials (688 per page, including every mapped Frappe variable and `--primary`) with the computed value on `html`, after resolving `var()`. The graphite-before and graphite-after runs both pass, which is the order-independence proof (upgrade review advisory 7).

Negative control: the same script with `ins_desk` left out of the page fails 270 of 1008 assertions, so the assertions do discriminate.

Raw values: `docs/team/evidence/phase2/css-cascade.json`.

## Not verified

- `::selection` and `:-webkit-autofill` colours: Chromium does not expose them through getComputedStyle for a pseudo that is not matched; the rules are written and compiled, not asserted.
- Native scrollbar appearance and `color-scheme` effect on native controls: the computed `color-scheme` and the scrollbar variables are asserted, the pixels are not.
- Forced-colors: Chromium's emulation confirms the media query and that the ring and badge outline are drawn; the system-colour values (`Highlight`, `CanvasText`) were not asserted, and no Windows High Contrast run exists.
- Real desk markup: the fixture uses the core classes (`.btn`, `.form-control`, `.badge`, `.custom-select`, `.datatable`, `.page-head`) but not a booted desk; the Tab order, JS-focused elements and the Awesomebar modal were not exercised.
- Screenshots, density (compact, coarse pointer) and the sticky page head with scroll-padding in a real scroll.
