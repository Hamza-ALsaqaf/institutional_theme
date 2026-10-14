Manifest rows checked: 34; names (classes, ids, attributes, APIs) checked: 39. Frappe 16.52.0 against 16.52.0.

Row verdicts: present 31, moved 1, changed 0, missing 0, unchecked 2.
Name verdicts: present 38, moved 1, changed 0, missing 0, unchecked 0.

| Section | Row | Verdict | Item | Detail |
|---|---|---|---|---|
| 2k | 1 | present | `.es-menu`, `.es-menu__item` (menu rows and their inset focus ring) | frappe/public/css/espresso/components/menu.css: 44-44 same; 81-81 same ; frappe/public/js/frappe/ui/components/menu.js: 331-332 same |
| 2k | 2 | present | `.es-popover` (panel surface), `.es-menu` panel | frappe/public/css/espresso/components/popover.css: 28-28 same ; frappe/public/js/frappe/ui/page.html: 49-49 same; 58-58 same |
| 2k | 3 | present | `nav.es-breadcrumbs.navbar-breadcrumbs > ol > li > a`, `button`, `span.es-breadcrumbs__item`; separa | frappe/public/js/frappe/ui/page.html: 17-17 same ; frappe/public/css/espresso/components/breadcrumbs.css: 40-40 same; 61-61 same |
| 2k | 4 | present | `.es-breadcrumbs li:last-child .es-breadcrumbs__item` (the page title crumb) | frappe/public/js/frappe/ui/page.js: 1048-1058 same ; frappe/public/js/frappe/ui/components/breadcrumbs.js: 55-80 same ; frappe/public/css/espresso/components/breadcrumbs.css: 100-100 same |
| 2k | 5 | present | `.es-tab-buttons > .es-pill[data-state="active"]` (selected page-size and tab pill) | frappe/public/js/frappe/list/base_list.js: 388-399 same ; frappe/public/css/espresso/components/tab_buttons.css: 65-65 same; 114-114 same; 289-289 same |
| 2k | 6 | present | `.es-toast`, `.es-toast-container` | frappe/public/js/frappe/ui/messages.js: 430-430 same ; frappe/public/js/frappe/ui/components/toast.js: 32-57 same ; frappe/public/css/espresso/components/toast.css: 34-34 same |
| 2k | 7 | present | `.es-badge[data-theme]` (status pills in lists and page heads) | frappe/public/css/espresso/components/badge.css: 7-14 same ; frappe/public/js/frappe/list/list_view.js: 1499-1499 same; 1896-1896 same ; frappe/public/js/frappe/ui/page.js: 299-299 same ; frappe/public/js/frappe/ui/page.html: 24-24 same |
| 2k | 8 | present | `.es-button[data-variant="solid"]` (page primary action, such as Add ToDo) | frappe/public/js/frappe/ui/page.html: 61-61 same ; frappe/public/css/espresso/components/button.css: 34-37 same; 149-162 same |
| 2k | 9 | present | `.has-error-mandatory`, `.has-error-invalid` (with `.has-error`) | frappe/public/js/frappe/form/controls/base_input.js: 270-286 same |
| 2k | 10 | present | `.current-highlight`, `.current-ball-highlight`, `.current-date-highlight` (frappe-gantt 1.1.0) | node_modules/frappe-gantt/src/styles/gantt.css: 182-182 same; 189-189 same; 196-196 same |
| 2k | 11 | present | `div.grid-header` as a direct child of `.gantt-container` (frappe-gantt 1.1.0), `.upper-text` and `. | node_modules/frappe-gantt/src/index.js: 471-471 same |
| 2k | 12 | moved | `.gantt-container` as the RTL pin and popup scope (`.gantt-modern` is no longer added) | node_modules/frappe-gantt/src/index.js: 62-62 same ; gantt-modern: not in the cited file; now in frappe/public/scss/desk/frappe_gantt.scss |
| 2k | 13 | present | .body-sidebar-container:not(.expanded) .sidebar-item-container:has(> .nested-container.hidden .activ | frappe/public/scss/desk/sidebar.scss: 365-375 same |
| 2k | 14 | present | .active-sidebar .item-anchor (active row text) | frappe/public/scss/desk/sidebar.scss: 54-54 same; 144-144 same; 544-544 same |
| 2k | 15 | present | .body-sidebar-container.expanded .overlay (scrim below md) | frappe/public/scss/desk/sidebar.scss: 535-535 same |
| 2k | 16 | present | .dock, .dock-item, .dock-item.active (icon rail dock) | frappe/public/scss/desk/dock.scss: 30-30 same; 145-145 same; 203-203 same ; frappe/public/js/frappe/ui/sidebar/dock.js: 21-40 same; 305-312 same |
| 2k | 17 | present | .sidebar-panel, .panel-header .panel-header-actions span | frappe/public/scss/desk/sidebar_panel.scss: 8-32 same |
| 2k | 18 | present | .es-button.w-full[data-variant="solid"][type=submit] (sign-in) and `.page-card-actions .es-button[da | frappe/www/login.html: 45-49 same ; frappe/public/css/espresso/components/button.css: 31-31 same; 34-34 same; 149-152 same; 29-30 same |
| 2k | 19 | present | .btn-login-option, .es-button.btn-login-option | frappe/www/login.html: 54-54 same |
| 2k | 20 | present | .form-label, .form-group > label, .form-group > div > label | frappe/www/login.html: 13-13 same; 24-24 same |
| 2k | 21 | present | .email-field:not(:has(> .field-icon))::before and the same for .password-field (icon drawn only wher | frappe/www/login.html: 13-13 same; 24-24 same |
| 2k | 22 | present | a[href="#forgot"] and p.text-lg.text-right.w-full > a (Forgot password? link) | frappe/www/login.html: 36-38 same |
| 2k | 23 | present | .login-error-banner.es-alert (error and success banners) | frappe/templates/includes/login/macros.html: 1-9 same ; frappe/public/css/espresso/components/alert.css: file exists |
| 2k | 24 | present | .password-strength-indicator, .password-hint, .password-mismatch-message (update-password) | frappe/www/update-password.html: 41-41 same; 52-52 same; 65-65 same |
| 2k | 25 | present | #verify_token (two-factor verify button, `button.es-button[data-variant="solid"]`) | frappe/templates/includes/login/login.js: 427-427 same |
| 2k | 26 | present | .email-ignore ("if you did not request this" warning in auth emails) | frappe/templates/emails/password_reset.html: 11-11 same ; frappe/templates/emails/verification_code.html: 5-5 same ; frappe/public/scss/email.bundle.scss: 614-614 same |
| 2k | 27 | present | .email-code (verification code box) | frappe/templates/emails/verification_code.html: 4-4 same ; frappe/public/scss/email.bundle.scss: 643-643 same |
| 2k | 28 | present | .auth-email .email-card and .email-btn.email-btn-primary (auth email card and button) | frappe/public/scss/email.bundle.scss: 585-585 same; 293-293 same ; frappe/templates/emails/auth_email.html: file exists |
| 2k | 29 | present | `--bt-solid-bg`, `--bt-solid-bg-hover`, `--bt-solid-bg-active`, `--bt-solid-fg`, `--bt-fill-bg`, `-- | frappe/public/css/espresso/components/button.css: 34-39 same; 45-46 same |
| 2k | 30 | present | `--c-fill`, `--c-fg`, `--c-line` (per status family, on `.es-badge`) | frappe/public/css/espresso/components/badge.css: 10-14 same ; frappe/public/css/espresso/components/badge-legacy-colors.css: 1-5 same |
| 2k | 31 | present | `--g-*` (20 variables on `.gantt-container`, read by frappe-gantt 1.1.0) | node_modules/frappe-gantt/src/styles/gantt.css: 26-26 same; 33-33 same; 39-39 same; 51-51 same |
| 2k | 32 | present | `--desk-sidebar-bg` (replaces the `--sidebar-*` colours), `--dock-*`, `--surface-elevation-2` and `- | frappe/public/scss/desk/sidebar.scss: 24-24 same; 28-28 same |
| 2k | 33 | unchecked | `institutional_theme/audits/data/counterparts.json`: `pairs` (30 entries: 28 `same`, 2 `differs`) |  |
| 2k | 34 | unchecked | `institutional_theme/audits/data/core_vars_frappe_16.52.0.json` (second core snapshot) | docs/audits/dead_tokens.txt: not found in the old tree either (manifest path not resolvable) |
