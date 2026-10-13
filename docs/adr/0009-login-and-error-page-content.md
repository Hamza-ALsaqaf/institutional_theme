# 0009 — Login and error-page content

Status: accepted, 2026-10-13. Delivers BRIEF 8 "Institutional trust cues" for login, 2FA, forgot-password, update-password and the error pages.

## Context

`templates/base.html` renders three context slots: `banner_html` (top of `<body>`), `body_include` (after the scripts) and `body_class`. None of the five pages overrides them. `update_website_context` runs after the page's `get_context` and before rendering. Core login shows the emblem but not the system name; 2FA empties `.login-content`, emblem included. Jinja has no autoescape. A trace ID exists only when `monitor` is set in site config.

## Decision

**One mechanism.** A second, independently guarded `update_website_context` entry, `institutional_theme.web_content.update_website_context`, after 0003's. Like 0003 it catches every exception, logs with `defer_insert=True` and returns `None`, so core pages render unchanged. It keys on `context.template`:

- *auth*: `www/login.html`, `www/update-password.html`;
- *error*: `www/error.html`, `www/message.html`, `www/404.html`.

For any other template it returns `None`. Otherwise it returns new strings, each concatenated with the existing value and never replacing it:
- `banner_html` = masthead + existing;
- `body_include` = existing + trust footer;
- `body_class` = existing + ` ins-has-masthead ins-auth` or ` ins-error`.

Both fragments are this app's Jinja templates, rendered with `frappe.render_template("institutional_theme/templates/ins/…")` and `_()` in `frappe.local.lang`. Every interpolated value passes `| e`. They contain no script and no `style` attribute.

**Masthead** (`<header class="ins-masthead">`): the emblem (settings `emblem`, else the placeholder SVG), `institution_name` / `institution_name_ar` and `system_name`. CSS hides core's `.page-card-head .app-logo` under `body.ins-has-masthead`, so the lockup stays in place through 2FA. On auth pages the masthead also carries the language switch: `<nav aria-label="Language">` with English and العربية links. Each link is the current path with its query kept plus `_lang=en|ar`, with `lang` and `hreflang`; the current one has `aria-current="true"`.

**Trust footer** (`<footer class="ins-trust">`):
- *Notice, auth pages only*: the field in the page language, else the other field with its own `lang`, else the default "Access to this system is restricted to authorised users. Activity is recorded." / "الوصول إلى هذا النظام مقصور على المصرَّح لهم، ويُسجَّل النشاط."
- *Support*: `support_contact` with `dir="auto"` and `white-space: pre-line`. Omitted if empty.
- *Version and environment line*: "Release {0}" from `frappe.conf.ins_release`, then the 0005 environment word. Explicit `Production` reads "Production" / "بيئة الإنتاج". If `ins_environment` is absent, the environment part is omitted. The framework version is never shown to guests.
- *Reference, error template, or message with a response status of 400 or more*: `frappe.monitor.get_trace_id()` if it matches `^[A-Za-z0-9-]{1,64}$`, in `<bdi dir="ltr"><code>`, labelled "Reference" / "الرقم المرجعي", with "Quote this reference when you contact support." / "اذكر هذا الرقم عند التواصل مع الدعم الفني." With no valid ID, the footer shows "Time of error" / "وقت الخطأ" with `now_datetime()` in the system time zone, the zone of Error Log `creation`.

**Deployment**: set `"monitor": 1` in site config. The same ID then appears on the page, in the `X-Frappe-Request-Id` header, in Error Log `trace_id` (5xx) and in `logs/monitor.json.log`. If nginx sends `X-Frappe-Request-Id: $request_id`, it also matches the access log.

**Gaps, delivered instead**:
- 404 is page-cached, so it gets masthead and support but no per-request ID.
- 403 through `NotPermittedPage` has no readable status at hook time, so it gets support only.
- 503 maintenance raises before `monitor.start`, so it gets "Time of error".
- The system name sits in the masthead, not inside the card as drawn (design deviation).
- Switching language drops the `#forgot` hash.

## Alternatives rejected

1. *Shipping `www/login.html`.* It wins, because the newest installed app is searched first. But it copies 242 lines of core markup coupled to `login.js`. It also needs a `login.py` beside it, and 403 forces core's `message.html` regardless. Silent drift breaks P3.
2. *`web_include_js` insertion.* `__()` is English on website pages, the script inserts into core components (BRIEF 6.5) and it shifts layout after paint (BRIEF 8).
3. *`templates/includes/banner_extension.html`.* This is an unprefixed path, so the first app in the loader wins silently, and `body_include` is still needed. One mechanism is simpler (P3).
4. *Website Settings `banner_html`, footer, `show_language_picker`.* These need Website Manager writes (0005) and appear on every web page. They are not bilingual. Core's picker is an unlabelled `<select>` filled by an API call (P2).
5. *Generating our own UUID when monitor is off.* It matches no record (P1).

## Consequences

- **backend-engineer**: `pkg/web_content.py`, the hook list entry and `pkg/tests/test_web_content.py`. Settings `on_update` calls `frappe.website.utils.clear_cache()` whenever any field shown here changes (404 is cached for 30 minutes).
- **print-web-engineer**: `pkg/templates/ins/masthead.html`, `pkg/templates/ins/trust_footer.html`, and their styles in `web/_login.scss` and `_error_pages.scss`.
- **scribe**: Arabic entries; README documents `monitor`, `ins_release` and the nginx header; the manifest lists the three slots and `.app-logo` as UNVERIFIED-on-upgrade checks.

## Verification

Python tests:
- Login renders the notice in English and Arabic, and falls back as specified.
- `<script>` in a settings field is escaped.
- With monitor on, a 500 shows an ID equal to the Error Log `trace_id` and to the response header.
- A forged `X-Frappe-Request-Id: <b>` shows "Time of error".
- 404 has no reference.
- A raising hook still gives the login page with status 200.

Browser test: the masthead survives 2FA, and the language links have accessible names.

## Evidence (Frappe 16.32.0)

- `templates/base.html:57-64, 115`; `www/login.html:2-6, 91-93`; `templates/includes/login/login.js:365-366`; `www/error.html`, `message.html`, `404.html`, `update-password.html`: no `banner`, `body_include` or `body_class` override.
- `website/page_renderers/base_template_page.py:27-36, 51-54, 69-75`.
- `website/page_renderers/template_page.py:51-66, 131-147, 178-185, 295-299`; `not_permitted_page.py:18-27`.
- `www/login.py:22`; `www/error.py:7`; `www/message.py:8`; `www/update_password.py:6`; `www/404.py` (no `no_cache`); `website/utils.py:381-402, 529-551`.
- `utils/jinja.py:66` (no autoescape), `:191-203`.
- `translate.py:33-47`; `auth.py:45, 99-100`; `templates/includes/navbar/navbar.html:28-30`; `website/js/website.js:379-411`.
- `monitor.py:20-22, 37-40, 77-78, 118-121`; `hooks.py:256, 456`; `app.py:189-194, 207-208, 260-261, 411-412`; `utils/error.py:80-90`; `core/doctype/error_log/error_log.json:75-78`.
- `__init__.py:1283-1311` (`respond_as_web_page`).
