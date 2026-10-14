"""Ship the Midad Print Style and Letter Head (ADR 0004, 0005).

Two records are created and kept current:

- Print Style `Midad`: the font block of the selected pairing (`fonts.print_font_css`, one TTF per face,
  because wkhtmltopdf reads no WOFF2), the `.print-format` family rule (`fonts.print_font_families`), then the compiled `ins_print.bundle.css`, read from the
  built assets through the asset manifest;
- Letter Head `Midad`: `print/letter_head.html` as the header and `print/letter_head_footer.html` as the
  footer, both Jinja that calls `ins_identity()` (`identity.py`), source "HTML".

Rules:
- Idempotent. The checksum of what was written is kept in the global `ins_print_shipped` (JSON,
  `frappe.db.set_global`). The same content again is a no-op.
- A record whose current content differs from the stored checksum was changed by an administrator: it is
  never overwritten, a line is logged and the outcome is `skipped`. A record an administrator deleted is
  not created again. A record of that name that this app did not ship is left alone.
- Nothing is made the default: the Letter Head is created with `is_default` 0 (core would otherwise make
  the first Letter Head the default) and Print Settings is not touched. Choosing them is the
  administrator's decision (behaviour changes ship disabled).
- A missing source (the compiled bundle, a template file) skips that record with a log line; it never
  raises. `after_install`, `after_migrate` and the settings save call `ship()` inside a guard.
- Uninstall: `remove()` deletes a record that still has the shipped content and is not linked from
  another document; a changed or linked record is kept and logged.

Letter Head content is an HTML Editor field, which core sanitises on save (`model/base_document.py:1307`)
and which would strip Jinja-bearing attributes; the shipped HTML is trusted, so it is written with
`frappe.db.set_value` after the insert.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from urllib.parse import quote

import frappe

from institutional_theme import fonts, guard_log, site_files

STYLE_DOCTYPE = "Print Style"
LETTER_DOCTYPE = "Letter Head"
NAME = "Midad"
GLOBAL_KEY = "ins_print_shipped"
PRINT_BUNDLE = "ins_print.bundle.css"
HEADER_FILE = "letter_head.html"
FOOTER_FILE = "letter_head_footer.html"
STYLE_KEY = "print_style"
LETTER_KEY = "letter_head"

CREATED = "created"
UPDATED = "updated"
UNCHANGED = "unchanged"
SKIPPED = "skipped"
REMOVED = "removed"
KEPT = "kept"

_SOURCE_MAP = re.compile(r"/\*#\s*sourceMappingURL=[^*]*\*/\s*$")
STYLE_COMMENT = (
	"/* Midad print style, shipped by institutional_theme.print.ship. If you edit this style the theme\n"
	"   keeps your version and no longer updates it. */\n"
)


# ----------------------------------------------------------------------------------------------
# Pure helpers
# ----------------------------------------------------------------------------------------------


def checksum(*parts: str) -> str:
	"""SHA-256 of the parts, each prefixed with its length so that two splits never collide."""
	digest = hashlib.sha256()
	for part in parts:
		data = (part or "").encode("utf-8")
		digest.update(f"{len(data)}:".encode("ascii"))
		digest.update(data)
	return digest.hexdigest()


def decide(exists: bool, current: str | None, stored: str | None, desired: str) -> tuple[str, str]:
	"""What to do with one record: `(action, reason)`.

	`current` is the checksum of the record as it is now (`None` when it does not exist), `stored` the
	checksum recorded when this app last wrote it (`None` when it never did) and `desired` the checksum
	of the content this version ships. `action` is `create`, `update`, `unchanged`, `adopt` (the record
	already holds the shipped content; only the checksum is recorded) or `skip`.
	"""
	if not exists:
		if stored is None:
			return "create", "missing"
		return "skip", "deleted by an administrator"
	if stored is None:
		if current == desired:
			return "adopt", "already holds the shipped content"
		return "skip", "exists and was not shipped by the theme"
	if current == desired:
		return (
			("unchanged", "up to date")
			if current == stored
			else ("adopt", "already holds the shipped content")
		)
	if current != stored:
		return "skip", "changed by an administrator"
	return "update", "newer content"


def strip_source_map(css: str) -> str:
	return _SOURCE_MAP.sub("", css.rstrip()) + "\n"


def compose_style(font_block: str, sans_family: str, bundle_css: str) -> str:
	"""The Print Style CSS: the font faces, the body family that uses them, then the bundle's rules.

	The bundle declares no font (wkhtmltopdf has no custom properties and the faces depend on the
	selected pairing), so the family rule is written here; without it a PDF falls back to DejaVu.
	"""
	family_rule = f".print-format {{\n\tfont-family: {sans_family};\n}}\n"
	return STYLE_COMMENT + font_block.rstrip() + "\n\n" + family_rule + "\n" + strip_source_map(bundle_css)


# ----------------------------------------------------------------------------------------------
# Sources
# ----------------------------------------------------------------------------------------------


def _log() -> Any:
	return frappe.logger("institutional_theme")


def _skip_log(what: str, reason: str) -> None:
	_log().info(f"Institutional Theme print shipping: {what} skipped: {reason}")


def bundle_path() -> str | None:
	"""Disk path of the compiled print bundle from the asset manifest, or `None` when not built."""
	try:
		assets = frappe.utils.get_assets_json()
	except Exception:
		return None
	url = assets.get(PRINT_BUNDLE) if assets else None
	if not url or not url.startswith("/assets/") or ".." in url.split("/"):
		return None
	path = os.path.abspath(os.path.join(frappe.local.sites_path, url.lstrip("/")))
	return path if os.path.isfile(path) else None


def _read(path: str | None) -> str | None:
	if not path:
		return None
	try:
		with open(path, encoding="utf-8") as handle:
			text = handle.read()
	except OSError:
		return None
	return text if text.strip() else None


def _uploaded(settings: Any) -> dict[str, fonts.UploadedFont | None]:
	"""The uploaded font files the settings point at, as `fonts.UploadedFont` (or `None`)."""
	uploaded: dict[str, fonts.UploadedFont | None] = {}
	for field, key in zip(site_files.fonts_fields(), fonts.UPLOAD_KEYS, strict=True):
		url = (settings.get(field) if settings is not None else "") or ""
		path = site_files._font_path(url)
		kind = fonts.file_kind(path) if path else None
		try:
			uploaded[key] = fonts.UploadedFont(quote(url, safe="/"), kind) if kind else None
		except ValueError:
			uploaded[key] = None
	return uploaded


def style_css(settings: Any = None) -> str | None:
	"""The Print Style CSS to ship, or `None` while the print bundle is not built."""
	bundle = _read(bundle_path())
	if bundle is None:
		return None
	if settings is None:
		settings = site_files.get_settings()
	pairing = (settings.get("font_pairing") if settings is not None else None) or fonts.DEFAULT_PAIRING
	if pairing not in fonts.PAIRINGS:
		pairing = fonts.DEFAULT_PAIRING
	uploaded = _uploaded(settings)
	families = fonts.print_font_families(pairing, uploaded)
	return compose_style(fonts.print_font_css(pairing, uploaded), families["sans"], bundle)


def letter_head_html() -> tuple[str, str] | None:
	"""`(header, footer)` from the app's template files, or `None` while either is missing."""
	header = _read(frappe.get_app_path("institutional_theme", "print", HEADER_FILE))
	footer = _read(frappe.get_app_path("institutional_theme", "print", FOOTER_FILE))
	if header is None or footer is None:
		return None
	return header, footer


# ----------------------------------------------------------------------------------------------
# State
# ----------------------------------------------------------------------------------------------


def _load() -> dict[str, str]:
	raw = frappe.db.get_global(GLOBAL_KEY)
	if not raw:
		return {}
	try:
		value = json.loads(raw)
	except TypeError, ValueError:
		return {}
	return {k: v for k, v in value.items() if isinstance(v, str)} if isinstance(value, dict) else {}


def _store(state: dict[str, str]) -> None:
	if state:
		frappe.db.set_global(GLOBAL_KEY, json.dumps(state, sort_keys=True))
	else:
		frappe.defaults.clear_default(key=GLOBAL_KEY, parent="__global")


def _style_checksum() -> str | None:
	if not frappe.db.exists(STYLE_DOCTYPE, NAME):
		return None
	return checksum(frappe.db.get_value(STYLE_DOCTYPE, NAME, "css") or "")


def _letter_checksum() -> str | None:
	if not frappe.db.exists(LETTER_DOCTYPE, NAME):
		return None
	row = frappe.db.get_value(
		LETTER_DOCTYPE, NAME, ["source", "content", "footer_source", "footer"], as_dict=True
	)
	return checksum(row.source, row.content, row.footer_source, row.footer)


@contextmanager
def _migrating() -> Iterator[None]:
	"""Make Letter Head's `before_insert` and `validate` behave as they do during install and migrate.

	Outside those, core switches a new Letter Head to source "Image" and makes the first one the default
	(`letter_head.py` `before_insert`, `validate_disabled_and_default`).
	"""
	previous = frappe.flags.in_migrate
	frappe.flags.in_migrate = True
	try:
		yield
	finally:
		frappe.flags.in_migrate = previous


# ----------------------------------------------------------------------------------------------
# Ship
# ----------------------------------------------------------------------------------------------


def _ship_style(state: dict[str, str], settings: Any) -> str:
	css = style_css(settings)
	if css is None:
		_skip_log(STYLE_DOCTYPE, "the compiled print bundle is not built yet")
		return f"{SKIPPED}: the compiled print bundle is not built yet"
	desired = checksum(css)
	action, reason = decide(
		frappe.db.exists(STYLE_DOCTYPE, NAME) is not None,
		_style_checksum(),
		state.get(STYLE_KEY),
		desired,
	)
	if action == "skip":
		_skip_log(STYLE_DOCTYPE, reason)
		return f"{SKIPPED}: {reason}"
	if action == "create":
		frappe.get_doc(
			{"doctype": STYLE_DOCTYPE, "print_style_name": NAME, "standard": 0, "disabled": 0, "css": css}
		).insert(ignore_permissions=True)
		state[STYLE_KEY] = desired
		return CREATED
	if action == "update":
		doc = frappe.get_doc(STYLE_DOCTYPE, NAME)
		doc.css = css
		doc.save(ignore_permissions=True)
		state[STYLE_KEY] = desired
		return UPDATED
	state[STYLE_KEY] = desired
	return UNCHANGED


def _ship_letter_head(state: dict[str, str]) -> str:
	html = letter_head_html()
	if html is None:
		_skip_log(LETTER_DOCTYPE, "print/letter_head.html or print/letter_head_footer.html is missing")
		return f"{SKIPPED}: the letter head template files are missing"
	header, footer = html
	desired = checksum("HTML", header, "HTML", footer)
	values = {"source": "HTML", "content": header, "footer_source": "HTML", "footer": footer}
	action, reason = decide(
		frappe.db.exists(LETTER_DOCTYPE, NAME) is not None,
		_letter_checksum(),
		state.get(LETTER_KEY),
		desired,
	)
	if action == "skip":
		_skip_log(LETTER_DOCTYPE, reason)
		return f"{SKIPPED}: {reason}"
	if action == "create":
		with _migrating():
			frappe.get_doc(
				{
					"doctype": LETTER_DOCTYPE,
					"letter_head_name": NAME,
					"is_default": 0,
					"disabled": 0,
					"align": "Left",
					**values,
				}
			).insert(ignore_permissions=True)
		# Core sanitised the HTML on insert; write the shipped text back exactly.
		frappe.db.set_value(LETTER_DOCTYPE, NAME, values)
		state[LETTER_KEY] = desired
		return CREATED
	if action == "update":
		frappe.db.set_value(LETTER_DOCTYPE, NAME, values)
		state[LETTER_KEY] = desired
		return UPDATED
	state[LETTER_KEY] = desired
	return UNCHANGED


def ship(settings: Any = None) -> dict[str, str]:
	"""Create or update the Print Style and Letter Head. Returns the outcome of each, by key.

	An outcome is `created`, `updated`, `unchanged` or `skipped: <reason>`. Each record is independent;
	an exception in one is logged and reported as `skipped: error` and the other still runs.
	"""
	state = _load()
	result: dict[str, str] = {}
	for key, step in (
		(STYLE_KEY, lambda: _ship_style(state, settings)),
		(LETTER_KEY, lambda: _ship_letter_head(state)),
	):
		try:
			result[key] = step()
		except Exception:
			guard_log.log_once(f"Institutional Theme print shipping: {key}", defer=False)
			result[key] = f"{SKIPPED}: error (see the Error Log)"
	_store(state)
	return result


def safe_ship(settings: Any = None) -> dict[str, str]:
	"""`ship()` that never raises, for install, migrate and the settings save."""
	try:
		return ship(settings)
	except Exception:
		guard_log.log_once("Institutional Theme print shipping", defer=False)
		return {}


def on_settings_update(doc: Any = None, method: str | None = None) -> None:
	"""`doc_events` hook of the settings: the font block follows the selected pairing."""
	safe_ship(doc)


# ----------------------------------------------------------------------------------------------
# Remove
# ----------------------------------------------------------------------------------------------


def _remove_one(doctype: str, current: str | None, stored: str | None) -> str:
	if current is None:
		return f"{REMOVED}: not present"
	if stored is None or current != stored:
		_skip_log(doctype, "kept on uninstall: changed or not shipped by the theme")
		return f"{KEPT}: changed or not shipped by the theme"
	try:
		frappe.delete_doc(doctype, NAME, ignore_permissions=True)
	except frappe.LinkExistsError:
		_skip_log(doctype, "kept on uninstall: another document links to it")
		return f"{KEPT}: linked from another document"
	return REMOVED


def remove() -> dict[str, str]:
	"""Delete the shipped records that still hold the shipped content and are not linked.

	Called by `before_uninstall` before the checksums are cleared. A record an administrator changed,
	or one that another document links to, stays and is logged; it is then an ordinary record.
	"""
	state = _load()
	result = {
		STYLE_KEY: _remove_one(STYLE_DOCTYPE, _style_checksum(), state.get(STYLE_KEY)),
		LETTER_KEY: _remove_one(LETTER_DOCTYPE, _letter_checksum(), state.get(LETTER_KEY)),
	}
	frappe.defaults.clear_default(key=GLOBAL_KEY, parent="__global")
	return result
