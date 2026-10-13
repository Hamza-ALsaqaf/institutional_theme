# Accessibility, RTL and fidelity review, round 2

Designed to meet WCAG 2.2 AA; formal audit recommended. VERIFIED = run live on http://midad.test:8000 (users `a11y-r2-ar/en`, scripts in `/tmp/a11yr2/`). Test data (masked Customer, Property Setter, Event, mask user) was deleted afterwards.

## 1. Blocking defects

None found against WCAG 2.2 AA on the screens tested. Major, not blocking:

- **Forced colours, buttons (1.4.11)**: `.page-head .btn` computes `border none 0px` and a Canvas background, so Save and Actions look like plain text (`/tmp/a11yr2/forced-form.png`, `f2.mjs`). Fix: `border: 1px solid ButtonText` in the forced-colors block of `_base.scss`.
- **List hover and selected row (consistency)**: only the sticky subject cell is tinted. Every other cell stays transparent, because `--ins-row-bg` is applied only in `_list.scss:31-33` (`list-sel.png`, computed). The tick still shows selection. Fix: also paint `.list-row` with `--ins-row-bg`.
- **Errors (3.3.1, 4.1.2)**: an invalid `Small Text` has no `aria-invalid` and no `aria-describedby`. Core's message dialog carries the text, which is the only text cue. The icon, 4px bar and inner line are verified, and the icon is at inline-end in RTL.
- **Appearance page**: `_appearance.scss` says core's page head holds the heading, but the page head contains only the 13px breadcrumb link. The `h1` is visually hidden (1x1). Sighted users see no page title.

## 2. Scores

| Dimension | Score | Evidence |
|---|---|---|
| Accessibility | 4 | Contrast audit 0 failing; banners 8.06:1 to 10.44:1; selected chip 7.96:1; ring 2px on every Tab stop; masked `tax_id` has `aria-describedby` "مخفي لدورك"; forced-colours buttons lose their boundary |
| RTL parity | 4 | Calendar, error icon, login and update-password mirror correctly, and update-password is fully Arabic. Print labels are English with the colon on the wrong side (":Customer Name"); the Gantt axis is deliberately LTR; the Quill English full stop sits left; login `<title>` is "Login" |
| Dark-mode parity | 4 | Appearance, list and chips verified in Dark; block chips lose their per-event colour (stripe only, scoped `!important`); calendar header row has a near-white outline |
| Density and productivity | 4 | 12 rows visible; hover and selected tint is partial |
| Clarity and hierarchy | 4 | "✓ محددة" no longer crowds the swatch; the Appearance page has no visible title; the disabled "Apply palette" gives no reason |
| Calm | 4 | Flat Dark surfaces; muted banners with text and bar |
| Consistency | 4 | Single ring and radius; partial row tint; the colour-vision audit baselines 99 chart gaps (`--strict` exits 1) |
| Credibility | 4 | Arabic login and update-password are clean; English remains in print labels, Gantt view modes and onboarding panels (core) |

Previous score-3 items are resolved: the Appearance heading is no longer oversized (but now hidden), the "Selected" tag is legible, and Dark chips are fixed.

## 3. A formal audit must still cover

Screen readers on the P0 flows; Windows High Contrast on real hardware; 200% and 400% reflow; coarse-pointer targets (no `pointer: coarse` rule exists; the reveal button is 32px); keyboard operation of Gantt bars and FullCalendar chips; the 99 chart gaps; print and PDF bidi; the idle `alertdialog` (focus moves to its button, Esc not handled); hover and focus not obscured by sticky headers; mobile viewports.

## 4. Not tested

Zoom 200/400%, `prefers-reduced-motion`, coarse pointer, screen readers, light-theme hover pairs (only Dark computed), the idle banner live, email clients, the website portal pages beyond one screenshot, and Tab order on dialogs.
