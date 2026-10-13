# Accessibility, RTL and fidelity critique: Phase 1 architecture

Reviewer: a11y-auditor. Source read, nothing run (no code exists). Designed to meet WCAG 2.2 AA; formal audit recommended. Not tested: any rendering, screen readers, Arabic shaping, the Colour field's keyboard behaviour.

## BLOCKING

1. **The Appearance page delegates Light/Dark/Automatic to core's dialog, which is not keyboard-operable (0002).** `theme_switcher.js:88-122` builds each choice as a `div` with a click handler: no role, no tabindex, selected state only a CSS class. The only keyboard path is Left/Right arrows on the dialog (`:24-27`), and they step by array index, so they are reversed in RTL. Evidence: source (VERIFIED). Fix: render the mode as a native radio group on the page and call `frappe.xcall("frappe.core.doctype.user.user.switch_theme", {theme})` after setting `data-theme-mode`, as `toggle_theme` does (`:127-135`). Do not open the dialog.

2. **Uploaded fonts allow synthetic bold, and 500 has no face (0004).** `font_*_semibold` is optional, so 500, 600 and 700 would be synthesised from regular, contradicting BRIEF section 8 (no synthetic bold, and Arabic joins distort). Core also sets `--weight-bold: 700` (`espresso/_typography.scss:30`) and `<b>` is bolder. With only 400 and 600 faces, a 500 request resolves to the 400 face (CSS font matching, COMPUTED), so buttons and labels lose their emphasis. Fix: make semibold mandatory for `Uploaded`. Declare it `font-weight: 500 600` and map `--ins-weight-medium` and `--weight-bold` to it. Set `font-synthesis: none` on `html:root[dir]` for every pairing.

3. **`color-scheme` and forced-colors are absent from the palette model (0003).** Neither term appears in the discussion files. Core sets `color-scheme: dark` only under `[data-theme="dark"]` (`dark.scss:2,177`), and has no `automatic` rule. `desk.html:2` renders `data-theme="automatic"` before `set_theme()`, so the page gets dark tokens from the media query but light native controls and scrollbars. Fix: add `color-scheme: light` to the light blocks, `dark` to the dark blocks and `light dark` to the automatic block. Add "color-scheme present in all three" to the parity audit. State that palette files never set `forced-color-adjust` and that forced-colors rules live in the base bundle only.

## ADVISORY

4. **Preset swatches.** Use `<fieldset><legend>` with native radios. Show the visible bilingual name, a check icon and the word "Selected". Draw the primary and accent dots with a 3:1 border so the swatch is not identified by colour alone. Under forced-colors, give the swatch a `CanvasText` border. If `custom_label_ar` is empty, fall back to English; never show an empty card.

5. **Palette change by reload (0002/0003).** After `location.reload()` focus drops to the document start and nothing is announced (WCAG 3.2.2, 4.1.3). Core's dirty forms register `beforeunload` (`form.js:1498`), so the browser prompt covers unsaved work. Fix: write the chosen preset name to `sessionStorage` before reload. On load of `ins-appearance`, focus the page heading and fill a `role="status"` region with "Colour preset changed to X".

6. **Status pill shapes.** `data-ins-docstatus` separates only Draft from Cancelled. The design's ten statuses are not derivable from the 12 core colour classes: Approved and Completed are both green, Rejected and Overdue both red. Core's pill always has text (`page.js:210`, `frappe.get_indicator` returns `__(status)`), which is good. Fix: state which hook supplies the shape for workflow states. Also state the fallback shape (ring) when no mapping exists. Draw shapes with `currentColor` borders so forced-colors keeps them.

7. **Consequential tagging by translated string (Consequential actions).** Equality with `__("Delete")` is not unique in Arabic: core `ar.po` maps both Delete and Remove to "حذف" (`ar.po:7379`, `:22998`), and both Cancel and Revoked to "إلغاء" (`:4318`, `:23771`). Approve and Reject have no core Arabic entry. Fix: tag only when the label matches and the state fits (Submit at docstatus 0, Cancel at 1, Amend at 2). Take Approve and Reject from `d.action` raw values, not translated text. Add both to `ar.csv`.

8. **Custom preset rejection message (0005).** `{0}` and `{1}` are raw token names ("text-on-primary"), which mean nothing to an administrator. In the Arabic string they sit unisolated between RTL text. Fix: map tokens to bilingual names (for example "نص على اللون الأساسي"). Wrap the Latin tokens and the ratio in `<bdi>`. Report every failing pair, not the first. Name the input to adjust (primary or accent).

9. **Density and coarse pointer.** `html[data-ins-density="compact"]` is (0,2,1). The coarse block must be `@media (pointer: coarse)` placed after it with equal specificity, so 44px wins over compact. Datatable rows stay at core's `cellHeight` (33 or 35px), so the 28px compact row and the 44px coarse row cannot be met there. Record that as a documented exception (it still passes 2.5.8's 24px). Test 24px for compact checkboxes and icon buttons.

10. **Environment ribbon.** `z-ribbon` is 1021 against the page head's 6 (`page.scss:120`). A fixed ribbon can cover a focused element and the sticky head. Fix: reserve its height with `scroll-padding-top`. Show the word as text, translated (Training/تدريب), never colour alone. Hide it in print. Verify 4.5:1 on `accent-subtle` in both modes; the audit declares only accent text pairs (`tokens.json:612`).

11. **Arabic face `unicode-range` (0004).** It must cover 0600-06FF, 0750-077F, 08A0-08FF, FB50-FDFF, FE70-FEFF and 200C-200F. Otherwise Arabic punctuation and Arabic-Indic digits (U+0660-0669, a documented option) fall to the Latin face. Also decide `font-display` now: "Phase 2" leaves the Arabic flash undefined.

12. **Proof language/direction switching (0007).** Setting `dir` and `lang` on `<html>` is not enough. The controls need native, labelled buttons, bilingual and outside the flipped region. English codes inside Arabic rows (`ACC-SINV-2026-00012`) need `dir="ltr"` or `<bdi>`, and embedded fragments need their own `lang`. Style element order must equal production (palette after desk). Extend the parity probes to `color-scheme`, `forced-colors: active`, `prefers-reduced-motion`, `pointer: coarse`, and a 320px-wide reflow screenshot (400% zoom).

**Blocking: 3** (1 keyboard-inoperable mode control; 2 synthetic bold/500 weight; 3 `color-scheme`/forced-colors missing).
