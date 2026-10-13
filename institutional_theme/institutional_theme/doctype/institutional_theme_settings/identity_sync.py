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
- Install and migrate never call `apply`.

`restore()` and `delete_attachments()` are called from `before_uninstall` (`institutional_theme/install.py`).
"""

from __future__ import annotations

import json
from typing import Any

import frappe

DOCTYPE = "Institutional Theme Settings"
PRIOR_KEY = "ins_identity_prior"
WRITTEN_KEY = "ins_identity_written"

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
				continue
			# Cleared here: forget the key. The original value goes back only into a target that still
			# holds what this app wrote; an administrator's later edit is left alone.
			original = prior.pop(key, None)
			wrote = written.pop(key, None)
			if wrote is not None and _text(current) == _text(wrote):
				batch[target_field] = original

	_store(PRIOR_KEY, prior)
	_store(WRITTEN_KEY, written)

	if website:
		frappe.db.set_single_value("Website Settings", website)
	if navbar:
		settings = frappe.get_single("Navbar Settings")
		for fieldname, value in navbar.items():
			settings.set(fieldname, value)
		settings.save()
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


def delete_attachments() -> int:
	"""Delete the File rows attached to the settings. A file shared by `content_hash` stays on disk."""
	names = frappe.get_all("File", filters={"attached_to_doctype": DOCTYPE}, pluck="name")
	for name in names:
		frappe.delete_doc("File", name, force=True, ignore_permissions=True)
	return len(names)
