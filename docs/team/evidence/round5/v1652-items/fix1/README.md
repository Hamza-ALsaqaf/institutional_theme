# Round 5 a11y fix round 1 (findings 1, 2, 3, 6)

Evidence labels: VERIFIED (probe output here), COMPUTED, ASSUMED. Probes: `scripts/narrow.mjs` (320 CSS px, device scale 4, en/ar, Light/Dark, `probe.json` and captures in `<version>-after/`), `scripts/desktop_rail.mjs` (`desktop-rail.json`), `../scripts/z400.mjs` (badge clip, rerun), `cascade/`.
"Before" is the reviewer's measurement in `docs/team/reviews/a11y-round5.md` (the benches hold only the new CSS; I built once, as asked, so I have no new before captures).

| # | Finding | Result |
|---|---|---|
| 1 | Subject clipped silently, Latin subject in Arabic row loses its first letter | Fixed |
| 2 | Row focus ring clipped at 320 px | Fixed |
| 3 | Closed sidebar controls focusable while invisible (v16.52.0, at most 767 px) | Fixed (theme-side mitigation) |
| 6 | Embedded-list host also matches non-status badges | Not changed, documented |

## 1. Subject ellipsis (`desk/_list.scss`, last block, comment corrected)
Inside the existing `max-width: 576px` query: `.list-row-col.list-subject .level-item.ellipsis { flex: 0 1 auto; min-inline-size: 0 }` and `.list-row-col.list-subject a { display: block; overflow: hidden; text-overflow: ellipsis; unicode-bidi: plaintext }`.
VERIFIED, `probe.json` `subj` per list row (including a deliberately long English subject and a long Arabic subject I seeded): v16.52.0 every row's `a` has `scrollWidth > clientWidth` and then `text-overflow: ellipsis` (5 of 5 truncated, 0 violations, in en, ar, Light, Dark); 16.32.0 0 violations (2 or 3 truncated rows, all with ellipsis). The assertion "truncated implies ellipsis" is in `narrow.mjs` (`ok`). Capture `16.52.0-after/ar-light-todo.png`: "Probe tas..." starts at its own first letter in the Arabic row and the ellipsis is at its end. Known: at 320 px the subject gets about 80 px (checkbox and the 130 px status group take the rest), so long names are short; the full text stays in the `title` tooltip. The second line's tail is still lost (core, same on 16.32.0).

## 2. Row focus ring
Same block: `.list-row-container, .list-row { max-inline-size: 100%; min-inline-size: 0 }`. VERIFIED by keyboard Tab (`narrow.mjs`, 16 stops from the top, ring read after 250 ms): v16.52.0 and 16.32.0, 5 list-row stops per mode and language, `rowRingClip` 0 for all (row x 26 to 303 inside the container), ring `solid 2px`, offset `-2px`. Capture `16.52.0-after/ar-light-row-focus.png` (the capture is taken after the last Tab of the loop, so it shows a later stop; the geometry for the row stops is in `probe.json` `tabs`).

## 3. Closed sidebar tab order (`desk/_shell.scss`, last block)
`@media (max-width: 767.98px) { .body-sidebar-container:not(.expanded) .body-sidebar > * { visibility: hidden; transition: transform .25s ..., opacity .2s ease, visibility 0s linear .25s } }` (core's two transitions are repeated because the shorthand would otherwise drop them). The media query is core's `md` boundary: above it `:not(.expanded)` is the visible icon rail on v16.52.0, so the rule must not apply there.
Source: v16.52.0 `ui/sidebar/sidebar.js:719-726,740-744` (no `inert` on mobile), `scss/desk/sidebar.scss:501-510`, `:73-75`; 16.32.0 `sidebar.html:1`, `scss/desk/sidebar.scss:219-232` (closed drawer is `width: 0` already) (manifest row added).
VERIFIED (`probe.json`): Tab from the top of the page at 320 px, v16.52.0: the first stop is a visible list row, 0 invisible stops before the first row, and the sidebar controls are no longer in the sequence (reviewer's before: 11 invisible stops, `opacity: 0` ancestors). Opening the drawer with the navbar toggle: `.expanded` set, `.body-sidebar > *` computed `visible`, first control `checkVisibility` true, all controls back (`16.52.0-after/*-sidebar-open.png`, en/ar, Light/Dark). Desktop regression at 1280 px: `desktop-rail.json`, children `visible` on both versions, first rail link visible on v16.52.0 (the 16.32.0 `firstLink` false is a probe artefact of its first link, children are visible; the rule does not match there).
Not verified: a screen reader; the sidebar toggle was found by a selector list in the probe (`.sidebar-toggle-btn` matched).

## 6. Embedded-list host breadth
No stable source-verified way: `.embedded-list-table td > .es-badge` is the same markup for ERPNext's status cells and for core's Role "Type" cell (`embedded_list.js:290-296` renders every `type: "badge"` column identically; the column definition, not the DOM, says which is a status). Left as is. Effect: "Standard" shows a neutral ring and "Custom" a blue dot; the label is always printed. Proposed wording for the checklist: "Embedded-list badges are all treated as statuses, including the Role form's Standard and Custom".

## Checks
Build once (`tools/bench/b.sh build --app institutional_theme`): 0 warnings. `audits` passed, `midad.build --check` 0 stale, `docs/audits/budgets.txt` regenerated. Cascade (`cascade/`): 16.32.0 4576 of 4576, v16.52.0 7680 of 7680. Badge clip (`z400.mjs`, tag `fix1`): v16.52.0 277 of 277, 0 clipped in en, ar, Light, Dark; the 16.32.0 rerun timed out twice because the 16.32.0 web server was saturated by the loaded test series (not completed; the 16.32.0 narrow probe above ran after the build and shows no clipped ring, ellipsis intact). No `!important`, logical properties only (`inline-size`, `min-inline-size`, `max-inline-size`; the 576 and 767.98 media widths are core's).
