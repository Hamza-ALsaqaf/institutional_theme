# Accessibility and RTL final review (HEAD b0228e0)

Designed to meet WCAG 2.2 AA; formal audit recommended. VERIFIED = run on the live bench at http://midad.test:8000 (own users `a11y-fin-ar`, `a11y-fin-en`, created over REST; Administrator unchanged). Script: `/tmp/a11yf/t.mjs`, `d.mjs`.

**Phase 3 items on the real build:** 1 fixed (Arabic login: 0 text elements with letter-spacing; English keeps core 0.28px). 2 fixed (`button.ins-reveal`, 32x32, `aria-pressed=false`, label "إظهار كلمة المرور" / "Show password", reached by Tab from the password field, 2px ring, Shift+Tab x2 returns to email). 4 fixed (report rows 10-16 render in full, both languages). 5 and 6: not re-run live (masked field needs a masked doctype; failed-save path not provoked). 7 partial (4px bar, no icon or text). Item 3: login now Arabic ("تسجيل الدخول", "استمر", "نسيت كلمة المرور؟"); "Sign Up" and update-password "Use strong passwords." stay English (`real-update-password-ar.png`, trailing full stop jumps to the left). 404 link: colour rgb(0,88,149), underlined (VERIFIED).

## 1. Blocking defects remaining

None found on P0 screens in the Midad preset. Open, non-blocking: no error icon or text (3.3.1 relies on border and colour plus core's message); forced-colours rules ASSUMED, never rendered.

## 2. Scores (1-5)

| Dimension | Score | Evidence |
|---|---|---|
| Accessibility | 4 | Login, reveal button and focus ring verified; 5 and 6 and forced colours unverified |
| RTL parity | 4 | Mirrored layout in `report-ar.png`, calendar week starts at inline-start; leftover English strings and a stray full stop on update-password |
| Dark-mode parity | 3 | Desk dark good (`ar-dark-compact-report.png`); auth pages are always Light by design; calendar block chips stay light in Dark; chart screenshot is synthetic and its overlay is broken |
| Density and productivity | 4 | 16 report rows visible at 800px; header checkbox cell shows a clipped ".." ellipsis |
| Clarity and hierarchy | 3 | Appearance page `h1` is oversized and duplicates the breadcrumb; "محددة" tag crowds the swatch on the selected preset (`appearance-ar.png`) |
| Calm | 4 | Restrained palette, flat dark surfaces; kanban cards have large empty lower areas |
| Consistency | 4 | One ring, one radius family; chart legend shows colour only, so dash patterns exist on lines but not in the legend |
| Credibility | 4 | Reads as an institutional product; remaining English in Arabic pages and the clipped header checkbox undercut it |

## 3. A formal audit must still cover

Screen readers (NVDA, JAWS, VoiceOver, TalkBack) on every P0 screen; Windows High Contrast; 200% and 400% reflow on desk and auth pages; coarse-pointer target sizes; Shift+Tab order on forms and dialogs; focus not obscured by sticky headers (2.4.11); 3.3.1 error identification; autocomplete attributes; Tree, Gantt, skeleton and offline states with ERPNext installed; real masked-field forms; email and print templates; colour-vision simulation of charts.

## 4. Not tested

Masked-field live markup; failed-save announcements; dark Arabic desk beyond the committed screenshots; compact density live; 2FA, 403 and update-password re-rendered live (only screenshots read); hover and selected-row contrast recomputed (Phase 3 numbers stand, not re-run); about 40 of the 48 desk screenshots; mobile viewports; Tree and Gantt (never rendered, per P1 evidence); forced-colors, reduced motion and zoom on the real build.
