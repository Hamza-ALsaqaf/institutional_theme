"""Error logging for the guards that keep a theme fault away from a request (boot, saves).

A guard exists so that a fault in this app never breaks the desk. Its log call must therefore never
raise itself (a broken database transaction makes `frappe.log_error` raise), and a persistent fault
must not write one Error Log row per request. `log_once` does both: each call is wrapped, and a
distinct error (title, exception type and message) is logged at most once per worker process.
"""

from __future__ import annotations

import sys
import threading

import frappe

# Bound on the remembered errors, so a fault whose message changes every time cannot grow it.
MAX_REMEMBERED = 64

_seen: set[tuple[str, str, str]] = set()
_lock = threading.Lock()


def log_once(title: str, *, defer: bool = True) -> bool:
	"""Log the exception being handled once per process; never raises. True when a row was requested."""
	try:
		error = sys.exc_info()[1]
		key = (title, type(error).__name__, str(error)[:300])
		with _lock:
			if key in _seen or len(_seen) >= MAX_REMEMBERED:
				return False
			_seen.add(key)
		frappe.log_error(title=title, defer_insert=defer)
		return True
	except Exception:
		return False


def reset() -> None:
	"""Forget every logged error (tests)."""
	with _lock:
		_seen.clear()
