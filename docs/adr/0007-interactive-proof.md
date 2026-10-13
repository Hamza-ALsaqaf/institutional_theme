# 0007 — Interactive proof built from the real compiled CSS

Status: accepted, 2026-10-13. Settles ADR 0001 question 6. Applies accessibility finding 12 and the css-engineer's conditions.

## Context

BRIEF 9.3 asks for one self-contained HTML file built from the same tokens and compiled CSS as the product, on Frappe's real class names, with controls for mode, language and direction, density and preset, and a token and contrast panel. The design canvas uses illustrative markup (design/README, "What the artboards are not"), so approving it would not approve the product.

## Decision

`tools/proof/build_proof.py` (standard library only, plus `institutional_theme.midad`) builds `docs/proof/midad-proof.html` from a built bench, never from `design/canvas/`.

**1. Inputs.** The script reads `sites/assets/assets.json` and resolves the same keys `bundled_asset` resolves:
- core's `desk.bundle.css` and `report.bundle.css`, which are core's `app_include_css`;
- this app's `ins_desk.bundle.css`, every `ins_palette_*` bundle and every `ins_fonts_*` bundle;
- the `rtl_` twin of each.

A sample custom preset is generated with `institutional_theme.midad` (0004), the code the runtime uses.

**2. Self-contained.**
- Each file is inlined verbatim, in its own `<style data-src="<manifest path>">`. Bundles are never merged.
- `<style>` order equals production: core, then `ins_desk`, then palette, then fonts.
- The theme's font `url(/assets/…)` references become `data:` URIs: about 235 KB of WOFF2, about 315 KB as base64. Other `/assets/` URLs in core CSS (Inter, images) are left alone and fail harmlessly offline. A check asserts that no computed `font-family` depends on them.
- Only the icon symbols the markup uses are copied from core's sprites, into a hidden sprite like the desk's `#all-symbols`.
- Expected size is 2 to 4 MB (ASSUMED). The script prints the measured size and `docs/proof/README.md` records it.

**3. Markup.** Hand-written partials in `tools/proof/partials/`, one per screen, with Frappe 16.32 structure:
- desktop, sidebar, page head;
- list, form (draft, submitted, cancelled), every control state;
- grid, report datatable;
- dialog, toasts;
- login.

Each partial names, in a comment, the core template it mirrors. The build fails if any class in the proof does not appear in core's compiled CSS, core's JS or HTML templates, or this theme's bundles.

Datatable rows keep core's absolute geometry from `cellHeight` (33 or 35px). The theme never sets their height.

Text comes from `tools/proof/strings.json`, in natural English and Arabic. Codes inside Arabic rows (`ACC-SINV-2026-00012`) are wrapped in `<bdi>`, and every embedded fragment in the other language carries its own `lang`.

**4. Controls.** `tools/proof/proof.js` is the proof's own script, not the product's. The controls are native, labelled, bilingual `<button>` and radio elements in a toolbar that sits outside the region that flips direction.
- **Mode**: sets `data-theme-mode` and `data-theme`. Automatic is resolved with `matchMedia`, as core's `frappe.ui.set_theme` does.
- **Language**: swaps `lang` and `dir` on `<html>`, which always keeps a `dir` because the palette selectors require one. It also switches between the LTR and RTL sets of `<style>` elements through `HTMLStyleElement.disabled`.
- **Density**: sets `data-ins-density`.
- **Preset**: enables exactly one palette `<style>`.
- **Token and contrast panel**: reads `docs/audits/contrast.json`, written by `python -m institutional_theme.audits`.

**5. Proof matches product.** `tests/browser/proof_parity.mjs` opens, on the test bench with fixture records:
- a draft form;
- a submitted form;
- a list;
- a query report;
- a dialog;
- login.

It then opens the same screens in the proof. For about 40 probe selectors it compares `getComputedStyle`:
- colours, borders, outline;
- font family, size, weight and line height;
- padding, radius, block size;
- `color-scheme`.

It runs the full matrix: Light and Dark, LTR and RTL, both densities, every shipped preset. Colours must match exactly; lengths within 0.5px.

Extra passes in Chromium emulation:
- `forced-colors: active`;
- `prefers-reduced-motion: reduce`;
- a touch context for `pointer: coarse` (ASSUMED to match in Chromium; the test asserts `matchMedia` first);
- a 320px-wide reflow screenshot.

The proof embeds each manifest path. The test fails if they differ from the bench's `assets.json`, so a stale proof cannot pass. The test runs at the Phase 4 and Phase 5 gates.

**Fallback.** Without a full bench, the script runs against a Frappe clone with built assets (WORKFLOW, Phase 0 fallback). The parity test then compares against the static harness, and `OWNER_REVIEW.md` records that no live site was used.

## Alternatives rejected

1. *Render the design canvas.* Its markup is not Frappe's, so approving it would not approve the product (P1).
2. *Snapshot live desk pages.* A snapshot would capture the runtime styles the datatable injects, would depend on fixture data, and is hard to make bilingual (P3). Live pages are used instead as the reference side of the parity test.

## Consequences

- **css-engineer**: `tools/proof/*`, `tests/browser/proof_parity.mjs`, `docs/proof/*` (Phase 4).
- **backend-engineer**: the audits write `docs/audits/contrast.json`; fixture records for the parity test.
- **scribe**: `tools/proof/strings.json` Arabic review.
- **a11y-rtl-reviewer**: checks the controls with the keyboard and a screen reader.

## Verification

- The class check passes.
- The parity test passes on the full matrix.
- The proof opens offline from `file://` with no network request other than the known core `/assets/` URLs. The test asserts this list.

## Evidence (Frappe 16.32.0)

- `hooks.py:36-43`: core's `app_include_css` and icons.
- `utils/jinja_globals.py:147-157` `bundled_asset`.
- `esbuild/esbuild.js:229, 450-456`: RTL output and manifest keys.
- `www/desk.html:2`: `<html>` attributes; `:43, 61-63`: the icon sprites.
- `public/js/frappe/ui/theme_switcher.js:154-163` `set_theme`.
- frappe-datatable 1.20.7 geometry (findings section 5; `docs/research/phase0-reverification.md` rows 5a and 5b).
