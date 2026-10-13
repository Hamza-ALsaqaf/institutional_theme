# Round 2 wave 3, print-web-engineer (2026-10-13, 23:15 UTC)

VERIFIED = I ran it. Scripts: `dump.mjs` (full computed-style dump, every property of every element), `diff.py`, `muted.mjs`. Raw dumps were 1.9 GB per run and are deleted; `diff.txt` and `muted.txt` are the results.

## Size (VERIFIED, budgets audit)
- Before: 175392 B raw, 14397 B gzip (FAIL both). After: 61091 B raw (59.7 KB), 9184 B gzip (8.9 KB). `budgets: 0 problem(s)`; no JUSTIFIED entry needed.
- Cause of the 83 KB: `$ins-auth-pages` was a two-item comma list wrapping a six-item `.for-*` list, so every nested rule was emitted 2 x 6 = 12 times. Fixed with `:is()` (same specificity as one argument) and a short `html body[data-path]` prefix for the card, 2FA, strength-bar, forced-colors and reduced-motion rules (`.for-*`, `#twofactor_div` exist only in core's login.html and update-password.html, 16.32.0). One redundant selector (`.btn-login:not(.btn-ldap-login)` min-block-size, already set by the rule above) removed.
- Light-only: `ins_web.bundle.scss` now imports `generated/tokens_light` and `generated/frappe_map_light` (both on disk at 23:01).

## Computed-style identity (VERIFIED)
Pages in en and ar: login, login#forgot, update-password (key=abc), 2FA (core's `continue_otp_app` injected), 404, 403 (`/me`, Guest), Web Page, web form, `/`. About 1100-1300 elements and all computed properties each, before vs after.
Result: 0 unintended differences. The only differences are the intended `.text-muted` colour (16 properties on the footer "ERPNext" link on Web Page and web form pages). The inline icon sprites (core emits symbols in a different order each request) are excluded. Not covered: hover and focus states, success/error banners, mobile width.

## Contrast (VERIFIED, `muted.txt`)
Footer `a.text-muted` "ERPNext" is rgb(88, 97, 109) = `--ins-text-muted`, 6.28:1 on white (was 4.17:1), en and ar. The 404, 403 and login pages have no visible `.text-muted` outside the 2FA hint, which already has its own rule. "No ToDo found" and the breadcrumb span from wave 2 did not render in these fixtures; they use the same class, so the rule covers them (not re-measured).

## Manifest row (for docs/DEPENDENCY_MANIFEST.md; I did not edit that file)
| Item | Value |
|---|---|
| Rule | `body[data-path]:not(.ins-auth):not(.ins-error) .text-muted { color: var(--ins-text-muted) !important }` in `web/_website.scss` |
| Answers | Bootstrap `.text-muted { color: $text-muted !important }`, `apps/frappe/node_modules/bootstrap/scss/utilities/_text.scss:52`, compiled into core's `website.bundle.css` by `frappe/public/scss/website/index.scss:4` with `$text-muted: $gray-600` = #7c7c7c (`website/variables.scss:8`) |
| Why | Two `!important` declarations: only a more specific `!important` wins. Colour variable cannot change it (the value is compiled in). Contrast (priority 2) outranks the no-`!important` rule (priority 3), lead decision. Scope excludes the desk and the auth and error pages. |
