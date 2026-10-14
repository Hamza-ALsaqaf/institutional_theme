"""`institutional_theme.api.set_appearance` (ADR 0002)."""

from __future__ import annotations

import frappe
from frappe.tests import IntegrationTestCase

from institutional_theme import api, cache_guard, preferences

from .helpers import all_bundles_linkable, delete_user, make_user, reset_settings, set_settings

USER = "ins_api_user@example.com"
OTHER = "ins_api_other@example.com"


class TestSetAppearance(IntegrationTestCase):
	@classmethod
	def setUpClass(cls) -> None:
		super().setUpClass()
		make_user(USER)
		make_user(OTHER)
		frappe.db.commit()

	@classmethod
	def tearDownClass(cls) -> None:
		frappe.set_user("Administrator")
		delete_user(USER)
		delete_user(OTHER)
		reset_settings()
		frappe.db.commit()
		super().tearDownClass()

	def setUp(self) -> None:
		frappe.set_user("Administrator")
		reset_settings()
		for user in (USER, OTHER):
			frappe.defaults.clear_default(parent=user)

	def tearDown(self) -> None:
		frappe.set_user("Administrator")

	def test_it_is_whitelisted_for_post_only(self) -> None:
		self.assertIn(api.set_appearance, frappe.whitelisted)
		self.assertEqual(frappe.allowed_http_methods_for_whitelisted_func[api.set_appearance], ["POST"])
		self.assertNotIn(api.set_appearance, frappe.guest_methods)

	def test_guest_gets_a_permission_error(self) -> None:
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			api.set_appearance(density="compact")

	def test_a_value_is_stored_for_the_session_user_only(self) -> None:
		frappe.set_user(USER)
		with all_bundles_linkable():
			result = api.set_appearance(palette="graphite", density="compact")
		self.assertEqual(result, {"palette": "graphite", "density": "compact"})
		stored = cache_guard.user_defaults(USER, ("ins_palette", "ins_density"))
		self.assertEqual((stored["ins_palette"], stored["ins_density"]), ("graphite", "compact"))
		self.assertFalse(cache_guard.user_defaults(OTHER, ("ins_palette",))["ins_palette"])
		self.assertFalse(cache_guard.user_defaults("Administrator", ("ins_palette",))["ins_palette"])

	def test_a_value_left_out_is_not_changed(self) -> None:
		frappe.set_user(USER)
		api.set_appearance(density="compact")
		result = api.set_appearance()
		self.assertEqual(result["density"], "compact")

	def test_a_disallowed_palette_is_a_validation_error(self) -> None:
		set_settings(allow_graphite=0)
		frappe.set_user(USER)
		for lang in ("en", "ar"):
			frappe.local.lang = lang
			try:
				with all_bundles_linkable(), self.assertRaises(frappe.ValidationError) as caught:
					api.set_appearance(palette="graphite")
			finally:
				frappe.local.lang = "en"
			if lang == "en":
				self.assertIn("is not available on this site", str(caught.exception))
		self.assertFalse(cache_guard.user_defaults(USER, ("ins_palette",))["ins_palette"])

	def test_an_unknown_palette_and_a_bad_density_are_rejected(self) -> None:
		frappe.set_user(USER)
		with self.assertRaises(frappe.ValidationError):
			api.set_appearance(palette="no-such-preset")
		with self.assertRaises(frappe.ValidationError):
			api.set_appearance(density="huge")
		self.assertEqual(cache_guard.user_defaults(USER, ("ins_density",))["ins_density"], None)

	def test_the_result_is_the_effective_value(self) -> None:
		frappe.set_user(USER)
		self.assertEqual(api.set_appearance(density="comfortable"), preferences.get_effective(USER))
