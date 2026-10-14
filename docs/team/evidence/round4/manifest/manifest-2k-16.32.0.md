Manifest rows checked: 34; names (classes, ids, attributes, APIs) checked: 39. Frappe 16.32.0 against 16.32.0.

Row verdicts: present 20, moved 5, changed 0, missing 0, unchecked 9.
Name verdicts: present 12, moved 8, changed 0, missing 0, unchecked 19.

| Section | Row | Verdict | Item | Detail |
|---|---|---|---|---|
| 2k | 1 | present | `.es-menu`, `.es-menu__item` (menu rows and their inset focus ring) | frappe/public/scss/desk/menu.scss: 18-24 same ; es-menu: not in 16.32.0 source either (this theme's own name, or a description) ; es-menu__item: not in 16.32.0 source either (this theme's own name, or a description) |
| 2k | 2 | present | `.es-popover` (panel surface), `.es-menu` panel | frappe/public/scss/desk/global.scss: 327-330 same ; es-popover: not in 16.32.0 source either (this theme's own name, or a description) ; es-menu: not in 16.32.0 source either (this theme's own name, or a description) |
| 2k | 3 | present | `nav.es-breadcrumbs.navbar-breadcrumbs > ol > li > a`, `button`, `span.es-breadcrumbs__item`; separa | frappe/public/scss/desk/breadcrumb.scss: 6-30 same; 9-20 same ; frappe/public/js/frappe/ui/page.html: 17-17 same ; es-breadcrumbs: not in 16.32.0 source either (this theme's own name, or a description) ; es-breadcrumbs__item: not in 16.32.0 source either (this theme's own name, or a description) |
| 2k | 4 | present | `.es-breadcrumbs li:last-child .es-breadcrumbs__item` (the page title crumb) | frappe/public/js/frappe/views/breadcrumbs.js: 216-216 same; 219-219 same ; frappe/public/scss/desk/mobile.scss: 357-357 same ; es-breadcrumbs: not in 16.32.0 source either (this theme's own name, or a description) ; es-breadcrumbs__item: not in 16.32.0 source either (this theme's own name, or a description) |
| 2k | 5 | moved | `.es-tab-buttons > .es-pill[data-state="active"]` (selected page-size and tab pill) | frappe/public/scss/desk/list.scss: 293-312 same ; frappe/public/js/frappe/list/base_list.js: 377-406 same ; es-tab-buttons: not in 16.32.0 source either (this theme's own name, or a description) ; es-pill: not in 16.32.0 source either (this theme's own name, or a description) ; data-state: not in the cited file; now in frappe/public/js/frappe/form/toolbar.js |
| 2k | 6 | present | `.es-toast`, `.es-toast-container` | frappe/public/js/frappe/ui/messages.js: 443-443 same ; frappe/public/scss/desk/toast.scss: 12-12 same ; es-toast: not in 16.32.0 source either (this theme's own name, or a description) ; es-toast-container: not in 16.32.0 source either (this theme's own name, or a description) |
| 2k | 7 | moved | `.es-badge[data-theme]` (status pills in lists and page heads) | frappe/public/scss/common/indicator.scss: 2-2 same ; es-badge: not in 16.32.0 source either (this theme's own name, or a description) ; data-theme: not in the cited file; now in frappe/public/js/form_builder/components/Field.vue |
| 2k | 8 | moved | `.es-button[data-variant="solid"]` (page primary action, such as Add ToDo) | frappe/public/scss/common/buttons.scss: 80-80 same; 117-117 same ; es-button: not in the cited file; now in frappe/public/js/frappe/ui/toolbar/about.js ; data-variant: not in the cited file; now in frappe/public/js/frappe/ui/toolbar/about.js |
| 2k | 9 | present | `.has-error-mandatory`, `.has-error-invalid` (with `.has-error`) | frappe/public/js/frappe/form/controls/base_input.js: 277-277 same; 286-286 same ; has-error-mandatory: not in 16.32.0 source either (this theme's own name, or a description) ; has-error-invalid: not in 16.32.0 source either (this theme's own name, or a description) |
| 2k | 10 | present | `.current-highlight`, `.current-ball-highlight`, `.current-date-highlight` (frappe-gantt 1.1.0) | node_modules/frappe-gantt/dist/frappe-gantt.css: 25-25 same ; current-highlight: not in 16.32.0 source either (this theme's own name, or a description) ; current-ball-highlight: not in 16.32.0 source either (this theme's own name, or a description) ; current-date-highlight: not in 16.32.0 source either (this theme's own name, or a description) |
| 2k | 11 | present | `div.grid-header` as a direct child of `.gantt-container` (frappe-gantt 1.1.0), `.upper-text` and `. | node_modules/frappe-gantt/dist/frappe-gantt.css: 1-27 same |
| 2k | 12 | present | `.gantt-container` as the RTL pin and popup scope (`.gantt-modern` is no longer added) | frappe/public/scss/desk/frappe_gantt.scss: 1-1 same; 84-84 same ; frappe/public/js/frappe/views/gantt/gantt_view.js: 96-96 same |
| 2k | 13 | unchecked | .body-sidebar-container:not(.expanded) .sidebar-item-container:has(> .nested-container.hidden .activ |  |
| 2k | 14 | present | .active-sidebar .item-anchor (active row text) | frappe/public/scss/desk/sidebar.scss: 19-23 same; 62-117 same |
| 2k | 15 | present | .body-sidebar-container.expanded .overlay (scrim below md) | frappe/public/scss/desk/sidebar.scss: 256-256 same |
| 2k | 16 | unchecked | .dock, .dock-item, .dock-item.active (icon rail dock) |  |
| 2k | 17 | unchecked | .sidebar-panel, .panel-header .panel-header-actions span |  |
| 2k | 18 | moved | .es-button.w-full[data-variant="solid"][type=submit] (sign-in) and `.page-card-actions .es-button[da | frappe/www/login.html: 56-56 same; 60-60 same ; frappe/public/scss/login.bundle.scss: 78-78 same ; es-button: not in the cited file; now in frappe/public/js/frappe/ui/toolbar/about.js ; data-variant: not in the cited file; now in frappe/public/js/frappe/ui/toolbar/about.js |
| 2k | 19 | present | .btn-login-option, .es-button.btn-login-option | frappe/www/login.html: 65-65 same ; frappe/public/scss/login.bundle.scss: 138-138 same |
| 2k | 20 | present | .form-label, .form-group > label, .form-group > div > label | frappe/www/login.html: 17-17 same; 32-32 same |
| 2k | 21 | present | .email-field:not(:has(> .field-icon))::before and the same for .password-field (icon drawn only wher | frappe/www/login.html: 23-23 same; 37-37 same |
| 2k | 22 | present | a[href="#forgot"] and p.text-lg.text-right.w-full > a (Forgot password? link) | frappe/www/login.html: 47-48 same ; frappe/public/scss/login.bundle.scss: 303-303 same |
| 2k | 23 | unchecked | .login-error-banner.es-alert (error and success banners) |  |
| 2k | 24 | present | .password-strength-indicator, .password-hint, .password-mismatch-message (update-password) | frappe/www/update-password.html: 55-55 same |
| 2k | 25 | moved | #verify_token (two-factor verify button, `button.es-button[data-variant="solid"]`) | frappe/templates/includes/login/login.js: 375-375 same ; es-button: not in the cited file; now in frappe/public/js/frappe/ui/toolbar/about.js ; data-variant: not in the cited file; now in frappe/public/js/frappe/ui/toolbar/about.js |
| 2k | 26 | present | .email-ignore ("if you did not request this" warning in auth emails) | frappe/templates/emails/password_reset.html: 5-5 same ; frappe/public/scss/email.bundle.scss: 268-268 same; 276-276 same |
| 2k | 27 | present | .email-code (verification code box) | frappe/templates/emails/verification_code.html: 3-3 same ; frappe/public/scss/email.bundle.scss: 254-254 same |
| 2k | 28 | unchecked | .auth-email .email-card and .email-btn.email-btn-primary (auth email card and button) |  |
| 2k | 29 | present | `--bt-solid-bg`, `--bt-solid-bg-hover`, `--bt-solid-bg-active`, `--bt-solid-fg`, `--bt-fill-bg`, `-- |  |
| 2k | 30 | unchecked | `--c-fill`, `--c-fg`, `--c-line` (per status family, on `.es-badge`) | es-badge: not in 16.32.0 source either (this theme's own name, or a description) |
| 2k | 31 | present | `--g-*` (20 variables on `.gantt-container`, read by frappe-gantt 1.1.0) |  |
| 2k | 32 | unchecked | `--desk-sidebar-bg` (replaces the `--sidebar-*` colours), `--dock-*`, `--surface-elevation-2` and `- | counterparts.json: not found in the old tree either (manifest path not resolvable) |
| 2k | 33 | unchecked | `institutional_theme/audits/data/counterparts.json`: `pairs` (30 entries: 28 `same`, 2 `differs`) |  |
| 2k | 34 | unchecked | `institutional_theme/audits/data/core_vars_frappe_16.52.0.json` (second core snapshot) | core_vars_frappe_16.32.0.json: not found in the old tree either (manifest path not resolvable) |
