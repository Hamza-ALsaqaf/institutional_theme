# Accessibility, RTL and fidelity review, round 4

Designed to meet WCAG 2.2 AA; formal audit recommended. Independent reviewer, did not write the code. Hostile review of `git diff 11a3a36..origin/build/midad-v1`, read at head `07d18f1` (the diff grew by `cc42a3f` and `07d18f1` while I worked; the served bundles on both benches were `ins_desk.bundle.WRBFSDWU.css` and, after the last commit, `ins_web.bundle.CCXCS47X.css`, and I re-measured the login on that build).

Labels. VERIFIED = I ran it on the live benches (`midad.test:8000` Frappe 16.32.0, `midad52.test:8001` Frappe v16.52.0; Chromium 1194 via Playwright 1.56.1; throw-away users `rev4*@example.com` in Light and Dark, en and ar; scripts in `docs/team/evidence/round4/review-a11y/scripts/`, raw output in `.../data/`). COMPUTED = from files or `getComputedStyle` with alpha composited down the ancestors and the WCAG formula. ASSUMED = not run. Screenshot paths are relative to `docs/team/evidence/round4/review-a11y/` (called `R/` below).

Housekeeping. I created four users per site (and one extra on 16.32.0 for the Arabic letter-spacing scan) through the REST API and deleted all of them (HTTP 202 each; `left: []` on both sites). I never wrote to Administrator: both sites read `desk_theme = Light`, `language = en` at the end. `python -m institutional_theme.audits` rewrote `docs/audits/budgets.txt` and `dead_tokens.txt`; I restored both with `git checkout`. The theme disappeared twice while the gates ran (an unthemed run of mine was discarded, one screenshot deleted); every number below is from a themed run. I commit only this file and `R/`.

## 1. Findings

Severity: BLOCKING = a user of the supported configuration cannot use or read something that matters, or a stated claim is false in a way that changes the gate. NON-BLOCKING = real, but the user can still do the task or the cause is core and unchanged.

### BLOCKING

**1. v16.52.0, Arabic login: the email text runs under the envelope icon.** (16.32.0 had the same defect until `07d18f1`; it is fixed there and not on v16.52.0.)
- Where: `institutional_theme/public/scss/web/_login.scss:181` (`.email-field input { padding-inline-start: 38px }`) with `:121-134` (`direction: ltr` on `#login_email`) and the field icon `.email-field:not(:has(> .field-icon))::before` (`:201`, `inset-inline-start`). Round 3 padded both sides (`git show 11a3a36:.../_login.scss`, `.email-field input, .password-field input { padding-inline: 38px }`); round 4 changed it for the X1 gap.
- What a user sees: in an Arabic session the email input keeps `direction: ltr` and `text-align: end`, so the address is flush right. Padding-inline-start of a ltr input is the left side. The icon sits at the inline start of the field, which in the rtl page is the right side. Computed on v16.52.0 ar: input `dir=ltr`, `padding-left 38px`, `padding-right 12px`; field box x 512 to 854, icon x 826 to 842, text right edge x 841. The last character of every typed address (".com", the final "m") is drawn under the icon; the placeholder does the same. The password field is fine (38 on both sides). English is fine (icon at the left, text starts at 38px).
- Observed: `R/login-filled-52-ar.png` and `R/login-filled-ar-52-left-32-right.png` (left: v16.52.0, overlap; right: 16.32.0 after `07d18f1`, clean), `R/login-52-ar-light.png`. The team's own capture shows it on 16.32.0 before the fix: `docs/team/evidence/round4/login/v1632-login-ar-focus.png`. Computed paddings: `R/data/login-52-ar-light.json` (`icons[0].padStart 38px`, `padEnd 12px`).
- Why the team missed it: the comment added in `07d18f1` (`_login.scss:185`) says "16.32.0 also pads the email field's end (`.field-icon` is its marker); v16.52.0 does not". That holds for a ltr page and not for the rtl one, where the input is forced ltr but the icon is placed by the field's direction. It is the first screen of an Arabic-first product.
- Check after any fix: type a long address in ar on both versions and compare the text's right edge to the icon's left edge.

### NON-BLOCKING

**2. v16.52.0 toast: the status colour the team measured is not the colour drawn.**
- Selector: `.es-toast svg` (computed on `.es-toast[data-type]`); `_overlays.scss:70-84` sets `--es-toast-icon`.
- Measured (VERIFIED, 4 types, 2 modes, en and ar): the icon's `color` takes the status ink (Light 4.79, 5.54, 3.79, 4.87; Dark 6.89, 6.15, 8.28, 6.75; these are the numbers in `p0/README.md`), but the rendered `stroke` is `rgb(66,75,87)` Light and `rgb(185,190,198)` Dark (8.84 and 8.28). The theme maps `--icon-stroke` to the secondary text colour, and core's `.icon { stroke: var(--icon-stroke) }` wins over the `stroke="currentColor"` attribute; `_actions.scss:71` restores `--icon-stroke: currentColor` for `.es-button` only.
- What the user sees: a calm grey icon on every toast; the type is carried by the glyph shape and the message. Nothing fails contrast (8.84, 8.28), but the commit "toast icons use status ink" and the P0 table describe a rendering that does not exist. `R/toast-52-en-light.png`, `R/toast-52-ar-dark.png`, `R/data/t5-52-*.json` (`iconColor` against `iconStroke`).

**3. v16.52.0 at 400% zoom: the status badge of a list row is cut off and unreachable.**
- Selector: `.result-container` (core `overflow-x: hidden` at narrow widths) containing `.level-right` with `min-width: var(--list-right-width, 130px)`.
- Measured (VERIFIED, 320 CSS px at 4x as the stand-in for 400% of 1280): ToDo list, row 1, badge `Cancelled` spans x 276 to 358, the container ends at x 295, `scrollWidth 359` against `clientWidth 278`, `overflow-x: hidden`, so there is nothing to scroll. On 16.32.0 the same badge sits at x 193 to 285 (`overflow: auto`, `scrollWidth = clientWidth`). With the theme blocked v16.52.0 behaves the same (x 285 to 359), so the cause is core, not the theme; at 390 px the overflow is 11 px and the badge shows. `R/z400-52-en-list.png` against `R/z400-32-en-list.png`, `R/row-52-320.png`, `R/data/t8-52-en.json`.
- Effect: at 400% the main status of a list is not perceivable on v16.52.0 (WCAG 1.4.10, 1.4.1 for the state). Page-level overflow is zero on both versions at 200% and 400% (`scrollWidth = innerWidth`, list and form).

**4. Forced colours: the selected row of the sidebar, the active dock tile and the active page-size pill are indistinguishable from their neighbours.**
- Selectors: `.body-sidebar .standard-sidebar-item.active-sidebar` (both versions), `.dock .dock-item.active` (v16.52.0, new), `.list-paging-area .es-pill[data-state="active"]` (v16.52.0, new). `_shell.scss`, `_dock.scss` and `_list.scss` have no `forced-colors` block.
- Measured (VERIFIED, Chromium `forcedColors: active`, en and ar): the ring is a `box-shadow` (computed `none`), the accent bar and the pill fill are backgrounds (`rgb(255,255,255)` = Canvas on a Canvas row). Active and plain rows have the same text colour, no border, no outline; weight 400 for both. `R/forced-52-en-list.png` (the current "ToDo" row, the first dock icon and the "20" pill look like their neighbours), `R/forced-32-en-list.png` (same sidebar defect, pre-existing), `R/data/t6-*.json`.
- What is fine under forced colours: status badges keep their border and glyph (cross, check, half, ring all drawn; badge border `solid 1px`, `forced-color-adjust` handled in `_status.scss`), buttons have a 1px border, the focus ring is a 2px outline, the toast and the menu keep a 1px border and the highlighted menu item has a 2px outline. Not exposed to AT either: no `aria-current` on the sidebar item (only the dock tile and the breadcrumb carry `aria-current="page"` on v16.52.0; none on 16.32.0).

**5. v16.52.0 controls are 28 px high (brief: 32 px, 44 px for coarse pointers).**
- Selectors: `.es-button` (`.primary-action`, `.menu-more-button`, view switcher), `.es-pill`, `.dock-item` (34), `.es-breadcrumbs__item` (28 to 29).
- Measured (VERIFIED): desktop `.primary-action` 28 px, icon button 28 x 28, pill 26 px; with `isMobile` and `hasTouch` (`(pointer: coarse)` true) the primary action stays 67 x 28 and the menu button 28 x 28, while text inputs become 44 px. On 16.32.0 the same buttons are 32 px and 44 px on touch (`R/data/t8-32-en.json`, `t8-52-en.json`, `R/touch-52-en-list.png`). Every target is at least 24 x 24 (WCAG 2.5.8 met; the home and doctype crumbs are 34 x 28 and 64 x 29, the toast close button is exactly 24 x 24). Core `.es-button` takes its height from `--es-bt-h`; only the login sets it (`_login.scss:295`, 40 px).
- Also v16.52.0 only: status badges are 20 px high, 12 px, weight 400 (16.32.0: 20 px, 13 px).

**6. Page-size pills: the selected state differs from the others by 1.07:1 (Light) and 1.15:1 (Dark) in fill.**
- Selector: `.list-paging-area .es-tab-buttons .es-pill[data-state="active"]`.
- Measured: Light active fill `rgb(232,235,241)` with a 1px/2px soft shadow against inactive `rgb(241,244,248)`; Dark `rgb(46,54,65)` against `rgb(37,44,55)` with no shadow; weight 400 for all four, no underline or border. Text goes from 5.69 to 14.49 (Light) and 5.58 to 10.58 (Dark), which is a tone change, not a shape. `aria-checked="true"` and roving `tabindex` (0, -1, -1, -1) are right, and the focus ring is a complete 2px ring outside the pill (`R/pillring-52-en.png`). Sighted users get the state from a faint fill; the 16.32.0 `.btn-paging.btn-info` used the same recipe. `R/data/t17-52-en-light.json`.

**7. Disabled `.es-button` and the login disabled button are below 4.5:1, and solid and subtle look the same.**
- Selector: `.es-button[disabled]` (`--bt-disabled-bg/-fg`, `_actions.scss:71-74`); login `:is(.btn-signup, .es-button):disabled` (dashed border).
- Measured on a disabled clone of each real button (VERIFIED, injected, not a natural state): text `rgb(106,114,125)` on `rgb(241,244,248)` = 4.41 (Light), `rgb(111,119,129)` on `rgb(23,30,40)` = 3.70 (Dark); solid and subtle disabled are identical (same colours, `cursor: not-allowed`). Login disabled "Send link": 4.41, dashed 1px border `rgb(184,190,199)` (1.87 against the card). WCAG exempts disabled controls; BRIEF 8 asks that they "stay distinguishable and legible", and Dark is 3.7. These are the approved `--ins-text-disabled` pair, not a new value.

**8. Emails: footer text 4.17:1, a physical `border-left` in the Arabic case, and no Arabic render.**
- `.email-footer-container.text-muted` and its link (core inline `color:#7c7c7c !important`, both versions, in `1632-` and `1652-email-*.html`): COMPUTED 4.17:1 on white at 13 px; the theme only recolours `.email-footer-meta`.
- `ins_email.bundle.scss:117,183,222`: `border-left: 4px solid` on the warning note (`.email-ignore`) and the quote rule. In an rtl email the rule stays on the left, the end side. SIMULATED (I took the team's v16.52.0 render, set `dir="rtl"` and swapped the text for Arabic): `R/email-ar-simulated-rtl.png`. Mail clients do not honour logical properties, so a physical property may be the right compromise, but it needs an `[dir=rtl]` or `align`-based counterpart. The team's evidence has English renders only.
- Contrast on the new `.auth-email` pieces is fine (COMPUTED): note text `#584600` on `#fdf8ea` 8.64; note rule 3.57 (on its fill) and 3.79 (on the card); button white on `#1b5086` 8.27; body `#424b57`; title `#141b25`. The wordmark in the card is core's "Frappe" logo, not the theme's emblem slot (fidelity, section 2). Emails are always Light; there is no Dark email.

**9. Arabic session on v16.52.0: English names and one reversed sentence.**
- VERIFIED names (tab-order dump, `R/scripts/t12.mjs`): dock link "All apps", sidebar header button "Sidebar Menu", dock tile labels "Build", "Users", "Email"... and the tooltip "Users" (Desktop Icon labels are data), group "Desk". Neither "All apps" nor "Sidebar Menu" is in core's `ar.po` (grep) or the theme's `ar.csv` (grep). The team's finding F2 lists `Sidebar Menu` but not `All apps`.
- OBSERVED (`R/toast-52-ar-dark.png`): the form sidebar shows "Administrator Last Edited By", the English sentence in rtl order. Cause not traced (an untranslated core string); the neighbouring line is translated ("تم إنشاؤه بواسطة Administrator").

**10. Tab order starts in the list, not at the top (both versions, core, unchanged).**
- Selector: `.list-row-container[tabindex="1"]` (core `list_view.js:895` on 16.32.0, `:895,1395` on v16.52.0; DOM check VERIFIED on both). In an Arabic Light list the first three tab stops are the three data rows (x 548), then the dock (x 1338), then the sidebar (x 1113 to 1198); Shift+Tab walks the same order backwards. Page head and filters come after the sidebar. WCAG 2.4.3. Every stop has a complete 2px ring (VERIFIED after a 250 ms wait; read immediately after the key press the same elements showed `outline-width: 0px`, so the ring appears with a short delay, which is why my first run flagged six false "no ring" stops; the cause of the delay I did not trace). The theme already writes attributes on core markup elsewhere (`a11y_rules.js`); this is the same class of fix.
- Related and also core, both versions: the filterable status badge is a `span` with `cursor: pointer`, no `tabindex`, no role (`.es-badge.filterable` and `.indicator-pill.filterable`); the same filter exists in the filter bar.

**11. Login and portal are Light only.** With `colorScheme: dark` emulated, `/login` on both versions computes `color-scheme: light`, body `rgb(247,249,252)` (`R/login-52-en-dark.png` is identical to the Light shot; `R/data/login-*-dark.json`). No document says this is intended, and all round-4 login evidence is Light. A guest has no user preference, so this is a gap in the decision record, not a defect I can measure. Dark-mode parity of the login is therefore unverified, not passed.

**12. Literal `font-weight: 420` survives on 16.32.0.** `.btn-outline` (the form "Discard" button), `.navbar-breadcrumbs a::before`, `.keyboard-shortcut`, `.menu-item-shortcut` are literals in core's compiled CSS (grep of `desk.bundle.*.css`), not variables. VERIFIED computed `420` on `BUTTON.discard-button` and `SPAN.keyboard-shortcut`, Midad Plex face, which only ships 400, 500 and 600. The variable mapping is right (see section 3); the literals cannot be reached by a token. Pre-existing, listed because the round claims "no 420".

**13. Minor notes.**
- `a[href="#forgot"]` on v16.52.0 computes `text-align: right` (ltr) and `left` (rtl), not the theme's `end`: core's `text-right` and its RTL flip place it, the theme's `p:has(> a[href="#forgot"]) { text-align: end }` loses. The result is on the correct side in both directions (`R/login-52-ar-light.png`); the rule is dead.
- Sidebar header chevron (`button[aria-label="Sidebar Menu"]`) and `.drop-icon` draw a square ring (radius 0) where the dock tile and buttons draw rounded ones (`R/ring-sheet-52-en.png`).
- Round-4 P0 README says the 24 compact 16.32.0 captures were not all viewed; I did not review compact density either.

## 2. Fidelity: deviations from the approved artboards (listed, not judged)

Reference: `design/canvas/midad.css`.
- Button: canvas `.btn` is 32 px, 13 px, weight 500, 12 px padding; 16.32.0 renders 32 px, 14 px, 400, 8 px; v16.52.0 renders 28 px, 14 px, 400, 8 px (`R/data/*` and `t19` output above).
- Status pill: canvas is 22 px high, 12 px, weight 500, radius 4 px; 16.32.0 renders 20 px, 13 px, 400, radius 999; v16.52.0 renders 20 px, 12 px, 400, radius 9999, 1px border. Shapes and families match the canvas (ring, check, half, cross, dot, diamond).
- v16.52.0 shell: icon dock plus tree sidebar, `Add ToDo` in the page head, no module crumb on the list; accepted by ADR 0011 D, X3.
- Selected row in Light is `rgb(242,247,254)` against hover `rgb(241,244,248)` (1.03:1); the approved tokens, unchanged since round 3 (N7).
- Sidebar active item: ring `0 0 0 1px` plus 3px accent bar, label weight 400 (canvas `.side-item.active` as in round 3). Dock active tile gets the same.
- Toast: overlay surface, hairline, icon grey (finding 2); the canvas has no toast.
- Email wordmark is core's "Frappe" logo (finding 8).
- Login: Light only (finding 11); field icons are CSS masks on v16.52.0 and core SVGs on 16.32.0 (same size, same colour, 6.28:1).
- Design values: `git diff 11a3a36..07d18f1 -- design/` touches only `frappe.vars` and raw gray step 950 in `tokens.json`; the `midad` preset blocks, `design/canvas/midad.css` and `design/README.md` are unchanged. `_tokens.scss` gains four raw steps (`--ins-night-450`, `--ins-yellow-950`, `--ins-teal-950`, `--ins-purple-950`) and no existing `--ins-*` value changes. VERIFIED by running `python -m institutional_theme.audits.effective_diff --ref 11a3a36 --version 16.32.0`: "changed 0, removed 0, added 0 ... --ins-* values that existed before and changed: 0 ... Frappe 16.32.0 does not move".

## 3. What I checked, with values

**Audits (run by me at `07d18f1`).** `python -m institutional_theme.audits`: contrast 0 failing pairs in shipped presets (midad Light and Dark among them), avatars 216 measurements 0 failing, parity 55 checks 0 failed, colour vision 0 failures (99 baselined chart gaps), counterparts 30 pairs 0 findings, budgets 0 problems, dead tokens combined 0 dead in every version, `audits: passed`.

**State clarity.** v16.52.0 list, Light and Dark, en and ar: every `.es-badge` has a label, a border and a glyph; Open (red) draws a cross, Cancelled (gray) a ring, Closed (green) a check, Medium (amber) a half disc, all 9 px (`R/list-52-*.png`). Badge fill is a tinted pair, never the only carrier. In forced colours the glyph and border survive (finding 4). Disabled is dashed and flat on the login and flat grey on `.es-button` (finding 7). Destructive actions were not changed this round; the solid danger button measured 5.54 Light and 6.78 Dark on 16.32.0, the round-3 values.

**Contrast, v16.52.0 (VERIFIED, ratio text or glyph against composited background; Light / Dark).**
- Solid primary `.primary-action`: 8.27 / 10.23 normal, 11.58 / 12.97 hover; glyph 8.27 / 10.23 (stroke follows `currentColor`); focus ring against the page 5.61 / 10.43.
- Subtle `.es-button`: 11.94 / 12.00, hover 11.03 / 10.90.
- Disabled: 4.41 / 3.70 (finding 7).
- Badges: neutral 8.01 / 10.47, amber 9.32 / 10.58, green 8.73 / 10.39, red 9.54 / 10.71. Badge border against the page 1.67 to 1.87 Light, 2.22 to 2.53 Dark (not a required boundary: label and glyph carry the status).
- Toast text 13.17 / 12.00; rendered icon 8.84 / 8.28; close button 24 x 24, 8.84 / 8.28.
- Sidebar: active label 17.31 / 12.18; accent bar 4.35 / 6.74; plain item 8.38 / 10.14; hover 8.01 / 7.53.
- Dock: active glyph 13.17 / 10.90; plain 5.95 / 7.52; hover 8.01 / 7.53; accent bar 4.35 / 6.74; focus ring 5.32 / 11.06; tooltip 17.31 / 14.70.
- Menu (`.es-menu`) text 8.84 / 8.28, highlighted item 8.01 / 7.53 with a 2px inset ring.
- Pills active 14.49 / 10.58, inactive 5.69 / 5.58. Breadcrumb crumb 6.28 / 7.10, title 17.31 / 15.48, separator 4.87 / 5.54.
- Three pairs the audit does not declare, computed by me: hover row text 8.01 / 7.53 (sidebar hover item and list row hover), selected list row 8.21 (Light, `rgb(242,247,254)`) and 7.31 (Dark, `rgb(26,47,70)`), text on a tinted banner, the email warning note 8.64.
- Login (both versions, Light): button 8.27, link 7.42, labels 8.84, placeholder 4.87, input text 17.31, field icons 6.28, reveal button 6.28 (32 x 32, named "Show password" / "إظهار كلمة المرور"), input border `rgb(133,141,151)` on white 3.36; focus ring 2px.

**Contrast and states on 16.32.0 (no regression).** VERIFIED on `/desk/user`, ar, Light and Dark: list row hover `rgb(241,244,248)` / `rgb(37,44,55)`, selected `rgb(242,247,254)` / `rgb(26,47,70)`, status chip 8.73 / 10.39, primary 8.27 / 10.23, sidebar active 17.31 / 12.18 with its ring and bar, home breadcrumb 24 x 24 at x 1021 to 1045, danger button 5.54, 8.05, 5.54 (Light) and 6.78, 9.56, 6.78 (Dark). These agree with my round-3 report and `round3/fix-final/probe.json` and `danger-*.png`. `effective_diff` reports 0 changes at token level.

**Focus.** v16.52.0, keyboard-driven `:focus-visible`: one 2px ring (`rgb(47,106,167)` Light, `rgb(167,201,240)` Dark) on the primary button, view switcher, menu button, dock tile, "All apps", sidebar menu chevron, sidebar rows, group toggles, breadcrumb items, page-size pills, menu items, login fields, reveal button, forgot link, Continue and the secondary option. Offsets: +2 outside the page-head buttons, pills, chevron and login controls; -2 inside the dock, sidebar, menu panel and breadcrumbs (all inside clipping parents, checked against the parents' overflow boxes). Nothing is clipped on the rings I captured at 3x (`R/ring-sheet-52-en.png`, `R/form-crumb-focus-52-*.png`, `R/pillring-52-en.png`). Focus is not hidden behind the sticky head over 25 forward stops at 640 x 400, 320 x 256 and 390 x 844 (0 covered; list and form).

**Keyboard.** Tab and Shift+Tab verified on the Arabic list and on the login (email, password, reveal, forgot, Continue, email-link option; reverse is the mirror). Finding 10 is the order defect. No pointer-only control found except the filterable badge (finding 10).

**RTL.** Dock right of the sidebar, sidebar right of the page, primary action at the inline end (left), breadcrumbs parent-then-title from right to left, status glyph at the inline start of the badge, previous/next chevrons mirrored (`#icon-chevron-right` on `.prev-doc` at x 153, `#icon-chevron-left` on `.next-doc` at x 113), toast at the bottom left with the close mark on the left, field icons at the inline start. Letter-spacing: every Arabic-bearing element on desktop, list, form, report and workspace has `letter-spacing: normal` on v16.52.0 and on 16.32.0 (0 offenders in 5 screens each; English elements keep 0.28px, which is Latin). Logical properties: my grep of the added SCSS found only the email `border-left` (finding 8) and prose comments. Weights on Arabic text: 400, 500, 600 only.

**Font-weight mapping.** `--font-weight-regular/medium/semibold/bold` map to `--ins-weight-*` in `generated/_frappe_map.scss` and in `web/_base.scss`. On v16.52.0, every visible text-bearing element on desktop, list, form, workspace and report in English (and the Arabic-bearing ones in the Arabic scan) is in the Midad family at 400, 500 or 600; no 420, no `InterVariable`. The login computes button 500, labels 500, body 400. Exception: finding 12 on 16.32.0.

**Targets (WCAG 2.5.8).** Crumbs 34 x 28 and 64 x 29, pills 32 to 48 x 26, dock tile 34 x 34, toast close 24 x 24, primary 102 x 28, menu 28 x 28, login reveal 32 x 32, login button 40 high. Measured under 24 in the viewport at 640, 320 and 390 wide: `.drop-icon` 16 x 16, `.sidebar-toggle-btn` 20 x 20, row checkboxes 16 x 16 (core; the team's axe `target-size` run reports no theme-caused node, and the spacing exception probably applies to these), the status badge 20 high x 58 to 83 wide (same).

**Robustness.** Forced colours (finding 4). `reducedMotion: reduce` used throughout; the focus ring appears with a short delay (finding 10, cause not traced). 200% and 400% (stand-in viewports): no page overflow on list and form for either version; finding 3 for the v16.52.0 list row. Coarse pointer: finding 5. The axe results I read from the team's folder (`verify/v16.52.0/axe`): 0 nodes caused by the theme; of the 23 pixel-measured "FAILS" in `incomplete.json`, 21 are `<mark>` search highlights; I measured one live (Dark, Ctrl+K, "User"): `mark` is `rgb(0,0,0)` on `rgb(253,249,175)` = 19.35, so a false positive. I did not re-measure the two workspace-card filter labels at 1.83 (`.time-interval-filter`, `.timespan-filter`, en Light, also in core).

## 4. Scores, BRIEF section 10 (dimensions I own)

| Dimension | Round 3 | Round 4 | Evidence and what holds it |
|---|---|---|---|
| Accessibility | 4 | **3** | Finding 1 (login text covered, v16.52.0, first screen) is blocking. Holding it down besides: forced-colours selection (4), tab order (10), 400% list row on v16.52.0 (3), toast claim (2). Strong: ring on every stop, contrast table above all 3.7 or more, axe 0 theme-caused |
| RTL parity | 4 | **3** | Finding 1 is an RTL defect. Mirroring, bidi and letter-spacing are right everywhere else I looked; email rule (8) and English names (9) remain |
| Dark-mode parity | 4 | **4** | v16.52.0 and 16.32.0 desk measured in Dark (rows 7.31 to 12.18, ring 5.3 to 11.1, badges 10.4 to 10.7); held at 4 because login and email have no Dark and disabled is 3.70 |
| Density and productivity | 5 | **4** | v16.52.0 controls are 28 px (finding 5); 16.32.0 unchanged |
| Clarity and hierarchy | 4 | **4** | Status shape, label and colour verified on both versions; the selected pill is faint (6), toast type lost its colour (2) |
| Calm | 4 | **4** | No new motion, no new saturation |
| Consistency | 4 | **4** | Two versions differ in control height and pill size (section 2); one status language holds |
| Credibility | 4 | **3** | An Arabic login whose email is half under an icon (1), plus English names (9) and the Frappe wordmark in emails (8). Returns to 4 when finding 1 closes |

Scores below 4: Accessibility, RTL parity and Credibility, all driven by finding 1. I do not score upgrade-safety, performance, documentation or craft (outside this review).

## 5. Not tested

Screen readers (NVDA, JAWS, VoiceOver, TalkBack); real Windows High Contrast (emulated `forcedColors` only); real browser zoom and pinch zoom (stand-in viewports at 2x and 4x); real touch (emulated); compact density on v16.52.0; the Gantt rules (78 changed lines, `--g-*` variables, today marker, popup), the notification panel (`.sidebar-panel`), the settings dialog, the calendar "+n more" popover, workspace cards beyond axe's classification; HRMS 16.20.1 (not installed on either bench; the `frappe.vars` remaps `--ink-white`, `--ink-red-2` and others have 0 readers in 16.32.0 core and ERPNext CSS by my grep, but HRMS and custom apps were not read); the 99 baselined chart gaps; Arabic-Indic digits; real Arabic emails from core (only simulated); the English row editor and the dialog destructive buttons; the two workspace-card filter contrast nodes; Dark rendering of the toast in the 16.32.0 `.desk-alert`. Designed to meet WCAG 2.2 AA; formal audit recommended.

## 6. Evidence index (`docs/team/evidence/round4/review-a11y/`)

- Finding 1: `login-filled-52-ar.png`, `login-filled-ar-52-left-32-right.png`, `login-52-ar-light.png`, `login-forgot-52-ar-light.png`, `data/login-52-ar-light.json`, `scripts/login.mjs`, `scripts/login2.mjs`.
- Finding 2: `toast-52-*.png`, `data/t5-52-*.json`.
- Finding 3: `z400-52-en-list.png`, `z400-32-en-list.png`, `row-52-320.png`, `row400-52-*.png`, `data/t8-*.json`.
- Finding 4: `forced-52-en-list.png`, `forced-52-ar-list.png`, `forced-32-en-list.png`, `data/t6-*.json`.
- Findings 5, 6: `touch-5*.png`, `data/t8-*.json`, `data/t17-52-*.json`, `pillring-52-en.png`.
- Finding 8: `email-ar-simulated-rtl.png`.
- Focus: `ring-*.png`, `ring-sheet-52-en.png`, `form-crumb-focus-52-*.png`.
- General: `list-52-*.png` (Light and Dark, en and ar), `rowsel-52-*.png`, `data/r3-52-*.json` (all states), `data/t7-32-*.json` (16.32.0 regression), `scripts/` (every script, `<out>` stands for the output folder).

---

# Re-check after fix round

Designed to meet WCAG 2.2 AA; formal audit recommended. Same reviewer, independent of the author. Diff read: `git diff 0a07372..origin/build/midad-v1` (head `0bbceb6`; the SCSS changes are in `215edef`, `cb4a6ca`, `e792ad5`, `c47ec4d`; `8722f3e` and `0bbceb6` are audit tooling and evidence). Evidence folders read: `docs/team/evidence/round4/fix2/`, `fix2-login/`, `fix1/` (render and cascade JSON, not re-viewed one by one). The served bundles on both benches were rebuilt from this head: `ins_web.bundle.RLJNQ6XH.css` (ltr) and `C6LGHONZ` (rtl) contain the new `html[dir=rtl] ... .email-field input` rules (grep of the served CSS, both ports); `ins_desk.bundle.PSXFMMG7.css` (ltr) and `U3Z2TNCJ` (rtl).

Labels as before: VERIFIED = run by me on the live benches (`midad.test:8000` Frappe 16.32.0, `midad52.test:8001` Frappe v16.52.0, Chromium via Playwright, throw-away users `rev4rc*@example.com`, Light and Dark, en and ar); COMPUTED = from `getComputedStyle` composited down the ancestors plus the WCAG formula or from files. `R/` below is `docs/team/evidence/round4/review-a11y/recheck/` (scripts in `R/scripts/`, raw output in `R/*.json`).

Housekeeping. Four users per site created and deleted (HTTP 202 each, `left: []` on both sites). Administrator never written: both sites read `desk_theme = Light`, `language = en` after the run. The working tree held uncommitted edits to `_base.scss`, `_status.scss`, `_typography.scss`, `ins_print.bundle.scss`, `cascade.mjs`, `fixture_v52.html` and an untracked `round4/fix3/` that are not mine (another agent is working in this checkout); I stage only `R/` and this file. My numbers are measured on the served bundle built from the committed head, so I cannot say whether those uncommitted edits were in the bundle I measured; none of the values below involve the files they touch (print, status, base), but I did not verify that.

## A. State of each finding

| # | Finding | State | Measured |
|---|---|---|---|
| 1 | v16.52.0 Arabic login: email text under the icon (BLOCKING) | **Closed** | see A1 |
| 2 | Toast stroke is grey, not the status ink | **Closed** | see A2 |
| 3 | v16.52.0 list row badge cut at 400% | **Open** (core, untouched by the diff) | see A3 |
| 4 | Forced colours: current sidebar row, dock tile, pressed pill | **Closed**, two minor residuals | see A4 |
| 5 | v16.52.0 controls 28 px | **Partly closed** | see A5 |
| 6 | Pressed pill differs by 1.07:1 fill only | **Closed**, one minor residual | see A6 |
| 7 | Disabled `.es-button`, solid and subtle alike, 4.41 / 3.70 | **Closed** | see A7 |
| 8 | Emails: footer 4.17, physical left rule, no Arabic render | **Partly closed** | see A8 |
| 9 | Arabic session: English names, reversed sentence | **Mostly closed**, residual in new finding 15 | see A9 |
| 10 | Tab order starts in the list (core) | **Open**, unchanged | A10 |
| 11 | Login and portal Light only | **Open**, unchanged | A10 |
| 12 | Literal weight 420 on 16.32.0 | **Closed** | A11 |
| 13 | Minor notes (forgot-link rule, square chevron ring, compact density) | **Not re-checked** | not in the diff |

### A1. Finding 1, closed
Long address `very.long.mailbox.name.for.overflow.test@subdomain.department.example.com` (73 characters, scrollWidth 559 to 605 against a clientWidth of 340) and `jane.doe@example.com`, typed into `#login_email`, caret at the end and at the start, at 1366 and 360 px wide, en and ar, both versions (`R/scripts/login.mjs`, `R/login-data.json`, 32 readings). Computed content box of the input against the icon box:

| | page | input padding L / R | content box x | icon x | overlap |
|---|---|---|---|---|---|
| 16.32.0 | en | 38 / 38 | 551 to 815 | 524 to 540 | none |
| 16.32.0 | ar | 38 / 38 | 551 to 815 | 826 to 842 | none |
| v16.52.0 | en | 38 / 12 | 551 to 841 | 524 to 540 | none |
| v16.52.0 | ar | **12 / 38** (was 38 / 12) | 525 to 815 | 826 to 842 | none |

At 360 px: v16.52.0 ar content 53 to 281, icon 292 to 308, no overlap; the same on 16.32.0. The text is clipped at the content box, so a long address scrolls under the 38 px zone and not the icon (`R/login-52-ar-1366-long-end.png`, `R/login-52-ar-1366-long-start.png`, `R/login-52-ar-360-long-end.png`, `R/login-32-ar-1366-long-end.png`; the left-to-right English cases `R/login-52-en-1366-long-end.png` are clean). The other two email fields that are visible in the Arabic page, `#forgot_email` and `#login_with_email_link_email`, take the same padding (12 / 38 on v16.52.0, 38 / 38 on 16.32.0, no overlap; `R/scripts/login_forms.mjs`). The sign-up form shows no `.email-field` on either bench. The gap between the last character and the icon is 11 px on v16.52.0 and 11 px on 16.32.0.
Observation on policy: the fix uses physical `padding-left` and `padding-right` in an `html[dir=rtl]` chain (`_login.scss:461-474`) and the comment explains why (the input is forced `direction: ltr`, the icon follows the field's direction). CLAUDE.md says logical properties only; this is a justified, documented exception and I list it as one. The same applies to the email bundle's physical borders (A8).

### A2. Finding 2, closed
`.es-toast[data-type] > svg { --icon-stroke: currentColor }` (`_overlays.scss`). VERIFIED on v16.52.0, 4 types, Light and Dark, en and ar: `stroke` equals `color` in all 32 readings (`R/desk-52-*.json`, `toasts[]`). Ratios of the drawn stroke against the toast fill: Light 4.79 (success), 5.54 (error), 3.79 (warning), 4.87 (info); Dark 6.89, 6.15, 8.28, 6.75. Same numbers as the team's P0 table, now actually drawn. Screenshot `R/toast-52-ar-light.png` (red ring cross at the inline start, close mark at the end). The 3.79 of the warning ink is above the 3:1 non-text floor and the glyph shape also carries the type.

### A3. Finding 3, open
`.result-container` on v16.52.0 at 320 CSS px and 4x: `overflow-x: hidden`, `scrollWidth 356` against `clientWidth 278` (en), `350` against `278` (ar); on 16.32.0 `overflow: auto`, `277 = 277` (`R/scripts/z400.mjs`, `R/z400-52-en-list.png`). Same as before (359 against 278). Page-level overflow remains zero (`scrollWidth = innerWidth`, 320 and 640, list and form, both versions, `R/t8-*.json`). New observation that widens it: at 900 px with the sidebar open and a **fine** pointer, v16.52.0 already clips the Priority badge under the sticky right group (badge x 702 to 769, group starts at x 726; `R/scripts/w900.mjs`; the `isMobile` capture `R/heights-coarse-52-en-dark.png` shows the same, with "Canc..." and half of the Priority chip), so it is a width matter of core's row layout and not a result of the new control heights. NON-BLOCKING, as before.

### A4. Finding 4, closed (two minor residuals)
Forced colours emulated (`forcedColors: active`, `R/scripts/forced.mjs`, `R/forced-52-*.json`, `R/forced-32-*.json`). The computed values below are for the row, tile or pill and its plain neighbour:

| | current | plain |
|---|---|---|
| Sidebar row, 16.32.0 and v16.52.0, en, ar, Light, Dark | `outline: solid 1px CanvasText` (rgb(0,0,0) Light, rgb(255,255,255) Dark) at offset -1px, plus a 3 x 16 px `::before` in `Highlight` (`forced-color-adjust: none`) | no outline, no bar |
| Dock tile, v16.52.0 | same outline, bar 3 x 22 px | none |
| Page-size pill, v16.52.0 | `border: solid 1px CanvasText`, weight 500 | no border, weight 400 |

When the row's anchor has keyboard focus the row outline is `none` and the anchor draws its own 2px ring (offset -2px), so the focus ring stays alone (`sbActiveFocused`, `sbAnchorFocused`). Screenshots: `R/forced-page-52-en-light.png` (the "ToDo" row boxed with its bar, the first dock tile boxed with its bar, the "20" pill boxed and bold), `R/forced-sidebar-52-ar-dark.png`, `R/forced-dock-52-en-light.png`, `R/forced-pills-52-ar-dark.png`. The bar's computed colour is `rgba(5,0,73,0.8)` in Chromium's emulation (it is `Highlight` resolved), visible against Canvas in the screenshots.
Residuals, both minor: (a) the pressed pill's forced-colours border adds 2 px to its width (34 against 32 px; the row of pills shifts by 2 px when the selection moves in that mode); (b) no `aria-current` on the sidebar item (the only `aria-current` nodes are the dock tile and the breadcrumb, as before): the current row is now visible in forced colours but is still not exposed to assistive technology.

### A5. Finding 5, partly closed
Heights read from `getBoundingClientRect` on the live benches (`R/scripts/desk.mjs`, `R/desk-52-*.json`, identical in en, ar, Light and Dark):

| v16.52.0 | comfortable | compact (`data-ins-density`) | coarse pointer (`isMobile`, `hasTouch`, `(pointer: coarse)` true) |
|---|---|---|---|
| `.primary-action` | 32 (was 28) | 28 | 44 (was 28) |
| icon button `.menu-more-button` | 32 x 32 | 28 x 28 | 44 x 44 (was 28) |
| view switcher / page-head buttons | 32 | 28 | 44 |
| `.es-pill` | 28 high (was 26) | **26** | 44 high, **32 wide** |
| text input | 32 | 28 | 44 |
| `.dock-item` | 34 x 34 | 34 x 34 | **34 x 34** |
| breadcrumb crumbs (form) | 34 x 28, 89 x 35 | not measured | **34 x 28** |

With compact density and a coarse pointer the buttons stay 44 (`coarseCompact` in the JSON). 16.32.0 buttons stay 32 and 44 on touch (`R/t8-32-en.json`: primary 60 x 32, 60 x 44 on touch), identical to the round-3 and round-4 numbers. The fix reaches what the team named (`.es-button`, `.es-pill`). What it leaves: the dock tile and the crumbs do not take the coarse step (34 x 34 and 34 x 28 at `(pointer: coarse)`), the compact pill is 26 (its content, above the 24 minimum), and a coarse pill is 32 wide. All are above the 24 x 24 of WCAG 2.5.8; BRIEF section 8 asks 44 for coarse pointers. Status badges are 20 high (unchanged). NON-BLOCKING.

### A6. Finding 6, closed (the engineer's 2.81 / 2.69, verified, judged)
Measured on the live pressed pill (`R/desk-52-*.json`, `pills`): ring `box-shadow: inset 0 0 0 1px` in `--ins-border-control` (rgb(133,141,151) Light, rgb(111,119,129) Dark), weight 500 (inactive 400), text 14.49 (Light) and 10.58 (Dark) against 5.69 and 5.58 for the others.

| | Light | Dark |
|---|---|---|
| ring against the pill's own fill (inside) | **2.81** | **2.69** |
| ring against the inactive fill and the tab container (outside) | **3.04** | **3.10** |
| fill, pressed against inactive | 1.08 | 1.15 |

The engineer's figures are correct for the inside edge. Judgement: the state is no longer carried by a faint fill; it has three non-colour-fill cues (a drawn boundary, a heavier weight, a different text tone) and the boundary meets 3:1 against the colour outside it (3.04 / 3.10), which is the contrast WCAG 1.4.11 asks of a boundary that is read against its background. A strict reading that also counts the inside colour is below 3:1 by 0.19 (Light) and 0.31 (Dark). I treat that as a minor residual, not a defect of the state: the cue the sighted user needs, the outline, is there and passes on its outer side, and a second cue (weight) is independent of colour. If the team wants the strict reading closed, the ring needs the `--ins-border-strong` step. Screenshots `R/pills-52-en-light.png`, `R/pills-52-ar-dark.png` (note the pill order and the selected pill at the inline start in Arabic: "20" is at the right edge in `ar`).

### A7. Finding 7, closed (judged against the round-3 disabled policy)
Policy read: BRIEF section 8 ("Disabled elements stay distinguishable and legible") and ADR 0010 ("Disabled text stays legible: ... `text-placeholder` on `--disabled-control-bg`, `--input-disabled-bg` (3.70; inactive controls are exempt)"). So the approved floor for disabled text is 3:1 with the 3.70 pair named, and the text pair itself was not changed. Measured on a disabled clone of the real `.primary-action` and `.menu-more-button` (injected, so not a natural state; `R/desk-52-*.json`, `disabled`):

| | text | border | border against own fill | border against the page |
|---|---|---|---|---|
| solid, Light | 4.41 | dashed 2px `rgb(133,141,151)` | 3.04 | 3.36 |
| subtle, Light | 4.41 | dashed 1px, same colour | 3.04 | 3.36 |
| solid, Dark | 3.70 | dashed 2px `rgb(111,119,129)` | 3.70 | 3.94 |
| subtle, Dark | 3.70 | dashed 1px | 3.70 | 3.94 |

Height is unchanged by the border (32). `cursor: not-allowed`. Text at 4.41 and 3.70 meets the approved policy; what was missing in round 4 was a non-colour cue that tells disabled from enabled and solid from subtle, and the dashed boundary now supplies it (it survives forced colours and greyscale, and is the same recipe as the disabled form control). Solid and subtle differ by the dash width (2 against 1 px) and, in practice, by the icon-only or label shape; that is a thin difference but adequate for a state that is exempt from contrast rules. `R/disabled-52-en-light.png`, `R/disabled-52-en-dark.png`.

### A8. Finding 8, partly closed
- Closed: the Arabic render exists (`docs/team/evidence/round4/fix2-login/*-ar.png`, which I read for 32 and 52, password reset and verification code) and the warning note shows the 4 px rule on both edges; measured left and right 4 px in every file (`email-measurements.txt`: `{"l":"4px","r":"4px"}` for 7 of 8, `null` for the two 16.32.0 verification-code files, which have no note). A rule on both edges is a defensible compromise for clients that ignore logical properties and `dir`; it is a deviation from the canvas's single start rule (listed in section C below).
- Open: the footer text of both versions is core's inline `color:#7c7c7c !important`: 4.17:1 on white and **3.96:1** on the page tint `#f7f9fc` where the 16.32.0 and v16.52.0 renders place it (COMPUTED). An inline `!important` cannot be out-ranked from a stylesheet, so the theme cannot fix it without core edits; it needs a decision record or an accepted-risk entry. The wordmark in the card is still core's "Frappe" logo.
- New (finding 14).

### A9. Finding 9, mostly closed
Arabic session on both benches, tab-order and `aria-label` dump (`R/scripts/strings.mjs`, `R/strings-52-ar.json`, `R/strings-32-ar.json`):
- `NAV` Breadcrumb: "مسار التصفح" (v16.52.0). Sidebar header button: "قائمة الشريط الجانبي". Dock link: "كل التطبيقات". Form sidebar: "آخر تعديل بواسطة Administrator" next to "تم إنشاؤه بواسطة Administrator" (`R/strings-form-52-ar.png`); the dictionary also returns "آخر تعديل بواسطتك" for the "You" string. Row editor "Collapse": "طي" on v16.52.0 and "طيّ" on 16.32.0 (the context string; a diacritic difference only). Sidebar chevrons: "طيّ Desk", "توسيع التخصيص" (the group name "Desk" is data). `__("Add attachment")` returns "إضافة مرفق". English session unchanged: "Breadcrumb", "Sidebar Menu", "All apps", "Last Edited By Administrator".
- Residual, new finding 15.

### A10. Findings 10 and 11, unchanged
Not in the diff. Tab order re-run on the v16.52.0 Arabic list: the first three stops are the three data rows (x 548), then "كل التطبيقات" (x 1338), then the dock tiles; every stop has a 2px ring (`R/scripts/t12.mjs`). `/login` with `colorScheme: dark` on both versions still computes `color-scheme: light` and body `rgb(247,249,252)` (`R/scripts/logindark.mjs`, `R/login-dark-52.png`). Open, same severity.

### A11. Finding 12, closed
16.32.0 weights on `/desk/user` (ar, Light and Dark), whole-page count by `fontWeight`: `420` went from 2 to absent and `400` from 134 to 136 (`R/t7-32-ar-light.json` and `-dark.json` against `data/t7-32-ar-*.json`). The form "Discard" button and the keyboard-shortcut chip now compute 400.

## B. What the fixes broke on 16.32.0 and v16.52.0 (compared with the values I measured before)

- 16.32.0, `/desk/user`, ar, Light and Dark: 74 recorded values (list row normal, hover, selected, status chip, sidebar active label, bar and ring, home breadcrumb 24 x 24, primary, danger button normal, hover, focus). **2 differ, both the 420 to 400 weight count; 0 contrast, size or colour changes** (`R/t7-32-ar-*.json` against `data/t7-32-ar-*.json`). The danger and primary figures are the round-3 values: 8.27 / 5.54 / 8.05 / 5.54 Light.
- 16.32.0 sizes (`R/t8-32-en.json`): primary 60 x 32 and 60 x 44 on touch, menu 32 and 44, no overflow at 320 and 640. The sidebar's forced-colours row is new on 16.32.0 by design (the diff comment says so).
- v16.52.0 full state sweep (`R/scripts/t3.mjs`, 354 values per configuration, en and ar, Light and Dark, against my round-4 `data/r3-52-*.json`): **7 values differ per configuration, all intended** (disabled solid and subtle borders, pressed pill weight 400 to 500, four pill heights 26 to 28). Every contrast ratio (buttons, badges, rows, hover, selected, sidebar, dock, menu, toast, login) is identical.
- No page overflow at 200% and 400% stand-ins on either version (list and form); focus not covered by the sticky head in the tab dumps except one item (next).
- **Observation, not confirmed:** in the keyboard cover scan (`R/t8-*.json`), `INPUT.input-with-feedback` reads "covered by datepicker--content" in two of the six form runs (16.32.0 en at 200%, v16.52.0 ar at 400%) and not in the other four, nor in my round-4 runs. The covering node is the date picker popup, not the sticky head. I did not trace it.
- The fix widens targets and does not shift the page head: Light and Dark compact and coarse screenshots show the head, filters and list in place (`R/heights-compact-52-ar-light.png`, `R/heights-coarse-52-en-dark.png`; the clipping in the second one is finding 3 at 900 px).

## C. New findings

**14. NON-BLOCKING. Arabic plural form of the new email strings.** `ar.csv` maps "The link expires in {0} minutes." to "تنتهي صلاحية الرابط خلال {0} دقائق." and "It expires in {0} minutes." likewise. "دقائق" is the plural for 3 to 10; for 2 Arabic needs "دقيقتين" and for 11 and above the singular "دقيقة". The team's own render shows "20 دقائق" (`fix2-login/52-email-password_reset-ar.png`), which a reader will see as an error; "5 دقائق" in the code email is correct. Options: a number-neutral phrase such as "مدة الصلاحية: {0} د" or "خلال {0} (دقيقة)", or a minute-count branch. Also noted, core's own strings and not in this diff: the title "اعد ضبط كلمه السر" is spelled without the hamza and with a final ه, and differs from the button "إعادة تعيين كلمة المرور" in the same email. In Arabic the salutation reads "العزيز Administrator," with a Latin comma (core).

**15. NON-BLOCKING. Two more untranslated core strings in a v16.52.0 Arabic session.** `BUTTON` "Collapse sidebar" (core `sidebar.js:767`, `__("Collapse sidebar")`, with "Expand sidebar") and the notifications `DIV` "Notification categories" (`notifications.js:169`) are English in an Arabic session; neither is in core's `ar.po` or the theme's `ar.csv` (grep). Same class as the four the team closed. Dock tile names (Build, Users, Email, ...) are Desktop Icon data and unchanged.

No new BLOCKING finding.

Deviations to list for fidelity (listed, not judged): the email warning note and quote carry a rule on both edges where the canvas draws one at the start; the pressed pill carries an inset ring and weight 500 where the canvas has a fill only; the disabled `.es-button` carries a dashed 1px or 2px boundary (the canvas has no disabled button); the forced-colours current row, tile and pill carry system-colour outlines (no canvas counterpart).

## D. Scores, BRIEF section 10 (dimensions I own)

| Dimension | Round 3 | Round 4 | After fix round | Evidence and what holds it |
|---|---|---|---|---|
| Accessibility | 4 | 3 | **4** | Blocking login overlap gone (A1, 32 cases, 11 px gap); forced-colours current state, toast ink, pressed pill boundary, disabled cue verified (A2, A4, A6, A7). Held at 4: tab order starts in the list (10), v16.52.0 list badge at 400% (3), no `aria-current` on the sidebar item, dock and crumbs below 44 at coarse (A5) |
| RTL parity | 4 | 3 | **4** | Arabic and English long address clear of the icon on both versions at 1366 and 360 px, three email fields; Arabic emails rendered; strings translated. Held at 4: physical borders and paddings as documented exceptions, "20 دقائق" (14), two English core strings (15) |
| Dark-mode parity | 4 | 4 | **4** | Toast, pill, disabled, forced-colours Dark values measured above (6.15 to 8.28, 3.10, 3.70); login and email still Light only (11) |
| Density and productivity | 5 | 4 | **4** | Buttons back to 32, 28 compact, 44 coarse on v16.52.0 (A5); the dock tile, crumbs, compact pill (26) and 32-wide coarse pill still short of the scale. Not back to 5 |
| Clarity and hierarchy | 4 | 4 | **4** | Pressed pill now has boundary plus weight; toast type colour drawn; disabled dashed. Residual: strict inside-edge ratio 2.81 / 2.69 (A6) |
| Calm | 4 | 4 | **4** | No new motion or saturation; the fixes add outlines in forced colours only and a hairline ring |
| Consistency | 4 | 4 | **4** | Two versions now agree on button heights (32 / 28 / 44); one status language |
| Credibility | 4 | 3 | **4** | First screen of the Arabic product is clean on both versions; Arabic for the breadcrumb, sidebar menu, All apps and Last Edited By is real. Held at 4: Frappe wordmark and 3.96 footer in emails (8), "20 دقائق" (14) |

No dimension I own is below 4. I do not score upgrade-safety, performance, documentation or craft.

## E. Not tested in the re-check

Screen readers; real Windows High Contrast (emulated `forcedColors` only, so the system colours are Chromium's); real zoom and pinch zoom (stand-in viewports); real touch (emulated `hasTouch`, `isMobile`); compact density on 16.32.0; the 16.32.0 toast (`.desk-alert`) in Dark; the natural disabled state of the buttons (clones were injected); Arabic emails as sent by core (I read the team's renders, I did not send mail); the login disabled button; HRMS; the print and status files modified in the working tree by someone else (see Housekeeping); the Gantt, notification panel and settings dialog (as in the first pass); finding 13 items; whether the two date-picker "covered" readings (section B) are reproducible.

## F. Evidence index (`docs/team/evidence/round4/review-a11y/recheck/`)

- Finding 1: `login-{32,52}-{en,ar}-{1366,360}-{short,long}-{end,start}.png` (selected), `login-data.json`, `login-forms-*.png`, `scripts/login.mjs`, `scripts/login_forms.mjs`.
- Findings 2, 5, 6, 7: `desk-52-{en,ar}-{light,dark}.json`, `toast-52-*.png`, `pills-52-*.png`, `disabled-52-*.png`, `heights-compact-*.png`, `heights-coarse-*.png`, `scripts/desk.mjs`, `scripts/crumbs.mjs`.
- Finding 3: `z400-*.png`, `w900-*.png`, `scripts/z400.mjs`, `scripts/w900.mjs`, `t8-*.json`, `zt-*.png`.
- Finding 4: `forced-*.json`, `forced-page-*.png`, `forced-sidebar-*.png`, `forced-dock-*.png`, `forced-pills-*.png`, `scripts/forced.mjs`.
- Finding 9: `strings-*.json`, `strings-form-*.png`, `strings-grid-*.png`, `scripts/strings.mjs`.
- Regression: `t3-52-*.json` (against `../data/r3-52-*.json`), `t7-32-ar-*.json` (against `../data/t7-32-ar-*.json`), `scripts/t3.mjs`, `scripts/t7.mjs`, `reg-list-*.png`.
