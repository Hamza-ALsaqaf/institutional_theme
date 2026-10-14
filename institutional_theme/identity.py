"""The institution's identity for print templates (ADR 0005).

`ins_identity()` is registered as a Jinja method (`hooks.py`, `jinja`), so the Letter Head, which is
rendered with Jinja at print time (`frappe/www/printview.py:231-241`), can write
`{% set ins = ins_identity() %}` and use `ins.institution_name` and so on. It is read at render time and
is never written to a core setting: the write-through of `system_name`, `emblem` and `favicon` is in
`institutional_theme/doctype/institutional_theme_settings/identity_sync.py`.

Every value is a plain string, possibly empty; the dictionary always has the same six keys. The
function never raises: a print job must not fail because of the letterhead's identity block.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import frappe

from institutional_theme import cache_guard, guard_log

KEYS: tuple[str, ...] = (
	"institution_name",
	"institution_name_ar",
	"system_name",
	"emblem_url",
	"address",
	"contact",
)
SETTINGS = "Institutional Theme Settings"


def _text(value: Any) -> str:
	return "" if value is None else str(value).strip()


def _public_url(value: str) -> str:
	"""A root-relative URL of a public file, or an empty string.

	A private file (`/private/files/...`) needs a session and cannot load in a PDF or on a printout
	opened elsewhere, and a protocol-relative or absolute URL is not this site's own file.
	"""
	if not value.startswith("/") or value.startswith("//") or value.startswith("/private/"):
		return ""
	if ".." in value.split("/"):
		return ""
	# Percent-encode what could end an attribute or a url() token; an existing %XX stays as it is.
	return quote(value, safe="/%@+=,-._~")


def _settings() -> Any:
	try:
		return cache_guard.settings_doc(SETTINGS)
	except Exception:
		return None


def _company() -> str:
	try:
		return _text(frappe.defaults.get_global_default("company"))
	except Exception:
		return ""


def _company_address(company: str) -> str:
	"""The default company's primary address on one line (the settings have no address field).

	Plain text for the template to escape. Empty when ERPNext is not installed, there is no company or
	it has no address.
	"""
	if not company:
		return ""
	try:
		from frappe.contacts.doctype.address.address import get_default_address

		name = get_default_address("Company", company)
		if not name:
			return ""
		row = frappe.db.get_value(
			"Address",
			name,
			["address_line1", "address_line2", "city", "pincode", "country"],
			as_dict=True,
		)
	except Exception:
		return ""
	if not row:
		return ""
	return ", ".join(part for part in (_text(row.get(key)) for key in row) if part)


def ins_identity() -> dict[str, str]:
	"""`institution_name`, `institution_name_ar`, `system_name`, `emblem_url`, `address`, `contact`.

	Fallbacks: the name falls back to the default company and the address is the default company's
	primary address. The Arabic name has no fallback, so a template can choose the other language's name
	instead of printing English in Arabic. The system name has none either: Website Settings `app_name`
	is "Frappe" on a stock site, which must not appear on an institution's letterhead.
	"""
	identity = dict.fromkeys(KEYS, "")
	try:
		settings = _settings()
		get = settings.get if settings is not None else (lambda _key: None)
		company = _company()
		identity["institution_name"] = _text(get("institution_name")) or company
		identity["institution_name_ar"] = _text(get("institution_name_ar"))
		identity["system_name"] = _text(get("system_name"))
		identity["emblem_url"] = _public_url(_text(get("emblem")))
		identity["address"] = _company_address(company)
		identity["contact"] = _text(get("support_contact"))
	except Exception:
		guard_log.log_once("Institutional Theme: identity for print")
	return identity
