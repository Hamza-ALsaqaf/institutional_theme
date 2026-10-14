# es-badge call sites in Frappe v16.52.0 (`/tmp/src/frappe-16.52.0`), round-4 fix 3 (R1)

Status hosts get a status family and shape: `.es-badge:where([data-filter], .page-indicator-pill, .side-panel-indicator *, .diw-import-log-line *)`.
Everything else gets the neutral pair and no shape. Source: grep of `ui.badge(`, `ui.badge.html(`, `class="es-badge`, `addClass("es-badge`.

| Call site (file:line) | What it shows | Class | Reached by |
|---|---|---|---|
| `list/list_view.js:1896` | doc status in list rows | status | `[data-filter]` |
| `list/list_view.js:1499` | Select field value in list rows (status, priority) | status | `[data-filter]` |
| `ui/page.js:299`, `ui/page.html:24` | page-head status chip | status | `.page-indicator-pill` |
| `ui/side_panel.js:746` | status in the side-panel header (`frappe.get_indicator`) | status | `.side-panel-indicator *` |
| `core/doctype/data_import/data_import.js:2740` | import log Success or Failure | status | `.diw-import-log-line *` |
| `ui/tags.js:117` | user tag on a form (`form-tag`) | label | neutral |
| `views/kanban_v2/kanban_page.js:1275` | Kanban v2 card tag, hashed theme | label | neutral |
| `views/kanban_v2/kanban_page.js:1297` | card age (ghost) | other | neutral |
| `views/kanban_v2/kanban_page.js:1467` | card Select field value with icon | status-like, no stable host class | neutral (accepted) |
| `views/kanban_v2/kanban_page.js:2048` | lane count | count | neutral |
| `views/kanban/kanban_column.html:4,6` | v1 column count, theme from column colour | count | neutral |
| `widgets/shortcut_widget.js:127` | workspace shortcut count, administrator-chosen colour | count | neutral |
| `widgets/onboarding_widget.js:96` | "Optional" | label | neutral |
| `widgets/quick_list_widget.js` | quick list items | label | neutral |
| `ui/embedded_list.js:293` | embedded list badge column | status-like, no host class | neutral (accepted) |
| `ui/tree.js:350` | "Group" | label | neutral |
| `form/templates/form_sidebar.html:39,49` | Experimental, Deprecated | label | neutral |
| `form/templates/timeline_message_box.html:66` | email status in timeline | status-like, no host class | neutral (accepted) |
| `form/templates/contact_list.html:14`, `address_list.html:14` | "Primary" | label | neutral |
| `form/doctype_settings/tabs/print_format.js:131` | "Custom" | label | neutral |
| `form/doctype_settings/tabs/roles.js:78,87,191` | "Only own", permlevel, granted flag (check icon) | label | neutral |
| `form/doctype_settings/tabs/user_permissions.js:90,93` | "All DocTypes", applicable-for | label | neutral |
| `form/doctype_settings/list_panel.js:174` | inline tags and column badges | label | neutral |
| `list/list_filter/manage_layouts_dialog.js:65` | scope label | label | neutral |
| `data_import/import_preview.js:382`, `import_tree_preview.js:295` | skipped column, "Edited" | label | neutral |
| `views/communication.js:843,1058,1580` | recipient chips, "+N more" | label | neutral |
| `desk/page/workspace_restore/workspace_restore.js:93` | restore state | status-like, no host class | neutral (accepted) |
| `templates/includes/navbar/navbar_items.html:93` | "Read Only Mode" | label | neutral |
| `website/doctype/web_form/templates/web_form.html:96` | "Not Saved" (web form, not desk) | label | neutral |
| `print_format_builder/**` (4 .vue files) | field type and zone chips | label | neutral |
| `core/page/component_explorer/component_explorer.js` | demo only | other | neutral |

Counts: 5 status call sites (one of them, `list/list_view.js:1499`, is a Select value), 4 status-like sites left neutral because no host class exists
(label text still says the state), the rest labels, counts or other. Neutral loses the colour on the four status-like sites; the text carries the meaning.

Correction (corrected by scribe): the count above previously said "5 status-like sites" and "6 with Select values counted apart". The table names four status-like rows (`kanban_page.js:1467`, `embedded_list.js:293`, `timeline_message_box.html:66`, `workspace_restore.js:93`) and five status rows in total, one of which is the Select value at `list_view.js:1499`. The table rows are unchanged.
