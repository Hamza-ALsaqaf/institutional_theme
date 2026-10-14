"""`update_website_context`: masthead, trust footer and body classes for login and error pages (ADR 0009).

Runs after `website.update_website_context`. The whole body is guarded: on any failure the error is
logged and the page renders as core builds it. Existing `banner_html`, `body_include` and
`body_class` values are kept; this module only adds to them.
"""

from __future__ import annotations

import re
from urllib.parse import urlencode

import frappe
from frappe import _

from institutional_theme import cache_guard

TEMPLATE_DIR = "institutional_theme/templates/ins"
AUTH_TEMPLATES = ("www/login.html", "www/update-password.html")
ERROR_TEMPLATES = ("www/error.html", "www/message.html", "www/404.html")
REFERENCE_PATTERN = re.compile(r"^[A-Za-z0-9-]{1,64}$")
LANGUAGES = (("en", "English"), ("ar", "العربية"))
SETTINGS = "Institutional Theme Settings"


def _setting(settings, fieldname: str) -> str:
	if settings is None:
		return ""
	return str(settings.get(fieldname) or "").strip()


def _get_settings():
	try:
		return cache_guard.settings_doc(SETTINGS)
	except Exception:
		return None


def _lang() -> str:
	return str(frappe.local.lang or "en")


def _is_arabic(lang: str) -> bool:
	return lang.split("-")[0].lower() == "ar"


def _pick(settings, base: str, lang: str) -> tuple[str, str]:
	"""The value of `base` or `base_ar` in the page language, else the other one with its language."""
	english, arabic = _setting(settings, base), _setting(settings, base + "_ar")
	first, second = (
		((arabic, "ar"), (english, "en")) if _is_arabic(lang) else ((english, "en"), (arabic, "ar"))
	)
	if first[0]:
		return first[0], ""
	if second[0]:
		return second
	return "", ""


def environment_label() -> str:
	"""The translated environment word from `ins_environment`; empty when the key is absent."""
	raw = str(frappe.conf.get("ins_environment") or "").strip()
	if not raw:
		return ""
	words = {
		"production": _("Production"),
		"training": _("Training"),
		"uat": _("UAT"),
		"staging": _("Staging"),
	}
	return words.get(raw.lower(), _("Non-production"))


def language_links() -> list[dict]:
	request = getattr(frappe.local, "request", None)
	path = str(getattr(request, "path", "") or "/login")
	raw = getattr(request, "args", None)
	pairs = raw.items(multi=True) if hasattr(raw, "getlist") else list((raw or {}).items())
	args = [(k, v) for k, v in pairs if k != "_lang"]
	current = _lang().split("-")[0].lower()
	links = []
	for code, label in LANGUAGES:
		query = urlencode([*args, ("_lang", code)])
		links.append({"code": code, "label": label, "href": f"{path}?{query}", "current": code == current})
	return links


def reference() -> str:
	"""The monitor trace ID when it is well formed, else an empty string."""
	try:
		from frappe.monitor import get_trace_id

		value = get_trace_id() or ""
	except Exception:
		return ""
	return value if REFERENCE_PATTERN.match(str(value)) else ""


def _status(context) -> int:
	for value in (
		context.get("http_status_code"),
		context.get("error_code"),
		(getattr(frappe.local, "response", None) or {}).get("http_status_code"),
	):
		try:
			if value:
				return int(value)
		except TypeError, ValueError:
			continue
	return 0


def _is_error_message(context, status: int) -> bool:
	"""A `www/message.html` page is an error when it has a status of 400 or more, or a red indicator.

	Core's `NotPermittedPage` (403) sets `self.http_status_code` after construction and leaves the status
	out of the template context. It stores `indicator_color="red"` in `frappe.local.response["context"]`
	(`not_permitted_page.py:23-25`), as `frappe.respond_as_web_page` does for every status over 300
	(`frappe/__init__.py:1295-1299`). Core merges that dict into the context only after the
	`update_website_context` hooks ran (`base_template_page.py:30-31, 52-54`), so it is read from there too.
	"""
	response = getattr(frappe.local, "response", None) or {}
	pending = response.get("context") or {}
	colour = context.get("indicator_color") or pending.get("indicator_color") or ""
	return status >= 400 or str(colour).lower() == "red"


def masthead_context(settings, lang: str, auth: bool) -> dict:
	name, name_lang = _pick(settings, "institution_name", lang)
	return {
		"ins_lang": lang,
		"ins_emblem": _setting(settings, "emblem"),
		"ins_name": name,
		"ins_name_lang": name_lang,
		"ins_system_name": _setting(settings, "system_name"),
		"ins_languages": language_links() if auth else [],
	}


def footer_context(settings, lang: str, auth: bool, template: str, error: bool) -> dict:
	values: dict = {
		"ins_lang": lang,
		"ins_support": _setting(settings, "support_contact"),
		"ins_release": str(frappe.conf.get("ins_release") or "").strip(),
		"ins_environment": environment_label(),
	}
	if auth:
		notice, notice_lang = _pick(settings, "authorised_use_notice", lang)
		if not notice:
			notice = _("Access to this system is restricted to authorised users. Activity is recorded.")
		values["ins_notice"] = notice
		values["ins_notice_lang"] = notice_lang
	elif template == "www/error.html" or (template == "www/message.html" and error):
		values["ins_reference"] = reference()
		if not values["ins_reference"]:
			values["ins_time_of_error"] = frappe.utils.format_datetime(
				frappe.utils.now_datetime(), "yyyy-MM-dd HH:mm:ss"
			)
	return values


def page_values(context) -> dict | None:
	"""Web Page: a stored `Left` becomes `start` on a right-to-left page.

	`Web Page.text_align` defaults to "Left" and `web_page.html:23` writes it as an inline
	`style="text-align: Left"`, which an author sheet cannot override without `!important`. On an Arabic
	page that parks every heading and paragraph at the wrong edge. `Center` and `Right` are kept.
	"""
	if str(context.get("text_align") or "").strip().lower() != "left":
		return None
	from frappe.utils.jinja_globals import is_rtl

	return {"text_align": "start"} if is_rtl() else None


def update_website_context(context) -> dict | None:
	try:
		template = str(context.get("template") or "")
		auth = template in AUTH_TEMPLATES
		if not auth and template not in ERROR_TEMPLATES:
			return page_values(context)
		settings = _get_settings()
		lang = _lang()
		masthead = frappe.render_template(
			f"{TEMPLATE_DIR}/masthead.html", masthead_context(settings, lang, auth)
		)
		footer = frappe.render_template(
			f"{TEMPLATE_DIR}/trust_footer.html",
			footer_context(settings, lang, auth, template, _is_error_message(context, _status(context))),
		)
		labels = ""
		if auth:
			# Read by `ins_web.bundle.js` for the password reveal button; `__()` is English on website pages.
			labels = ('<span hidden data-ins-reveal-labels data-show="{}" data-hide="{}"></span>').format(
				frappe.utils.escape_html(_("Show password")), frappe.utils.escape_html(_("Hide password"))
			)
		flags = " ins-has-masthead ins-auth" if auth else " ins-error"
		values = {
			"banner_html": masthead + str(context.get("banner_html") or ""),
			"body_include": str(context.get("body_include") or "") + footer + labels,
			"body_class": str(context.get("body_class") or "") + flags,
		}
		title = str(context.get("title") or "")
		if template == "www/login.html" and title.endswith("Login"):
			# Core sets `context["title"] = "Login"` without `_()` (www/login.py:45), so the tab reads English.
			values["title"] = title[: -len("Login")] + _("Login")
		return values
	except Exception:
		frappe.log_error(title="Institutional Theme: web content", defer_insert=True)
		return None
