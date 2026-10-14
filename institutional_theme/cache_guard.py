"""Cache hygiene for everything this app writes and then reads back (round 5, cache race).

Frappe clears a cache while a save is still inside its transaction. A request that is served in the
meantime reads the old committed rows and refills the cache; nothing clears it again when the save
commits, so the old value outlives the commit. Core covers the document cache (`clear_document_cache`
clears again after commit and after rollback, `model/document.py`), but not the defaults cache
(`defaults.set_default` and `clear_default` clear once, `defaults.py`). On PostgreSQL the transaction
isolation is REPEATABLE READ (`database/postgres/database.py`), so a request that began before the
commit can also read the old rows after the commit and refill even a cache that core cleared after it.

This module gives the app three tools, none of which touches core:

- `after_transaction(callback)` runs a callback when the current transaction ends, committed or not.
- Writers (`set_global`, `clear_global`, `set_user_default`, `forget_defaults`) clear the caches at once
  and again after the transaction ends.
- Readers (`get_global`, `user_defaults`, `settings_doc`) do not trust a shared cache for a value the
  app itself writes: globals and user defaults are read from the table, and the settings document is
  checked against its `modified` stamp, so a stale refill heals on the next request.

Callbacks never raise: an exception in one `after_commit` callback would stop the ones queued behind it.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any

import frappe
from frappe.utils import get_datetime

from institutional_theme import guard_log

GLOBAL = "__global"


def after_transaction(callback: Callable[[], None]) -> None:
	"""Run `callback` once when the transaction ends, whether it commits or rolls back.

	Core drops the queued callbacks of the other outcome (`database.py` `commit` and `rollback`), so the
	callback runs once. It runs now as well when there is no transaction to wait for.
	"""
	db = getattr(frappe, "db", None)
	if db is None or not hasattr(db, "after_commit"):
		return
	db.after_commit.add(callback)
	db.after_rollback.add(callback)


def _forget_defaults(parents: tuple[str | None, ...]) -> None:
	try:
		from frappe.cache_manager import clear_defaults_cache

		for parent in parents:
			clear_defaults_cache(parent)
	except Exception:
		guard_log.log_once("Institutional Theme: defaults cache")


def forget_defaults(*parents: str | None) -> None:
	"""Drop the cached defaults of `parents` (`None`: all of them) now and after the transaction ends."""
	_forget_defaults(parents)
	after_transaction(lambda: _forget_defaults(parents))


def _forget_user(user: str) -> None:
	try:
		frappe.clear_cache(user=user)
	except Exception:
		guard_log.log_once("Institutional Theme: user cache")


# ----------------------------------------------------------------------------------------------
# Globals (`DefaultValue` rows of the parent `__global`)
# ----------------------------------------------------------------------------------------------


def get_global(key: str) -> str | None:
	"""The global `key`, read from the table. Never from the defaults cache: a value that is written
	and read back in one transaction (a read-modify-write of this app's records) must not come from a
	cache that another request may have refilled with the old rows."""
	value = frappe.db.get_value(
		"DefaultValue", {"parent": GLOBAL, "defkey": key}, "defvalue", order_by="creation asc"
	)
	return None if value is None else str(value)


def set_global(key: str, value: str) -> None:
	"""`frappe.db.set_global`, with the cache dropped again after the transaction ends."""
	frappe.db.set_global(key, value)
	forget_defaults(GLOBAL)


def clear_global(key: str) -> None:
	"""`frappe.defaults.clear_default` for a global, with the cache dropped again after the transaction."""
	frappe.defaults.clear_default(key=key, parent=GLOBAL)
	forget_defaults(GLOBAL)


# ----------------------------------------------------------------------------------------------
# User defaults
# ----------------------------------------------------------------------------------------------


def user_defaults(user: str, keys: Iterable[str]) -> dict[str, str | None]:
	"""The user's own values of `keys`, read from the table (the first one by creation, as core does)."""
	wanted = tuple(keys)
	found: dict[str, str | None] = dict.fromkeys(wanted)
	rows = frappe.get_all(
		"DefaultValue",
		filters={"parent": user, "defkey": ("in", list(wanted))},
		fields=["defkey", "defvalue"],
		order_by="creation asc",
	)
	for row in rows:
		if found.get(row.defkey) is None and row.defvalue is not None:
			found[row.defkey] = str(row.defvalue)
	return found


def set_user_default(key: str, value: str, user: str) -> None:
	"""`frappe.defaults.set_user_default`, with the user's caches (defaults and boot) dropped again after
	the transaction ends."""
	frappe.defaults.set_user_default(key, value, user)
	_forget_defaults((user,))
	after_transaction(lambda: (_forget_defaults((user,)), _forget_user(user)))


# ----------------------------------------------------------------------------------------------
# The settings document
# ----------------------------------------------------------------------------------------------


def settings_doc(doctype: str) -> Any:
	"""The cached Single `doctype`, checked against the `modified` stamp in the table.

	Core clears the document cache when a save commits, but a request whose snapshot is older than the
	commit can put the old document back afterwards. The stamp is one primary-key read, remembered by
	core for the rest of the request (`db.value_cache`, dropped by `clear_document_cache`); a stale copy
	is replaced from the table. Raises as `frappe.get_cached_doc` does when the doctype is missing.
	"""
	doc = frappe.get_cached_doc(doctype)
	try:
		stamp = frappe.db.get_single_value(doctype, "modified")
		current = get_datetime(stamp) if stamp else None
		cached = get_datetime(doc.get("modified")) if doc.get("modified") else None
	except Exception:
		return doc
	if current != cached:
		frappe.clear_document_cache(doctype, doctype)
		doc = frappe.get_cached_doc(doctype)
	return doc
