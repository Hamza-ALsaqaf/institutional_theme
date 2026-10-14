"""Install, migrate and uninstall paths. Every function is idempotent.

`before_uninstall` leaves the stock look: it removes the shipped Print Style and Letter Head that are
untouched and unlinked (a changed or linked one is kept), it gives the identity values this app wrote to core
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

from institutional_theme import cache_guard, guard_log, site_files
from institutional_theme.institutional_theme.doctype.institutional_theme_settings import identity_sync
from institutional_theme.print import ship

# Per-user choices stored with `frappe.defaults` (ADR 0002).
USER_DEFAULT_KEYS = ("ins_palette", "ins_density")
# Global rows this app keeps: identity checksums (`identity_sync`) and print shipping (`print/ship.py`).
GLOBAL_PREFIXES = ("ins_identity_", "ins_print_")
SITE_FILES_FOLDER = ("public", "files", "institutional_theme")


def clear_globals() -> int:
	"""Delete the global (`__global`) rows this app keeps, such as the identity checksums."""
	names: list[str] = []
	for prefix in GLOBAL_PREFIXES:
		names += frappe.get_all(
			"DefaultValue",
			filters={"parent": "__global", "defkey": ("like", f"{prefix}%")},
			pluck="name",
		)
	for name in names:
		frappe.db.delete("DefaultValue", {"name": name})
	cache_guard.forget_defaults(cache_guard.GLOBAL)
	return len(names)


def clear_user_defaults() -> int:
	"""Delete every user's palette and density choice."""
	count = frappe.db.count("DefaultValue", {"defkey": ("in", USER_DEFAULT_KEYS)})
	frappe.db.delete("DefaultValue", {"defkey": ("in", USER_DEFAULT_KEYS)})
	cache_guard.forget_defaults(None)
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


def after_install() -> None:
	"""Ship the Print Style and Letter Head. Nothing else changes: the theme is on as soon as the
	bundles are built. Never raises, and skips what is not built yet (`print/ship.py`)."""
	ship.safe_ship()


def after_migrate() -> None:
	"""Regenerate the per-site stylesheets and bring the shipped print records up to date.
	Idempotent, never overwrites an administrator's change and never raises (a failed migrate step must
	not hide behind the theme)."""
	try:
		site_files.after_migrate()
	except Exception:
		frappe.log_error(title="Institutional Theme migrate: generated files")
	ship.safe_ship()


def _clear_cache_guarded() -> None:
	try:
		frappe.clear_cache()
	except Exception:
		guard_log.log_once("Institutional Theme uninstall: clear cache after commit")


def before_uninstall() -> None:
	"""Restore core settings, then delete the app's files, globals and per-user defaults."""
	_run(
		(
			("remove print style and letter head", ship.remove),
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
		cache_guard.after_transaction(_clear_cache_guarded)
	except Exception:
		frappe.log_error(title="Institutional Theme uninstall: clear cache")
