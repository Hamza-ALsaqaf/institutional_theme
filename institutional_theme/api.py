"""Whitelisted API of the theme (ADR 0002). One method: the user's own appearance."""

from __future__ import annotations

import frappe
from frappe import _

from institutional_theme import cache_guard, preferences


@frappe.whitelist(methods=["POST"])
def set_appearance(palette: str | None = None, density: str | None = None) -> dict[str, str]:
	"""Store the current user's colour preset and density, and return the effective values.

	Both values are validated on the server. Only the session user's own defaults are written, and
	Guest is refused. A value left out (`None`) is not changed.
	"""
	user = frappe.session.user
	if user == "Guest":
		raise frappe.PermissionError

	if palette is not None:
		allowed = preferences.allowed_presets()
		if palette not in allowed or not preferences.site_files.palette_linkable(palette):
			frappe.throw(
				_("The colour preset {0} is not available on this site.").format(
					frappe.bold(frappe.utils.escape_html(str(palette)))
				),
				frappe.ValidationError,
			)
	if density is not None and density not in preferences.DENSITIES:
		frappe.throw(_("Density must be Comfortable or Compact."), frappe.ValidationError)

	if palette is not None:
		cache_guard.set_user_default(preferences.PALETTE_KEY, palette, user)
	if density is not None:
		cache_guard.set_user_default(preferences.DENSITY_KEY, density, user)
	return preferences.get_effective(user)
