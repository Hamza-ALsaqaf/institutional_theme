"""Identity write-through of the Institutional Theme Settings (ADR 0005).

Three settings fields are copied into core settings that show them:

| Field | Target |
|---|---|
| `system_name` | Website Settings `app_name` |
| `emblem` | Website Settings `app_logo` and `splash_image`, Navbar Settings `app_logo` |
| `favicon` | Website Settings `favicon` |

Rules:
- Only a field that changed in this save is written, so a save that touches colours never overwrites
  an identity value an administrator changed in Website Settings.
- Website Settings is written with `frappe.db.set_single_value`: its `save()` needs the Website Manager
  role and runs unrelated validators (upgrade review, finding 1). Its caches are cleared as its
  `on_update` would. Navbar Settings has no `validate`, so its `save()` is used.
- The first time a target is written, its current value is stored in the global `ins_identity_prior`;
  each value written is stored in `ins_identity_written`. `restore()` puts the prior value back, but
  only into a target that still holds the value this app wrote.
- Core copies a file when a document that holds another document's file in an Attach field is saved
  (`frappe/hooks.py` `doc_events["*"]["on_update"]`, `core/doctype/file/utils.py`
  `attach_files_to_document`). Those copies are the app's leftovers, but an administrator's own File rows
  can have the same `file_url` and `content_hash` (core's de-duplication). So ownership is recorded, not
  guessed from the hash: the global `ins_identity_files` keeps, per target, each value this app wrote, the
  time of the write and the names of the File rows that the write itself created: every row attached to
  Navbar Settings `app_logo` since the write began, whatever its `file_url` (core re-saves content that
  decodes as text, `File.get_content`, so a copy can have another hash and name). A row that existed before the
  write is never owned. Website Settings is written without `save()`, so core copies appear only when somebody
  saves it later; those rows are recognised by target field, `file_url` equal to a written value and
  `creation` at or after the write.
- Install and migrate never call `apply`.

`restore()` and `delete_attachments()` are called from `before_uninstall` (`institutional_theme/install.py`).
`ins_identity_files` starts with the prefix that `install.clear_globals` deletes, and `delete_attachments()`
removes it itself once the files are gone.
"""

from __future__ import annotations

import json
from typing import Any

import frappe
from frappe.utils import now_datetime

DOCTYPE = "Institutional Theme Settings"
PRIOR_KEY = "ins_identity_prior"
WRITTEN_KEY = "ins_identity_written"
FILES_KEY = "ins_identity_files"

# settings field -> ((target doctype, target field), ...)
TARGETS: dict[str, tuple[tuple[str, str], ...]] = {
	"system_name": (("Website Settings", "app_name"),),
	"emblem": (
		("Website Settings", "app_logo"),
		("Website Settings", "splash_image"),
		("Navbar Settings", "app_logo"),
	),
	"favicon": (("Website Settings", "favicon"),),
}
IMAGE_FIELDS = ("emblem", "favicon")


def _key(doctype: str, fieldname: str) -> str:
	return f"{doctype}.{fieldname}"


def _load(global_key: str) -> dict[str, Any]:
	raw = frappe.db.get_global(global_key)
	if not raw:
		return {}
	try:
		value = json.loads(raw)
	except TypeError, ValueError:
		return {}
	return value if isinstance(value, dict) else {}


def _store(global_key: str, value: dict[str, Any]) -> None:
	frappe.db.set_global(global_key, json.dumps(value, sort_keys=True))


def _text(value: Any) -> str:
	return "" if value is None else str(value)


def _stamp() -> str:
	"""Now, with microseconds, in the format of `File.creation` (the seconds-only `frappe.utils.now()`
	would let a row created earlier in the same second count as new)."""
	return str(now_datetime())


def _record_write(files: dict[str, Any], key: str, url: str, since: str, names: list[str]) -> None:
	"""Remember that this app wrote `url` to the target `key` at `since`, and which File rows that created."""
	entries = files.setdefault(key, [])
	for entry in entries:
		if entry["url"] == url:
			entry["since"] = min(entry["since"], since)
			entry["names"] = sorted(set(entry["names"]) | set(names))
			return
	entries.append({"url": url, "since": since, "names": sorted(names)})


def _created_since(doctype: str, fieldname: str, since: str, url: str | None = None) -> list[str]:
	"""Names of the File rows attached to `doctype`.`fieldname` that were created at or after `since`,
	for `url` when one is given."""
	filters: dict[str, Any] = {
		"attached_to_doctype": doctype,
		"attached_to_field": fieldname,
		"creation": (">=", since),
	}
	if url:
		filters["file_url"] = url
	return frappe.get_all("File", filters=filters, pluck="name")


def changed_fields(doc: Any, old: Any) -> list[str]:
	"""Identity fields whose value differs from the previous save.

	With no previous document a field counts as changed when it is not empty.
	"""
	changed = []
	for field in TARGETS:
		new_value = _text(doc.get(field))
		old_value = _text(old.get(field)) if old is not None else ""
		if new_value != old_value:
			changed.append(field)
	return changed


def clear_website_caches() -> None:
	"""The cache clearing that Website Settings `on_update` performs."""
	import frappe.website.utils

	frappe.clear_cache(user="Guest")
	frappe.website.utils.clear_cache()
	frappe.clear_cache()


def apply(doc: Any, old: Any) -> list[str]:
	"""Write the changed identity fields through. Returns the settings fields that were written."""
	changed = changed_fields(doc, old)
	if not changed:
		return []
	frappe.has_permission(DOCTYPE, "write", throw=True)

	prior = _load(PRIOR_KEY)
	written = _load(WRITTEN_KEY)
	files = _load(FILES_KEY)
	since = _stamp()
	website: dict[str, Any] = {}
	navbar: dict[str, Any] = {}

	for field in changed:
		value = _text(doc.get(field))
		for target_doctype, target_field in TARGETS[field]:
			key = _key(target_doctype, target_field)
			current = frappe.db.get_single_value(target_doctype, target_field)
			if key not in prior:
				prior[key] = current
			batch = website if target_doctype == "Website Settings" else navbar
			if value:
				batch[target_field] = value
				written[key] = value
				if target_doctype == "Website Settings":
					_record_write(files, key, value, since, [])
				continue
			# Cleared here: forget the key. The original value goes back only into a target that still
			# holds what this app wrote; an administrator's later edit is left alone.
			original = prior.pop(key, None)
			wrote = written.pop(key, None)
			if wrote is not None and _text(current) == _text(wrote):
				batch[target_field] = original

	_store(PRIOR_KEY, prior)
	_store(WRITTEN_KEY, written)
	_store(FILES_KEY, files)

	if website:
		frappe.db.set_single_value("Website Settings", website)
	if navbar:
		settings = frappe.get_single("Navbar Settings")
		for fieldname, value in navbar.items():
			settings.set(fieldname, value)
		settings.save()
		# `save()` ran core's attach hook: the rows created by this very save belong to this app.
		for fieldname, value in navbar.items():
			if value and written.get(_key("Navbar Settings", fieldname)) == value:
				_record_write(
					files,
					_key("Navbar Settings", fieldname),
					value,
					since,
					_created_since("Navbar Settings", fieldname, since),
				)
		_store(FILES_KEY, files)
	if website or navbar:
		clear_website_caches()
	return changed


def restore() -> list[str]:
	"""Give every target that still holds the value this app wrote its prior value back.

	A target an administrator changed afterwards is left alone. Clears both globals. Returns the
	keys that were restored. Idempotent: a second call finds nothing to do.
	"""
	prior = _load(PRIOR_KEY)
	written = _load(WRITTEN_KEY)
	restored: list[str] = []
	website: dict[str, Any] = {}
	navbar: dict[str, Any] = {}

	for key, value in written.items():
		target_doctype, _sep, target_field = key.partition(".")
		if _text(frappe.db.get_single_value(target_doctype, target_field)) != _text(value):
			continue
		(website if target_doctype == "Website Settings" else navbar)[target_field] = prior.get(key)
		restored.append(key)

	if website:
		frappe.db.set_single_value("Website Settings", website)
	if navbar:
		settings = frappe.get_single("Navbar Settings")
		for fieldname, value in navbar.items():
			settings.set(fieldname, value)
		settings.save()
	if restored:
		clear_website_caches()

	for global_key in (PRIOR_KEY, WRITTEN_KEY):
		frappe.defaults.clear_default(key=global_key, parent="__global")
	return restored


def _owned_copies(files: dict[str, Any]) -> list[str]:
	"""Names of the File rows this app is responsible for, per `ins_identity_files`.

	A recorded name counts as is. For Website Settings, where core copies a file only when the document is
	saved after this app wrote it, a row counts when it is attached to the written field, carries a written
	`file_url`, and was created at or after that write. A row whose `file_url` is what the target shows now is
	never owned: it is what the site displays.
	"""
	owned: list[str] = []
	for key, entries in files.items():
		target_doctype, _sep, target_field = key.partition(".")
		showing = _text(frappe.db.get_single_value(target_doctype, target_field))
		for entry in entries:
			candidates = list(entry.get("names", []))
			if target_doctype == "Website Settings":
				candidates += _created_since(target_doctype, target_field, entry["since"], entry["url"])
			for name in dict.fromkeys(candidates):
				row = frappe.db.get_value(
					"File",
					name,
					["file_url", "attached_to_doctype", "attached_to_field"],
					as_dict=True,
				)
				if (
					row
					and row.attached_to_doctype == target_doctype
					and row.attached_to_field == target_field
					and _text(row.file_url) != showing
				):
					owned.append(name)
	return list(dict.fromkeys(owned))


def delete_attachments() -> int:
	"""Delete the File rows this app owns: those attached to the settings doctype, and the copies core made
	of its images for Navbar Settings and Website Settings (see the module docstring for how ownership is
	known). An administrator's own file, even one with the same bytes as the emblem, is never touched: core
	keeps the file on disk while a row that stays shares its `content_hash`. Idempotent; forgets the record.
	"""
	names = frappe.get_all("File", filters={"attached_to_doctype": DOCTYPE}, pluck="name")
	names += _owned_copies(_load(FILES_KEY))
	deleted = 0
	for name in dict.fromkeys(names):
		if frappe.db.exists("File", name):
			frappe.delete_doc("File", name, force=True, ignore_permissions=True)
			deleted += 1
	frappe.defaults.clear_default(key=FILES_KEY, parent="__global")
	return deleted
