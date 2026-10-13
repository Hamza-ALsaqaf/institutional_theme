# 0002 — User preference storage and the Appearance page

Status: accepted, 2026-10-13. Author: theme-architect. Settles question 1 of ADR 0001. Applies accessibility review findings 1, 4 and 5 (`docs/team/reviews/a11y-phase1.md`).

## Context

Each user picks a colour preset (D4) and a density (BRIEF 8). The User doctype must not change, and the mode stays core's `desk_theme` (BRIEF 5.5). Core's theme dialog is not keyboard-operable: each choice is a clickable `div`, and its arrow keys run backwards in RTL.

## Decision

**Storage.** Two user defaults, written with `frappe.defaults.set_user_default` (core stores `time_zone` the same way):
- `ins_palette`: `midad`, a shipped preset key, or `custom`;
- `ins_density`: `comfortable` or `compact`.

**Effective value.** `institutional_theme/preferences.py` defines `get_effective(user: str) -> dict`. Boot, the website hook (0003) and the API all call it.
- The palette is the stored value if the site allows it and its stylesheet can be linked (0003, 0004); otherwise it is the site default.
- The density is the stored value, otherwise the site default.
- A stored value the site no longer allows is kept, so allowing it again restores it.

**Boot.** `institutional_theme.boot.extend_bootinfo` sets `bootinfo.ins` to:
- `palette` and `density`;
- `allowed`: a list of `{key, label, primary, accent}`, where `primary` and `accent` are the swatch hex values;
- `environment` (0005);
- `idle_warning`, `idle_minutes` and `connection_banner` (D7).

Client code reads only `frappe.boot.ins`. User defaults leak into `boot.sysdefaults` and new-document pre-fill, so no field of this app may be named `ins_palette` or `ins_density`.

**API.** `institutional_theme.api.set_appearance(palette: str | None = None, density: str | None = None) -> dict`, declared `@frappe.whitelist(methods=["POST"])`.
- It raises `PermissionError` for Guest.
- It validates both values on the server.
- It writes defaults for `frappe.session.user` only and returns `get_effective()`.

It has two messages:
- "The colour preset {0} is not available on this site." / "مجموعة الألوان {0} غير متاحة على هذا الموقع."
- "Density must be Comfortable or Compact." / "يجب أن تكون الكثافة مريحة أو مضغوطة."

**Appearance page.** A desk Page `ins-appearance` ("Appearance" / "المظهر") with no roles, so every desk user may open it. It holds:
- an `h1` with `tabindex="-1"`;
- a visually hidden `role="status"` region;
- three `<fieldset>`s, each with a `<legend>` and native radio inputs with `<label>`s.

1. **Mode**: Light / Dark / Automatic ("فاتح / داكن / تلقائي"). The radio that starts checked comes from `<html data-theme-mode>`. On `change`, the page:
   - sets `data-theme-mode` on `<html>`, lower-case (core's own observer then calls `frappe.ui.set_theme()`);
   - calls `frappe.xcall("frappe.core.doctype.user.user.switch_theme", {theme})` with `"Light"`, `"Dark"` or `"Automatic"`;
   - announces "Mode changed to {0}." / "تم تغيير الوضع إلى {0}.".

   Core's dialog is never opened.
2. **Density**: Comfortable / Compact ("مريحة / مضغوطة"). On `change`, the page sets `data-ins-density` on `<html>`, calls `set_appearance` and announces "Density changed to {0}." / "تم تغيير الكثافة إلى {0}.".
3. **Colour preset**: one radio per allowed preset. Its label holds:
   - the name in the user's language. For `custom`, that is `custom_label_ar` for Arabic when it is not empty, otherwise `custom_label_en`, otherwise "Custom" / "مخصصة". A card is never empty.
   - two swatch dots, primary and accent, each with a 1px `--ins-border-control` border (audited at 3:1);
   - on the checked option, a check icon and the word "Selected" / "محدد".

   Under `forced-colors: active` the dots get a `CanvasText` border.

   The arrow keys only move the selection. The button "Apply colour preset" / "تطبيق مجموعة الألوان" is disabled while the selection equals the effective preset. When pressed, it:
   - saves the preset;
   - stores the preset's label with `sessionStorage.setItem("ins_palette_changed", label)`;
   - calls `location.reload()`.

   When the page loads and that key exists, it removes the key, focuses the `h1` and writes "Colour preset changed to {0}." / "تم تغيير مجموعة الألوان إلى {0}." into the status region.

   If the site allows exactly one preset, the page shows its name and "Set by your administrator." / "يحدده مسؤول النظام." with no radios.

**Lifecycle.** `before_uninstall` deletes the `DefaultValue` rows with these keys. Deleting a User leaves its rows, like core's `time_zone`; uninstall removes them.

## Alternatives rejected

1. *A doctype with a Link to User.* Deleting the user is blocked unless a `doc_events` hook removes the row first (P3).
2. *`localStorage`.* It is per device, wrong on shared PCs, and invisible to the server (P1).
3. *Core's `ThemeSwitcher` dialog.* It is not keyboard-operable (P2).
4. *A Navbar Settings item.* A Route item does nothing; an Action item is an inline `onclick` (BRIEF 6.5).

## Consequences

- **backend-engineer**: `preferences.py`, `api.py`, `boot.py`, the page (`.json`, `.py`, `.js`) and the uninstall cleanup. Markup classes: `ins-appearance`, `ins-swatch`, `ins-swatch-dot`, `ins-selected`.
- **css-engineer**: `desk/_appearance.scss`.
- **scribe**: an Arabic entry for each string above.
- **a11y-rtl-reviewer**: a keyboard pass of the page, in both directions.

## Verification

Python tests:
- set a value and read it back;
- restrict the allowed presets and get the fallback;
- Guest gets `PermissionError`;
- a disallowed value gets `ValidationError`;
- no rows remain after uninstall.

Playwright, keyboard only, in LTR and RTL:
- Tab reaches each group;
- the arrow keys change the mode live, and no dialog opens;
- Apply reloads the page, focus lands on the `h1`, and the status region holds the message.

## Evidence (Frappe 16.32.0)

- `defaults.py:12-13` `set_user_default`; `:105-118` the user's defaults merged over the global ones; `:168-176, 268-273` cache clearing.
- `boot.py:51` `sysdefaults`; `public/js/frappe/model/create_new.js:167` pre-fill by fieldname.
- `sessions.py:169-170` `extend_bootinfo`.
- `core/doctype/page/page.py:126-137`: a page without roles is permitted to every user.
- `core/doctype/user/user.py:1447-1450` `@frappe.whitelist() def switch_theme`.
- `public/js/frappe/ui/theme_switcher.js:17-44` arrow keys step by array index; `:127-135` `toggle_theme`.
- `public/js/frappe/desk.js:110-118` the observer on `data-theme-mode` calls `set_theme()`.
- `model/delete_doc.py:376` the link check.
