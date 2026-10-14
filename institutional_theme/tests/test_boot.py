"""`boot.extend_bootinfo` and the Appearance page (ADR 0002, 0005)."""

from __future__ import annotations

from unittest import mock

import frappe
from frappe.tests import IntegrationTestCase

from institutional_theme import boot, guard_log

from .helpers import all_bundles_linkable, reset_settings, set_settings


class TestBoot(IntegrationTestCase):
	@classmethod
	def tearDownClass(cls) -> None:
		frappe.set_user("Administrator")
		reset_settings()
		frappe.db.commit()
		super().tearDownClass()

	def setUp(self) -> None:
		frappe.set_user("Administrator")
		reset_settings()
		guard_log.reset()

	def test_bootinfo_ins_has_the_documented_keys(self) -> None:
		info = frappe._dict()
		with all_bundles_linkable():
			boot.extend_bootinfo(bootinfo=info)
		self.assertEqual(
			set(info.ins),
			{
				"palette",
				"density",
				"allowed",
				"environment",
				"idle_warning",
				"idle_minutes",
				"connection_banner",
			},
		)
		self.assertEqual((info.ins["palette"], info.ins["density"]), ("midad", "comfortable"))
		self.assertEqual(info.ins["allowed"][0]["key"], "midad")
		for card in info.ins["allowed"]:
			self.assertEqual(set(card), {"key", "label", "primary", "accent"})

	def test_behaviour_changes_ship_disabled(self) -> None:
		ins = boot.build("Administrator")
		self.assertFalse(ins["idle_warning"])
		self.assertFalse(ins["connection_banner"])

	def test_the_behaviour_flags_follow_the_settings(self) -> None:
		set_settings(enable_idle_warning=1, idle_warning_minutes=7, enable_connection_banner=1)
		ins = boot.build("Administrator")
		self.assertTrue(ins["idle_warning"])
		self.assertEqual(ins["idle_minutes"], 7)
		self.assertTrue(ins["connection_banner"])

	def test_environment_comes_from_site_config_only(self) -> None:
		for configured, expected in (
			(None, ""),
			("", ""),
			("Production", ""),
			("production", ""),
			("UAT", "UAT"),
			("Training", "Training"),
			("Pilot", "Pilot"),
		):
			with mock.patch.dict(frappe.local.conf, {"ins_environment": configured}):
				self.assertEqual(boot.environment(), expected, configured)

	def test_a_failure_is_logged_and_leaves_the_boot_without_ins(self) -> None:
		info = frappe._dict()
		with (
			mock.patch.object(boot, "build", side_effect=RuntimeError("boom")),
			mock.patch("frappe.log_error") as log_error,
		):
			boot.extend_bootinfo(bootinfo=info)
		self.assertNotIn("ins", info)
		log_error.assert_called_once_with(title="Institutional Theme: boot", defer_insert=True)

	def test_a_persistent_failure_is_logged_once_per_process(self) -> None:
		with (
			mock.patch.object(boot, "build", side_effect=RuntimeError("boom")),
			mock.patch("frappe.log_error") as log_error,
		):
			for _ in range(5):
				info = frappe._dict()
				boot.extend_bootinfo(bootinfo=info)
				self.assertNotIn("ins", info)
		self.assertEqual(log_error.call_count, 1)

	def test_a_different_failure_is_logged_again(self) -> None:
		with mock.patch("frappe.log_error") as log_error:
			for message in ("first", "second", "first"):
				with mock.patch.object(boot, "build", side_effect=RuntimeError(message)):
					boot.extend_bootinfo(bootinfo=frappe._dict())
		self.assertEqual(log_error.call_count, 2)

	def test_a_log_call_that_raises_never_leaves_the_guard(self) -> None:
		info = frappe._dict()
		with (
			mock.patch.object(boot, "build", side_effect=RuntimeError("boom")),
			mock.patch("frappe.log_error", side_effect=RuntimeError("transaction aborted")),
		):
			boot.extend_bootinfo(bootinfo=info)
		self.assertNotIn("ins", info)

	def test_the_appearance_page_is_open_to_every_desk_user(self) -> None:
		page = frappe.get_doc("Page", "ins-appearance")
		self.assertEqual(page.roles, [])
		self.assertEqual(page.module, "Institutional Theme")
