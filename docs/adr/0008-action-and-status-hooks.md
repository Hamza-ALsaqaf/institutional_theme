# 0008 — Action and status hooks in the shell script

Status: accepted, 2026-10-13. Applies accessibility findings 6, 7 and 10 (BRIEF 8).

## Context

Core gives CSS no stable hook for consequential actions (labels are translated; primary actions carry an unencoded `data-label`, menu items none), Draft against Cancelled (both red), or masked fields (no markup). Core's `ar.po` collapses several sources onto one Arabic string:

| Arabic | English sources |
|---|---|
| "حذف" | Delete, Deleted, Remove, delete |
| "إلغاء" | Cancel, Cancelling, Revoked, cancel, on_cancel |
| "تعديل" | Amend |
| "تسجيل" | Submit |

## Decision

**The script.** `ins_shell.bundle.js` (`app_include_js`) is the only desk script. Each feature has its own `try/catch`; it writes attributes and appends one ribbon element, nothing else; no network calls, patching, `eval` or inline handlers. If it fails, core works and looks as without the theme.

**1. Form status.** On `$(document).on("form-refresh", (e, frm) => …)` the script sets `data-ins-docstatus` (`0`, `1`, `2`) and, while `frm.is_new()`, `data-ins-new` on `frm.page.wrapper`, before `refresh_fields` runs. Unsaved edits do not re-trigger it; core's orange "Not Saved" pill covers them.

**2. Status shapes.** CSS draws one shape per core indicator colour class, with `currentColor` borders so the shape survives forced colours:

`green` check; `red` cross; `orange` half disc; `yellow` two bars; `blue`, `light-blue`, `cyan` dot; `purple`, `pink` diamond; `gray`, `grey`, `darkgrey`, `black` and any other class ring. Core has no rule for `black` (workflow "Inverse"); the theme gives it the `status-ink` pair.

Two overrides key on state, not colour:
- Draft (ring, neutral): `[data-ins-docstatus="0"] .title-area .indicator-pill.red` and `.indicator-pill[data-filter="docstatus,=,0"]`.
- Cancelled (square, muted): the same shapes with `2`.

Workflow states take their style's class shape. Overdue (triangle) and Completed (target) cannot be told from Rejected and Approved without reading text, so they show the class shape and core's label distinguishes them: a known gap, listed under Design deviations.

**3. Consequential actions.** The script sets `data-ins-action="submit|cancel|amend|delete|approve|reject"`. CSS keys on that attribute only. Matching runs inside `frm.page.wrapper .page-head`. Labels are compared by string equality with `__()`, evaluated at runtime with the same dictionary the toolbar used, so they are equal by construction in every language:

| Value | Element | Label equals | Also requires |
|---|---|---|---|
| `submit` | `button.primary-action` | `__("Submit")` | docstatus 0 |
| `cancel` | `button.btn-secondary` | `__("Cancel")` | docstatus 1 |
| `amend` | `.primary-action`, `.btn-secondary` | `__("Amend")` | docstatus 2 |
| `delete` | `.menu-btn-group .menu-item-label` (its `a`) | `__("Delete")` | docstatus ≠ 1 |
| same values | `.custom-actions button[data-label]`, `.inner-group-button .dropdown-item[data-label]` (decoded) | any of the six labels | none |
| workflow | `.actions-btn-group .menu-item-label` (its `a`) | `__(t.action)` for a consequential transition `t` | none |

State conditions stop same-text items being tagged in the wrong state. `ar.csv` adds "اعتماد" and "رفض" for Approve and Reject, which core lacks.

*Workflow transitions* come from `frappe.workflow.get_all_transitions(frm.doctype)`, which is local and makes no network call. A transition is consequential if its raw English `action` matches, case-insensitively, a whole word from `approve|approval|authorise|authorize|reject|decline|return|cancel|void|submit|delete|amend|close|pay`, or if its `next_state` has a different `doc_status` from its `state`. Its value is:
- `reject` for reject, decline or return;
- `cancel` for cancel or void, or when the next `doc_status` is 2;
- otherwise `approve`.

*False positives are accepted (P1)*: a miss hides a consequence, an extra tag only adds emphasis. Known ones, recorded in the manifest: an Arabic page-menu Remove ("حذف") on an unsubmitted document; a custom button translating to one of the six labels; two workflow actions translating alike.

*When it runs.* One pass on `form-refresh`, plus one guarded `MutationObserver` per page wrapper (`childList`, `subtree`, `attributeFilter: ["data-label"]`), because the Amend check is asynchronous, workflow items arrive after a promise, and a dirty form resets actions without a refresh.

**4. Masked fields.** On `form-refresh`, for each name in `frm.meta.masked_fields`, the script sets `data-ins-masked` and `data-ins-masked-label="${__("Hidden for your role")}"` ("مخفي بحسب دورك") on `frm.fields_dict[name].wrapper`. CSS shows the reason as generated text with a lock glyph.

**5. Environment ribbon.** When `frappe.boot.ins.environment` is set, the script:
- sets `data-ins-environment` on `<html>`;
- appends one `<div class="ins-env-ribbon" role="note">` to `<body>` holding the translated word (0005).

The ribbon sits at `z-index: var(--ins-z-ribbon)` (1021, below the modal backdrop at 1040), uses `accent-text` on `accent-subtle` (already audited at 4.5:1), is hidden in print, and `html[data-ins-environment]` adds its block size to `scroll-padding-block-start` and the sticky offsets so it never covers the page head or the focused element.

## Alternatives rejected

1. *CSS on `data-label`.* Translated, inconsistently encoded, often absent (P1).
2. *Patching `frappe.ui.form.Toolbar`.* Forbidden (BRIEF 6.5) and fragile (P3).
3. *No state checks.* The Arabic collisions would mis-tag in every state (P1).

## Consequences

- **backend-engineer**: `public/js/ins_shell.bundle.js`, `public/js/shell/*.js`, `tests/browser/actions.mjs` (a submittable fixture doctype with a two-step workflow).
- **css-engineer**: `desk/_status.scss`, `_actions.scss`, `_masked.scss`, `_ribbon.scss`. CSS keys only on `data-ins-*`.
- **scribe**: Arabic entries; collisions in the manifest.

## Verification

Browser tests in both languages: each tag appears in the right state only; a workflow "Reject" is tagged; Draft and Cancelled pills differ in shape and colour; a masked field shows its reason; the ribbon never covers a focused field (bounding-box check).

## Evidence (Frappe 16.32.0)

- `public/js/frappe/form/form.js:618-627` `form-refresh`, `:90` page, `:1214-1220` masked fields.
- `public/js/frappe/form/toolbar.js:507-508` Delete, `:720-764` primary actions, `:765-786` status, `:808, 845` labels, `:850-861` dirty.
- `public/js/frappe/form/workflow.js:98-104`; `public/js/frappe/model/workflow.js:10-20, 88-90`.
- `public/js/frappe/ui/page.html:1, 54-82` (all groups inside `.page-head`); `page.js:151-152, 275-287, 401-407, 455-485, 565-575, 644-656`.
- `public/js/frappe/model/indicator.js:72-79`.
- `utils/install.py:119-120`.
- `locale/ar.po:2363, 4318, 7379, 22998, 23771, 27260`.
- Bootstrap 4.6.2 `scss/_variables.scss:689-690`.
