"""`preferences.get_effective` and the allowed presets (ADR 0002)."""

from __future__ import annotations

from unittest import mock

import frappe
from frappe.tests import IntegrationTestCase

from institutional_theme import preferences, site_files

from .helpers import all_bundles_linkable, delete_user, make_user, reset_settings, set_settings

USER = "ins_pref_user@example.com"


class TestPreferences(IntegrationTestCase):
	@classmethod
	def setUpClass(cls) -> None:
		super().setUpClass()
		make_user(USER)
		frappe.db.commit()

	@classmethod
	def tearDownClass(cls) -> None:
		frappe.set_user("Administrator")
		delete_user(USER)
		reset_settings()
		frappe.db.commit()
		super().tearDownClass()

	def setUp(self) -> None:
		frappe.set_user("Administrator")
		reset_settings()
		frappe.defaults.clear_default(parent=USER)

	def test_defaults_are_midad_and_comfortable(self) -> None:
		self.assertEqual(preferences.get_effective(USER), {"palette": "midad", "density": "comfortable"})

	def test_guest_gets_the_site_defaults(self) -> None:
		self.assertEqual(preferences.get_effective("Guest"), {"palette": "midad", "density": "comfortable"})

	def test_a_stored_value_is_read_back(self) -> None:
		with all_bundles_linkable():
			frappe.defaults.set_user_default(preferences.PALETTE_KEY, "graphite", USER)
			frappe.defaults.set_user_default(preferences.DENSITY_KEY, "compact", USER)
			self.assertEqual(preferences.get_effective(USER), {"palette": "graphite", "density": "compact"})

	def test_a_palette_the_site_does_not_allow_falls_back_and_comes_back(self) -> None:
		with all_bundles_linkable():
			frappe.defaults.set_user_default(preferences.PALETTE_KEY, "graphite", USER)
			set_settings(allow_graphite=0)
			self.assertEqual(preferences.get_effective(USER)["palette"], "midad")
			self.assertEqual(frappe.defaults.get_defaults_for(USER).get("ins_palette"), "graphite")
			set_settings(allow_graphite=1)
			self.assertEqual(preferences.get_effective(USER)["palette"], "graphite")

	def test_the_fallback_is_the_site_default_palette(self) -> None:
		with all_bundles_linkable():
			set_settings(default_palette="petrol")
			frappe.defaults.set_user_default(preferences.PALETTE_KEY, "graphite", USER)
			set_settings(allow_graphite=0)
			self.assertEqual(preferences.get_effective(USER)["palette"], "petrol")

	def test_a_palette_without_a_stylesheet_is_never_effective(self) -> None:
		frappe.defaults.set_user_default(preferences.PALETTE_KEY, "graphite", USER)
		with mock.patch.object(site_files, "bundle_linkable", return_value=False):
			self.assertEqual(preferences.get_effective(USER)["palette"], "midad")

	def test_an_unknown_stored_value_is_ignored(self) -> None:
		frappe.defaults.set_user_default(preferences.PALETTE_KEY, "no-such-preset", USER)
		frappe.defaults.set_user_default(preferences.DENSITY_KEY, "huge", USER)
		self.assertEqual(preferences.get_effective(USER), {"palette": "midad", "density": "comfortable"})

	def test_site_default_density(self) -> None:
		set_settings(default_density="Compact")
		self.assertEqual(preferences.get_effective(USER)["density"], "compact")
		frappe.defaults.set_user_default(preferences.DENSITY_KEY, "comfortable", USER)
		self.assertEqual(preferences.get_effective(USER)["density"], "comfortable")

	def test_a_missing_settings_document_gives_the_stock_values(self) -> None:
		with mock.patch.object(site_files, "get_settings", return_value=None):
			self.assertEqual(preferences.allowed_presets(), ["midad"])
			self.assertEqual(preferences.get_effective(USER), {"palette": "midad", "density": "comfortable"})

	def test_allowed_presets_keep_the_shipped_order_and_never_come_back_empty(self) -> None:
		with all_bundles_linkable():
			self.assertEqual(preferences.allowed_presets(), preferences.shipped_presets())
			for key in preferences.shipped_presets():
				if key != "midad":
					set_settings(**{f"allow_{key}": 0})
			self.assertEqual(preferences.allowed_presets(), ["midad"])

	def test_custom_is_offered_only_when_its_palette_passes(self) -> None:
		with all_bundles_linkable():
			set_settings(allow_custom=1, custom_primary="#1F3A5F", custom_accent="#8A6D1F")
			self.assertIn("custom", preferences.allowed_presets())
		# Bypass the save-time check to prove the runtime refuses an unaudited palette too.
		with mock.patch.object(site_files, "_custom_css", return_value=None):
			self.assertNotIn("custom", preferences.allowed_presets())

	def test_cards_carry_a_name_and_two_swatches(self) -> None:
		with all_bundles_linkable():
			for card in preferences.allowed_cards():
				self.assertTrue(card["label"])
				self.assertRegex(card["primary"], r"^#[0-9a-fA-F]{6}$")
				self.assertRegex(card["accent"], r"^#[0-9a-fA-F]{6}$")

	def test_a_custom_card_is_never_nameless(self) -> None:
		with all_bundles_linkable():
			set_settings(allow_custom=1, custom_primary="#1F3A5F", custom_accent="#8A6D1F")
			self.assertEqual(preferences.preset_label("custom"), "Custom")
			set_settings(custom_label_en="Ministry blue")
			self.assertEqual(preferences.preset_label("custom"), "Ministry blue")
			frappe.local.lang = "ar"
			try:
				self.assertEqual(preferences.preset_label("custom"), "Ministry blue")
				set_settings(custom_label_ar="أزرق الوزارة")
				self.assertEqual(preferences.preset_label("custom"), "أزرق الوزارة")
			finally:
				frappe.local.lang = "en"
