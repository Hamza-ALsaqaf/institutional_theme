# Login, forgot-password, 2FA, update-password and auth emails: selectors for Frappe 16.32.0 and v16.52.0

Round 4, print-web-engineer. Source read from `/tmp/src/frappe-16.32.0` and `/tmp/src/frappe-16.52.0` (COMPUTED); rendering done on `midad.test` (16.32.0, port 8000) and `midad52.test` (v16.52.0, port 8001) (VERIFIED by running; screenshots and `*-measurements.json` in this folder). All theme rules are in `institutional_theme/public/scss/web/_login.scss`, `web/_base.scss` and `ins_email.bundle.scss`. Every new selector sits next to the old one; where a name is absent it matches nothing. No version test, no `!important`, only existing tokens and literals.

Paths under `frappe/`. "login.html" is `www/login.html`, "bundle" is `public/scss/login.bundle.scss`, "button.css" is `public/css/espresso/components/button.css`.

## Login page

| Item | 16.32.0 | v16.52.0 | Theme rule |
|---|---|---|---|
| Sign-in button | `button.btn.btn-sm.btn-default.btn-block.btn-login` (login.html:56,60), styled by bundle:78 | `button.es-button.w-full[data-variant="solid"][type=submit]` (login.html:45-49), grey-10 fill (button.css:29-30,149-152), so near-black | `.page-card-actions .es-button[data-variant="solid"]` next to `.btn-login`, `.btn-ldap-login`, `.btn-signup:not(:disabled)`. The `.es-button` block sets core's own local variables `--bt-solid-bg`, `-hover`, `-active`, `--bt-solid-fg`, `--bt-focus`, `--es-bt-h` to theme tokens, so core's hover, active, focus and disabled rules follow the theme without repeating them |
| Secondary option button | `.btn-login-option` (login.html:65, bundle:138) | `a.es-button.w-full.btn-login-option` (login.html:54) | `.btn-login-option, .es-button.btn-login-option` |
| Forgot, send-link button | `.btn.btn-primary.btn-signup.btn-forgot` (login.html:183) | `.es-button.btn-forgot[data-variant="solid"]`, disabled until typed (login.html:170-171) | solid selector above; disabled `.btn-signup:disabled, .es-button:disabled`: dashed border, muted text (state by border, not tint) |
| Email and password labels | `label.form-label` (login.html:17,32) | bare `label.text-base.text-ink-gray-5` inside `.form-group` (login.html:13,24) | `.form-label, .form-group > label, .form-group > div > label` |
| Field icons (envelope, lock) | `svg.field-icon.email-icon` / `.password-icon` inside `.email-field` / `.password-field` (login.html:23,37) | none in the markup | `.email-field:not(:has(> .field-icon))::before` and the same for `.password-field`: a 16px `mask-image` (data-URI SVG, lucide mail and lock) painted `--ins-text-muted`, at `inset-inline-start`. Added only where core draws none, so 16.32.0 gets no double icon (VERIFIED: `.field-icon` svg present and `::before` content `none` on 16.32.0; no svg and `""` on v16.52.0) |
| "Forgot password?" link | `p.forgot-password-message > a[href="#forgot"]` (login.html:47-48, bundle:303) | `p.text-lg.text-right.w-full > a.text-base.text-ink-gray-5[href="#forgot"]` (login.html:36-38); `.forgot-password-message` is gone | `.forgot-password-message > *, a[href="#forgot"]` coloured `--ins-text-link`, 13px; `.forgot-password-message, p:has(> a[href="#forgot"])` aligned `end` |
| Password reveal | `svg.toggle-password[toggle]` (login.html:41), handler in `templates/includes/login/login.js:108` | same svg with `.icon.icon-sm` (login.html:29), handler `login.js:115` | `ins_web.bundle.js` selector `svg.toggle-password` unchanged: finds its target on both (VERIFIED: `.ins-reveal` button present with the translated aria-label, three on update-password). Core's handler stays bound to the svg, which no longer receives clicks (`pointer-events: none`), so the toggle does not fire twice. Added `stroke: none` because v16.52.0 keeps `.icon` (1.5px stroke) and the filled glyph looked bold. If the svg is absent the script finds nothing and does nothing |
| Error and success banners | `.login-error-banner` styled by the bundle | `div.login-error-banner.es-alert.hidden[data-theme=red]` with `.es-alert__title` (`templates/includes/login/macros.html:1-9`, `public/css/espresso/components/alert.css`) | existing `.login-error-banner, .login-success-banner` rule (border, 4px start rule, icon, text) applies to both; `.hidden` is core's. NOT rendered visible on either version (needs a failed login); see "Not done" |
| Field error text | `p.field-error` | `p.field-error.text-base.text-ink-red-8` (login.html:17) | existing `.field-error` rule |
| Invalid field | `.form-group.invalid input` | same (bundle:46-50) | existing rule, 2px danger border |
| Card, inputs, focus | `.page-card` (bundle:32) | `.page-card` (bundle:33-50), inputs 28px high (bundle:68-75) | existing rules out-rank core by `html body[data-path] ...`; input height 40px, focus ring 2px `--ins-focus` (VERIFIED, both versions) |
| Sign-up and back links | `.sign-up-message a` | `.sign-up-message a.text-p-sm-semibold` (login.html:114-116,174-176) | existing `.sign-up-message a` rule (link colour, underline) |
| Body weight | 400 | `--font-weight-regular: 420` (`public/css/espresso/typography.css:8`), read by body, `text-*` utilities and `.es-button`. The bundled faces have 400, 500 and 600, so 420 rounds to 500 and every line looked a step too heavy | `web/_base.scss`: on `body.ins-auth, body.ins-error` map `--font-weight-regular/-medium/-semibold/-bold` to `--ins-weight-*`. Measured body 400, heading 600, button 500 on both versions. **Report to the theme architect**: the generated Frappe map has the `--weight-*` aliases but not `--font-weight-*`, which the desk also reads in v16.52.0 |

## Forgot-password

| | 16.32.0 | v16.52.0 |
|---|---|---|
| Section | `section.for-forgot` (login.html:164) | `section.for-forgot` (login.html:153) |
| Send button | `.btn-signup.btn-forgot` | `.es-button.btn-forgot` |
| Email field | `.email-field` with `.field-icon` | `.email-field`, `::before` icon from the rule above |
| Back link | `.sign-up-message a` | `.sign-up-message a` (login.html:174) |

## Two-factor step (markup injected by `login.js`)

| | 16.32.0 | v16.52.0 |
|---|---|---|
| Container | `#twofactor_div form.form-verify` (`login.js:365-376`) | same (`login.js:417-429`) |
| Verify button | `button.btn.btn-sm.btn-primary.btn-block.mt-3#verify_token` (`login.js:375`) | `button.es-button.w-full.mt-3[data-variant="solid"]#verify_token` (`login.js:427`) |
| Theme rule | `#twofactor_div #verify_token` (ink blue, hover, focus) | the same id rule; it out-ranks `.es-button[data-variant]`; measured 8.27:1 on both. The step is emulated in the capture (core fills it after a real two-factor login), see "Not done" |

## Update-password

| | 16.32.0 | v16.52.0 |
|---|---|---|
| Section | `.for-reset-password` | `.for-reset-password` (`www/update-password.html:14`) |
| Strength | `.password-strength-bar-track` | gone; text `span.password-strength-indicator`, `.password-hint`, `.password-mismatch-message` (update-password.html:41,52,65) |
| Theme rule | `.for-reset-password .password-strength-bar-track` kept | `.password-strength-indicator, .password-hint, .password-mismatch-message` in `--ins-text-secondary`, 13px (measured `rgb(66, 75, 87)`, 8.84:1 on white) |
| Confirm button | `.btn-signup#update` | `.es-button#update[data-variant="solid"]`, disabled until valid |

## Auth emails (G4)

Core moved password reset, verification code, email-login link, new user and invitation emails to `templates/emails/auth_email.html` in v16.52.0 (`www/login.py:160`, `core/doctype/user/user.py:530,560,1358`, `twofactor.py:360`, `core/doctype/user_invitation/user_invitation.py:63,81,125`), with their own CSS under `.body-table.auth-email` (`public/scss/email.bundle.scss:585-660`).

| Role | 16.32.0 | v16.52.0 | Theme rule (`ins_email.bundle.scss`) |
|---|---|---|---|
| Warning callout "if you did not request this" | `div.callout.callout-warning` (`templates/emails/password_reset.html:5`, `email.bundle.scss:268,276`) | `p.email-ignore` (`templates/emails/password_reset.html:11`, `verification_code.html:5`, `login_with_email_link.html:11`, `new_user.html:13`; only a margin in `email.bundle.scss:614`) | `.body-table.auth-email .email-body .email-ignore`: 1px border, 4px left rule, warning fill, 13px. Old `.callout-warning` rule kept |
| Verification code | `div.verification-code` (`verification_code.html:3`, `email.bundle.scss:254`) | `div.email-code` (`verification_code.html:4`, `email.bundle.scss:643`) | `.email-body .email-code`: boxed with a 2px strong border, `direction: ltr`. Old rule kept |
| Title | `h1.email-header-title` | `h1.email-title` (`email.bundle.scss:598`) | colour, weight, no tracking |
| Primary button | `a.btn.btn-primary` | `a.email-btn.email-btn-primary` (colour `!important` in core, white, kept; `email.bundle.scss:293`) | `.email-btn.email-btn-primary` background and border `$ins-primary`; 4px radius |
| Card | `.body-table.with-container .email-container` | `.body-table.auth-email .email-card` (24px radius, no border; `email.bundle.scss:585`) | border, 4px brand rule, 6px radius, sunken page background, Segoe UI stack, `unicode-bidi: plaintext` |

Not changed, because it would need `!important` against core's: `.email-copy a` is `#0070cc !important` (about 5.2:1 on white, readable) and `.email-brand-name` is `color: #171717 !important`. Both are acceptable as they are.
