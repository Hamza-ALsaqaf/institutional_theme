# axe-core violations that come from core markup (Frappe 16.32.0, ERPNext 16.33.0)

Source of the list: `summary.md` and `classified.json` in this directory (axe-core 4.13.0, tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa; P0 desk screens and the three logged-out pages; Arabic and English; Light and Dark).
Proof of origin (VERIFIED): the same screens were scanned a second time with every `/assets/institutional_theme/**` request aborted (`page.route`), which is the stock Frappe look. A violation is listed here only when the same rule fired on the same selector, screen, language and mode in that run. The file:line references are to the Frappe 16.32.0 checkout in `/home/frappe/frappe-bench/apps/frappe/frappe/` and explain the cause; the counts are axe nodes summed over the four language-mode runs (one node can repeat on several screens).
"Theme can fix" says whether the theme can remove the violation without editing core: by CSS, or by an attribute written from `public/js/shell/` (attributes only, no DOM restructuring). It is a recommendation, not something done.

| # | Rule (impact) | Nodes | Where | Cause in core | Theme can fix |
|---|---|---|---|---|---|
| 1 | `listitem` (serious) | 276 | form tabs, global search results, notifications | `form/tab.js:31` writes `<li class="nav-item">` inside `<ul role="tablist">` (`form/layout.js:46`); the `li` loses its list semantics and holds a `role="tab"` button | yes: `role="presentation"` on each `li.nav-item` |
| 2 | `aria-required-parent` (critical) | 56 | form tabs | the `role="tab"` buttons (`form/tab.js:36`) have an `li` between them and the `tablist` | yes, same attribute as 1 |
| 3 | `aria-required-children` (critical) | 24 | `#form-tabs`, notifications tabs, search `ul[role=listbox]` | `tablist` whose children are `li` (as above); `awesomplete` list and `.notifications-list[role=menu]` have no required children while empty or while holding anchors | tabs yes (as 1); awesomplete and menu no |
| 4 | `label` (critical) | 260 | list and report row checkboxes, filter value inputs | `list/list_view.js:2706` `create_checkbox_element` adds no name; datatable header checkbox is `<input type="checkbox" />` (`node_modules/frappe-datatable/src/datamanager.js:387,624`); filter value `input[role=combobox]` has no label | yes: `aria-label` on `.list-row-checkbox`, datatable checkboxes and filter inputs |
| 5 | `button-name` (critical) | 258 | icon-only buttons everywhere | `btn-reset drop-icon` (`ui/sidebar/sidebar_item.js:252`, `sidebar_header.html:17`), `match-type-dropdown-btn` (`list/base_list.js:1310`), `card-description-btn` (`widgets/links_widget.js:31`), `btn-modal-close` (`dom.js:354`), form footer and sidebar `icon-btn` buttons (`form/templates/form_footer.html:6`, `form_sidebar.html:92,108,136`), `prev-doc`/`next-doc` (`form/toolbar.js:343`), reload buttons (`list/base_list.js:250`). The label sits in `data-original-title` (Bootstrap tooltip moves `title`), which is not an accessible name | yes: `aria-label` copied from `data-original-title`/`title`; `Close` for `.btn-modal-close` |
| 6 | `link-name` (serious) | 44 | breadcrumb home link `a[href$="desk"]` | `views/breadcrumbs.js:282` appends an icon-only link | yes: `aria-label` |
| 7 | `image-alt` (critical) | 40 | sidebar header `.header-logo > img` | `ui/sidebar/sidebar_header.html:3-4` inserts the app icon without `alt` | yes: `alt=""` (decorative) |
| 8 | `select-name` (critical) | 12 | filter condition `select.condition`, dialog Select fields | `ui/filters/edit_filter.html:10` has no label; the dialog `select` control label is not associated | yes: `aria-label`, `aria-labelledby` |
| 9 | `meta-viewport` (moderate) | 48 | every desk page | `www/desk.html:14-15`: `maximum-scale=1.0, minimum-scale=1.0, user-scalable=no` blocks zoom | no (needs a core edit) |
| 10 | `target-size` (serious, WCAG 2.2) | 16 | desktop (apps) screen | `.desktop-icon` anchors (`ui/desktop_icon.html:1`) are inline links with `style="text-decoration:none"` and less than 24 px of spacing between neighbours | yes (CSS min size or gap) |
| 11 | `link-in-text-block` (serious) | 8 | form timeline | links inside `.timeline-content` (`scss/desk/timeline.scss:58,94`) are distinguished by colour only | yes (CSS underline) |
| 12 | `aria-allowed-attr` (critical) | 20 | search results (`li[aria-selected]` inside awesomplete list), workspace card menus (`a[aria-haspopup]` in `.card-actions`) | awesomplete 1.1.5 (`node_modules/awesomplete`) and the workspace widget template | no (third party and core JS) |
| 13 | `aria-required-attr`, `aria-valid-attr-value` (critical) | 4 + 4 | `#navbar-search` | `ui/toolbar/awesome_bar.js:36-39` sets `aria-haspopup`, and awesomplete adds `aria-expanded` and `aria-owns` pointing to a list that is not in the DOM until typing | no |
| 14 | `document-title` (serious) | 4 | query report | the page has an empty `<title>` while the report route loads; `frappe.utils.set_title` runs only when a title is known (`router.js:344-348`, `ui/page.js:730`). Cause not traced further (ASSUMED: timing of the General Ledger report) | no |
| 15 | `color-contrast` (serious), core palette | 66 | see below | see below | mostly yes (CSS) |

## Colour contrast nodes that also occur with the theme blocked

Only the nodes whose theme colours are not worse than core are listed as core. Ratios are from axe; the required ratio is 4.5:1.

| Selector | Pair, light or dark | Ratio | Cause in core | Theme can fix |
|---|---|---|---|---|
| `.datepicker--cell-day.-other-month-` | `#dedede` on `#ffffff` | 1.34 | `node_modules/air-datepicker/dist/css/datepicker.min.css` `.datepicker--cell-day.-other-month-{color:#dedede}`, hard coded and not dark aware | yes (CSS) |
| `.datepicker--nav-title i` | `#9c9c9c` on `#ffffff` | 2.74 | same stylesheet | yes (CSS) |
| `.hljs-string`, `.hljs-number`, `.hljs-comment` in a field description code sample | `#718c00`, `#f5871f`, `#8e908c` on `#ffffff` | 3.85, 2.50, 3.22 | `form/controls/base_input.js:248-251` highlights `<pre>` descriptions with highlight.js's default light theme; the block stays white in Dark | yes (CSS) |
| `.onb-progress-badge` | `#db7706` on `#fdfaed` | 3.01 | `ui/user_onboarding/OnboardingPanel.vue:259` | yes (CSS) |
| `.avatar-frame` initials | see `avatar-pairs.md` | 1.76 to 4.64 | `scss/desk/avatar.scss:6-31` (light) and `:39` onward (dark) pair each colour at 500 on 50 | the theme now owns these pairs: see "Theme-caused" in `README.md` |

## Not scanned

Two-factor page and session-expired dialog (they need a changed System Settings or an expired session; not done here), mobile and tablet widths, HRMS pages (the axe users do not hold HR roles), print views, emails.
