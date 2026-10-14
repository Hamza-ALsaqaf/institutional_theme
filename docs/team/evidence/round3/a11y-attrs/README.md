# Accessible-name attributes written by the shell script (round 3, wave 2)

Code: `institutional_theme/public/js/shell/a11y_rules.js` (what each rule writes) and `a11y_names.js` (the observer), started from `institutional_theme/public/js/ins_shell.bundle.js` as `initA11yNames`. Attributes only: `aria-label`, `aria-labelledby` (through the existing `field_labels.js`), `role="presentation"`, `alt=""`. No node is added, moved or removed, no core class or function is touched, no network call, no inline script.

Test: `tests/browser/a11y_attrs.mjs` (checks and accessibility-tree snapshots, English and Arabic, Light), output in this folder: `results.md` (62 checks, 0 failed, VERIFIED), `<lang>-<screen>.aria.yml` (Playwright `ariaSnapshot`), `timing.json`. Run: `cd tests/browser && PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH=/opt/pw-node/node_modules node a11y_attrs.mjs` (exit 0). Local CI: `ci-2.log` (CI PASSED).

## Rules

A name is written only onto an empty attribute or onto a value this module wrote itself (so a changed tooltip or a toggled state is followed, and a name core or an administrator sets always wins). Checked live: a custom `aria-label` on an icon button and on a dialog control is kept (`results.md`, "late insertion").

| Element (selector) | Written | Source of the name |
|---|---|---|
| `ul[role=tablist] > li.nav-item` (form tabs; the icon picker uses the same markup and the same selector, not exercised) | `role="presentation"` | fixes `listitem`, `aria-required-parent`, and the form-tab part of `aria-required-children` |
| `.navbar-breadcrumbs > li:first-child > a` when it has no text | `aria-label` | `__("Home")` (core string) |
| `.sidebar-header .header-logo > img` | `alt=""` | decorative: the app title is the adjacent text (written only when the title is not empty) |
| `.onb-title-icon > img` | `alt=""` | decorative: the panel title is adjacent text |
| `.sidebar-header > button.drop-icon` | `aria-label` | `__("Menu")`: the header opens the app-switcher menu |
| `.item-anchor > .sidebar-item-control > button.drop-icon` | `aria-label` | `Collapse {0}` or `Expand {0}` with the row's own label, state from `data-state` (core's `toggle()`), else the chevron |
| any `button` with an icon and no text: tooltip | `aria-label` | `data-original-title` or `title`: reload list/report, previous and next document, Edit and Print in the form sidebar, and every other button with a tooltip |
| `.btn-modal-close`, `.onb-header-actions > button:last-child` | `aria-label` | `__("Close")` |
| `.scroll-to-top` | `aria-label` | `__("Scroll to top")` |
| `.add-assignment-btn`, `.add-attachment-btn`, `.share-doc-btn`, `.add-tags-btn` | `aria-label` | `__("Assign")`, `__("Add Attachment")`, `__("Share")`, `__("Add Tags")` |
| `.card-description-btn` | `aria-label` | `__("Description")` (opens a popover with the description) |
| `.match-type-dropdown-btn` | `aria-label` | `__("Match type")` (dropdown with Equals and Like) |
| `.chart-menu`, and the ellipsis button in `.page-icon-group` | `aria-label` | `__("Menu")` (both open a menu) |
| `.onb-header-actions > button:first-child` | `aria-label` | `__("Minimize")` (toggles the panel) |
| `input.list-row-checkbox` | `aria-label` | `__("Select {0}", [row title])`, with the document name added in brackets when it differs from the title (two rows can share a title), else the name, else `Select row` |
| `.dt-cell input[type=checkbox]` (report view) | `aria-label` | `Select all rows` in the header cell, `Select row {n}` from `data-row-index + 1` |
| `textarea.dt-paste-target` | `aria-label` | `__("Paste into table")` |
| `input.dt-filter` without a title | `aria-label` | `__("Filter", null, "Column filter")`; the other column filters keep core's `Filter based on {column}` |
| `.filter-box select.condition` | `aria-label` | `__("Condition", null, "Filter")` |
| `.filter-box .fieldname-select-area input` | `aria-label` | `__("Field")` |
| `.filter-box .filter-field input/select/textarea` | `aria-label` | `__("Value")` (not written when the control has a title or sits in a `label`) |
| `.modal .frappe-control` (dialogs) | `aria-labelledby` + `id` on the label | the visible label, through `labelWrapper` of `field_labels.js` |

Left alone, with the reason:

- `.list-check-all` (list select-all): core gives it `title="Select All"` (`list/list_view.js:760,827`), which is a name; adding `aria-label` would replace it.
- `.btn-modal-minimize` (hidden by default, `hide` class): not reachable; not named.
- Global search results and notification tabs: see `../axe-rescan/README.md` (attribute-only fixes would swap one violation for another or promise behaviour core lacks).
- `a[aria-haspopup]` in `.card-actions` (workspace card menu): not focusable; the real fix is markup.
- Child-table checkboxes: already done by `grid_names.js`.

## Observer scope and cost

- One `MutationObserver` on `document.body` with `childList` and `subtree`, plus `attributes` limited by `attributeFilter` to `data-original-title`, `title` and `data-state`. Attribute records are looked at only for `button` targets. Added nodes (the node and its descendants, one `querySelectorAll` with the union selector) are queued in a Set and processed once per animation frame; a disconnected node is dropped. The document is scanned once at start (the body, in one animation frame); never again as a whole.
- Writes happen only when the value changes (`setAttr`). The attributes written are not in the filter, so the observer does not trigger itself.
- Measured (`timing.json`, VERIFIED on this runner, 2 shared vCPUs): inserting 1500 synthetic list rows (7500 elements, 3000 attribute writes) in one go takes 18.8 ms to insert and 289 to 300 ms until the second frame with the script, 260 to 270 ms without it (the browser's own layout): about 25 to 30 ms for the whole batch, once. A normal list page (20 rows) is a fraction of that (inferred from the batch, not measured separately).
- Bundle size: `ins_shell.bundle.js` 19.3 KB minified (budget 24 KB, `docs/audits/budgets.txt`).
- Virtual scrolling of the report view (`/desk/doctype/view/report`, rows recycled by frappe-datatable): after three scroll positions every visible row checkbox carries the label of its current `data-row-index` (VERIFIED, both languages).

## Selectors depended on (Frappe 16.32.0, `frappe/public/js/frappe/` unless noted)

- Form tabs: `form/tab.js:31` (`li.nav-item`), `:36` (`role="tab"`), `form/layout.js:46` (`ul#form-tabs[role=tablist]`), `icon_picker/icon_picker.js:61-68` (same pattern).
- Breadcrumb home: `views/breadcrumbs.js:281-282` (`.navbar-breadcrumbs`, first link to `/desk` with the home icon).
- Sidebar header: `ui/sidebar/sidebar_header.html:3-4` (`.header-logo`), `:17` (`button.drop-icon.show-in-edit-mode`), `ui/sidebar/sidebar_header.js:334-340` (`create_menu` on the header wrapper).
- Sidebar section toggle: `ui/sidebar/sidebar_item.js:207-218` (`toggle`, `data-state`, chevron), `:245-256` (`button.btn-reset.drop-icon` in `.sidebar-item-control`), `:285-287` (a click on the row toggles it); label from `.sidebar-item-label` in the same `.item-anchor`.
- Icon buttons with tooltips: `ui/page.js:224-246` (`add_action_icon`: `button.icon-btn`, `title` moved to `data-original-title` by Bootstrap's tooltip), `list/base_list.js:244-251` (reload), `views/reports/query_report.js:94`, `form/toolbar.js:205,338-352` (edit, previous, next), `form/sidebar/form_sidebar.js:92` (print), `views/workspace/workspace.js:220` (ellipsis menu button, tooltip removed).
- Class-named buttons: `dom.js:354` (`.btn-modal-close`), `form/templates/form_footer.html:6` (`.scroll-to-top`), `form/templates/form_sidebar.html:92,108,136` (assign, attach, share), `ui/tags.js:21` (`.add-tags-btn`), `widgets/links_widget.js:31` (`.card-description-btn`), `list/base_list.js:1310` (`.match-type-dropdown-btn`), `widgets/chart_widget.js:511` (`.chart-menu`), `ui/user_onboarding/OnboardingPanel.vue:237-238,248-250` (header actions and title icon).
- List checkboxes: `list/list_view.js:1334-1336` (checkbox and subject link in the same `.list-subject`), `:2706` (`create_checkbox_element`), `:2746` (link element carries `data-name` and the title).
- Datatable (`apps/frappe/node_modules/frappe-datatable/src/`): `datamanager.js:387,624` (`<input type="checkbox" />` in column 0), `datatable.js:126` (`textarea.dt-paste-target`), `cellmanager.js:153-157` (paste), header cells `data-is-header`, filter cells `data-is-filter`, row cells `data-row-index` (read on the live DOM).
- Filters: `ui/filters/edit_filter.html:10` (`select.condition`), `:15` (`.filter-field`), `ui/filters/filter.js:106` (`.fieldname-select-area`), `:300-303` (value control, `only_input: true`).
- Dialogs: `dom.js:341-359` (`.modal`, `.modal-body`), `form/controls/base_input.js:24` (`label.control-label`, no `for`), handled by `field_labels.js`.

## Strings

Source strings used and where Arabic comes from.

New rows added to `institutional_theme/translations/ar.csv` (alphabetical block, the file's conventions; the scribe may refine the Arabic):

| source | context | Arabic |
|---|---|---|
| Collapse {0} | | طيّ {0} |
| Condition | Filter | الشرط |
| Expand {0} | | توسيع {0} |
| Filter | Column filter | تصفية |
| Match type | | نوع المطابقة |
| Minimize | | تصغير |
| Paste into table | | لصق في الجدول |
| Scroll to top | | العودة إلى الأعلى |

Contexts are used for `Condition` and `Filter` because core already translates the bare words (`Condition` as "الحالة", "status"; `Filter` as "منقي"), and a theme row without a context would change them everywhere in the desk. `frappe._()` looks up `source:context` first and falls back to the bare source.

Already translated, not duplicated: by this app (`ar.csv`): `Select all rows`, `Select row`, `Select row {0}`. By core (`frappe/locale/ar.po`): `Select {0}` (حدد {0}), `Menu` (الخيارات), `Close` (أغلق), `Home` (الصفحة الرئيسية), `Description` (وصف), `Field` (حقل), `Value` (القيمة), `Assign` (عين), `Share` (مشاركة), `Add Attachment` (إضافة مرفق), `Add Tags` (إضافة وسوم). The accessibility tree shows these in Arabic (`ar-*.aria.yml`). Two core renderings are weak (`Assign` as "عين", `Collapse`/`Expand` as "انهيار"/"وسعت", which is why `Collapse {0}` and `Expand {0}` are new strings); the scribe may add a context row for `Assign`.

## Not done

Dark mode and the Light/Dark difference are not relevant to these attributes (they do not depend on the mode); only Light was run. Tablet and mobile widths were not run. A screen reader was not run: names are checked in the accessibility tree that Chromium builds (`ariaSnapshot`), which is what screen readers read, but not through NVDA, JAWS or VoiceOver.
