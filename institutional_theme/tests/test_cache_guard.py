"""`institutional_theme.cache_guard`: the helpers behind the cache-race fix (round 5)."""

from __future__ import annotations

from unittest import mock

import frappe
from frappe.tests import IntegrationTestCase

from institutional_theme import cache_guard, guard_log

from .helpers import DOCTYPE, delete_user, make_user, reset_settings

USER = "ins_guard_user@example.com"
KEY = "ins_identity_guardtest"


class TestCacheGuard(IntegrationTestCase):
	@classmethod
	def setUpClass(cls) -> None:
		super().setUpClass()
		make_user(USER)
		frappe.db.commit()

	@classmethod
	def tearDownClass(cls) -> None:
		frappe.set_user("Administrator")
		frappe.defaults.clear_default(key=KEY, parent="__global")
		delete_user(USER)
		reset_settings()
		frappe.db.commit()
		super().tearDownClass()

	def setUp(self) -> None:
		frappe.set_user("Administrator")
		reset_settings()
		frappe.defaults.clear_default(parent=USER)
		frappe.defaults.clear_default(key=KEY, parent="__global")
		frappe.db.commit()

	def tearDown(self) -> None:
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def test_a_current_settings_document_is_served_from_the_cache(self) -> None:
		frappe.get_cached_doc(DOCTYPE)
		with mock.patch.object(frappe, "clear_document_cache") as clear:
			doc = cache_guard.settings_doc(DOCTYPE)
		clear.assert_not_called()
		self.assertEqual(doc.name, DOCTYPE)

	def test_a_global_is_read_from_the_table(self) -> None:
		self.assertIsNone(cache_guard.get_global(KEY))
		cache_guard.set_global(KEY, "one")
		self.assertEqual(cache_guard.get_global(KEY), "one")
		cache_guard.set_global(KEY, "two")
		self.assertEqual(cache_guard.get_global(KEY), "two")
		cache_guard.clear_global(KEY)
		self.assertIsNone(cache_guard.get_global(KEY))

	def test_a_users_values_come_back_by_key_and_are_none_when_absent(self) -> None:
		self.assertEqual(
			cache_guard.user_defaults(USER, ("ins_palette", "ins_density")),
			dict.fromkeys(("ins_palette", "ins_density")),
		)
		cache_guard.set_user_default("ins_density", "compact", USER)
		self.assertEqual(
			cache_guard.user_defaults(USER, ("ins_palette", "ins_density")),
			{"ins_palette": None, "ins_density": "compact"},
		)
		self.assertEqual(cache_guard.user_defaults("Administrator", ("ins_density",)), {"ins_density": None})

	def test_an_after_transaction_callback_runs_once_on_commit(self) -> None:
		calls: list[str] = []
		cache_guard.after_transaction(lambda: calls.append("x"))
		self.assertEqual(calls, [])
		frappe.db.commit()
		self.assertEqual(calls, ["x"])
		frappe.db.commit()
		self.assertEqual(calls, ["x"])

	def test_an_after_transaction_callback_runs_once_on_rollback(self) -> None:
		calls: list[str] = []
		cache_guard.after_transaction(lambda: calls.append("x"))
		frappe.db.rollback()
		self.assertEqual(calls, ["x"])
		frappe.db.commit()
		self.assertEqual(calls, ["x"], "the commit after the rollback does not run it again")

	def test_a_failing_cache_clear_never_breaks_the_commit(self) -> None:
		guard_log.reset()
		with (
			mock.patch(
				"frappe.cache_manager.clear_defaults_cache", side_effect=RuntimeError("redis is down")
			),
			mock.patch("frappe.log_error") as log_error,
		):
			cache_guard.forget_defaults("__global")  # runs now and again after the commit, both guarded
			frappe.db.commit()
		log_error.assert_called_once()
