# Newest Frappe v16 tag against this theme (ADR 0001 D1, round 3 item 3)

Run on 2026-10-14 by `tools/bench/newest_tag.sh` (whole run from nothing: about 3 minutes). The supported range and the committed snapshot
(`institutional_theme/audits/data/core_vars_frappe_16.32.0.json`) are unchanged: every audit ran with `--no-write`.

| | Tag | Commit |
|---|---|---|
| Newest Frappe v16 (highest semver of `git ls-remote --tags https://github.com/frappe/frappe 'v16.*'`) | **v16.52.0** | `4515014c87ece6cb20ee91d2cfb121c5cbd1ff4a` |
| Newest ERPNext v16 | v16.50.0 | `7474d9e786277383de1242ab882f16856d17a9c9` |
| Reference (the verified target on `midad.test`) | v16.32.0 | `5cba016e86b54b57f34a3864282b92300ef20fb0` |

**The newest tag moved during the round.** The first run of the day (commit `cd88064`) saw v16.51.1 (`2871914b69b6e14a4b023d9b7cc52dc3e269cc1b`); v16.52.0 appeared before the last run, and every file here is from the v16.52.0 run. The only difference in the findings: `--surface-modal`, still read in v16.51.1, is no longer read in v16.52.0 (15 dead names instead of 14, 6 read-only instead of 7). The selector results are the same apart from a one-line shift. Set `NEWEST_TAG=v16.51.1` to pin a tag.

The newest bench is `/home/frappe/newest-bench` (`bench init` on the clone `/tmp/frappe-newest/frappe-src`, then `bench get-app erpnext --branch v16.50.0`,
`bench build --app erpnext`), outside the repository, with no site. HRMS was not part of this check (ADR 0001 D1 names Frappe; HRMS is item 2).

## Commands and exit codes

All in `commands.tsv` (step, exit, seconds, command) and `run.log`; logs of the bench steps are `bench-init.log`, `get-app-erpnext.log`, `build-erpnext.log`.
`tools/bench/newest_tag.sh` (no argument) runs: `tag`, `clone`, `bench`, `theme`, `site`, `audit`, `selectors`.

| Step | Exit | Notes |
|---|---|---|
| `git clone --depth 1 --branch v16.52.0 https://github.com/frappe/frappe` | 0 | 5 s |
| `bench init newest-bench --frappe-path <clone> --frappe-branch v16.52.0 --python /opt/python3.14/bin/python3.14 --no-backups --skip-redis-config-generation` | 0 | 40 to 60 s, builds core assets (LTR and RTL) |
| `bench get-app erpnext --branch v16.50.0 --skip-assets`, `bench build --app erpnext` | 0, 0 | about 20 s each |
| `bench get-app https://github.com/Hamza-ALsaqaf/institutional_theme --branch build/midad-v1` into the newest bench (also builds), `bench build --app institutional_theme` | 0, 0 | The SCSS and JS compile against the newest core: the same ten bundles, desk CSS 119.78 KB (`get-app-theme.log`, `build-theme.log`) |
| `fresh_install.sh site-frappe` on the newest bench: new Frappe-only site, setup wizard, README install, checks, uninstall (`site/`) | 0 | 31 steps, every exit code 0; details in section 4 |
| `python -m institutional_theme.audits --no-write` on the committed snapshot (`audit-snapshot.txt`) | **0** | 377 variables: 266 declared and read, 111 declared only, 0 dead |
| Same, `--core-css` on the compiled CSS of the 16.32.0 bench (`audit-1632-live.txt`) | **0** | Identical counts to the snapshot: the scan reproduces the committed snapshot (VERIFIED) |
| Same, `--core-css` on the compiled CSS of the newest bench (`audit-newest.txt`) | **1** | 346 declared and read, 10 declared only, 6 read only, **15 dead** |
| `tools/bench/manifest_selectors.py` (`manifest-selectors.{tsv,md}`, `manifest-names.tsv`) | 1 | 8 manifest rows have a name that is gone from the newest tag |

CSS scanned (`css-scanned-1632.txt`, `css-scanned-newest.txt`): every `*.css` of `sites/assets/frappe/dist/css` and `css-rtl` and of `sites/assets/erpnext/dist/css` and `css-rtl`
(16.32.0: 22 files; newest: 24 files, the new `leaflet.bundle` included). The committed snapshot lists the 11 LTR files of Frappe and ERPNext 16.32.0; RTL files only repeat the variable names.
The audit does not read `frappe-datatable` or `frappe-gantt` CSS (they are bundled inside `desk.bundle`).

## 1. Dead-token audit: the newest tag fails it (VERIFIED, `dead-token-diff.txt`)

16.32.0 against v16.52.0, compiled core CSS:

| | 16.32.0 | v16.52.0 |
|---|---|---|
| Custom properties declared by core | 581 | 1041 |
| Custom properties read (`var(--x)`) by core | 403 | 937 |
| Overridden by this theme and declared-and-read (override takes effect) | 266 | 346 |
| Overridden, declared but never read (inert) | 111 | 10 |
| Overridden, read but not declared by core | 0 | 6 |
| Overridden, in neither (**dead**, audit fails) | 0 | **15** |

123 of the 377 overridden variables change category (list in `dead-token-diff.txt`):

- **15 dead.** Core no longer contains the name anywhere in `frappe/public/{scss,css,js}` (grep of the clone):
  `--neutral-black`, `--surface-white`, `--surface-menu-bar`, `--surface-modal`, `--surface-selected`, `--toast-bg`, `--sidebar-border-color`, `--sidebar-hover-color`, `--sidebar-active-color`,
  `--border-radius-tiny`, `--border-radius-xl` (11 of them were read by core in 16.32.0, so those overrides had an effect there), and `--surface-cards`, `--outline-white`, `--outline-gray-modals`, `--divider-color` (declared but unread in 16.32.0).
- **6 read only** (core still reads the name, no longer declares it; the theme's declaration now defines it): `--invert-neutral`, `--ink-white`, `--border-radius-sm`, `--border-radius`, `--border-radius-md`, `--border-radius-lg`.
- **99 inert in 16.32.0 become effective**: core's components now read `--surface-*`, `--ink-*`, `--outline-*`, the colour ramps (`--amber-*`, `--violet-*`, ...) and `--text-2xs`. The theme already overrides them, so the Dark and Light look will change on those surfaces. Not looked at.
- 3 effective become inert: `--primary-color`, `--shadow-xl`, `--modal-shadow`.

Cause (read in the clone, not inferred): Frappe 16.51 finishes its "Espresso" design-token system. New plain-CSS token files in `frappe/public/css/espresso/` (`colors.css`, `radius.css`, `spacing.css`, `typography.css`, `effects.css`, `legacy.css`, `components/*`); the old names survive only as deprecated aliases in `legacy.css`
(for example `--bg-color: var(--surface-base)`), and the old `--sidebar-*` colours were replaced by `--desk-sidebar-bg` (`scss/desk/sidebar.scss:4-28`). `scss/espresso/_borders.scss` says the `--border-radius-*` names are deprecated aliases whose values follow Espresso. Whether the 15 dead names matter visually: see section 4 for what a site shows.

## 2. Third-party packages whose CSS the theme restyles (VERIFIED, `package.json` of both benches)

| Package | 16.32.0 | v16.52.0 | Effect on this theme |
|---|---|---|---|
| `frappe-datatable` | 1.20.7 | 1.21.2 | Same 17 `--dt-*` variables and the same 26 `.dt-*` classes in `dist/frappe-datatable.css` (compared). No change expected |
| `frappe-gantt` | 0.6.1 | **1.1.0 (major)** | `.today-highlight` is gone (new: `.current-highlight`, `.current-date-highlight`, `.date-range-highlight`, `.upper-header`, `.lower-header`, `.grid-column`, `.holiday-label`, `.side-header` and others); `.grid-header`, `.grid-row`, `.row-line`, `.tick`, `.upper-text`, `.lower-text`, `.bar*` remain. The theme's `.today-highlight` rule (`desk/_gantt.scss:40`) matches nothing |
| `bootstrap`, `quill`, `ace-builds`, `@popperjs/core` | 4.6.2, 2.0.3, ^1.4.8, ^2.11.2 | the same declared versions | none |

## 3. Selector checks of `docs/DEPENDENCY_MANIFEST.md` (COMPUTED by grep and line comparison; `manifest-selectors.md`)

Method (`tools/bench/manifest_selectors.py`, reads files only): every `path:lines` citation of manifest sections 1, 2a to 2h, 4 (round 2 table) and 6 is resolved in the 16.32.0 tree; its lines are compared with the same lines of v16.52.0
(`present`: identical; `moved`: the identical block is on other lines; `changed`: the file exists but the cited text differs; `missing`: the file or the name is gone). In addition, every class, id, `data-` or `aria-` attribute and API name written in the first column is searched in the cited files, then in the whole new tree.
A row takes the worst of its parts. A row is `missing` only when a name from its first column no longer exists anywhere in the new tree; a removed file whose names survive elsewhere counts as `moved`.

| | Present | Moved | Changed | Missing | Unchecked |
|---|---|---|---|---|---|
| Manifest rows (129) | 31 | 45 | 36 | 8 | 9 |
| Names in those rows (273) | 221 | 16 | 0 | 9 | 27 |

Reading guide: `moved` rows are line shifts (the manifest line numbers are stale, the code is there). `changed` rows need a human look: the cited lines were rewritten; the names of the row are still present (otherwise the row would be `missing`).
`unchecked` rows (9) cite things outside the Frappe tree or this theme's own markup: `.ins-banner`, `.ins-appearance`, the ERPNext print-format names (`.items-table`, `.tax-table` present in the sales invoice print format JSON of both ERPNext tags; `.highlight-bg` and `.invoice-page` are in neither), `.ql-editor.ql-blank::before` (quill 2.0.3 in both), the wkhtmltopdf build, and the observed 417 behaviour.

### Names gone from v16.52.0 (the 9 `missing` names, 8 rows)

| Row | Name | What the new tag has instead (read in the clone) |
|---|---|---|
| 2b.2 | `.dropdown-menu-item` | `js/frappe/ui/menu.js` moved to `ui/components/menu.js`; the class is not used any more |
| 2b.3 | `.page-title .title-text` | `ui/page.html` has `.page-title` and `.title-area`; no `.title-text` |
| 2b.8 | `.btn.btn-paging.btn-info` | `ui/listing.html:23` has `.btn-group-paging`; `base_list.js:378` builds `.list-paging-area` without `.btn-paging` |
| 2b.11 | `.desk-alert` | `frappe.show_alert` (`ui/messages.js:430`) no longer uses the class |
| 2c.6 | `.btn-login` (login actions) | `www/login.html` now uses `<button class="es-button ...">` (`btn-ldap-login`, `btn-login-option`, `btn-forgot`, ... remain as extra classes) |
| 2c.7 | `.forgot-password-message` | not present |
| 2c.12 | `.password-strength-bar-track` | `www/update-password.html:41` has `.password-strength-indicator` and `.password-strength-value` |
| 2e.9 | `.callout-warning`, `.verification-code` (email) | not in `email.bundle.scss` or the email templates |

### Notable `changed` and `moved` rows

- **Login page (rows 2c.4 to 2c.12):** `scss/login.bundle.scss` is 181 lines (542 in 16.32.0), the page uses Espresso `es-button` components, and the cited lines of `www/login.html` are rewritten. Every login rule of this theme needs a visual check before the range is raised.
- **Sidebar (2b.1, 2d.7):** `scss/desk/sidebar.scss` was rewritten (`.body-sidebar-container` now at `:39`; sidebar colour variables replaced, see section 1). `ui/sidebar/sidebar.js` line 389 is now at 515.
- **Removed SCSS files:** `scss/desk/menu.scss`, `scss/desk/breadcrumb.scss`, `scss/desk/toast.scss`. The names they held (`.navbar-breadcrumbs` in `list.scss`, `mobile.scss`, `page.html`) survive except `.dropdown-menu-item` and `.desk-alert`.
- **List (2b.5):** `list_view.js` lines shifted by about 500 (771 to 1266, 825 to 1322, 1025 to 1535); `list.scss` rewritten around `.list-row`.
- **Form errors (2d.2, 2g.1):** `base_input.js:258-286` now sets `has-error` only after the primary action was attempted and adds `has-error-mandatory` and `has-error-invalid`. `field_errors.js` (`aria-invalid` on `has-error`) keeps working but flags fields later than in 16.32.0.
- **Hooks and events still found in the newest tag** (section 1 of the manifest, VERIFIED by grep): `www/desk.py:68-69` (`app_include_js`, `app_include_css`), `migrate.py:210` (`after_migrate`), `installer.py:374-375` and `:459-460` (`after_install`, `before_uninstall`), `base_template_page.py:71-73` (`update_website_context`), `sessions.py:170` (`extend_bootinfo`), `email/email_body.py:479` (`email_css`), `utils/jinja.py:252` (`jinja`), `hooks.py:109` (`pdf_generator`), `form.js:670` (`form-refresh`), `views/container.js:86` (`page-change`).
  Run: the app installed, checked and uninstalled on a site of the newest bench (section 4).

## 4. The theme installed on a site of the newest bench (VERIFIED by running it; `site/`)

`tools/bench/fresh_install.sh site-frappe` against `/home/frappe/newest-bench` (Frappe v16.52.0, web on 8011, own Redis), site `newest.test`, Frappe only, the app from `build/midad-v1`. `site/commands.tsv` and `site/logs/`; all 31 steps exit 0.

| Check | Result |
|---|---|
| `install-app`, `build --app`, second `install-app`, two `migrate` runs | exit 0 each; "already installed" the second time |
| Login page and signed-in `/desk` link `ins_web`, `ins_desk`, `ins_shell` bundles, all served | pass (`site/verify-newest.test-installed.txt`) |
| `uninstall-app` (prompt answered, backup taken) | exit 0; Phase 0 gate residue checks `none`; row count of every table before and after: `RESIDUE: none` (`site/logs/newest.test-residue-*.log`) |
| After uninstall, login and `/desk` link no `ins_` bundle | pass |
| Screenshots stock / installed / after uninstall (`site/shots-newest.test/`) | after uninstall equals stock (login 0 pixels, todo 2 pixels, delta 1); installed differs from stock in 78 percent (login) and 26 percent (todo) of pixels |

So install, build, migrate and uninstall work on v16.52.0 with no change to the app. What the installed screenshots show (read from `installed-login.png` and `installed-todo.png`, compared with the 16.32.0 screenshots in `docs/team/evidence/round3/fresh-install/branch/shots-fresh.test/`; OBSERVED, not measured):

- The desk is a different shell (a rail of app icons and a tree sidebar, no workspace header). The theme's fonts, colours, radii and the brass active mark in the sidebar still apply.
- **The primary button is near-black, not the theme's Prussian ink**, on the login page (`Continue`) and in the desk (`Add ToDo`). Core's new `es-button` components do not take the colour the theme sets on `.btn-primary` and `--primary-color` (now inert, section 1).
- **The login inputs have no field icons** (an empty gap where the envelope and lock were) and "Forgot password?" is grey instead of the link colour: rows 2c.6 and 2c.7 of the manifest.

None of this was fixed: the supported range is unchanged (ADR 0001 D1). It is the work list for raising it.

## Not done

- Dark mode, Arabic and the P0 screens on the newest tag: only the two English screens above were looked at.
- A computed-style comparison on the newest tag (the cascade check `tests/browser/cascade.mjs` was not run against it).
- HRMS against a newer tag.
- The `changed` rows were not read one by one; they are listed in `manifest-selectors.md` with the old and new line numbers.

## Files

`audit-snapshot.txt`, `audit-1632-live.txt`, `audit-newest.txt`, `audit-exit-codes.tsv`, `dead-token-diff.txt`, `manifest-selectors.md`, `manifest-selectors.tsv`, `manifest-names.tsv`, `css-scanned-*.txt`, `newest-css-files.txt`, `tags.env`, `frappe-newest.commit`, `commands.tsv`, `run.log`, the bench logs, `get-app-theme.log`, `build-theme.log`, `theme-commit.txt`, and `site/`.

## Appendix: every name checked (273), from `manifest-names.tsv`

`present` = in the cited file or, where the manifest cites no file, somewhere in the tag. `moved` = not in the cited file, found elsewhere (some are theme-owned attributes or generic words that happen to occur elsewhere: `aria-invalid`, `aria-labelledby`, `py`, `text-left`, `border-left`). `missing` = gone. `unchecked` = not in 16.32.0 source either.

| Manifest row | Name | State | Where |
|---|---|---|---|
| 1.1 | `app_include_css` | present | in the cited file |
| 1.2 | `app_include_js` | present | in the cited file |
| 1.3 | `web_include_css` | present | no source line cited; found in frappe/hooks.py |
| 1.4 | `web_include_js` | present | no source line cited; found in frappe/translate.py |
| 1.5 | `update_website_context` | present | in the cited file |
| 1.6 | `extend_bootinfo` | present | in the cited file |
| 1.7 | `doc_events` | present | in the cited file |
| 1.7 | `on_update` | present | in the cited file |
| 1.8 | `after_migrate` | present | in the cited file |
| 1.9 | `before_uninstall` | present | in the cited file |
| 1.10 | `doc_events` | present | in the cited file |
| 1.10 | `on_update` | present | in the cited file |
| 1.12 | `after_install` | present | in the cited file |
| 1.13 | `email_css` | present | in the cited file |
| 2a.1 | `indicator-pill` | present | in the cited file |
| 2a.2 | `control-label` | present | in the cited file |
| 2a.2 | `reqd` | present | in the cited file |
| 2a.3 | `like-disabled-input` | present | in the cited file |
| 2a.4 | `form-tabs-list` | present | in the cited file |
| 2a.4 | `form-tabs` | present | in the cited file |
| 2a.4 | `nav-item` | present | in the cited file |
| 2a.4 | `nav-link` | present | in the cited file |
| 2a.5 | `form-message` | present | in the cited file |
| 2a.6 | `form-links` | present | in the cited file |
| 2a.6 | `document-link` | present | in the cited file |
| 2a.7 | `form-section` | present | in the cited file |
| 2a.7 | `section-head` | present | in the cited file |
| 2a.8 | `fc-event-main-frame` | present | in the cited file |
| 2a.8 | `fc-daygrid-dot-event` | present | in the cited file |
| 2a.9 | `btn` | present | in the cited file |
| 2a.9 | `btn-primary` | present | in the cited file |
| 2a.9 | `btn-secondary` | present | in the cited file |
| 2a.10 | `btn` | present | in the cited file |
| 2a.10 | `btn-default` | present | in the cited file |
| 2a.11 | `modal` | present | in the cited file |
| 2a.11 | `form-in-grid` | present | in the cited file |
| 2a.12 | `grid-body` | present | in the cited file |
| 2a.12 | `editable-row` | present | in the cited file |
| 2a.13 | `chart-container` | present | in the cited file |
| 2a.14 | `new-timeline` | present | no source line cited; found in frappe/public/js/frappe/form/footer/base_timeline.js |
| 2a.14 | `timeline-item` | present | no source line cited; found in frappe/public/js/frappe/form/footer/base_timeline.js |
| 2a.15 | `switch-control` | present | in the cited file |
| 2a.16 | `rating` | present | no source line cited; found in frappe/public/js/form_builder/components/controls/RatingControl.vue |
| 2a.17 | `get_textstyle` | present | in the cited file |
| 2a.18 | `modal` | present | no source line cited; found in frappe/public/js/frappe/form/form_tour.js |
| 2b.1 | `body-sidebar-container` | present | in the cited file |
| 2b.1 | `body-sidebar` | present | in the cited file |
| 2b.1 | `standard-sidebar-item` | present | in the cited file |
| 2b.1 | `active-sidebar` | present | in the cited file |
| 2b.1 | `item-anchor` | present | in the cited file |
| 2b.1 | `sidebar-item-label` | present | in the cited file |
| 2b.2 | `dropdown-menu-item` | missing | gone from 16.52.0 (was in frappe/public/js/frappe/ui/menu.js) |
| 2b.3 | `page-head` | present | in the cited file |
| 2b.3 | `page-title` | present | in the cited file |
| 2b.3 | `title-text` | missing | gone from 16.52.0 (was in frappe/public/js/frappe/ui/page.js) |
| 2b.4 | `navbar-breadcrumbs` | present | in the cited file |
| 2b.5 | `list-row` | present | in the cited file |
| 2b.5 | `list-row-head` | present | in the cited file |
| 2b.5 | `level-left` | present | in the cited file |
| 2b.5 | `list-subject` | present | in the cited file |
| 2b.5 | `level-right` | present | in the cited file |
| 2b.5 | `list-row-checkbox` | present | in the cited file |
| 2b.6 | `frappe-list` | present | in the cited file |
| 2b.6 | `result-container` | present | in the cited file |
| 2b.7 | `msg-box` | present | in the cited file |
| 2b.8 | `list-paging-area` | present | in the cited file |
| 2b.8 | `btn-group` | present | in the cited file |
| 2b.8 | `btn` | present | in the cited file |
| 2b.8 | `btn-paging` | missing | gone from 16.52.0 (was in frappe/public/js/frappe/list/base_list.js) |
| 2b.8 | `btn-info` | present | in the cited file |
| 2b.9 | `datatable` | present | in the cited file |
| 2b.9 | `dt-cell__content` | present | in the cited file |
| 2b.9 | `dt-header` | present | in the cited file |
| 2b.9 | `dt-cell--header` | present | in the cited file |
| 2b.9 | `dt-row-header` | present | in the cited file |
| 2b.9 | `dt-row` | present | in the cited file |
| 2b.9 | `dt-cell` | present | in the cited file |
| 2b.9 | `dt-row-totalRow` | present | in the cited file |
| 2b.9 | `dt-scrollable` | present | in the cited file |
| 2b.10 | `grid-heading-row` | present | in the cited file |
| 2b.10 | `grid-row` | present | in the cited file |
| 2b.10 | `grid-empty` | present | in the cited file |
| 2b.10 | `form-grid` | present | in the cited file |
| 2b.10 | `grid-body` | present | in the cited file |
| 2b.10 | `rows` | present | in the cited file |
| 2b.11 | `modal-content` | moved | not in the cited file; now in frappe/public/js/frappe/form/form_tour.js |
| 2b.11 | `freeze` | present | in the cited file |
| 2b.11 | `in` | present | in the cited file |
| 2b.11 | `freeze-message-container` | present | in the cited file |
| 2b.11 | `dropdown-menu` | present | in the cited file |
| 2b.11 | `popover` | present | in the cited file |
| 2b.11 | `tooltip-content` | present | in the cited file |
| 2b.11 | `desk-alert` | missing | gone from 16.52.0 (was in frappe/public/js/frappe/ui/messages.js) |
| 2b.11 | `awesomplete` | moved | not in the cited file; now in frappe/public/js/frappe/data_import/import_preview.js |
| 2b.12 | `datepicker` | present | no source line cited; found in frappe/public/js/controls.bundle.js |
| 2b.13 | `widget` | present | in the cited file |
| 2b.13 | `number-widget-box` | present | in the cited file |
| 2b.13 | `shortcut-widget-box` | present | in the cited file |
| 2b.13 | `links-widget-box` | present | in the cited file |
| 2b.13 | `widget-title` | present | in the cited file |
| 2b.13 | `link-item` | present | in the cited file |
| 2b.13 | `number` | present | in the cited file |
| 2c.1 | `data-path` | present | in the cited file |
| 2c.1 | `banner_html` | present | in the cited file |
| 2c.1 | `body_include` | present | in the cited file |
| 2c.2 | `page-content-wrapper` | present | in the cited file |
| 2c.3 | `page_content` | present | in the cited file |
| 2c.4 | `for-login` | present | in the cited file |
| 2c.4 | `page-card` | present | in the cited file |
| 2c.4 | `for-forgot` | present | in the cited file |
| 2c.4 | `for-login-with-email-link` | present | in the cited file |
| 2c.4 | `for-signup` | present | in the cited file |
| 2c.4 | `for-email-login` | present | in the cited file |
| 2c.4 | `for-reset-password` | present | in the cited file |
| 2c.5 | `page-card` | present | in the cited file |
| 2c.5 | `form-group` | present | in the cited file |
| 2c.6 | `page-card-actions` | present | in the cited file |
| 2c.6 | `btn-login` | missing | gone from 16.52.0 (was in frappe/public/scss/login.bundle.scss) |
| 2c.6 | `btn-ldap-login` | present | in the cited file |
| 2c.6 | `btn-signup` | moved | not in the cited file; now in frappe/templates/includes/login/login.js |
| 2c.6 | `btn-login-option` | present | in the cited file |
| 2c.7 | `page-card-body` | present | in the cited file |
| 2c.7 | `form-label` | moved | not in the cited file; now in frappe/templates/includes/comments/comments.html |
| 2c.7 | `field-icon` | moved | not in the cited file; now in frappe/templates/styles/card_style.css |
| 2c.7 | `email-field` | present | in the cited file |
| 2c.7 | `password-field` | present | in the cited file |
| 2c.7 | `toggle-password` | present | in the cited file |
| 2c.7 | `forgot-password-message` | missing | gone from 16.52.0 (was in frappe/public/scss/login.bundle.scss) |
| 2c.7 | `login-error-banner` | moved | not in the cited file; now in frappe/templates/includes/login/login.js |
| 2c.7 | `login-success-banner` | moved | not in the cited file; now in frappe/templates/includes/login/login.js |
| 2c.7 | `field-error` | present | in the cited file |
| 2c.7 | `invalid` | present | in the cited file |
| 2c.8 | `sign-up-message` | present | in the cited file |
| 2c.9 | `page-card-head` | present | in the cited file |
| 2c.9 | `app-logo` | present | in the cited file |
| 2c.9 | `page-card-subtitle` | present | in the cited file |
| 2c.10 | `invalid-login` | present | in the cited file |
| 2c.11 | `twofactor_div` | present | in the cited file |
| 2c.11 | `form-verify` | present | in the cited file |
| 2c.11 | `login_token` | present | in the cited file |
| 2c.11 | `verify_token` | present | in the cited file |
| 2c.11 | `text-muted` | present | in the cited file |
| 2c.12 | `for-reset-password` | present | in the cited file |
| 2c.12 | `password-strength-bar-track` | missing | gone from 16.52.0 (was in frappe/public/scss/login.bundle.scss) |
| 2c.13 | `error-page` | present | in the cited file |
| 2c.13 | `details` | present | in the cited file |
| 2c.13 | `error-content` | present | in the cited file |
| 2c.13 | `btn-primary` | present | in the cited file |
| 2d.1 | `fc-event` | present | in the cited file |
| 2d.1 | `fc-event-main` | present | in the cited file |
| 2d.1 | `fc-daygrid-dot-event` | present | in the cited file |
| 2d.2 | `frappe-control` | present | in the cited file |
| 2d.2 | `has-error` | present | in the cited file |
| 2d.2 | `control-input` | present | in the cited file |
| 2d.2 | `data-fieldtype` | present | in the cited file |
| 2d.3 | `tree-children` | present | in the cited file |
| 2d.3 | `tree-label` | present | in the cited file |
| 2d.3 | `tree-node-toolbar` | present | in the cited file |
| 2d.4 | `gantt` | present | in the cited file |
| 2d.4 | `grid-header` | present | in the cited file |
| 2d.4 | `grid-row` | present | in the cited file |
| 2d.4 | `row-line` | present | in the cited file |
| 2d.4 | `tick` | present | in the cited file |
| 2d.4 | `today-highlight` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.4 | `upper-text` | present | in the cited file |
| 2d.4 | `lower-text` | present | in the cited file |
| 2d.4 | `bar-progress` | present | in the cited file |
| 2d.5 | `gantt-container` | present | in the cited file |
| 2d.6 | `main-section` | present | in the cited file |
| 2d.7 | `body-sidebar` | present | in the cited file |
| 2d.7 | `body-sidebar-container` | present | in the cited file |
| 2d.7 | `expanded` | present | in the cited file |
| 2d.8 | `page-head` | present | in the cited file |
| 2d.12 | `ace_editor` | present | in the cited file |
| 2d.13 | `ace-tomorrow` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_keyword` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_storage` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_meta` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_tag` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_tag-name` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_string` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_regexp` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_constant` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_numeric` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_comment` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_variable` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_support` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_entity` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_marker-layer` | moved | not in the cited file; now in frappe/public/scss/common/controls.scss |
| 2d.13 | `ace_selection` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_cursor` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_invisible` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.13 | `ace_indent-guide` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.14 | `ql-editor` | present | in the cited file |
| 2d.14 | `ql-blank` | present | in the cited file |
| 2d.16 | `dt-instance-N` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2d.16 | `dt-cell` | moved | not in the cited file; now in frappe/public/js/frappe/data_import/import_preview.js |
| 2d.16 | `dt-row` | moved | not in the cited file; now in frappe/public/js/frappe/data_import/import_preview.js |
| 2d.17 | `level-item` | present | in the cited file |
| 2e.1 | `print-format` | present | in the cited file |
| 2e.1 | `print-heading` | present | in the cited file |
| 2e.1 | `sub-heading` | present | in the cited file |
| 2e.1 | `page-break` | present | in the cited file |
| 2e.1 | `letter-head` | present | in the cited file |
| 2e.1 | `letter-head-footer` | moved | not in the cited file; now in frappe/public/html/print_template.html |
| 2e.3 | `data-field` | present | in the cited file |
| 2e.3 | `data-fieldname` | present | in the cited file |
| 2e.4 | `table` | present | in the cited file |
| 2e.4 | `table-bordered` | present | in the cited file |
| 2e.5 | `items-table` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2e.5 | `tax-table` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2e.5 | `highlight-bg` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2e.5 | `invoice-page` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2e.6 | `text-right` | present | in the cited file |
| 2e.6 | `text-left` | moved | not in the cited file; now in frappe/public/css/bootstrap.css |
| 2e.9 | `body-table` | present | in the cited file |
| 2e.9 | `email-container` | present | in the cited file |
| 2e.9 | `email-masthead` | present | in the cited file |
| 2e.9 | `email-title-cell` | present | in the cited file |
| 2e.9 | `email-body-cell` | present | in the cited file |
| 2e.9 | `email-footer-cell` | present | in the cited file |
| 2e.9 | `filled` | present | in the cited file |
| 2e.9 | `email-footer-container` | present | in the cited file |
| 2e.9 | `email-header-title` | present | in the cited file |
| 2e.9 | `brand-name` | present | in the cited file |
| 2e.9 | `btn` | present | in the cited file |
| 2e.9 | `table` | present | in the cited file |
| 2e.9 | `callout-warning` | missing | gone from 16.52.0 (was in frappe/public/scss/email.bundle.scss) |
| 2e.9 | `verification-code` | missing | gone from 16.52.0 (was in frappe/public/scss/email.bundle.scss) |
| 2e.9 | `indicator-` | present | in the cited file |
| 2e.10 | `border-left` | present | no source line cited; found in frappe/public/css/bootstrap.css |
| 2e.11 | `border-top` | present | no source line cited; found in frappe/public/css/bootstrap.css |
| 2e.11 | `margin-right` | present | no source line cited; found in frappe/public/css/bootstrap.css |
| 2e.11 | `border-right-width` | present | no source line cited; found in frappe/public/css/bootstrap.css |
| 2e.12 | `items-table` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2f.2 | `page-content-wrapper` | present | in the cited file |
| 2f.2 | `container` | present | in the cited file |
| 2f.2 | `page_content` | present | in the cited file |
| 2f.2 | `data-doctype` | present | in the cited file |
| 2f.2 | `web-form-introduction` | present | in the cited file |
| 2f.2 | `success-title` | present | in the cited file |
| 2f.2 | `success-message` | present | in the cited file |
| 2f.4 | `empty-apps-state` | present | in the cited file |
| 2f.5 | `no-result` | present | in the cited file |
| 2f.6 | `text_align` | present | in the cited file |
| 2f.7 | `page-card-head-text` | present | in the cited file |
| 2f.7 | `page-card-subtitle` | present | in the cited file |
| 2g.1 | `aria-invalid` | moved | not in the cited file; now in frappe/public/css/espresso/components/button.css |
| 2g.2 | `title` | present | no source line cited; found in frappe/public/js/frappe/views/communication.js |
| 2g.3 | `info-text` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 2h.1 | `aria-labelledby` | moved | not in the cited file; now in frappe/public/js/frappe/form/tab.js |
| 2h.2 | `like-action` | present | in the cited file |
| 2h.3 | `modal` | present | in the cited file |
| 2h.3 | `fade` | present | in the cited file |
| 2h.3 | `modal-dialog` | present | in the cited file |
| 4.4 | `text-muted` | present | no source line cited; found in frappe/public/js/frappe/ui/page.js |
| 6.1 | `after_commit` | present | in the cited file |
| 6.2 | `get_logged_user` | present | in the cited file |
| 6.4 | `session_expiry` | present | in the cited file |
| 6.4 | `py` | moved | not in the cited file; now in frappe/public/js/frappe/ui/sidebar/sidebar.js |
| 6.6 | `is_online` | present | in the cited file |
| 6.8 | `page-change` | present | in the cited file |
| 6.9 | `masked_fields` | present | in the cited file |
| 6.10 | `before_insert` | present | in the cited file |
| 6.10 | `validate_disabled_and_default` | present | in the cited file |
| 6.15 | `ins_identity` | unchecked | not in 16.32.0 source either (this theme's own name, or a description) |
| 6.16 | `get_chrome_pdf` | present | in the cited file |
| 6.18 | `get_print` | present | no source line cited; found in frappe/__init__.py |
| 6.18 | `pdf_generator` | present | no source line cited; found in frappe/hooks.py |
| 6.19 | `py` | present | no source line cited; found in frappe/public/js/frappe/ui/sidebar/sidebar.js |
| 6.20 | `web_include_js` | present | in the cited file |
| 6.21 | `data-path` | present | in the cited file |
| 6.22 | `text-muted` | moved | not in the cited file; now in frappe/public/js/frappe/ui/page.js |
