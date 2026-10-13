"""Boot information for the desk shell (ADR 0002, 0005). Client code reads only `frappe.boot.ins`."""

from __future__ import annotations

import frappe
from frappe.utils import cint

from institutional_theme import preferences, site_files


def environment() -> str:
	"""The raw `ins_environment` of `site_config.json`; empty for production. The client translates it."""
	value = str(frappe.conf.get("ins_environment") or "").strip()
	return "" if value.lower() == "production" else value


def build(user: str) -> dict:
	settings = site_files.get_settings()
	effective = preferences.get_effective(user)
	idle = cint(settings.get("idle_warning_minutes")) if settings is not None else 0
	return {
		"palette": effective["palette"],
		"density": effective["density"],
		"allowed": preferences.allowed_cards(settings),
		"environment": environment(),
		"idle_warning": bool(settings is not None and cint(settings.get("enable_idle_warning"))),
		"idle_minutes": idle or 5,
		"connection_banner": bool(settings is not None and cint(settings.get("enable_connection_banner"))),
	}


def extend_bootinfo(bootinfo) -> None:
	"""Add `bootinfo.ins`. A failure is logged and leaves the desk without it: the shell script then
	writes nothing and the stylesheet defaults apply."""
	try:
		bootinfo["ins"] = build(frappe.session.user)
	except Exception:
		frappe.log_error(title="Institutional Theme: boot")
