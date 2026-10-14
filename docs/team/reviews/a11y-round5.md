# Accessibility, RTL and fidelity review, round 5 (release gate)

Designed to meet WCAG 2.2 AA; formal audit recommended. Independent reviewer, did not write the code. Scope: `git diff 610edf4..HEAD -- institutional_theme/public tests/browser docs/DEPENDENCY_MANIFEST.md` (head `af3388d`; the SCSS and JS change is `2ec07ff`), the evidence in `docs/team/evidence/round5/v1652-items/` and `.../print-clip/`.

Labels. VERIFIED = I ran it. COMPUTED = from a file, a recorded probe or a screenshot pixel, with the WCAG formula. ASSUMED = not run.

Environment note. The v16.52.0 bench was not listening on `127.0.0.1:8001` (connection refused, twice, 20 s apart). `127.0.0.1:8002` served `midad52.test` with the theme bundles (`ins_desk.bundle.J3F5O5T2.css` and `S7SLX3YG`), and `frappe.boot.versions.frappe` read `16.52.0`, so I used it, read only, as Administrator. Its ToDo and "Ins Probe Slip" lists were empty (a fresh database), so I rendered three fictional rows client-side with `cur_list.data = [...]; cur_list.render()` (no server write, no setting changed; the login itself updates Administrator's session data). I did not start, build or restart anything. Scripts and screenshots are in `/tmp/a11y-r5/` (not in the repository; the numbers are copied below). I ran the full `python -m institutional_theme.audits` once (it rewrote nothing: `git status docs/audits` is clean).

## 1. Findings

Severity. BLOCKING = a user of the supported configuration cannot use or read something that matters, or a claim is false in a way that changes the gate. SHOULD-FIX = real and measurable, the user can still do the task, or the cause is core. NOTE = observation or a documented limit.

**No BLOCKING finding.**

### SHOULD-FIX

**1. List subject is clipped silently, with no ellipsis, since the 576 px fix (v16.52.0, 400% zoom, English and Arabic).**
- Where: `institutional_theme/public/scss/desk/_list.scss:129-137` (the new block). Its comment says the subject column "is already an ellipsis flex item"; it is not.
- Measured (VERIFIED, 320 CSS px, three injected rows, `getComputedStyle` up the chain from `.list-subject a`): `a.ellipsis` `overflow:hidden`, width 112.48 (its text); `span.level-item.bold.ellipsis` `flex: 0 0 auto`, width 112.48 (it never shrinks, so `text-overflow: ellipsis` never fires); `.list-row-col.list-subject` `overflow:hidden`, width 156.66 (`flex 1 1 0%`); `.level-left` clips at 171.66. Result: "Probe task three" is drawn "Probe task thre" and a long subject is cut mid-glyph at about x = 164 CSS px with no "…" (`/tmp/a11y-r5/f-ltr-light-0.png`). Before the fix the same row showed the full subject (the badge was the thing that was lost, `z400-16.52.0-before/ar-light-todo.png`).
- Arabic, the team's own capture (`shots/z400-16.52.0-after/ar-light-todo.png`): the Latin subject "Probe task three" loses its first letter ("robe task three") because the Latin run is anchored at the inline start of an rtl row and the clip falls on the left; the `before` shot shows it whole. The team's README lists this as "residual, mixed direction, core behaviour"; the clipping of the start is new with the fixed layout.
- User experience: at 400% zoom the user reads a wrong or truncated document name and nothing tells them it is truncated; the full text is only in the `title` tooltip (pointer). The second line also loses its tail (the dot after "Probe slip cancelled" and whatever follows, `shots/z400-16.52.0-after/en-dark-slip.png`; the same on 16.32.0, so that part is core).
- Fix suggestion: inside the same media query, `.list-row-col.list-subject .level-item.ellipsis { flex: 0 1 auto; min-inline-size: 0; }` and `.list-subject a { display: block; overflow: hidden; text-overflow: ellipsis; unicode-bidi: plaintext; }` (plaintext makes a Latin subject in an Arabic row start at its own start, so the ellipsis lands at its end). Re-run `z400.mjs` and add a probe for "subject scrollWidth > clientWidth implies text-overflow ellipsis". Correct the comment.

**2. Focus ring of a list row is clipped on the inline-end side at 320 px (v16.52.0).**
- Where: same block; `.list-row-container` (`tabindex="1"`) is wider than `.result-container` after the fix.
- Measured (VERIFIED, injected rows, keyboard Tab, ring read after 300 ms): `.result-container` 277 px (x 17 to 294); the three focused rows are x 17, width 561, 320 and 318. All three `ringClip: true` (ring `2px solid`, offset `-2px`, ring edge beyond the container). Screenshot `/tmp/a11y-r5/f-ltr-light-0.png`: the first row's ring is complete on the start, top and bottom and runs off the right edge; the top line also stops at x of about 163 where the subject clip ends. In Arabic it will clip on the left (ASSUMED by symmetry; my RTL attempt was a `dir` flip on the LTR page, which does not load the RTL bundle, so I discarded it).
- Why: `table-layout: fixed; width: 100%` fixes the table, but the anonymous cell still holds rows whose `.level.list-row` is 302 px wide (min content of `.level-right` 130 px plus the checkbox and subject). The badge fits (x 201 to 284) because it sits in the right group; the row box does not.
- Same defect existed before the fix (row 341 px in a 277 px container), so the fix did not worsen it; it still misses "never clipped" at 400%.
- Fix suggestion: also set `.list-row-container, .list-row { max-inline-size: 100%; min-inline-size: 0 }` in the media query, or give the ring `outline-offset: -2px` on a wrapper that is inside the clip (the row's `.list-row` child).

**3. v16.52.0 at 320 px: the first Tab stops are invisible controls of the closed sidebar (core, not caused by the theme, mitigable).**
- Measured (VERIFIED, empty ToDo list, Tab from page load): stops 1 to 11 are `button.drop-icon` "Sidebar Menu", `a.item-anchor` "Home", "DocType", then "Expand Customization", "Expand Scripting", "Expand Views", "Expand Desk", "Expand Modules", "Expand Packages", "Expand Settings", "Expand Reports"; the ancestor `.body-sidebar-top` (and `.sidebar-header`) computes `opacity: 0`, `transform: translateX(-12px)`, and `elementFromPoint` at each stop is another element. The outline is 2 px but its parent has opacity 0, so the user sees no focus for about 11 key presses. With injected rows the three rows come first, then the same 11 invisible stops.
- Cause read in core: `sidebar.js:719-726` `hides_when_collapsed()` returns false when `frappe.is_mobile()` (true at 320 px: measured `mobile: true`), so `apply_expanded_state` (`:740-744`) does not set `inert`; `sidebar.scss:496-510` then fades the closed drawer (`> * { transform: translateX(-12px); opacity: 0 }`, `pointer-events: none`) but leaves it focusable. Probe at 1280 px: `inert false`, sidebar expanded, no issue. I did not block the theme to prove core alone shows it; neither theme file mentions `inert`, `opacity: 0` or `translateX` for this (grep of `_shell.scss`, `_dock.scss`).
- Why it matters: this is exactly the 400% zoom of a 1280 px window (WCAG 2.4.7, 2.4.3 at 400%). Round 4 finding 10 (tab order starts in the list) did not catch the invisibility.
- Fix suggestion (theme side): in `@media (max-width: 767px)`, `.body-sidebar-container:not(.expanded) .body-sidebar > * { visibility: hidden }` (with `transition: visibility 0s linear .2s` so the fade still plays). It removes the controls from the tab order and the accessibility tree while closed and returns them when `.expanded` is set.

**4. Embedded-list Cancelled is a red cross, the list's Cancelled is a muted square (state language splits).**
- Where: `_status.scss:144` (`.embedded-list-table td > .es-badge` host), documented by the team as limit (a) in `v1652-items/README.md` section 3.
- Evidence (COMPUTED from `probe-embedded.json`, `workorder-style`): "Cancelled" `theme: red` text/fill 9.54 (Light) and 10.71 (Dark), 9x9 cross; the list and the side panel draw Cancelled as a muted square (12.83 Light, 6.74 Dark). "Open" is also a red cross (ERPNext's own map). A reader of a Work Order form sees the same word with two different symbols, and a red cross in the product also means "Open" or "Overdue".
- Mitigated because the label is always printed (status is not carried by colour or shape alone). A cheap improvement: key the same muted square on the badge's label text for the three known docstatus labels is fragile; better ask core for `data-filter` on the cell or leave a documented known issue (the team's wording does).

### NOTE

**5. Kanban v1 dot: shape is now a status vocabulary on what is a user-chosen colour tag.** `kanban_column.html:4` draws the dot from the column's `indicator` colour, which the user picks freely. Red now draws a cross, green a check, orange a half disc (`probe.json`, `kanban`: glyph 9x9 / 5x9 / 9x9, text/fill 9.32, 8.73, 9.54 Light and 10.58, 10.39, 10.71 Dark, all above 3:1 as a non-text glyph). It adds a non-colour cue (good, 1.4.1), but a column the user painted red for "Urgent" now carries a cross, which reads as "failed". Icon-only, no accessible name (same as core and as 16.32.0's dot). The column title is the label. Decision for the lead, no change required.

**6. Embedded-list host is broader than status cells.** `.embedded-list-table td > .es-badge` also matches non-status badges: the Role form's Documents tab shows "Standard" with a neutral ring (8.01 Light) and "Custom" with a blue dot (`probe-embedded.json`, `role-embedded`). A ring on "Standard" reads like "Draft". Label text is intact; the shape is decoration there.

**7. Neutral badge on a hovered row loses its fill.** COMPUTED: Draft fill `rgb(241,244,248)` on the Light hover row `rgb(241,244,248)` is 1.00:1; border `rgb(184,190,199)` on it 1.70:1; ring glyph and text 8.01:1. Dark: fill `rgb(29,37,47)` against hover `rgb(37,44,55)` 1.10:1, text on the hover row 9.52:1. The shape and the label remain, so the status is still carried; the pill boundary vanishes on hover (this is the approved token pair, unchanged since round 3).

**8. Side-panel script (`public/js/shell/side_panel_status.js`).** Read in full. It writes `data-ins-filter` only when `frappe.get_indicator` returns `docstatus,=,0` or `,=,2` (regex `^docstatus,=,[02]$`); other cases remove the attribute (`setAttr(..., null)`), so a Draft panel followed by a Submitted one does not keep a stale marker (core `.empty()`s and re-appends, `side_panel.js:738-747`). `panel.preview` is set before `set_header` (`:610-613`), `panel.current` at `:550`; the loading state calls `set_header(..., null)` (`:574`) and leaves no badge, so nothing is mis-marked. try/catch on the private `frappe.ui._side_panel`. Two small points: the observer on `document.body` with `subtree: true` (`:33`) runs `watch()` after every DOM mutation batch in the desk (one `querySelector`, so cheap, but it never disconnects); a workflow-state badge shown red is not covered (documented). No ARIA changes, no focusable element added.

**9. Print: the Midad DRAFT watermark on v16.52.0 is partly covered, and it is a legibility issue, not a status-communication issue.** VERIFIED by rendering the PDF at 110 dpi (`pdftoppm`, crop of `v16.52.0-explicit/themed-chrome-A4-en.pdf`): the framed word "DRAFT" at `top: 40%` lies behind the line-item table and the totals; the upper roughly third of the letters is hidden by the opaque item row and the box's top border is cut, the lower two thirds and the 6 px frame bottom are drawn, the Sub Total and Grand Total text sits on the grey letters (black on 12% ink, no contrast problem). In Arabic (`themed-chrome-A4-ar.png`) "مسودة" is drawn with the same overlap and stays readable. The format also prints the status as text: "Status / Draft" (and "الحالة / مسودة"), which the 16.32.0 Standard format does not, so on 16.52.0 the watermark is redundant there. On 16.32.0 (`v16.32.0/png/themed-chrome-A4-en.png`) the whole word and frame show in the empty area below the table. Why it is not a status problem: the text label is printed in the document body; the watermark is a second cue at `opacity: 0.12` (`ins_print.bundle.scss:361`) and "the text is the meaning" (`:350-351`). Residual: on a photocopy at 12% ink the watermark may drop out entirely, and the sole cue in the Standard format on 16.52.0 is then the "Draft" in the title block of that format (not checked). Suggest `z-index`/position is left alone; consider `top: 55%` only if the lead wants the whole word visible on short documents. Other print observations (core): the Arabic print leaves "Sub Total" and the in-words line in English; not in the diff.

**10. Forced colours, reduced motion, logical properties, `!important`, datatable heights.**
- Forced colours: the status shape rule in `_status.scss` (`@media (forced-colors: active)` block after line 262, `html:root[dir] :is(.indicator-pill, .es-badge#{$ins-badge-host})::before { forced-color-adjust: none; color: CanvasText }`) uses `$ins-badge-host`, so the Kanban dot, the embedded cell and the side-panel badge get it; by reading, not by running (see section 4).
- Reduced motion: no animation or transition added in the diff (grep of added lines).
- Logical properties and wrapper: my grep of the added lines in `institutional_theme/public` for `!important`, `margin/padding-left/right`, `left:`, `right:`, `text-align: left/right`, `border-left/right`, `height` returned nothing. The only new sizing is `inline-size` and `max-inline-size`. `ins_desk.bundle.scss:3` and `:38` carry `/*rtl:begin:ignore*/` and `/*rtl:end:ignore*/`. The check mark shape keeps its physical `border-width: 0 2px 2px 0` plus rotate (correct, a tick must not mirror; pre-existing mixin).
- No datatable row or cell height is set (the new rule sets table layout and widths on `.result`, which is core's list table, not frappe-datatable).
- `!important`: none added; the manifest rows for the new selectors exist (`docs/DEPENDENCY_MANIFEST.md`, four new rows and one edited), each with file and line on both versions.

## 2. What I checked, with values

**Audits (VERIFIED, run by me).** `python -m institutional_theme.audits`: contrast 0 failing pairs in shipped presets (midad Light and Dark pass), avatars 216 measurements 0 failing, parity 56 checks 0 failed, colour vision 0 failures (99 baselined chart gaps), counterparts 30 pairs 0 findings, budgets 0 problems, dead tokens combined 0 dead in every version, `audits: passed`.

**State clarity.**
- Kanban dot (COMPUTED from `probe.json`): label-less, so shape carries the colour: orange half disc, green check, red cross; the count badge next to it stays neutral with no shape (`content: none`); glyph against its own fill 8.7 to 10.7:1. The core circle svg is `display: none` (probe `svg: "none"`).
- Side panel Draft: neutral pair `rgb(66,75,87)` on `rgb(241,244,248)` 8.01 (Light), 10.47 (Dark), ring 9x9; Cancelled: `rgb(20,27,37)` on `rgb(218,222,229)` 12.83 (Light), 6.74 (Dark), square 8x8; Submitted blue dot 9.01 / 10.44. Same values as the list rows. English and Arabic, Light and Dark. The Arabic panel opens on the inline-end side (left) and the header reads "Ins Probe Slip / 1" then the badge (`ar-light-sidepanel-draft.png`).
- Embedded cells: Completed, Submitted green check 8.73 / 10.39, Work In Progress amber half 9.32 / 10.58, Draft neutral ring 8.01 / 10.47, Cancelled and Open red cross (finding 4).
- List badge at 320 px, injected rows, ltr Light and Dark: `table-layout: fixed`, `.result` 277 px, `scrollWidth 277 = clientWidth 277`, page overflow 0, the status badge x 201 to 284, 219 to 284, 226 to 284 inside the container (294), shape glyph drawn (`content: ""`), label present. The status is conveyed by label, shape and colour. The team's recorded run (`z400-16.52.0-after/probe.json`) shows 0 clipped badges of 6 and 3 in en, ar, Light and Dark; I read it and viewed `ar-light-todo.png`, `en-dark-slip.png` and the `before` shots.

**Contrast spot checks the audit does not declare (COMPUTED).** (a) Hover: Draft on the hovered row, finding 7 (1.00 fill, 8.01 text). (b) Selected row: Cancelled border `rgb(106,114,125)` on the Light selected row `rgb(242,247,254)` 4.52, fill against selected 1.25 (fill is not the carrier). (c) Tinted banner: Kanban column title ink against the status-tinted column, sampled from the screenshot pixels (`ar-dark-kanban.png`, `ar-light-kanban.png`): Dark red column `rgb(81,11,13)` with title `rgb(223,227,232)` 11.61, green `rgb(0,52,29)` 10.80, orange `rgb(71,27,0)` 11.43; Light red column `rgb(255,230,228)` with title `rgb(40,49,60)` 11.09, green 11.33, orange 11.10. In Light the dot's fill equals the column tint, so the dot is carried by glyph and border (border 1.44 to 1.50 against it, glyph 8.7 to 9.5).

**Focus.** Core row stops `list-row-container` show a 2 px ring at offset -2 (VERIFIED); finding 2 for the clip. The other stops measured at 320 px (sidebar items, drop icons, sidebar toggle) have a 2 px ring, offset +2 or -2; none was covered by the sticky page head (`coveredByHead false` in every ltr reading); finding 3 for their invisibility.

**Keyboard.** Tab on the live page at 320 px, both orders read from the dump above. Nothing new in the diff is a control; the new badges are not focusable (core), the side panel script adds no tabindex.

**RTL.** Team captures viewed (Arabic): Kanban (`ar-dark-kanban.png`: dock on the right, sidebar right of the page, columns run right to left, dot at the inline end of the column title next to the count), side panel (`ar-light-sidepanel-draft.png`), list at 400% (`ar-light-todo.png`: checkbox and subject at the right, badge at the left top, date then priority on the second line, previous/next not involved). Letter-spacing was not re-scanned. Finding 1 for the clipped Latin subject.

**Robustness.** Reduced motion: no new motion (reading). Forced colours: not run (finding 10). 200%: not in the diff's scope (rule starts at 576 px; a 200% zoom of 1280 is 640 px, so the rule does not apply there; the pre-fix list at 640 px was clean in round 4). 400%: findings 1 to 3. Coarse pointer: not touched.

**Fidelity (listed, not judged), reference `design/canvas/midad.css`.** Kanban v1 column dot is an icon-only status badge with check, cross and half glyphs (the canvas has no Kanban); side-panel Draft has a ring and Cancelled a square as in the canvas list pills; embedded-list badges are status badges with shapes; the list at 576 px and below uses a fixed table layout and clips instead of scrolling (16.32.0 scrolls, `overflow: auto`); the focus ring of rows is clipped at that width (finding 2).

## 3. Scores, BRIEF section 10 (dimensions I own), rescored

| Dimension | Round 4 after fixes | Round 5 | Evidence and what holds it |
|---|---|---|---|
| Accessibility | 4 | **4** | New: the 400% list badge is reachable (measured 201 to 284 in a 277 px container, 0 clipped badges in the team's 8 recorded runs, 36 badges), contrast on every new shape 6.7 to 12.8, no `!important`, no focusable element added. Held at 4, not 5: findings 1, 2 and 3 (silent subject clipping, row ring clipped, 11 invisible tab stops at 320 px, the last core-caused). If the lead judges finding 3 a release defect it would drop this to 3; I kept it SHOULD-FIX because the cause is core, the content is reachable after the stops, and the fix is three lines |
| RTL parity | 4 | **4** | Logical properties only in the diff, wrapper intact, Arabic captures read right to left, side panel and Kanban placed correctly. Held at 4: Latin subject loses its first letter in an Arabic row at 400% (finding 1) |
| Dark-mode parity | 4 | **4** | Dark values computed for every new shape (6.74 to 10.71), Kanban column tint and title 10.80 to 11.61; login and email remain Light only (round 4 finding 11, lead decision) |
| Density and productivity | 4 | **4** | No size change in the diff; the 400% list now shows the status without a horizontal gesture |
| Clarity and hierarchy | 4 | **4** | Side-panel Draft and Cancelled now match the list, Kanban dot has a non-colour cue; held by findings 4 and 5 (Cancelled symbol differs in embedded lists, cross on a decorative colour) |
| Calm | 4 | **4** | No motion, no new saturation; the Kanban dot adds 3 small glyphs |
| Consistency | 4 | **4** | One status language except the embedded Cancelled (finding 4) |
| Credibility | 4 | **4** | Nothing new on the first screen; the 400% list is credible except for the silent subject clip (finding 1) |

No dimension I own is below 4. I do not score upgrade-safety, performance, documentation or craft.

## 4. Not tested

Forced colours on the new shapes (read, not run); real browser zoom and pinch zoom (320 CSS px stand-in at DPR 2 to 4); Arabic session on the live bench (the Arabic captures are the team's; my own run was English, and the `dir` flip I tried was discarded as unfaithful); real data (rows were injected client-side; the v16.52.0 bench at 8001 was down and 8002 had no ToDo records); the side panel opened live (read the script and core, read the team's captures); keyboard behaviour of the side panel; compact density; coarse pointer; screen readers (NVDA, JAWS, VoiceOver, TalkBack); real Windows High Contrast; the Work Order form with a real record (the team could not create one on PostgreSQL); HRMS 16.20.1; whether finding 3 appears with the theme blocked (core code and CSS read, theme not disabled); PDF printing on paper or photocopy, Letter size, and the wkhtmltopdf path (the team shows it is core's clip). Designed to meet WCAG 2.2 AA; formal audit recommended.

---

# Re-check after fix rounds

Designed to meet WCAG 2.2 AA; formal audit recommended. Same reviewer. Diff read: `git diff af3388d..HEAD -- institutional_theme/public tests/browser docs/DEPENDENCY_MANIFEST.md` (code in `5d00af9` and `e17dd5d`; evidence `docs/team/evidence/round5/v1652-items/fix1/` and `fix2/`).

Environment. All three benches answered this time. I probed v16.52.0 at `midad52.test:8001` (served bundle `ins_desk.bundle.C3CZGC3A.css`) and, when 8001 timed out under the release-gate load, at 8002; read only, Administrator, the same three to four fictional rows injected client-side (`cur_list.render()`), no writes, no builds. Scripts and captures are in `/tmp/a11y-r5/` (`r.mjs`, `r2*.mjs`, `rc-row.png`, `rc-drawer.png`), numbers copied below.

## A. State of each finding

| # | Finding | State | Evidence |
|---|---|---|---|
| 1 | Subject clipped without ellipsis, Latin subject loses its first letter in Arabic | **Closed** (new side effect, finding 5) | below |
| 2 | Row focus ring clipped at 320 px | **Closed** | below |
| 3 | Closed sidebar controls focusable while invisible at 320 px | **Closed** | below |
| 4 | Embedded-list Cancelled is a red cross, list Cancelled a muted square | **Closed** (arm removed; every cell neutral) | below |
| 5 (old note) | Kanban v1 dot shapes on user-chosen colours | **Accepted by the lead**, no change | this report's note 5 stands as the record |
| 6 (old note) | Embedded host broader than status cells | **Closed** by the same removal | below |
| 7 | Neutral badge on a hovered row loses its fill | Open, NOTE, approved token pair | unchanged |
| 8 | Side-panel script | **Closed**, re-read | below |
| 9 | Watermark partly behind totals on v16.52.0 | **Accepted by the lead** (that format prints "Status: Draft" as text) | my judgement stands: legibility, not status communication |

**1 and 2, subject and ring (VERIFIED on v16.52.0, 320 px, DPR 2).** `.result-container` 277 px (x 17 to 294), `scrollWidth 277 = clientWidth 277`, page overflow 0. All four injected rows (three English, one long Arabic subject) sit at x 17 to 294, so the row is no wider than the container (before: 318 to 561 px). Every subject `a` computes `text-overflow: ellipsis`, `unicode-bidi: plaintext`, and `scrollWidth > clientWidth` (514, 112 and 233 against 77) in the three truncated rows, so truncation always has an ellipsis; "Short" (37 against 37) is not truncated. Keyboard Tab from the top: stops 1 to 4 are the four list rows, `outline 2px solid`, offset `-2px`, ring edge inside the container (`ringClip false` for all four), `checkVisibility` true; stops 5 to 9 are the page-head controls (sidebar toggle, search, view switcher, menu, "Add ToDo"), all visible, none covered. The team's Arabic capture (`fix1/16.52.0-after/ar-light-todo.png`, viewed): "Probe tas..." starts at its own first letter in the Arabic row and the ellipsis is at its end; the long Arabic subject ends with its ellipsis; the status badges are inside the row at the inline end (x 138 to 297 of 1000 in the capture). The 400% badge fix still holds (badge x 193 to 276, 211 to 276, 218 to 276).

**3, closed drawer (VERIFIED).** At 320 px the first stops are rows then the page-head controls: 0 invisible stops (before: 11, with `opacity: 0` ancestors). At 700 px with the drawer closed every `.body-sidebar > *` computes `visibility: hidden`, `opacity: 0`, and the first sidebar link `checkVisibility` is false, so it is out of the tab order and the accessibility tree. Opening it with the toggle: container class `body-sidebar-container expanded`, child `visibility: visible`, the first control `checkVisibility` true (`/tmp/a11y-r5/rc-drawer.png`). At 1280 px: container `expanded`, all five children `visible/1`, first link visible, so the 767.98 px scope does not touch the desktop rail.

**4 and 6, embedded lists (COMPUTED, `fix2/16.52.0-after/probe-embedded.json`).** 48 badges across the Work Order-style table and the Role Documents tab, en and ar, Light and Dark: 0 not neutral (fill `rgb(241,244,248)` Light, `rgb(29,37,47)` Dark), `::before` width `auto` (no shape), the label printed in every cell. "Cancelled" is therefore no longer a red cross in an embedded list; a Work Order's Draft, Submitted and Cancelled cells all read as neutral text. That removes the state-language split and the ring on "Standard". It also means those cells carry the label only; the manifest row now says "NOT a status host". The Kanban v1 arm stays in `$ins-badge-host` (`_status.scss`, host line).

**8, side-panel script (read).** `side_panel_status.js` now uses `frappe.ui.get_side_panel()` when it exists (falling back to the private name), one `childList` observer on `<body>` without `subtree` that reads only added nodes and disconnects when it finds `.side-panel-indicator`, and uses an existing host directly. This removes the per-mutation `querySelector` I flagged. The attribute logic is unchanged (`docstatus,=,[02]` only, `setAttr(..., null)` otherwise); the 12 recorded probes (`fix2/16.52.0-after/probe.json`, `side-*`) still show Draft neutral ring, Submitted blue dot, Cancelled muted square, en and ar, Light and Dark. Not re-run by me on the live side panel.

**Code hygiene of the fix diff.** My grep of the added lines in `institutional_theme/public` finds no `!important`, no physical property (`inline-size`, `min-inline-size`, `max-inline-size`, `text-overflow`, `unicode-bidi` only), no height on a row or cell; the `767.98px` and `576px` media widths are core's breakpoints; the `visibility` transition repeats core's two transitions so the fade is kept, and under `prefers-reduced-motion` the `_base.scss` collapse still applies (not re-measured). `ins_desk.bundle.scss` still wraps in `rtl:ignore`.

## B. New finding

**5. SHOULD-FIX. The date in the list row's second line is now cut to an ellipsis at 320 px (v16.52.0, ToDo list).**
- Observed (VERIFIED, `/tmp/a11y-r5/rc-row.png`, one injected row, DPR 3): the second line reads "[Low] • …": the priority chip, the separator dot and a lone ellipsis wrapped under the dot; "14-10-2026" is not visible. The date `a.filterable.ellipsis` has `clientWidth 0` inside its `.ellipsis` column (x 118, width 79). The team's own Arabic capture shows the same stacked "•" and "…" on every row (`fix1/16.52.0-after/ar-light-todo.png`), not flagged in their README.
- Before the fixes, on the same bench at the same size (my round-5 capture `/tmp/a11y-r5/f-ltr-light-0.png`), the second line read "[Medium] • 14-10-2026" for every row, so this is new with `5d00af9` (rows made no wider than the container). The cause is not isolated: three in-page overrides (undoing the row `max-inline-size`, the table layout, the subject `display`) did not bring the date back while the bench was under load, so I cannot say which of the five new rules does it. Core already loses the tail of this line on other doctypes and on 16.32.0 (the slip list, round-5 first report), so the date was only ever visible here by luck of width.
- Impact: at 400% the due date (for other lists: the modified time) is unreadable and nothing says why; the primary status and the subject are intact, the document opens to the full data. Not a content-reachability blocker, but a regression of a visible field.
- Fix suggestion: in the same media query let the meta line wrap instead of clipping: `.list-row-container .list-row .level-left { flex-wrap: wrap }` and `.list-row-col.ellipsis:has(> a.filterable) { flex: 0 0 auto; overflow: visible }` (the date is short and fixed in width), or allow the date column `min-inline-size: max-content`. Add a probe: for each row, `date.getClientRects()[0].width > 0` in the narrow probe.

## C. Final scores, BRIEF section 10 (dimensions I own)

| Dimension | Round 4 after fixes | Round 5 first report | Final | Evidence and what holds it |
|---|---|---|---|---|
| Accessibility | 4 | 4 | **4** | Findings 1 to 3 closed with measurements: subject ellipsis in every truncated row, row ring inside the clip on 4 of 4 stops, 0 invisible stops before the first row, drawer restores when opened, desktop rail unchanged. Held at 4: finding 5 (due date lost at 400%), round-4 items still open from before (tab order starts in the list, login Light only) |
| RTL parity | 4 | 4 | **4** | Latin subject starts at its own first letter in an Arabic row and the ellipsis is at its end (team capture, viewed); logical properties only; badges at the inline end. Not re-run in a real Arabic session by me |
| Dark-mode parity | 4 | 4 | **4** | New neutral embedded cells `rgb(29,37,47)` with ink 10.47; the side-panel and Kanban Dark values unchanged (6.74 to 10.71); login and email still Light only (lead decision) |
| Density and productivity | 4 | 4 | **4** | No size change; the 400% list keeps subject, status and priority in view; the date is the regression (finding 5) |
| Clarity and hierarchy | 4 | 4 | **4** | Embedded cells now carry the label only, so there is no second Cancelled symbol; side-panel Draft and Cancelled match the list |
| Calm | 4 | 4 | **4** | No new motion or saturation; one delayed `visibility` on the closed drawer |
| Consistency | 4 | 4 | **4** | One status language: list, page head, side panel and Kanban dot draw shapes; embedded cells are plain labels (documented) |
| Credibility | 4 | 4 | **4** | The 400% list reads cleanly except for the clipped date line |

No dimension I own is below 4. **Open blocking: none.** Open should-fix: finding 5 (new, date at 400%). Open notes: 7 (hover fill), plus the round-4 items outside this diff.

## D. Not tested in the re-check

An Arabic session on the live bench (Arabic read from the team's captures); real records (injected rows again); the side panel opened live after the observer change (read and the team's 12 probes); forced colours; `prefers-reduced-motion` on the delayed `visibility`; real browser zoom; screen readers; whether the drawer's `visibility: hidden` hides anything a user needs when the drawer is open on 16.32.0 (read only, the rule matches there at ≤767.98 px where core already closes to width 0; not measured); 16.32.0 live (not probed this round); the cause of finding 5. Designed to meet WCAG 2.2 AA; formal audit recommended.

---

# Re-check of fix round 3

Designed to meet WCAG 2.2 AA; formal audit recommended. Same reviewer. Diff read: `94ec765` (`desk/_list.scss`, three rules added to the existing `max-width: 576px` block) and `docs/team/evidence/round5/v1652-items/fix3/README.md`.

Probe (VERIFIED, read only, Administrator, 320 CSS px at DPR 3, `locale: en-US`, Chromium): v16.52.0 at `midad52.test:8001` with four rows injected client-side (`cur_list.render()`, three English subjects and one long Arabic one); 16.32.0 at `midad.test:8000` with its five real ToDo rows (no injection, no writes). For every data row I measured the date's text range (`Range.getBoundingClientRect`) against every `overflow: hidden` ancestor up to `.result-container`, the subject's `scrollWidth` against `clientWidth`, the status badge's x range, and keyboard Tab ring geometry. Script `/tmp/a11y-r5/r3.mjs` and `r3real.mjs`, captures `/tmp/a11y-r5/r3-v52.png`.

## Finding 5 (date lost at 320 px): closed

| | v16.52.0 (4 rows) | 16.32.0 (5 rows) |
|---|---|---|
| container | x 17 to 294, `scrollWidth 277 = clientWidth 277`, page overflow 0 | x 18 to 295, 277 = 277, page overflow 0 |
| date `14-10-2026` | width 79, x 35 to 114, inside every clip, 4 of 4 | width 79, x 36 to 115, inside every clip, 5 of 5 |
| subject | truncated rows carry `text-overflow: ellipsis` (3 of 4 truncated; "Short" is not) | the same (3 of 5 truncated, all with ellipsis) |
| status badge | x 193 to 276, 211 to 276, 218 to 276 (container right 294) | x 214 to 277, 185 to 277, 204 to 277 (right 295) |
| row | x 17 to 294, height 92 | x 18 to 295, height 92 |
| keyboard (4 row stops) | `2px solid`, offset `-2px`, `ringClip false`, `checkVisibility` true | the same |

The capture (`r3-v52.png`) shows each row as subject with ellipsis, status badge with shape and label at the inline end, then the priority chip with a separator dot, and the date on its own line under the chip. The team's Arabic capture (`fix3/z400-16.52.0-after/ar-light-todo.png`, viewed): the same layout mirrored (chip and date right-aligned at the start, badge at the inline end on the left, "Probe tas..." and the Arabic subject with their ellipses at the end). I also ran the same probe with `dir="rtl"` flipped on the LTR page (v16.52.0: date x 174 to 250 inside, badge x 44 to 124; 16.32.0: date inside on 5 of 5, badge x 44 to 134); that is a layout stand-in only, because the Arabic CSS bundle is not loaded in it, so I rely on the team's capture for Arabic.

## New observations (NOTE, not blocking)

- **Dangling separator.** The meta line now wraps between the chip and the date, so the dot that separated them stays at the end of the first line ("[Medium] •") and the date sits alone below it. Cosmetic; the meaning is intact. A tidy fix is to hide that separator inside the media query (`.mobile-layout`'s dot) or to move it with the date.
- **Partial row fill on focus.** The focused row's tint covers the lower part and leaves the upper part (subject and badge area) white in my capture (`r3-v52.png`, last row). The same split was in my pre-fix capture (`f-ltr-light-0.png`), so it is older than this change; it comes from the hover and checked fill being applied to `.list-row` pieces separately (`_list.scss:39-47`). The ring and the label are unaffected.
- The row is one line taller (92 px against 76); the list scrolls, nothing overlaps.

No new accessibility issue found. Not tested: a real Arabic session on the live benches (language is Administrator's setting, which I did not change), the focus ring in Arabic, other doctypes' second lines (the README says core may still lose columns on other narrow lists), real browser zoom, forced colours, screen readers.

## Final scores, BRIEF section 10 (dimensions I own)

| Dimension | After fix round 2 | Final | Evidence |
|---|---|---|---|
| Accessibility | 4 | **4** | Date, subject ellipsis, row ring and status badge all inside the clip on both versions, no invisible tab stops (round 2 probe); open items from before this round (tab order starts in the list, login Light only) unchanged |
| RTL parity | 4 | **4** | Arabic capture mirrors correctly with the date visible; `dir`-flip stand-in only for my own probe |
| Dark-mode parity | 4 | **4** | No colour change in this fix; Dark values from the earlier checks stand |
| Density and productivity | 4 | **4** | Rows 92 px tall at 320 px; all four fields (subject, status, priority, date) readable |
| Clarity and hierarchy | 4 | **4** | Status keeps label, shape and colour; dangling dot is cosmetic |
| Calm | 4 | **4** | No motion or saturation added |
| Consistency | 4 | **4** | 16.32.0 and v16.52.0 produce the same row geometry at 320 px |
| Credibility | 4 | **4** | The 400% list now reads in full except the long subjects, which carry an ellipsis and a title |

No dimension I own is below 4. **Open blocking: none. Open should-fix: none from this review.** Open notes: hover fill of the neutral badge (7), dangling separator and partial focus fill (this section).
