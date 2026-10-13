"""Institutional Theme Settings: one place for colour, fonts, identity and behaviour (ADR 0005).

Validation never offers "save anyway": a custom preset that fails a required contrast pair, a file
that is not a font, or a default preset that is not allowed stops the save with a message. The colour
maths lives in `institutional_theme.midad` (no Frappe import there); this module only translates and
formats its results. Generation of the per-site CSS files is added in Phase 3 (`site_files.ensure()`).
"""

from __future__ import annotations

import os
import re
from typing import Any

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, escape_html

from institutional_theme import fonts
from institutional_theme.midad import model as midad
from institutional_theme.midad.labels import mode_label, token_label
from institutional_theme.midad.model import CustomPreset

from . import identity_sync

CUSTOM = "custom"
FONT_FIELDS = {
	"font_arabic_regular": "arabic_regular",
	"font_arabic_semibold": "arabic_semibold",
	"font_latin_regular": "latin_regular",
	"font_latin_semibold": "latin_semibold",
}
FONT_FIELD_LABELS = {
	"font_arabic_regular": "Arabic regular",
	"font_arabic_semibold": "Arabic semibold",
	"font_latin_regular": "Latin regular",
	"font_latin_semibold": "Latin semibold",
}
IDLE_MIN, IDLE_MAX = 1, 30
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


# ----------------------------------------------------------------------------------------------
# Pure helpers (tested without saving a document)
# ----------------------------------------------------------------------------------------------


def shipped_presets(model: midad.Model | None = None) -> list[str]:
	"""Presets that passed the audits, from the generated model. Dropped presets are not offered."""
	return list((model or midad.load_model())["palettes"]["shipped"])


def preset_label(name: str, model: midad.Model | None = None) -> str:
	"""Human name of a preset in the current language (the custom preset has its own name)."""
	if name == CUSTOM:
		return _("Custom")
	presets = (model or midad.load_model())["palettes"]["presets"]
	entry = presets.get(name, {})
	arabic = (frappe.local.lang or "en").split("-")[0] == "ar"
	return entry.get("label_ar" if arabic else "label_en") or name


def _ltr(text: Any) -> str:
	"""Text that must keep its own direction inside a sentence of either language (names, numbers)."""
	return f'<bdi dir="ltr">{escape_html(str(text))}</bdi>'


def contrast_line(failure: dict[str, Any]) -> str:
	"""One sentence naming a failing pair by its human labels, in the current language."""
	if failure["kind"] == "max":
		template = _("{0} on {1}, {2} mode: {3}:1; at most {4}:1 is allowed.")
	else:
		template = _("{0} on {1}, {2} mode: {3}:1; at least {4}:1 is required.")
	line = template.format(
		_(failure["fg_label"]),
		_(failure["bg_label"]),
		_(failure["mode_label"]),
		_ltr(failure["ratio_text"]),
		_ltr(f"{failure['required']:g}"),
	)
	if failure.get("adjust"):
		line += " " + _("Adjust the {0} colour.").format(_(failure["adjust_label"]))
	return line


def contrast_message(failures: list[dict[str, Any]]) -> str:
	"""The rejection message: a lead-in and one list item per failing pair."""
	items = "".join(f"<li>{contrast_line(failure)}</li>" for failure in failures)
	return (
		_("Custom colour preset rejected. These pairs are below their minimum contrast:")
		+ f"<ul>{items}</ul>"
	)


def check_custom_palette(
	primary: str | None, accent: str | None, model: midad.Model | None = None
) -> CustomPreset:
	"""Generate the custom preset and throw (naming every failing pair) unless it passes."""
	for value in (primary, accent):
		if not HEX.match(value or ""):
			frappe.throw(
				_("{0} is not a colour written as six hex digits, for example #1F3A5F.").format(
					_ltr(value or "")
				)
			)
	result = midad.custom_preset(primary, accent, model)
	if result.failures:
		frappe.throw(contrast_message(result.failures), title=_("Custom colour preset rejected"))
	return result


def audit_summary(result: CustomPreset, model: midad.Model | None = None) -> str:
	"""Language-neutral summary stored in `custom_audit`: passed pairs out of all, lowest ratio.

	The form shows `audit_text` instead (labels, in the user's language); this stored value is
	rewritten on every save.
	"""
	model = model or midad.load_model()
	measured = midad.contrast_results(model, result.palette)
	passed = sum(1 for pair in measured if pair.passed)
	lowest = min((pair.ratio for pair in measured if pair.kind == "min"), default=0.0)
	return f"{passed} / {len(measured)} \u00b7 {midad.ratio_text(lowest)}:1"


def audit_text(result: CustomPreset, model: midad.Model | None = None) -> str:
	"""The contrast check in words, in the current language, naming the tightest pair by its labels."""
	model = model or midad.load_model()
	measured = midad.contrast_results(model, result.palette)
	passed = sum(1 for pair in measured if pair.passed)
	minima = [pair for pair in measured if pair.kind == "min"]
	if not minima:
		return ""
	tight = min(minima, key=lambda pair: pair.ratio / pair.limit)
	return _(
		"{0} of {1} contrast pairs pass. Tightest: {2} on {3}, {4} mode, {5}:1 (at least {6}:1 is required)."
	).format(
		passed,
		len(measured),
		_(token_label(tight.fg)),
		_(token_label(tight.bg)),
		_(mode_label(tight.mode)),
		_ltr(midad.ratio_text(tight.ratio)),
		_ltr(f"{tight.limit:g}"),
	)


def environment_label(value: str | None) -> str:
	"""The ribbon word for `site_config.ins_environment`, translated; empty for production.

	Anything other than the known words is treated as non-production: when in doubt, show it.
	"""
	word = (value or "").strip()
	if not word or word.lower() == "production":
		return ""
	known = {
		"training": _("Training"),
		"uat": _("UAT"),
		"staging": _("Staging"),
	}
	return known.get(word.lower()) or _("Non-production")


# ----------------------------------------------------------------------------------------------
# Files
# ----------------------------------------------------------------------------------------------


def _public_path(file_url: str) -> str | None:
	"""Disk path of a public file URL under /files/, or None for any other URL."""
	if not file_url.startswith("/files/") or ".." in file_url.split("/"):
		return None
	return frappe.get_site_path("public", file_url.lstrip("/"))


def _file_name(file_url: str) -> str:
	return os.path.basename(file_url) or file_url


class InstitutionalThemeSettings(Document):
	def onload(self) -> None:
		self.environment = environment_label(frappe.conf.get("ins_environment"))
		self.show_audit_text()
		missing = self.missing_font_files()
		if missing:
			self.set_onload(
				"missing_font_message",
				_(
					"The uploaded font {0} is missing from the server; IBM Plex is used until it is uploaded again."
				).format(", ".join(_ltr(name) for name in missing)),
			)

	def validate(self) -> None:
		self.environment = None  # shown from site_config; never stored
		self.validate_default_preset()
		self.validate_custom_preset()
		self.validate_fonts()
		self.validate_images()
		self.validate_idle_warning()

	def on_update(self) -> None:
		identity_sync.apply(self, self.get_doc_before_save())

	# -- colour ------------------------------------------------------------------------------

	def allowed(self, preset: str) -> bool:
		if preset == CUSTOM:
			return bool(cint(self.allow_custom))
		return bool(cint(self.get(f"allow_{preset}")))

	def validate_default_preset(self) -> None:
		default = self.default_palette or "midad"
		if default != CUSTOM and default not in shipped_presets():
			frappe.throw(_("The colour preset {0} is not available.").format(_ltr(default)))
		if not self.allowed(default):
			frappe.throw(
				_("The default colour preset {0} must also be allowed.").format(
					frappe.bold(preset_label(default))
				)
			)

	def validate_custom_preset(self) -> None:
		if not (cint(self.allow_custom) or self.default_palette == CUSTOM):
			self.custom_audit = None
			return
		for fieldname, label in (("custom_primary", "Primary colour"), ("custom_accent", "Accent colour")):
			if not self.get(fieldname):
				frappe.throw(_("{0} is required").format(frappe.bold(_(label))), frappe.MandatoryError)
		result = check_custom_palette(self.custom_primary, self.custom_accent)
		self.custom_audit = audit_summary(result)

	# -- fonts and images -------------------------------------------------------------------

	def font_urls(self) -> dict[str, str]:
		return {key: self.get(field) for field, key in FONT_FIELDS.items() if self.get(field)}

	def missing_font_files(self) -> list[str]:
		"""Names of uploaded fonts that are set but absent on disk. Only for the Uploaded pairing."""
		if self.font_pairing != "Uploaded":
			return []
		missing = []
		for field in FONT_FIELDS:
			url = self.get(field)
			path = _public_path(url) if url else None
			if url and not (path and os.path.isfile(path)):
				missing.append(_file_name(url))
		return missing

	def changed(self, fieldname: str) -> bool:
		"""True when the field differs from the previous save (or there is no previous save)."""
		old = self.get_doc_before_save()
		return old is None or (old.get(fieldname) or "") != (self.get(fieldname) or "")

	def validate_fonts(self) -> None:
		"""Uploaded fonts are checked only for the Uploaded pairing, and only when they changed.

		After a restore without files the URLs are set and the files are gone. Saving must still work
		(for example to switch to another pairing), so unchanged fields are not re-checked while the
		pairing stays Uploaded; choosing Uploaded checks every file again.
		"""
		if self.font_pairing != "Uploaded":
			return
		old = self.get_doc_before_save()
		newly_uploaded = old is None or old.font_pairing != "Uploaded"
		for field, label in FONT_FIELD_LABELS.items():
			if not self.get(field):
				frappe.throw(_("{0} is required").format(frappe.bold(_(label))), frappe.MandatoryError)
		for field in FONT_FIELDS:
			url = self.get(field)
			if url and (newly_uploaded or self.changed(field)):
				self.check_font_file(url)

	def check_font_file(self, url: str) -> None:
		if url.startswith("/private/"):
			frappe.throw(
				_(
					"The font file {0} must be public so that the login page and printouts can load it."
				).format(_ltr(_file_name(url)))
			)
		path = _public_path(url)
		if not path or fonts.file_kind(path) is None:
			frappe.throw(_("{0} is not a WOFF2 or TrueType font file.").format(_ltr(_file_name(url))))

	def validate_images(self) -> None:
		for field in identity_sync.IMAGE_FIELDS:
			url = self.get(field)
			if url and url.startswith("/private/") and self.changed(field):
				frappe.throw(
					_(
						"The image {0} must be public so that the login page and printouts can load it."
					).format(_ltr(_file_name(url)))
				)

	def show_audit_text(self) -> None:
		"""Show the contrast check in words, in the user's language, on the form only."""
		if not (cint(self.allow_custom) or self.default_palette == CUSTOM):
			return
		if not (HEX.match(self.custom_primary or "") and HEX.match(self.custom_accent or "")):
			return
		self.custom_audit = audit_text(midad.custom_preset(self.custom_primary, self.custom_accent))

	# -- behaviour --------------------------------------------------------------------------

	def validate_idle_warning(self) -> None:
		if cint(self.enable_idle_warning) and not IDLE_MIN <= cint(self.idle_warning_minutes) <= IDLE_MAX:
			frappe.throw(_("The idle warning must come between 1 and 30 minutes before the session expires."))
