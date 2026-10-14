# Round 5 fix round 3: the date of the list row's second line (a11y re-check, finding 5)

Labels: VERIFIED (probe output here), COMPUTED. Probes: `scripts/narrow.mjs` (320 CSS px, device scale 4; en/ar, Light/Dark; the earlier subject, row ring and sidebar probes plus the new date probe), `scripts/visible.mjs` (the date probe's helper), `scripts/z400.mjs`, `cascade/`.

## Cause
At 320 px the second line is two `inline-block` `.mobile-layout` items (priority chip and date, v16.52.0 `list.scss:851-866`) inside `.level-left`, which is `white-space: nowrap`, `overflow: hidden`. Since `5d00af9` the row ends at the container, so `.level-left` is 131 px wide (it was about 195 px before): chip 100 px plus date 89 px no longer fit side by side. The date item moved to the right of the chip's line break position, outside the group's clip (date x 141 to 220, group x 25 to 156), and showed as a lone "...". The cause is the row cap together with core's `nowrap`, not a single rule of the five; the reviewer's in-page overrides did not isolate it.

## Fix (`desk/_list.scss`, in the existing `max-width: 576px` block)
`.level-left` of data rows gets `white-space: normal`; every `.list-row-col` inside keeps `white-space: nowrap` (so the subject still ellipsises); `.mobile-layout .list-row-col` gets `flex: 0 0 auto; overflow: visible`. The meta line wraps between the chip and the date instead of clipping; the date sits on its own line under the chip (`16.52.0-after/*-todo.png`). Row height grows by one line.

## Probe
For each data row: the date's text range lies inside every clipping ancestor up to `.result-container` horizontally and has non-zero width (`dates` in `probe.json`). Discrimination: before the fix (`16.52.0-before/`) 0 of 5 rows per mode and language pass; after, 5 of 5 on v16.52.0 and 5 of 5 on 16.32.0 (en, ar, Light, Dark). I developed it by injecting the block with `addStyleTag` (`16.52.0-injected/`, 5 of 5) while the gate ran, then built once after `/tmp/r5logs/gate.done` existed. Note for the injection harness: `//` comment lines must be stripped, otherwise they swallow the next selector.
The vertical position is not part of the probe (the list scrolls; a first version that checked it flagged the last row of a 640 px viewport on 16.32.0, which is cut by the viewport, not by width).

## Regression probes (same run, `probe.json`)
Subject ellipsis: 0 violations, 5 of 5 truncated rows on v16.52.0 carry the ellipsis. Row focus ring: 5 row stops per mode, `ringClip` 0. Invisible stops before the first row: 0. Badge clip (`z400-16.52.0-after/probe.json`): 277 of 277, 0 clipped, page overflow 0 in en, ar, Light, Dark. 16.32.0 narrow probe: same results, dates 5 of 5.

## Checks
One build after the gate: 0 warnings. Audits passed, `midad.build --check` 0 stale, budgets unchanged. Cascade `cascade/`: 16.32.0 4576 of 4576, v16.52.0 7680 of 7680. Not verified: a real 400% browser zoom (the stand-in is the round-4 one), other doctypes' second lines (core may still lose other columns on narrow lists).
