# Fix round: css-engineer

Run: `cd tests/browser && PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node cascade.mjs` (0 Sass warnings, `ins_desk` 82,059 bytes, rtlcss LTR/RTL identical). 24 pages (LTR/RTL x midad, graphite after, graphite before x Light, Dark, Automatic light/dark): **1992 of 1992 pass** (was 1008; the 984 new assertions are below). Core CSS is the bench's current `desk.bundle.G74HNZ4B.css` and its RTL twin. COMPUTED, not screenshots.

## A3: focus on checkboxes inside inset-ring containers
Fix: in `.datatable`, `.grid-body`, `.frappe-list .result-container`, `.dt-scrollable`, `input[type=checkbox|radio]` and `[role=checkbox|radio]` keep the ring OUTSIDE (offset +2px), on the row background. Other controls there keep the -2px inset ring.

Ratios (repo `midad/colour.py`, ring = `--ins-focus`):

| Mode | ring vs base | vs hover | vs selected | vs selected-strong | ring vs checked fill |
|---|---|---|---|---|---|
| Light (#2f6aa7) | 5.61 | 5.09 | 5.22 | 4.83 | 1.47 (not adjacent) |
| Dark (#a7c9f0) | 10.43 | 8.20 | 7.96 | 6.60 | 1.00 (not adjacent) |

The ring is 2px away from the fill, so it never touches it; the ratio against the fill cannot reach 3:1 without a token change and is recorded as info, not asserted. Browser test (checked and unchecked boxes in `.datatable`, `.grid-body .grid-row`, `.frappe-list .result-container`, reached with real Tab presses): computed outline 2px solid, offset 2px, and the ring against the effective background and four row backgrounds is at least 3 in every mode. Forced-colors: focused checked checkbox keeps a 2px solid outline.

## Upgrade advisory 5
- Specificity comments corrected: ring rule (0,4,1); box-shadow reset (0,5,1); inset and checkbox rules (0,5,1) and (0,5,2); `::selection` (0,1,2); autofill (0,2,2), (0,3,2) with `:hover` or `:focus`.
- The `box-shadow: none` reset is now a separate rule with `:not(:-webkit-autofill)`, so the autofill cover survives focus. Headless test asserts the exclusion exists in the stylesheet; I did not render a real autofilled field.

## Not verified
Positive-offset ring clipping inside real datatable and grid cells (fixture has no overflow clipping); real autofill; Windows High Contrast.
