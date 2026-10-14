# Accessibility and RTL review, Phase 3 (bd42d23..HEAD)

Designed to meet WCAG 2.2 AA; formal audit recommended. VERIFIED = run on the live bench (own user `a11y-ar`). COMPUTED = my arithmetic.

**Phase 2 items:** 1, 2, 3, 5, 11 fixed (audit 0 failing; live checked box in a selected row: ring 2px, offset 2px, outside the fill, VERIFIED). 4 fixed on the desk (no Arabic text with letter-spacing on 5 routes, VERIFIED) but not on login (finding 1). 6 fixed in code only. 7 open (`_base.scss:94-95`). 8, 9 partial. 10 is Phase 4.

**Computed, undeclared pairs:** ring on selected row 5.22 (L) / 7.96 (D); ring on hover 5.09 / 8.20; dark muted on `selected-strong` 4.69; success pill 9.45; `border-control` on dark selected 3.01, light hover 3.04 (thin).

## BLOCKING

**1. Arabic login keeps letter-spacing.** `web/_base.scss:19-22` resets `body` only; core `login.bundle.scss` sets tracking on descendants. Live `/login?_lang=ar`: labels 0.26px, "استمر" 0.28px, links 0.26px (VERIFIED). It breaks Arabic joins. Fix: `letter-spacing: 0` on `body.ins-auth *` and `body.ins-error *` under `html[lang|="ar"]`, above core's specificity.

**2. Password reveal is pointer-only.** `svg.toggle-password`: `tabindex=-1`, no role or name, 16x16px (VERIFIED). Tab skips from the field to "Forgot password?". Fails 2.1.1, 4.1.2, 2.5.8. Fix: a small web script wrapping it in `<button aria-pressed>` with a translated label and a 24px target, or record it as a deviation.

## ADVISORY

3. **Login strings English on the Arabic page** (live): "Sign In", "Welcome!…", "Forgot password?", "Send Link", "Resend". Punctuation jumps ("?Forgot password", `evidence/phase3/web/login-ar.png`). Add them to `ar.csv`.
4. **Row numbers truncated** ("1…" from row 10) in both languages: `screens/en-light-comfortable-report.png`, `ar-dark-comfortable-report.png`. Suspect `_typography.scss:32` (tabular figures on all `.dt-cell__content`); cause not confirmed. Exempt the index column.
5. **Masked reason not tied to the field:** `::after` on the wrapper (`_masked.scss:32-40`), no `aria-describedby` (`masked_fields.js:16-17`). The input reads only "XXXXXXXX". Use a real element plus `aria-describedby`.
6. **Appearance page** (`ins_appearance.js`): a failed mode or density save reverts silently, with no status (`:101-105`, `:129-133`). The post-reload message is set while the page is hidden (`:223`) and may not be read. After a failed apply, focus is lost (`:197`, `:208`). The `h1` renders at core size and repeats the page title; "Apply" sits inside the option row (live shot `/tmp/a11y/appearance-ar.png`, not committed). Keyboard works: one Tab stop per radio group, ring drawn (VERIFIED).
7. **Error state** uses colour plus a thicker border only (`_controls.scss:86-90`), and `_base.scss:25` removes the thickness on focus. Add an icon or message.
8. **Forced colours** is asserted for checked checkboxes only; selected rows, switches and web pages are not rendered. Spinners unchanged (Phase 2 item 7).
9. **Workspace** (`ar-light-comfortable-workspace.png`): "تعريف وحدة بر..." truncated, no `title`; "↗" arrows not mirrored.
10. **Translations:** "Selected" is "محدد" (masculine) next to "مجموعة" (feminine): use "محددة". The `ar.csv` override is global. Terms are otherwise consistent; no placeholder mismatches.
11. Email and password inputs have no `dir`; Latin text aligns right in RTL. Optional `dir="ltr"` with `text-align: start`.

## Fidelity deviations (not judged)

Report view shows an empty strip at the inline-end of the table. Status pills carry shape plus label. The form sidebar sits at the inline-end in both languages, as core does.

## Not tested

Screen readers, Windows High Contrast, 400% zoom on the desk (my resize test caught the sidebar mid-transition; discarded), coarse pointer, Shift+Tab order, real autofill, update-password, 403, 500, dark Arabic login, 40 of the 48 desk screenshots.
