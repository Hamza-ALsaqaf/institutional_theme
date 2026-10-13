# Phase 3 web surfaces (print-web-engineer): login, 2FA, forgot-password, update-password, error pages

Evidence labels: VERIFIED (run or opened), COMPUTED, ASSUMED.

## Done

- `institutional_theme/public/scss/ins_web.bundle.scss`, `web/_base.scss`, `web/_login.scss`, `web/_error_pages.scss`: light midad tokens, Plex through `fonts/plex`, `font-synthesis: none`, forced-colors, reduced motion. No `!important`, no literal colours, logical properties only, wrapped in `rtl:begin:ignore`.
- `institutional_theme/web_content.py` (ADR 0009): masthead into `banner_html`, trust footer into `body_include`, `body_class` flags. Guarded, existing values kept, server-side `_()`.
- `institutional_theme/tests/test_web_content.py`: 15 tests.
- Templates `templates/ins/masthead.html`, `trust_footer.html` unchanged (drafts accepted as written).

## Verified

- VERIFIED: `tools/bench/b.sh run-tests --app institutional_theme --module institutional_theme.tests.test_web_content` gives `Ran 15 tests ... OK`. Covers: other templates untouched, masthead and footer present, existing values kept, default notice en/ar, notice language and fallback with `lang`, escaping, support omitted when empty, language links keep the query, environment words, release line, reference on error.html, forged reference gives "Time of error", 404 without reference or language nav, message.html reference only for status >= 400, hook swallows a raising render.
- VERIFIED: `uvx ruff@0.16.8 check` and `format` clean on both Python files.
- VERIFIED: the bundle compiles with the bench Sass (162 KB expanded, unminified).
- VERIFIED (browser, live core page, CSS and fragments injected): screenshots in this folder, en and ar (rtl): `login-*`, `login-error-*` (invalid state with banner, icon, 2px border), `login-mobile-*` (390 px), `forgot-*`, `twofa-*` (request_otp() called, masthead survives), `notfound-*`. Regenerate with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node shots.mjs` (needs `/tmp/frag.json`, produced by rendering `web_content` in `bench console`; recipe in this file's last section).
- VERIFIED: specificity beats `login.bundle.css` without relying on order. The injected style is prepended to `<head>` (before core's link) and computed styles still read ours: `.btn-login` background `rgb(27, 80, 134)` (`--ins-primary`), input height 40px, card top border 3px, `.app-logo` display none, page background `rgb(247, 249, 252)`, font stack `"Midad Plex Sans Arabic", "Midad Plex Sans"...`.
- ASSUMED: the real `ins_web.bundle.css` build. Nothing was built; hooks are not yet enabled.

## Not verified or missing

- NOT VERIFIED: the live `/login` served by the real hook chain (needs the two hooks.py lines below and a build). Fragments were rendered by the real `web_content` code, with mocked settings (fictional names) and a mocked trace ID, then inserted by script.
- NOT VERIFIED: update-password page screenshot (no valid reset key on the bench); its selectors are mirrored from `www/update-password.html` and the `.for-reset-password` rules in `login.bundle.scss`.
- NOT VERIFIED: 403 (`NotPermittedPage`) and 500 (`error.html`) screenshots; they share the `.error-page` rules shown on the 404 screenshot. 500 reference and time-of-error are covered by unit tests only.
- NOT VERIFIED: forced-colors rendering (rules written, not rendered); `monitor: 1` end to end (ADR 0009 verification list item "500 shows an ID equal to the Error Log trace_id" needs a request-level test; the unit test mocks `get_trace_id`).
- Core limits that this CSS cannot fix: the password reveal control is an `<svg class="toggle-password">`, not focusable or keyboard-operable; the live bench has no Arabic for several core strings ("Sign In", "Welcome! ...", "Forgot password?" appear in English on the Arabic page), which is translation data, not CSS; `.ins-trust-line` renders an empty div when there is no support line, release or environment (harmless).
- Design deviations: system name sits in the masthead, not inside the card (ADR 0009). The design's divider and caps-lock hint are not present in core markup and are not added.
- Not touched: `public/images/*` (existing drafts), `_website.scss` (no general website styling in P0).

## hooks.py lines for the lead

```python
web_include_css = ["ins_web.bundle.css"]
update_website_context = [
	"institutional_theme.website.update_website_context",
	"institutional_theme.web_content.update_website_context",
]
```

`update_website_context` accepts a list (`website/page_renderers/base_template_page.py:69-75` loops over `frappe.get_hooks("update_website_context")`). Order matters: `website` first, so `web_content` sees the stylesheet list it may have extended. Also the dispatched Phase 3 hooks note: `ins_web.bundle.scss` must exist before `web_include_css` is enabled (it does now).

## Selectors depended on (Frappe 16.32.0, `frappe/` relative)

| Selector | Source |
|---|---|
| `body[data-path]`, `body class`, `banner_html`, `body_include` slots | `templates/base.html:57, 61-62, 115` |
| `.page-content-wrapper` (min-height, padding) | `public/scss/login.bundle.scss:5-13`; `templates/web.html:8` |
| `.page_content { min-height: 50vh }` | `public/scss/website/index.scss:128-130` |
| `.for-login .page-card` and siblings `.for-forgot`, `.for-login-with-email-link`, `.for-signup`, `.for-email-login`, `.for-reset-password` | `login.bundle.scss:27-50`; `www/login.html:119, 135, 150, 165`; `www/update-password.html:14` |
| `.page-card form`, `.form-group` | `login.bundle.scss:52-70` |
| `.page-card-actions .btn-login, .btn-ldap-login, .btn-signup, .btn-login-option` | `login.bundle.scss:72-165`; `www/login.html` (buttons in `email_login_body`) |
| `.page-card-body` inputs, `.form-label`, `.field-icon`, `.email-field`, `.password-field`, `.toggle-password`, `.forgot-password-message`, `.login-error-banner`, `.login-success-banner`, `.field-error`, `.invalid` | `login.bundle.scss:210-352`; `www/login.html:9-48` |
| `.sign-up-message` | `login.bundle.scss:356-372`; `www/login.html:125, 168` |
| `.page-card-head`, `img.app-logo`, `h4`, `.page-card-subtitle` | `login.bundle.scss:398-435`; `www/login.html:92-93` |
| `.invalid-login` wiggle | `login.bundle.scss:374-376` |
| 2FA: `#twofactor_div`, `.form-verify`, `#login_token`, `#verify_token`, `.text-muted` hint | `templates/includes/login/login.js:365-381` |
| Update-password strength: `.for-reset-password .password-strength-bar-track` | `login.bundle.scss` (reset-password block); `www/update-password.html:55` |
| `.error-page`, `.details`, `h4`, `.error-content`, `.btn-primary` | `public/scss/website/error-state.scss:1-24`; `www/error.html:19, 33-45`; `www/message.html:14-28` |

## Strings (new source strings, Arabic entries needed unless already in ar.csv)

From `web_content.py` and the templates (all through `_()`):

- Language
- Reference
- Quote this reference when you contact support.
- Time of error
- Technical support
- Release {0}
- Production
- Training
- UAT
- Staging
- Non-production
- Access to this system is restricted to authorised users. Activity is recorded.

VERIFIED by grep: `ar.csv` already holds an Arabic entry for every string above (I did not edit it). The `ar` rendering of the default notice was verified (`test_default_notice_in_both_languages`), which proves that entry resolves.

## Recipe: fragments for the screenshots

`bench console`: loop over `en`, `ar` and the templates `www/login.html`, `www/error.html`, `www/404.html`; set `frappe.local.lang`; patch `web_content._get_settings` with a `frappe._dict` of fictional names, `frappe.conf` `ins_release` and `ins_environment`, and `frappe.monitor.get_trace_id`; call `web_content.update_website_context(frappe._dict(template=..., http_status_code=...))`; dump to `/tmp/frag.json`.

## Fix round (a11y findings 1, 2, 3, 10, 11)

Evidence labels: VERIFIED = run live on the bench (Chromium, SCSS compiled with the bench sass and injected, JS via `addScriptTag`). Screenshots: `fix-login-ar.png`, `fix-login-en.png`.

- **1 letter-spacing (VERIFIED):** `web/_base.scss` sets `letter-spacing: 0` on `*` under `html[lang|="ar"] body.ins-auth` / `.ins-error`, with the body class repeated six times to out-rank core `login.bundle.scss` (lines 365, 423, 434 and the `get_textstyle` mixin, nested up to five classes). Live Arabic login: zero visible elements with non-zero tracking. English is unchanged (0.28px, core).
- **2 password reveal (VERIFIED):** `public/js/ins_web.bundle.js` wraps `svg.toggle-password` in `<button type="button" class="ins-reveal" aria-pressed>`, 32x32px, focus ring from tokens, logical `inset-inline-end`. Tab from the password field reaches it; Space sets type `text` and `aria-pressed=true`; Enter toggles back. Label source: `__()` reads `frappe._messages`, which website pages do not fill, so the translated label is rendered server-side by `web_content.py` in `<span hidden data-ins-reveal-labels data-show data-hide>` and read by the script. The script removes the svg's `toggle-password` class (core's click handler is bound to the element and would double-toggle, so the button toggles itself, as core does, and swaps `#es-line-preview` / `#es-line-hide`). A MutationObserver wraps re-rendered icons. Also covers update-password.
- **3, 10 translations:** `ar.csv` gains Sign In, Welcome!..., Forgot password?, Forgot Password?, the reset-link sentence, Send Link, Resend, Didn't receive the link?, Back to sign in, Login with Email Link, Send login link, Login with password, Please check your email., Show password, Hide password; "Selected" is now "محددة". Not VERIFIED live: the running bench has not reloaded translations, so the screenshot still shows English for those strings.
- **11 input direction (VERIFIED):** `#login_email`, `#login_password` and update-password password fields get `direction: ltr` (Latin caret and run correct). Under ltr, `text-align: start` is the left edge, so in RTL pages `text-align: end` (right edge) keeps the text lined up with the mirrored layout and icons. Computed: ar `ltr/end`, en `ltr/start`.
- Screenshot artefact: the doubled masthead in `fix-login-*.png` comes from injecting the fragment into a page that already renders it.

## Real build verification

Run against the live bench at `http://midad.test:8000` with this app's bundles served by core (no injection), Chromium via Playwright, `locale` set per language. Script: `real_pages.mjs`; measurements: `real-pages-check.json`; screenshots `real-<page>-<lang>.png`. Evidence label: VERIFIED = run live.

Fictional test data (all prefixed `web-`): users `web-reset@`, `web-session@`, `web-twofa@example.com`, role `web-2fa-role` (the only role with `two_factor_auth=1`, assigned only to `web-twofa`). Administrator was not touched. 2FA: System Settings `enable_two_factor_auth` was 0; the script set it to 1 only around the 2FA login and restored it to 0 in a `finally` block (re-read afterwards: 0). The `web-twofa` user has its `_otplogin` default set so the OTP step shows without an outgoing email account (the first-login path needs one: the English run first showed core's "Please setup default outgoing Email Account" message).

Dark: not applicable. Core website pages never set `data-theme` or `prefers-color-scheme` (grep of `templates/`, `www/`, `public/scss/website`: only `www/desk.html` and the avatar partial); auth and error pages are always Light.

Session expired in 16.32: `request.js:136-139` (401) and `request.js:436-439` (`r.session_expired`) call `frappe.app.handle_session_expired()` (`desk.js:403`), which calls `redirect_to_login()` (`desk.js:406`) = navigation to `/login?redirect-to=<path>`. There is no separate expired page: it is the login page. Reproduced by `frappe.sessions.clear_sessions(user, force=True)` and then a `frappe.call` from the open desk; the browser landed on `/login?redirect-to=%2Fdesk%2Fuser%3Fenabled%3D1`.

| Page | en | ar | Notes |
|---|---|---|---|
| login | VERIFIED | VERIFIED | earlier capture, not repeated |
| forgot-password (`/login#forgot`) | VERIFIED | VERIFIED | own CSS loaded, 0 tracked text nodes in ar |
| update-password (real reset key) | VERIFIED | VERIFIED | reveal buttons 32x32 with translated label; ar subtitle "Use strong passwords." was untranslated, entry added to `ar.csv` (not re-rendered: bench has not reloaded translations) |
| 2FA (OTP App, verification step) | VERIFIED | VERIFIED | ar letter-spacing 0 |
| session-expired (redirect to login) | VERIFIED | VERIFIED | URL above; page identical to login with `redirect-to` |
| 404 | VERIFIED | VERIFIED | |
| 403 (`/printview` as Guest, "Not Permitted") | VERIFIED | VERIFIED | |
| Dark | n/a | n/a | see above |

Checks: Arabic letter-spacing is 0 on every page (zero text-bearing elements with non-zero tracking). English shows core's 0.28px, unchanged by design. Reveal button present and visible on every password page (hidden on forgot, where the field is not shown).

Defect found and fixed: on 404 and 403 the "Back to Home" link kept core's `.text-muted { color: #7c7c7c !important }` (4.2:1 on white, below 4.5:1), so `_error_pages.scss` could not recolour it. `ins_web.bundle.js` now removes `text-muted` from `body.ins-error .details a.text-muted`; verified by injecting the script into the live 404 page: class empty, colour rgb(0, 88, 149) = `--ins-text-link`, underlined, about 7.5:1 (COMPUTED). Screenshot `fix-404-link-en.png`. Needs a rebuild to reach the real build. Not done: no `!important` was added.
