# Accessibility review, Phase 2 (f0d5790..e4015f7)

Designed to meet WCAG 2.2 AA; formal audit recommended. COMPUTED = my arithmetic on generated hex values; VERIFIED = I ran it.

**Ran:** `python -I -m institutional_theme.audits --no-write` (passed, 67 chart gaps); `tests/browser/cascade.mjs` (1008/1008; it rewrote tracked `css-cascade.json`, which I restored with `git checkout`).
**Checked, no issue:** ring 2px/2px via `outline`; `color-scheme` light, dark and `light dark`; `font-synthesis: none`; digits fall outside the Arabic `unicode-range`, so they come from the Latin face; Tajawal 600 uses the real 700 file; contrast messages isolate tokens and numbers with `<bdi dir="ltr">`.

## BLOCKING (3)

**1. The audit measures inputs on the wrong background.** `--control-bg` maps to `surface-fill` (`_frappe_map.scss:211`) and the cascade test confirms `.form-control` uses it. The audit declares `surface-field`. COMPUTED, Light: placeholder on `surface-fill` 4.41:1 (needs 4.5); placeholder on `surface-fill-hover` (`--control-bg-on-gray`, `list_sidebar.scss:87`) 4.07:1; `border-control` on `surface-fill-hover` 2.81:1 (needs 3). Fix: add `surface-fill`, `surface-fill-hover`, `surface-disabled` to the placeholder, help and input-boundary groups. Then map `--control-bg` to `surface-field` or change a value. Both need a decision record because `midad` is frozen.

**2. Dark help text is under the floor in a real state.** `text-muted` (`--text-light`) on `surface-selected-strong` is 4.49:1 (COMPUTED). The "hover and selected rows" group omits `selected-strong`, `active` and `fill`. A selected, hovered list row shows exactly this pair, so "0 failing" is unsupported. Fix: widen the group; lighten dark `text-muted` a step (decision record).

**3. Focus is invisible on checked checkboxes in inset-ring containers.** `_base.scss:27-29` draws the ring at `-2px` inside `.datatable`, `.grid-body`, `.frappe-list .result-container`. A checked box fills with `--ins-primary` (map line 135). Ring on fill: Dark `#a7c9f0` on `#a7c9f0` 1.00:1; Light `#2f6aa7` on `#1b5086` 1.47:1 (COMPUTED). Keyboard users cannot see the focused row checkbox. Fix: add an inner contrasting cue (for example `box-shadow: inset 0 0 0 1px var(--ins-surface-base)` on checked and focused) and a "ring vs primary fill" audit group. Not observed in a booted desk.

## ADVISORY

4. **Arabic typography is applied nowhere.** No `letter-spacing` reset (core desk CSS declares it 115 times, 87 at `.02em`, which breaks joining); `--ins-leading-arabic` (1.65) has no consumer; no size compensation; no `tabular-nums`. Assign to the Phase 3 css-engineer and the gate: `letter-spacing: 0` for Arabic, line-height from the token, `font-variant-numeric: lining-nums tabular-nums`.
5. **Disabled vs read-only not distinct; audit tests an unused token.** `--ins-text-disabled` has no consumer (grep). Both states use `--disabled-text-color` (= `text-secondary`) on `surface-disabled`, which equals `surface-hover` in Light; Light `text-disabled` equals `text-placeholder`. Phase 3: define a separate read-only cue and audit the pair that renders.
6. **Autofill styling is lost on focus.** The focus reset `box-shadow: none` has specificity (0,4,1); the autofill `:focus` rule is (0,3,2) (COMPUTED). The browser's autofill fill returns on a focused field. Fix: `:not(:-webkit-autofill)` on the reset. Not observed.
7. **Reduced motion** sets `animation-iteration-count: 1`, which freezes spinners with no static substitute. The test asserts one element only. Fix: exempt spinners with a static cue; sweep all elements.
8. **Sticky obscuring.** `scroll-padding-block-start` is a fixed 56/48px on `html` only. The head wraps at 400% zoom or with long Arabic titles. No inline-start padding for the sticky first column; inner scrollers uncovered. Fix: measure the head by script; add inline padding.
9. **Forced-colors** asserts only "media active, outline drawn". `Highlight` was not asserted. Nothing covers checked checkbox and switch fills, selected rows or Phase 3 status shapes. Run Windows High Contrast before the Phase 3 gate.
10. **Chart colour-vision plan is inadequate.** STATUS item 11 says "where frappe-charts allows" without checking, with no owner; WORKFLOW puts charts in Phase 4, not "P1". The accepted gap omits grayscale: chart-5 vs 6 is 0.3 (Light) and chart-2 vs 4 is 0.3 (Dark), so B&W photocopies cannot separate series. Series 1-8 reaches 1.0 (tritanopia). Fix: fail the audit on any new GAP against a committed baseline; default to 6 series ordered so neighbours are passing pairs; read the frappe-charts source and record in the manifest which of labels, markers or dashes exist (else ship a data-table toggle); require protanopia and grayscale screenshots per chart.
11. **Settings strings.** Unwrapped `{0}` in the font, image and "preset not available" messages (raw key, not label) and the missing-font intro (joined file names): wrap in `<bdi dir="ltr">`. The contrast message shows internal token names (`text-muted`). `custom_audit` ("181 / 181 · 4.52:1") has no labels. `set_intro` is not announced. No Arabic-Indic digit option, though BRIEF section 8 asks for it documented. `ar.csv` is untracked and outside this diff; sampled only.

## Not tested
Real desk markup, Tab order, screenshots, 200% and 400% zoom, coarse pointer, density, Windows High Contrast, screen readers, rendered Arabic glyphs. Selection is subtle (Light 1.35:1, Dark 1.54:1 against the page).
