# 0005 — Settings doctype

Status: accepted, 2026-10-13. Settles ADR 0001 question 4. Applies upgrade findings 1 and 10, accessibility findings 2, 8, 10, and the print-web Letter Head condition.

## Context

A System Manager configures colour, fonts, identity and behaviour in one place (BRIEF 5). Identity must reach core's settings; Website Settings is writable only by Website Manager, and its `save()` runs unrelated validators.

## Decision

One Single, `Institutional Theme Settings` (module Institutional Theme), read and written by System Manager only. Users get effective values through `frappe.boot.ins` (0002).

**Fields.** Fieldname (type, default).
- *Colour*: `default_palette` (Select: `midad`, shipped presets, `custom`; `midad`); `allow_<preset>` (Check, 1) per shipped preset including `midad`; `allow_custom` (Check, 0); `custom_label_en`, `custom_label_ar` (Data); `custom_primary`, `custom_accent` (Color, mandatory when `eval:doc.allow_custom || doc.default_palette=="custom"`); `custom_audit` (Small Text, read only). A preset dropped at the Phase 2 gate loses its option and Check in the same commit.
- *Typography*: `font_pairing` (Select: `IBM Plex`, `Noto`, `Tajawal`, `Uploaded`; `IBM Plex`); `font_arabic_regular`, `font_arabic_semibold`, `font_latin_regular`, `font_latin_semibold` (Attach, all mandatory when `eval:doc.font_pairing=="Uploaded"`).
- *Identity, written through*:
  - `system_name` (Data) → Website Settings `app_name`;
  - `emblem` (Attach Image) → Website Settings `app_logo` and `splash_image`, and Navbar Settings `app_logo`;
  - `favicon` (Attach Image) → Website Settings `favicon`.
- *Identity, read by this app only*: `institution_name`, `institution_name_ar` (Data); `wordmark`, `wordmark_dark` (Attach Image); `authorised_use_notice`, `authorised_use_notice_ar`, `support_contact` (Small Text). The Letter Head reads these and `emblem` at render time through the Jinja method `institutional_theme.identity.ins_identity()`; it is never a write-through target.
- *Behaviour (D7)*: `default_density` (Select: `Comfortable`, `Compact`; `Comfortable`); `enable_idle_warning` (Check, 0); `idle_warning_minutes` (Int, 5); `enable_connection_banner` (Check, 0); `environment` (Data, read only, filled in `onload` from `frappe.conf.ins_environment`, never read back).

**Environment.** Owned by `site_config.json`, so a restored backup cannot hide the ribbon (P1). Absent, empty or `Production`: no ribbon. `Training`, `UAT`, `Staging`: that word, translated ("تدريب", "اختبار القبول", "ما قبل الإنتاج"). Anything else: "Non-production" / "غير إنتاجية" (P1: when in doubt, show it).

**Write-through** (`institutional_theme/identity.py`, called from `on_update`):
1. `old = self.get_doc_before_save()`. A field counts as changed when `old` is `None` and the value is non-empty, or when `old.get(f) != self.get(f)`.
2. If nothing changed, stop. Otherwise call `frappe.has_permission("Institutional Theme Settings", "write", throw=True)`.
3. On a key's first write, save the target's current value in the global `ins_identity_prior` (JSON, `frappe.db.set_global`); record each written value in `ins_identity_written`.
4. Website Settings: `frappe.db.set_single_value("Website Settings", {changed keys})`, then clear caches as its `on_update` does: `frappe.clear_cache(user="Guest")`, `frappe.website.utils.clear_cache()`, `frappe.clear_cache()`.
5. Navbar Settings: `frappe.get_single`, set `app_logo`, `save()` (it has no `validate`).

Install and migrate never write these targets.

On uninstall, each target still equal to `ins_identity_written` gets its prior value back; File rows attached to this doctype are deleted (files shared by `content_hash` stay on disk).

**Validation** in `validate`. No message offers "save anyway".

| Case | English | Arabic |
|---|---|---|
| default not allowed | The default colour preset {0} must also be allowed. | يجب أن تكون مجموعة الألوان الافتراضية {0} مسموحاً بها أيضاً. |
| contrast, title | Custom colour preset rejected. These pairs are below their minimum contrast: | رُفضت مجموعة الألوان المخصصة. هذه الأزواج أقل من الحد الأدنى للتباين: |
| contrast, one line per pair | {0} on {1}, {2} mode: {3}:1; at least {4}:1 is required. Adjust the {5} colour. | {0} على {1}، الوضع {2}: ‏{3}:1؛ المطلوب {4}:1 على الأقل. عدّل اللون {5}. |
| not a font | {0} is not a WOFF2 or TrueType font file. | الملف {0} ليس ملف خط بصيغة WOFF2 أو TrueType. |
| private font | The font file {0} must be public so that the login page and printouts can load it. | يجب أن يكون ملف الخط {0} عاماً لتتمكن صفحة الدخول والمطبوعات من تحميله. |
| idle range | The idle warning must come between 1 and 30 minutes before the session expires. | يجب أن يظهر تنبيه الخمول قبل انتهاء الجلسة بمدة تتراوح بين 1 و30 دقيقة. |
| upload missing (form intro) | The uploaded font {0} is missing from the server; IBM Plex is used until it is uploaded again. | الخط المرفوع {0} غير موجود على الخادم؛ يُستخدم IBM Plex إلى أن يُرفع مجدداً. |

In the contrast lines, {0} and {1} are human labels in the message's language from `midad/labels.py` ("Text on primary action" / "النص على زر الإجراء الأساسي"), each followed by the token name in `<bdi dir="ltr"><code>`. {2} is "Light" / "Dark" ("فاتح" / "داكن"). {3} and {4} are wrapped in `<bdi dir="ltr">`. {5} is "primary" or "accent" ("الأساسي" / "المميِّز"), from the failing token's ramp. Every failing pair is listed in a `<ul>` via `frappe.throw`.

**Custom preset maths** (`midad/model.py: custom_preset(primary_hex, accent_hex)`): convert each input to OKLCH; keep its hue; chroma multiplier `min(1, C_input / C_ramp[step])`, where `step` is the `ink` (or `brass`) step nearest in lightness; lightness from the approved curves; `neutral_h` 255. The official hue is kept, not its exact hex (BRIEF 5.2); the README says so.

## Alternatives rejected

1. *Website Settings `save()`.* `PermissionError` without Website Manager; validators can throw or blank `home_page` (upgrade finding 1).
2. *No identity fields.* Identity in three places, against BRIEF 5.4 (P3).
3. *Several profiles.* D4 allows one custom preset (P3).

## Consequences

- **backend-engineer**: the doctype (`json`, `py`, `js`), `identity.py`, `labels.py`, the `jinja` hook, and one test per message.
- **print-web-engineer**: the Letter Head uses `ins_identity()`.
- **scribe**: Arabic entries, including `labels.py`.

## Verification

Tests: a pale custom primary is rejected with every failing pair named; a System Manager without Website Manager saves identity; a broken Website Settings redirect does not block saving; uninstall restores the prior `app_name`.

## Evidence (Frappe 16.32.0)

- `website/doctype/website_settings/website_settings.json`: permissions (Website Manager only); `website_settings.py:76-85, 127-139, 141-154`.
- `database/database.py:843-868` `set_single_value` accepts a dict; `:1136-1138` `set_global`.
- `core/doctype/navbar_settings/navbar_settings.json`: System Manager; `navbar_settings.py:26-39`.
- `model/document.py:696-707` (true without a previous doc).
- `www/printview.py:231-241`: Letter Head content is rendered with Jinja.
- `utils/jinja.py:223-250`: the `jinja` hook.
- `core/doctype/file/file.py:605-620`.
- `sessions.py:518-519`.
