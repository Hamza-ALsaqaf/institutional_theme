"""`update_website_context`: palette and font links in the desk and on website pages (ADR 0003)."""

from __future__ import annotations

from unittest import mock

import frappe
from frappe.tests import IntegrationTestCase

from institutional_theme import site_files, website

from .helpers import all_bundles_linkable, delete_user, make_user, reset_settings, set_settings

USER = "ins_web_user@example.com"
PETROL = "ins_palette_petrol.bundle.css"


def desk_context(links: list[str] | None = None) -> frappe._dict:
	return frappe._dict(template="www/desk.html", app_include_css=list(links or ["ins_desk.bundle.css"]))


class TestWebsiteHook(IntegrationTestCase):
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

	def tearDown(self) -> None:
		frappe.set_user("Administrator")

	def test_the_desk_links_the_users_palette_after_the_existing_links(self) -> None:
		frappe.defaults.set_user_default("ins_palette", "petrol", USER)
		frappe.set_user(USER)
		context = desk_context()
		with all_bundles_linkable():
			result = website.update_website_context(context)
		self.assertEqual(result, {"app_include_css": ["ins_desk.bundle.css", PETROL]})
		self.assertEqual(context.app_include_css, ["ins_desk.bundle.css"], "the input list is not changed")

	def test_the_midad_palette_adds_no_link(self) -> None:
		frappe.set_user(USER)
		with all_bundles_linkable():
			self.assertIsNone(website.update_website_context(desk_context()))

	def test_a_missing_manifest_key_gives_no_link(self) -> None:
		frappe.defaults.set_user_default("ins_palette", "petrol", USER)
		frappe.set_user(USER)
		manifest = {"ins_palette_petrol.bundle.css": "/assets/x/petrol.css"}  # no rtl_ key
		with mock.patch("frappe.utils.get_assets_json", return_value=manifest):
			self.assertIsNone(website.update_website_context(desk_context()))
		manifest["rtl_ins_palette_petrol.bundle.css"] = "/assets/x/rtl_petrol.css"
		with mock.patch("frappe.utils.get_assets_json", return_value=manifest):
			result = website.update_website_context(desk_context())
		self.assertEqual(result["app_include_css"][-1], PETROL)

	def test_a_raising_hook_logs_once_and_changes_nothing(self) -> None:
		frappe.set_user(USER)
		with (
			mock.patch.object(website, "desk_links", side_effect=RuntimeError("boom")),
			mock.patch("frappe.log_error") as log_error,
		):
			self.assertIsNone(website.update_website_context(desk_context()))
		log_error.assert_called_once_with(title="Institutional Theme: stylesheet links", defer_insert=True)

	def test_a_context_without_a_list_is_left_alone(self) -> None:
		self.assertIsNone(website.update_website_context(frappe._dict(template="www/desk.html")))
		self.assertIsNone(website.update_website_context(frappe._dict(template="www/me.html")))

	def test_website_pages_get_the_site_default_in_a_new_list(self) -> None:
		with all_bundles_linkable():
			set_settings(default_palette="petrol")
			frappe.defaults.set_user_default("ins_palette", "graphite", USER)
			frappe.set_user(USER)
			cached = ["ins_web.bundle.css"]
			context = frappe._dict(template="www/login.html", web_include_css=cached)
			result = website.update_website_context(context)
		self.assertEqual(result, {"web_include_css": ["ins_web.bundle.css", PETROL]})
		self.assertIsNot(result["web_include_css"], cached)
		self.assertEqual(cached, ["ins_web.bundle.css"], "the worker's cached hooks list is untouched")

	def test_a_font_pairing_bundle_is_linked_with_the_palette(self) -> None:
		with all_bundles_linkable():
			set_settings(font_pairing="Noto")
			frappe.set_user(USER)
			result = website.update_website_context(desk_context())
		self.assertEqual(result, {"app_include_css": ["ins_desk.bundle.css", "ins_fonts_noto.bundle.css"]})

	def test_a_custom_palette_is_linked_by_its_generated_file(self) -> None:
		set_settings(allow_custom=1, custom_primary="#1F3A5F", custom_accent="#8A6D1F")
		frappe.defaults.set_user_default("ins_palette", "custom", USER)
		frappe.set_user(USER)
		result = website.update_website_context(desk_context())
		link = result["app_include_css"][-1]
		self.assertRegex(link, r"^/files/institutional_theme/ins_palette_custom\.[0-9a-f]{12}\.css$")
		self.assertTrue(frappe.db.get_value("Institutional Theme Settings", None, "allow_custom"))
		self.assertTrue(site_files.palette_linkable("custom"))
