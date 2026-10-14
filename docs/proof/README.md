# Interactive proof

`midad-proof.html` is one self-contained file (5.34 MB, measured after round 3; ADR 0007 assumed 2 to 4 MB) built from the compiled bundles of a built bench, never from `design/canvas/`. It opens from `file://`, needs no network and shows the product's real class names.

Build and check (bench built, test site up):

```
python3 tools/proof/build_proof.py --bench /home/user/frappe-bench
node tests/browser/proof_parity.mjs        # exit code 1 on any mismatch, stale path or outside request
```

`parity.json` holds the last run; `parity-320.png` is the 320 px reflow screenshot.

## What it contains

- Screens (toolbar, `tools/proof/partials/`): desk list, form (Not Saved indicator, mandatory, disabled and error fields), report datatable, dialog, workspace (shortcut widgets and link cards; round 3), toasts (`frappe.show_alert` green, red, orange; round 3), login (an isolated document with the web bundles, as the real `/login`).
- Controls: screen, mode (Light, Dark, Automatic through `matchMedia`), language and direction (swaps `lang`/`dir` and the LTR/RTL `<style>` sets), density, preset (midad, graphite, forest, petrol, plum), font pairing (Plex, Noto, Tajawal), a contrast table read from `docs/audits/contrast.json`.
- Every bundle is inlined verbatim in its own `<style data-src="<manifest path>">`, in production order: core desk, report, ERPNext, `ins_desk`, palettes, fonts, and the `rtl_` twin of each. The theme's font urls are `data:` URIs (20 files, 487 KB raw). 38 other `/assets/` urls in core CSS (Inter, Font Awesome, images) are left alone; no request is made for them on load (asserted).
- The build fails if a class in the markup is absent from every bundle, core JS, templates or the datatable source. The datatable rows keep core's absolute geometry, written by a proof-local rule that copies what frappe-datatable's runtime sets (35 px); the theme sets no row or cell height.

## Parity result (full matrix)

266 comparisons, 2794 probes, 0 mismatches, 0 stale paths, 0 blocked requests. Matrix: Light and Dark, English (LTR) and Arabic (RTL), both densities, five presets, six desk screens (list, form, report, dialog, workspace, toasts); login in both languages; forced-colors and reduced-motion passes (every screen, both languages); `matchMedia('(pointer: coarse)')` asserted in a touch context. Colours must match exactly, lengths within 0.5 px.

Normalisations (the live page is put in the state the proof shows, not the reverse): transitions are disabled on both sides; focus is blurred; an unseen record's subject span is reduced to the seen form (`list_view.js` `get_seen_class`); the ToDo form's Due Date control gets `has-error` (as `base_input.js` does); non-default presets are applied to the live page by appending the palette `<link>`. The last one assumes production does the same, which was not verified against the shell script.

## Cut from the ADR scope (honest list)

Not in the proof: the workspace editor mode, onboarding and chart/number-card widgets (the workspace shows shortcut and link-card blocks only, without the sidebar-toggle button), grid, submitted and cancelled form states, every control state (hover, focus, disabled variants beyond one disabled field), the sample custom preset generated with `institutional_theme.midad`, the token value panel (only the contrast table), the touch parity pass itself (only the media query is asserted; no `pointer: coarse` computed comparison), and the 320 px screenshot is not compared, only captured. The workspace parity user is a System Manager with the ERPNext roles of round 2 (`roles.mjs`), and the live browser context needs an explicit `locale` (without it core throws "Incorrect locale information provided" and the workspace never renders). Parity probes are about 10 per screen, not 40.
