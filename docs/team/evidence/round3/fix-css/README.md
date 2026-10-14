# Round 3 CSS fixes (css-engineer)

## 1. Folder thumbnail focus ring (a11y should-fix 5) - VERIFIED
`institutional_theme/public/scss/desk/_desktop.scss`: `html:root[dir] .folder-icon .icons > .desktop-icon:focus-visible { outline-offset: calc(var(--ins-focus-width) * -2) }` (-4px, specificity 0,6,1 beats the ring rule 0,4,2).
Why -4px and not -2px: `.icons-container` (overflow hidden) is 40px wide and the thumbnail box (24px, -3px inline margin) sticks out 1.1px past it on the outer side (measured: ar box left 595.41 vs clip 596.5; en box right 770.59 vs clip 769.5), so a ring at -2px was still shaved by 1.1px. At -4px the 2px ring occupies 2..4px inside the box and is complete.
Computed in the live page after Tab focus (ar and en, Light and Dark): `outline 2px solid`, offset `-4px`, colour `rgb(47,106,167)` Light, `rgb(167,201,240)` Dark. Screenshots at 2x device scale: `folder-focus-{ar,en}-{light,dark}.png` (ring complete in ar-light and en-dark viewed; the other two share the same computed values, not individually viewed after the final change).
Comment honesty: the file header now says the 24px box satisfies the axe target-size checker only; core sets `pointer-events: none` on the thumbnails. The manifest should say the same. Not changed: the 9 tab stops per folder tile (core markup, links with href).
Compile: `bench build --app institutional_theme`, no warnings (0 matches for "warn").

## 2. Hover vs selected row in Light - no change, by design
`design/tokens.json:91,93`, `design/canvas/midad.css:10,12`: `surface-hover` slate.100 `#f1f4f8`, `surface-selected` ink.50 `#f2f7fe`. Contrast between them 1.025:1 (computed). The approved artboard uses the same two values (`.tbl tr.is-hover td`, `.tr.is-selected td`, midad.css:241-242). The product matches the approved design; the values are themselves near-identical, so nothing was changed (an approved value needs an owner decision record). In Light the checkbox and the selection count carry the state. Dark differs (`#252c37` vs `#1a2f46`). Option for the owner if wanted: use `surface-selected-strong` (ink.100) for selected rows; that is a design decision, not made here.

## 3. HRMS screens re-run - VERIFIED
`node tests/browser/hrms_screens.mjs` on the current build, 2m33s, exit 0. 84 records, all `lowContrast=0`; PNGs and `hrms_screens.json` in `../hrms-screens/` overwritten. `leave-list-ar-dark-comfortable.png` viewed: sidebar avatar is the tinted pair (no pink). The hrms-screens README run date (01:11 UTC) is the earlier run; the files are from this run.

## 4. Cascade - VERIFIED
`node tests/browser/cascade.mjs`: total 4256, pass 4256, fail 0, rtlIdentical desk true and graphite true (14 s). Result: `css-cascade.json` here (the tracked phase2 copy was restored, only timings differed).

## Selectors depended on
| Selector | Source | Purpose | Breaks if changed |
|---|---|---|---|
| `.folder-icon .icons > .desktop-icon` | frappe 16.32.0 `desk/page/desktop/desktop.css:278-308` (as in the file header; not re-read this round) | thumbnail focus ring inset | ring clipped again |
| `.icons-container` (overflow hidden, observed computed) | same stylesheet, observed live | the clip the ring must stay inside | ring clipped |
