"""Shared helpers of the Frappe tests. They run on a bench site:

bench --site midad.test run-tests --app institutional_theme
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from unittest import mock

import frappe

from institutional_theme import site_files

DOCTYPE = "Institutional Theme Settings"


def make_user(email: str, role: str = "System Manager") -> None:
	if frappe.db.exists("User", email):
		return
	frappe.get_doc(
		{
			"doctype": "User",
			"email": email,
			"first_name": "Ins",
			"send_welcome_email": 0,
			"roles": [{"role": role}],
		}
	).insert(ignore_permissions=True)


def delete_user(email: str) -> None:
	frappe.defaults.clear_default(parent=email)
	frappe.delete_doc("User", email, force=True, ignore_permissions=True)


def set_settings(**values) -> None:
	"""Save values into the settings Single as Administrator and drop the caches."""
	user = frappe.session.user
	frappe.set_user("Administrator")
	try:
		doc = frappe.get_doc(DOCTYPE)
		doc.update(values)
		doc.save()
	finally:
		frappe.set_user(user)
	site_files.clear_memo()


def reset_settings() -> None:
	frappe.set_user("Administrator")
	doc = frappe.get_doc(DOCTYPE)
	for df in doc.meta.fields:
		if df.fieldtype in ("Section Break", "Column Break", "Tab Break", "HTML", "Button"):
			continue
		if df.fieldname == "environment":
			continue
		doc.set(df.fieldname, df.default if df.default not in (None, "") else None)
	for fieldname in ("allow_midad", "allow_graphite", "allow_petrol", "allow_forest", "allow_plum"):
		doc.set(fieldname, 1)
	doc.save()
	site_files.clear_memo()


@contextmanager
def all_bundles_linkable() -> Iterator[None]:
	"""The asset manifest of a bench without a build has no palette bundles: pretend it has them."""
	with mock.patch.object(site_files, "bundle_linkable", return_value=True):
		yield
