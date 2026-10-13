"""Install, migrate and uninstall paths. Every function is idempotent.

`before_uninstall` leaves the stock look: it gives the identity values this app wrote to core
settings back (only where an administrator did not change them since), and removes everything this
app stored outside its own doctype. It never raises: the steps are independent, so an error in one is
logged and the others still run. Frappe calls it with no arguments after the backup and before the
modules and doctypes are deleted (the settings doctype and its values go with the module).
"""

from __future__ import annotations

import os
import shutil
from collections.abc import Callable

import frappe

from institutional_theme import site_files
from institutional_theme.institutional_theme.doctype.institutional_theme_settings import identity_sync

# Per-user choices stored with `frappe.defaults` (ADR 0002).
USER_DEFAULT_KEYS = ("ins_palette", "ins_density")
GLOBAL_PREFIX = "ins_identity_"
SITE_FILES_FOLDER = ("public", "files", "institutional_theme")


def clear_globals() -> int:
	"""Delete the global (`__global`) rows this app keeps, such as the identity checksums."""
	names = frappe.get_all(
		"DefaultValue",
		filters={"parent": "__global", "defkey": ("like", f"{GLOBAL_PREFIX}%")},
		pluck="name",
	)
	for name in names:
		frappe.db.delete("DefaultValue", {"name": name})
	return len(names)


def clear_user_defaults() -> int:
	"""Delete every user's palette and density choice."""
	count = frappe.db.count("DefaultValue", {"defkey": ("in", USER_DEFAULT_KEYS)})
	frappe.db.delete("DefaultValue", {"defkey": ("in", USER_DEFAULT_KEYS)})
	return count


def delete_versions() -> int:
	"""Delete the change history (`track_changes`) of the settings doctype."""
	count = frappe.db.count("Version", {"ref_doctype": identity_sync.DOCTYPE})
	frappe.db.delete("Version", {"ref_doctype": identity_sync.DOCTYPE})
	return count


def remove_site_files() -> bool:
	"""Delete the folder of generated per-site CSS files, if it exists."""
	folder = frappe.get_site_path(*SITE_FILES_FOLDER)
	existed = os.path.isdir(folder)
	shutil.rmtree(folder, ignore_errors=True)
	return existed


def _run(steps: tuple[tuple[str, Callable[[], object]], ...]) -> None:
	for title, step in steps:
		try:
			step()
		except Exception:
			frappe.log_error(title=f"Institutional Theme uninstall: {title}")


def after_migrate() -> None:
	"""Regenerate the per-site stylesheets. Idempotent; writes files only, never the database, and
	never raises (a failed migrate step must not hide behind the theme)."""
	try:
		site_files.after_migrate()
	except Exception:
		frappe.log_error(title="Institutional Theme migrate: generated files")


def before_uninstall() -> None:
	"""Restore core settings, then delete the app's files, globals and per-user defaults."""
	_run(
		(
			("restore identity", identity_sync.restore),
			("delete attachments", identity_sync.delete_attachments),
			("clear globals", clear_globals),
			("clear user defaults", clear_user_defaults),
			("delete change history", delete_versions),
			("remove site files", remove_site_files),
		)
	)
	try:
		frappe.clear_cache()
	except Exception:
		frappe.log_error(title="Institutional Theme uninstall: clear cache")
