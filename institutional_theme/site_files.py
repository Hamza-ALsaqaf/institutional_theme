"""Generated per-site stylesheets and the links to them (ADR 0003, 0004).

Two files live in `sites/<site>/public/files/institutional_theme/` and are served at
`/files/institutional_theme/...`:

- `ins_palette_custom.<h>.css`, only while the custom preset is allowed or is the default, and only
  when the palette passes every contrast pair (`PaletteRejected` writes nothing);
- `ins_fonts_uploaded.<h>.css`, only while the pairing is `Uploaded` and a script has both its files.

`<h>` is the first 12 hex digits of the SHA-256 of the content, so a name never outlives its content
and no name is stored in the database. `ensure()` never writes the database.
"""

from __future__ import annotations

import functools
import hashlib
import os
import threading
from typing import Any
from urllib.parse import quote

import frappe

from institutional_theme import fonts
from institutional_theme.midad import model as midad

DOCTYPE = "Institutional Theme Settings"
FOLDER = ("public", "files", "institutional_theme")
URL_BASE = "/files/institutional_theme"
PALETTE_PREFIX = "ins_palette_custom"
FONTS_PREFIX = "ins_fonts_uploaded"
PREFIXES = (PALETTE_PREFIX, FONTS_PREFIX)
PALETTE_BUNDLE = "ins_palette_{0}.bundle.css"
HASH_LENGTH = 12
CUSTOM = "custom"

# One entry per site and settings state: {(site, state, present): {kind: file name}}.
_memo: dict[tuple[Any, ...], dict[str, str]] = {}
_memo_lock = threading.Lock()


# ----------------------------------------------------------------------------------------------
# Settings
# ----------------------------------------------------------------------------------------------


def get_settings() -> Any:
	"""The cached settings document, or `None` when the doctype is not installed yet."""
	try:
		return frappe.get_cached_doc(DOCTYPE)
	except Exception:
		return None


def _folder() -> str:
	return frappe.get_site_path(*FOLDER)


def _font_path(url: str) -> str | None:
	"""Disk path of a public `/files/` URL, or `None` for any other URL."""
	if not url or not url.startswith("/files/") or ".." in url.split("/"):
		return None
	return frappe.get_site_path("public", url.lstrip("/"))


def _font_present(settings: Any) -> tuple[bool, ...]:
	present = []
	for field in fonts_fields():
		path = _font_path(settings.get(field) or "")
		present.append(bool(path and os.path.isfile(path)))
	return tuple(present)


def fonts_fields() -> tuple[str, ...]:
	return ("font_arabic_regular", "font_arabic_semibold", "font_latin_regular", "font_latin_semibold")


def custom_wanted(settings: Any) -> bool:
	return bool(settings.get("allow_custom") or settings.get("default_palette") == CUSTOM)


# ----------------------------------------------------------------------------------------------
# Content (pure given the settings)
# ----------------------------------------------------------------------------------------------


def palette_content(settings: Any) -> str | None:
	"""CSS of the custom preset, or `None` when it is not wanted, incomplete or fails its audit."""
	if not custom_wanted(settings):
		return None
	primary, accent = settings.get("custom_primary"), settings.get("custom_accent")
	if not (primary and accent):
		return None
	return _custom_css(primary, accent)


@functools.lru_cache(maxsize=16)
def _custom_css(primary: str, accent: str) -> str | None:
	"""Pure in its two inputs, so it is remembered; `None` when the audit fails."""
	try:
		return midad.custom_palette_css(primary, accent)
	except midad.PaletteRejected, ValueError:
		return None


def fonts_content(settings: Any) -> str | None:
	"""CSS of the uploaded fonts, or `None` when the pairing is not Uploaded or nothing is usable."""
	if settings.get("font_pairing") != "Uploaded":
		return None
	uploaded: dict[str, fonts.UploadedFont | None] = {}
	for field, key in zip(fonts_fields(), fonts.UPLOAD_KEYS, strict=True):
		url = settings.get(field) or ""
		path = _font_path(url)
		kind = fonts.file_kind(path) if path else None
		try:
			uploaded[key] = fonts.UploadedFont(quote(url, safe="/"), kind) if kind else None
		except ValueError:
			uploaded[key] = None
	return fonts.uploaded_font_css(uploaded) or None


def file_name(prefix: str, content: str) -> str:
	digest = hashlib.sha256(content.encode("utf-8")).hexdigest()[:HASH_LENGTH]
	return f"{prefix}.{digest}.css"


# ----------------------------------------------------------------------------------------------
# Writing
# ----------------------------------------------------------------------------------------------


def _write_atomic(folder: str, name: str, content: str) -> None:
	"""Write `<name>.<pid>.tmp`, fsync it and replace the target, so a reader never sees a part."""
	target = os.path.join(folder, name)
	if os.path.isfile(target):
		return
	os.makedirs(folder, exist_ok=True)
	temporary = f"{target}.{os.getpid()}.{threading.get_ident()}.tmp"
	try:
		with open(temporary, "wb") as handle:
			handle.write(content.encode("utf-8"))
			handle.flush()
			os.fsync(handle.fileno())
		os.replace(temporary, target)
	finally:
		if os.path.exists(temporary):
			os.unlink(temporary)


def _files_exist(entry: dict[str, str]) -> bool:
	folder = _folder()
	return all(os.path.isfile(os.path.join(folder, name)) for name in entry.values())


def _state(settings: Any) -> tuple[Any, ...]:
	"""The settings values the generated files depend on (not `modified`: a Single may not carry it)."""
	return tuple(
		settings.get(field)
		for field in (
			"allow_custom",
			"default_palette",
			"custom_primary",
			"custom_accent",
			"font_pairing",
			*fonts_fields(),
		)
	)


def ensure(settings: Any | None = None) -> dict[str, str]:
	"""Create the generated files that are missing and return the URLs to link, by kind.

	`settings` is the document just saved (the `on_update` hook: the cached copy is still the old
	one there); every other caller omits it and gets the cached document.

	Keys: `palette` and `fonts`. A kind that is not wanted, not usable or cannot be written has no key.
	A failure to write one file never raises: that file is simply not linked.
	"""
	settings = settings if settings is not None else get_settings()
	if settings is None:
		return {}
	key = (frappe.local.site, _state(settings), _font_present(settings))
	with _memo_lock:
		entry = _memo.get(key)
	if entry is not None and _files_exist(entry):
		return _urls(entry)

	entry = {}
	folder = _folder()
	for kind, prefix, content in (
		("palette", PALETTE_PREFIX, palette_content(settings)),
		("fonts", FONTS_PREFIX, fonts_content(settings)),
	):
		if not content:
			continue
		name = file_name(prefix, content)
		try:
			_write_atomic(folder, name, content)
		except OSError:
			continue
		entry[kind] = name
	with _memo_lock:
		# Keep the memo small: one entry per site is enough, older states are never asked for again.
		for stale in [k for k in _memo if k[0] == key[0]]:
			del _memo[stale]
		_memo[key] = entry
	prune(keep=entry.values())
	return _urls(entry)


def _urls(entry: dict[str, str]) -> dict[str, str]:
	return {kind: f"{URL_BASE}/{name}" for kind, name in entry.items()}


def prune(keep: Any = ()) -> list[str]:
	"""Delete old generated files; keep the ones in `keep` and the newest previous file of each kind."""
	folder = _folder()
	if not os.path.isdir(folder):
		return []
	keep = set(keep)
	removed: list[str] = []
	for prefix in PREFIXES:
		candidates = [
			name
			for name in os.listdir(folder)
			if name.startswith(prefix + ".") and name.endswith(".css") and name not in keep
		]
		candidates.sort(key=lambda name: os.path.getmtime(os.path.join(folder, name)), reverse=True)
		for name in candidates[1:]:
			try:
				os.unlink(os.path.join(folder, name))
				removed.append(name)
			except OSError:
				continue
	return removed


def clear_memo() -> None:
	"""Forget every remembered state (tests, and a changed settings document)."""
	with _memo_lock:
		_memo.clear()


# ----------------------------------------------------------------------------------------------
# Links
# ----------------------------------------------------------------------------------------------


def bundle_linkable(name: str) -> bool:
	"""True when the asset manifest has `<name>` and `rtl_<name>`; a missing key is a broken link."""
	assets = frappe.utils.get_assets_json()
	return bool(assets.get(name)) and bool(assets.get(f"rtl_{name}"))


def palette_url(key: str) -> str | None:
	"""The `app_include_css` entry of a palette: a bundle name or a `/files/` URL.

	`None` for `midad` (its tokens are in `ins_desk`) and for a palette that cannot be linked.
	"""
	if key == midad.BASE_PRESET:
		return None
	if key == CUSTOM:
		return ensure().get("palette")
	name = PALETTE_BUNDLE.format(key)
	return name if bundle_linkable(name) else None


def palette_linkable(key: str) -> bool:
	"""Whether the palette can be shown: `midad` always, others only when their file exists."""
	return key == midad.BASE_PRESET or palette_url(key) is not None


def font_links(settings: Any | None = None) -> list[str]:
	"""Stylesheets of the selected font pairing, none for IBM Plex (it is inside `ins_desk`)."""
	settings = settings or get_settings()
	if settings is None:
		return []
	pairing = settings.get("font_pairing") or fonts.DEFAULT_PAIRING
	if pairing == "Uploaded":
		url = ensure().get("fonts")
		return [url] if url else []
	bundle = fonts.PAIRING_BUNDLES.get(pairing)
	return [bundle] if bundle and bundle_linkable(bundle) else []


# ----------------------------------------------------------------------------------------------
# Hooks
# ----------------------------------------------------------------------------------------------


def on_settings_update(doc: Any = None, method: str | None = None) -> None:
	"""`doc_events` hook: regenerate the files after the settings are saved and clear page caches."""
	clear_memo()
	try:
		import frappe.website.utils

		ensure(doc)
		frappe.website.utils.clear_cache()
	except Exception:
		frappe.log_error(title="Institutional Theme: generated files")


def after_migrate() -> None:
	"""Regenerate the files after a migrate (a restore does not migrate; the lazy path covers it)."""
	clear_memo()
	ensure()
