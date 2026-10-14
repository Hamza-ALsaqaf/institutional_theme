"""Effective appearance of a user: colour preset and density (ADR 0002).

Boot, the website hook and the API all read through `get_effective()`. A user's stored choice is kept
even when the site no longer allows it, so allowing it again restores it; until then the site default
is used. A preset whose stylesheet cannot be linked is never effective, so the page never names a
palette it does not carry.
"""

from __future__ import annotations

import functools
from typing import Any

import frappe
from frappe import _

from institutional_theme import cache_guard, site_files
from institutional_theme.midad import model as midad

PALETTE_KEY = "ins_palette"
DENSITY_KEY = "ins_density"
DENSITIES = ("comfortable", "compact")
DEFAULT_DENSITY = "comfortable"
CUSTOM = "custom"
BASE = midad.BASE_PRESET


def shipped_presets() -> list[str]:
	"""Presets that passed the Phase 2 audits, in the approved order, from the generated model."""
	return list(midad.load_model()["palettes"]["shipped"])


def allowed_presets(settings: Any | None = None) -> list[str]:
	"""Preset keys the site offers: allowed shipped presets, then `custom` if allowed and valid.

	`midad` is always offered when nothing else is, so the list is never empty.
	"""
	settings = settings if settings is not None else site_files.get_settings()
	if settings is None:
		return [BASE]
	keys = [key for key in shipped_presets() if settings.get(f"allow_{key}")]
	if settings.get("allow_custom") and site_files.palette_content(settings) is not None:
		keys.append(CUSTOM)
	return keys or [BASE]


def site_default_palette(settings: Any | None = None) -> str:
	"""The site's default preset when it is allowed and linkable; otherwise `midad`."""
	settings = settings if settings is not None else site_files.get_settings()
	if settings is None:
		return BASE
	default = settings.get("default_palette") or BASE
	if default in allowed_presets(settings) and site_files.palette_linkable(default):
		return default
	return BASE


def site_default_density(settings: Any | None = None) -> str:
	settings = settings if settings is not None else site_files.get_settings()
	value = ((settings.get("default_density") if settings is not None else None) or "").lower()
	return value if value in DENSITIES else DEFAULT_DENSITY


def stored(user: str) -> dict[str, str | None]:
	"""The user's stored choices, from their own defaults only (not the global ones).

	Read from the table, not from the defaults cache: a request that was served while the user saved a
	choice can put the old rows back into that cache, and nothing would clear them again (`cache_guard`).
	"""
	values = cache_guard.user_defaults(user, (PALETTE_KEY, DENSITY_KEY))
	return {"palette": values[PALETTE_KEY], "density": values[DENSITY_KEY]}


def get_effective(user: str) -> dict[str, str]:
	"""`{"palette": key, "density": "comfortable" | "compact"}` for a user.

	Never raises for a missing doctype or a missing file: the fallback is `midad` and comfortable.
	"""
	settings = site_files.get_settings()
	choice = stored(user) if user and user != "Guest" else {"palette": None, "density": None}
	palette = choice["palette"]
	if not (
		palette in allowed_presets(settings) and site_files.palette_linkable(palette)  # type: ignore[arg-type]
	):
		palette = site_default_palette(settings)
	density = choice["density"] if choice["density"] in DENSITIES else site_default_density(settings)
	return {"palette": palette, "density": density}  # type: ignore[dict-item]


# ----------------------------------------------------------------------------------------------
# Swatches and labels for the Appearance page
# ----------------------------------------------------------------------------------------------


@functools.cache
def _swatch(name: str, primary: str = "", accent: str = "") -> tuple[str, str]:
	"""Light-mode `primary` and `accent` of a preset. The custom preset is keyed by its two inputs."""
	model = midad.load_model()
	built = (
		midad.custom_preset(primary, accent, model).palette if name == CUSTOM else midad.palette(model, name)
	)
	return built.colour("primary", "light"), built.colour("accent", "light")


def preset_label(name: str, settings: Any | None = None) -> str:
	"""Name of a preset in the current language; a custom preset is never nameless."""
	arabic = (frappe.local.lang or "en").split("-")[0] == "ar"
	if name == CUSTOM:
		settings = settings if settings is not None else site_files.get_settings()
		if settings is not None:
			label = (arabic and settings.get("custom_label_ar")) or settings.get("custom_label_en")
			if label:
				return label
		return _("Custom")
	entry = midad.load_model()["palettes"]["presets"].get(name, {})
	return entry.get("label_ar" if arabic else "label_en") or name


def allowed_cards(settings: Any | None = None) -> list[dict[str, str]]:
	"""`[{key, label, primary, accent}]` for every preset the user may pick."""
	settings = settings if settings is not None else site_files.get_settings()
	cards = []
	for key in allowed_presets(settings):
		if not site_files.palette_linkable(key):
			continue
		if key == CUSTOM:
			primary, accent = _swatch(key, settings.get("custom_primary"), settings.get("custom_accent"))
		else:
			primary, accent = _swatch(key)
		cards.append({"key": key, "label": preset_label(key, settings), "primary": primary, "accent": accent})
	return cards or [
		{"key": BASE, "label": preset_label(BASE), "primary": _swatch(BASE)[0], "accent": _swatch(BASE)[1]}
	]
