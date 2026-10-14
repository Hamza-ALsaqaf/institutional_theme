# Accessibility, RTL and fidelity review, round 3

Designed to meet WCAG 2.2 AA; formal audit recommended. Reviewer: independent, did not write the code. Diff `origin/main...HEAD`, files named in the task, and the round-3 evidence folders.

Labels: VERIFIED = I ran it on the live bench `midad.test` (Playwright, users `rev3-ar`, `rev3-en`, `rev3-ar-dark`, scripts in `/tmp/rev3/`, not committed). COMPUTED = I derived it from files. NOT RUN = stated in section 6. The `rev3-*` users and the five ToDo records I created were deleted afterwards (HTTP 202 each). Running `python -m institutional_theme.audits` rewrote `docs/audits/budgets.txt`; I restored it with `git checkout`, so the only file I commit is this one.

## 1. Blocking

None found against WCAG 2.2 AA on the screens I could reach. Nothing in the round-3 diff makes a screen worse than before; the problems below are either things the round claims to have fixed that are incomplete, or core markup the round left untouched.

## 2. Should-fix

**S1. Child-table row editor: every control is unnamed, and the axe scan never opened it.**
Where: `institutional_theme/public/js/shell/grid_names.js` (names only the row checkbox), `a11y_rules.js:215` (`.modal .frappe-control` only), `field_labels.js` is not applied to `.form-in-grid`. What a user hears: opening a row of the Notification "Recipients" table (Arabic, `/desk/notification/new`, add row, click the row number) gives two `combobox` and `textbox` controls with no name, two Ace editor textareas with no name, and the first icon button of the row editor with no name. Observed: Playwright `ariaSnapshot` of `.form-in-grid` printed `- combobox` and `- button` with no quoted name; DOM check printed `lbl=` empty and `forLabel=false` for `SELECT[data-fieldname=receiver_by_document_field]`, `INPUT[data-fieldname=receiver_by_role]`, `INPUT[data-fieldname=condition]`. Why the evidence missed it: the axe screen `form-child-table` (`tests/browser/axe.mjs:65-72`) adds a row but never opens the row editor, so "label 260 to 0" does not cover it. WCAG 1.3.1 and 4.1.2. Fix: run the existing `labelWrapper` rule for `.form-in-grid .frappe-control` (same markup as dialog controls), name `.grid-collapse-row` from `__("Collapse")`, and add an axe screen that opens the row editor.

**S2. No bypass mechanism, no `main` landmark, no `h1`; axe flagged `bypass` as "incomplete" in every run and nobody reviewed it.**
`run-themed-*.json` `incomplete` shows `bypass` 7 to 8 nodes per run. Observed on `/desk/todo` (English): no skip link, no `main` or `role=main`, `h1` count 0, landmarks are `HEADER, HEADER, NAV` only. WCAG 2.4.1 (landmark regions are the sufficient technique). The shell script already writes attributes on core markup, so `role="main"` on the page's main section (and an `aria-label` on the sidebar `nav`) is the same class of change. Core cause, unfixed by the theme.

**S3. Form tabs: `role="presentation"` on the `li` satisfies axe, but the tab widget still does not expose which tab is selected.**
Observed on the User form (Arabic): `#form-tabs` buttons have `role="tab"`, `aria-selected` is absent on all six, no `tabindex`, and ArrowLeft/ArrowRight do not move focus (they stay on the first tab; Tab moves through the six buttons in DOM order). The AX snapshot (`a11y-attrs/ar-form-tabs.aria.yml`) lists `tab "..."` with no `[selected]`. The presentation role itself causes no keyboard side effect (Tab order and focus are the same as without it; I did not run it with the theme blocked, so "same as before" is inferred from the DOM). WCAG 4.1.2 (value). Fix: write `aria-selected` from `.active` in the same rule and observe `class` on `.nav-link`; arrow-key support is a larger change and can stay documented.

**S4. Names copied from tooltips are English in the Arabic UI, and one datatable name is hard-coded English by the library.**
Observed in Arabic: `aria-label="Previous Document"`, `"Next Document"` (form, `form/toolbar.js` tooltips, no entry in `frappe/locale/ar.po`), `"Clear all filters"` (list, report, calendar), and every report-view column filter is `"Filter based on <column>"` (`frappe-datatable/src/rowmanager.js:360` has no `__()`; `a11y_rules.js:177-180` keeps core's `title`). A screen-reader user in Arabic hears English phrases mixed with Arabic column names. The round-3 README says the Arabic names are checked; these four were not. Fix: add `ar.csv` rows for the three core strings; for the datatable filters write an `aria-label` from `__("Filter based on {0}")` (aria-label outranks `title`). Related terminology, note-level: core's `Assign` is "عين" (reads as the word for "eye" without vowels); `a11y-attrs/README.md` already says a context row may be added, none was.

**S5. Folder thumbnails on the desktop: the focus ring is clipped, and the 24px change gives pointer-unreachable tab stops.**
`public/scss/desk/_desktop.scss:3-10`. Observed (Arabic, Light, 4x screenshot `/tmp/rev3/thumb-focus.png`): the focused thumbnail has `outline: solid 2px rgb(47,106,167)`, `outline-offset: 2px`, and a computed box of 24x24 (VERIFIED), but only an arc on one side is visible; the rest is cut by the folder's overflow. There are 9 consecutive tab stops per folder tile, each with `pointer-events: none` (the round's own caveat). The brief requires a ring that is never clipped (BRIEF section 8). The 24px box is a pointer-size fix for elements a pointer cannot hit, so it satisfies axe `target-size` without helping anyone; the criterion's purpose is served only by the ring and by core making the thumbnails non-interactive. Fix: `outline-offset: -2px` on `.folder-icon .icons > .desktop-icon:focus-visible`, and state in the manifest that `target-size` is met for the checker only.

**S6. The axe classification "0 caused by theme" is true as defined, but the definition is narrower than the sentence, and part of the evidence was not reviewed.**
Method read in `tests/browser/axe.mjs:255-275` (`summarize`): a themed node is "core" if the same rule fires on the same screen, language, mode and a selector (data-name, data-timestamp, title and href values stripped) in the run with `/assets/institutional_theme/**` aborted; "theme" otherwise. I recomputed: all 312 rows in `axe-rescan/classified.json` are `core`. Limits:
- Only `violations` are classified. `incomplete` is saved as counts and never reviewed: `color-contrast` 23 to 31 nodes per run, `target-size` 10, `aria-prohibited-attr` 11, `bypass` 7 to 8. Zero violations plus 25 unreviewed contrast nodes is not zero contrast problems. I computed some of them myself (section 4); they passed, but the sample is mine, not the team's.
- A node that fails on the same selector with and without the theme is "core" even if the theme changed the cause; only `color-contrast` has a "worse than core" test (0 found).
- The `core` runs were copied from wave 1, not re-run (README says so, and the argument holds for unchanged core markup, not for anything the theme's JS adds, which is blocked in the core variant).
- `pageErrors` holds six `"undefined"` entries in every run, themed and core; not classified or explained.
- Coverage is one role (System Manager), one viewport (1280x800), 23 screens. Not scanned: any ERPNext or HRMS document form, the grid row editor (S1), the page-head Actions menu open, tooltips, popovers other than filters, print preview, Kanban, calendar, Gantt, the setup wizard, the idle banner, the ribbon, focus-state screens, 320 px width.
- The README row "meta-viewport: needs a core edit; no hook adds or removes it" is not accurate. The shell script writes attributes on core markup in 15 rules; setting `content` on `meta[name=viewport]` is the same technique, and `user-scalable=no` with `maximum-scale=1.0` (observed: `width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, minimal-ui`) fails WCAG 1.4.4 on touch devices. 48 nodes, "serious" in axe terms, left as core. Either fix it or record it as a deliberate decision with the reason.

## 3. Notes

- N1. List row labels (`a11y_rules.js:145-152`). Verified in Arabic and English on ToDo: an empty title gives "حدد b46ad69ski" (the hash name; acceptable, the sighted user also sees an empty subject); two rows with the same title are distinguished by the name in brackets; a 330-character title is read in full plus the hash (`Select <330 chars> (b44ud50fgo)`). The bracketed name is noise for hash-named doctypes (ToDo, Event). Suggest: truncate the title at about 80 characters and add the name only when two titles in the list collide.
- N2. Section toggles use a changing name ("طيّ X" / "توسيع X") instead of a fixed name plus `aria-expanded`. Works (VERIFIED labels "طيّ الصلاحيات", "طيّ عمليات التدقيق" on the User form), but a screen reader cannot query the state. Note-level.
- N3. Two different buttons are both named "الخيارات"/"Menu" on one page (sidebar header chevron and the form menu button); region context is the only difference.
- N4. `decorateLogo` and `decorateOnboardingIcon` decide `alt=""` once, when the title text is non-empty. The observer does not watch `characterData`, so an image inserted before its title text is filled keeps no `alt`. Not reproduced; reasoned from `a11y_names.js`.
- N5. Grids inside dialogs are not covered by `grid_names.js` (its own README says so).
- N6. Arabic register is mixed. Core: "حدد {0}", "حدد الكل", "أغلق" (imperative). This round: "تحديد الصف {0}", "تحديد جميع الصفوف", "تصغير" (verbal noun). Both are valid Arabic; the same screen can read "حدد X" on list rows and "تحديد الصف 3" in report view. Pick one. New Arabic strings are otherwise correct and natural: "طيّ {0}", "توسيع {0}", "نوع المطابقة", "لصق في الجدول", "العودة إلى الأعلى", "الشرط", "تصفية". The context rows (`Condition,الشرط,Filter` and `Filter,تصفية,Column filter`) are correct: I read `frappe/translate.py:190-211` and `public/js/frappe/translate.js:5-20`; the lookup is `source:context` then the bare source, so core's "الحالة" for `Condition` (it means "status") is not overridden elsewhere. The accessibility tree shows "الشرط" and "تصفية" (`a11y-attrs/ar-filter-popover.aria.yml`, `ar-report-view.aria.yml`).
- N7. Selected and hovered row are not distinguishable in Light (computed backgrounds `rgb(242,247,254)` selected and `rgb(241,244,248)` hover; the checkbox carries the state). Dark differs (`rgb(26,47,70)` vs `rgb(37,44,55)`).
- N8. `docs/team/evidence/round3/hrms-screens/shots/leave-list-ar-dark-comfortable.png` shows a bright pink sidebar avatar with white "H", the pre-fix pair. The live page now renders the tinted pair. The HRMS screenshots predate the avatar commit; re-take them or date them.
- N9. `docs/audits/budgets.txt` (committed) says `ins_shell.bundle.js` 18.3 KB; the live build measures 18.8 KB and `a11y-attrs/README.md` says 19.3 KB. Three values for one file; budget still passes (24 KB).
- N10. `html:root[dir] .text-primary { color: var(--ins-text-strong) !important }` (`_hardcoded.scss:75`) turns every Bootstrap `.text-primary` into near-black strong text. Contrast is fine; the hue meaning is gone. The `!important` count and reasons are in the manifest (section 4, 14 declarations, I read the lines, I did not recount).
- N11. Timeline links now carry a permanent underline (`_form.scss`, `text-underline-offset: 2px`). The approved canvas uses underline on hover for links; the brief requires links to be distinguishable without colour, so this is a documented, brief-driven deviation. Viewed `axe-fixes-css/shots/timeline-ar-light.png`: the link "Administrator" is underlined and readable; its position inside the Arabic sentence is core's string order.

## 4. What I checked, with values

**State clarity.** Avatar, banner, hover and selected states are colour plus content; the avatar is not a status. No new state is carried by colour alone in this diff.

**Contrast, computed live (Arabic, `getComputedStyle`, alpha composited down the ancestors, WCAG formula):**

| Pair | Light | Dark |
|---|---|---|
| Hover row, subject text | 11.94 on `rgb(241,244,248)` | 10.90 on `rgb(37,44,55)` |
| Hover row, muted cell text | 8.01 | 7.53 |
| Selected row, subject text | 12.23 on `rgb(242,247,254)` | 10.59 on `rgb(26,47,70)` |
| Selected row, muted cell text | 8.21 | 7.31 |
| Orange intro banner text | 10.24 on `rgb(255,244,239)` | 12.16 on `rgb(52,19,0)` |
| Timeline link on card | 7.42 (`rgb(0,88,149)` on white) | 10.45 |
| Avatar dark-green (Light) | 8.84 (`rgb(0,73,69)` on `rgb(221,242,239)`) | |
| Avatar pink (Dark) | | 10.65 (`rgb(253,205,224)` on `rgb(70,21,46)`) |
| Placeholder | `rgb(106,114,125)` on white, about 4.9 (computed by hand) | `rgb(137,144,153)` on `rgb(11,17,25)`, about 5.9 |

These agree with the team's `avatar-pairs-after.md` (8.84 and 10.65 match to two decimals). `python -m institutional_theme.audits` printed `contrast: 0 failing pair(s) in shipped presets`, `avatars: 216 pair measurements, 0 failing`, `parity: 55 checks, 0 failed`, `audits: passed`. Only the pairs in the table were recomputed by me; the datepicker, highlight.js and onboarding badge claims (5.95 to 14.2, 8.06 and 10.22) I did not recompute.

**Avatar fidelity.** The approved canvas (`design/canvas/midad.css:233`) draws one neutral avatar (`surface-active`, `text-strong`, 11px) and `tokens.json:490-492` gives one frame pair. Core renders nine per-colour pairs inline, so the theme must map them. Round 3 maps them to the status pairs (`_avatar.scss`). I rendered the nine in Light and Dark next to the Pending, Rejected and Approved chips (`/tmp/rev3/avatars-light.png`, `avatars-dark.png`): the avatars are quiet tinted discs with dark text (Light) or deep tint with pale text (Dark), consistent with the chips and with Midad's calm, not saturated. Deviations to list: (a) avatars are tinted, not neutral as in the canvas; (b) the red avatar is the same colour as the "Rejected" chip, and the green avatar the same as "Approved", so a user's colour can read as a status next to a status chip; (c) core's `green` and `dark-green` now differ (teal), where before they were identical. Not judged; an owner decision if (b) matters.

**Focus.** Ring on the folder thumbnail is clipped (S5). Ring on `#form-tabs` and list controls not re-tested this round.

**Keyboard.** Tab order on the form tabs follows reading order (DOM order, six stops); arrow keys do nothing (S3). Folder tiles: 9 consecutive tab stops (S5). Not tested in reverse (Shift+Tab) beyond reasoning that DOM order is symmetric.

**RTL.** All new SCSS uses logical properties (`min-block-size`, `min-inline-size`, `margin-block: 0 -6px`, `margin-inline: -3px`, `border-block-end`, `justify-content: flex-start`); I grepped `_avatar`, `_core_contrast`, `_desktop`, `_shell` for `left`, `right`, `margin-left`, `padding-left`: no match. The folder thumbnails' margins are symmetric, so RTL needs no mirror. In `a11y_rules.js` the labels are strings, no direction logic. Bidi in labels: "حدد rev3 dup (b45gpcjoct)" (Arabic verb, Latin title, parenthesised code) is a name, not rendered text; Chromium's AX tree shows it unchanged.

**Robustness.** Forced colours: the new rules set colours only, so forced colours replaces them; not run. `prefers-reduced-motion`: the axe runs used `reducedMotion: "reduce"` (read from `axe.mjs:162`); no new motion in the diff. Coarse pointer: `generated/_scale.scss:71-79` has a `(pointer: coarse)` block (44px) that round 2 said did not exist; I read it, I did not emulate touch. Zoom 200% and 400%: not run.

**Names, wrong or stale.** Grid row labels follow add and delete (Arabic, Notification table: 3 rows "تحديد الصف 1..3", delete row 2, remaining "تحديد الصف 1", "تحديد الصف 2", header "تحديد جميع الصفوف"). Tooltip-copied names enumerated across 11 Arabic routes: the only non-Arabic ones are in S4. `alt=""` on logos: the sidebar header image has `alt=""` and the adjacent visible title "المستخدمين" is its name, so it was not the image's only name. Desktop folder thumbnail images keep core's `alt` (app name). No "Select {title}" with an empty title was produced (N1).

## 5. Rescored BRIEF section 10 table

| Dimension | Round 2 | Round 3 | Evidence |
|---|---|---|---|
| Accessibility | 4 | 4 | Contrast 0 failing; axe 0 violations attributable to the theme by the stated method; named list rows, grid rows, filters, dialogs; held back by S1 (unnamed row-editor controls), S2 (no landmark or skip), S3 (tab state), S5 (clipped ring), S6 (incomplete results unreviewed, viewport) |
| RTL parity | 4 | 4 | New CSS logical only; names correct in Arabic order; English names in S4 |
| Dark-mode parity | 4 | 4 | Hover, selected, banner, avatar all computed in Dark, 7.3 to 12.2; HRMS screenshots stale (N8) |
| Density and productivity | 5 | 5 | Not re-measured; hover and selection tint verified |
| Clarity and hierarchy | 5 | 4 | Avatar colours now echo status colours (fidelity deviation b); selected and hover merge in Light (N7) |
| Calm | 4 | 4 | Tinted avatars are quiet; permanent timeline underline is small |
| Consistency | 4 | 4 | Mixed Arabic register (N6); avatar and status share hues |
| Credibility | 4 | 4 | English "Previous Document", "Clear all filters", "Filter based on" in an Arabic session (S4) |

Every dimension is 4 or more. I have not scored upgrade-safety, performance, documentation, craft (outside this review's scope).

## 6. Not tested, and what a formal audit still covers

Screen readers (NVDA, JAWS, VoiceOver, TalkBack); Windows High Contrast on hardware (forced colours not emulated this round); 200% and 400% zoom and 320 px reflow for the new CSS; touch emulation and real 44px targets; `prefers-reduced-motion` live; Shift+Tab order; keyboard operation of the grid row editor, Gantt, calendar chips and Kanban; Escape handling of the idle `alertdialog`; focus not obscured by sticky headers in the new screens; HRMS screens after the avatar commit (re-shoot); ERPNext document forms (Sales Invoice, Item) under axe; inline grid cell editing names; print and PDF bidi; the 99 baselined chart gaps; Arabic-Indic digits; the hljs, datepicker and onboarding contrast values I did not recompute; the 25 unreviewed `color-contrast` incomplete nodes per run. Designed to meet WCAG 2.2 AA; formal audit recommended.
