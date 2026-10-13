"""Masthead, trust footer and body classes of the login and error pages (ADR 0009)."""

from __future__ import annotations

from unittest import mock

import frappe
from frappe.tests import IntegrationTestCase
from werkzeug.datastructures import MultiDict

from institutional_theme import web_content
from institutional_theme.tests import helpers

NOTICE_EN = "Authorised staff only."
NOTICE_AR = "للمصرَّح لهم فقط."


def render(template: str = "www/login.html", lang: str = "en", **context) -> dict:
	frappe.local.lang = lang
	result = web_content.update_website_context(frappe._dict(template=template, **context))
	assert result is not None
	return result


class TestWebContent(IntegrationTestCase):
	def setUp(self) -> None:
		frappe.set_user("Administrator")
		helpers.reset_settings()
		self.addCleanup(helpers.reset_settings)
		self.addCleanup(setattr, frappe.local, "lang", "en")

	def test_other_templates_are_left_alone(self) -> None:
		for template in ("www/desk.html", "www/index.html", "www/me.html", ""):
			self.assertIsNone(web_content.update_website_context(frappe._dict(template=template)))

	def test_login_gets_masthead_footer_and_classes(self) -> None:
		helpers.set_settings(institution_name="Fictional Agency", system_name="Unified system")
		result = render()
		self.assertIn('class="ins-masthead"', result["banner_html"])
		self.assertIn("Fictional Agency", result["banner_html"])
		self.assertIn("Unified system", result["banner_html"])
		self.assertIn('class="ins-trust"', result["body_include"])
		self.assertIn("ins-has-masthead ins-auth", result["body_class"])

	def test_existing_values_are_kept(self) -> None:
		result = render(banner_html="<p>old</p>", body_include="<i>old</i>", body_class="x")
		self.assertTrue(result["banner_html"].endswith("<p>old</p>"))
		self.assertTrue(result["body_include"].startswith("<i>old</i>"))
		self.assertTrue(result["body_class"].startswith("x "))

	def test_default_notice_in_both_languages(self) -> None:
		self.assertIn("restricted to authorised users", render()["body_include"])
		self.assertIn("مقصور على المصرَّح لهم", render(lang="ar")["body_include"])

	def test_notice_follows_page_language_with_fallback(self) -> None:
		helpers.set_settings(authorised_use_notice=NOTICE_EN, authorised_use_notice_ar=NOTICE_AR)
		self.assertIn(NOTICE_AR, render(lang="ar")["body_include"])
		self.assertNotIn('lang="en"', render(lang="en")["body_include"])
		helpers.set_settings(authorised_use_notice_ar="")
		fallback = render(lang="ar")["body_include"]
		self.assertIn(NOTICE_EN, fallback)
		self.assertIn('lang="en"', fallback)

	def test_settings_values_are_escaped(self) -> None:
		# Frappe strips markup on save; the template must still escape what it is given.
		payload = "<script>alert(1)</script>"
		fields = ("institution_name", "system_name", "authorised_use_notice", "support_contact")
		forged = frappe._dict({field: payload for field in fields})
		with mock.patch.object(web_content, "_get_settings", return_value=forged):
			result = render()
		self.assertNotIn("<script>", result["banner_html"] + result["body_include"])
		self.assertIn("&lt;script&gt;", result["body_include"])
		self.assertIn("&lt;script&gt;", result["banner_html"])

	def test_support_is_omitted_when_empty_and_kept_when_set(self) -> None:
		self.assertNotIn("ins-support", render()["body_include"])
		helpers.set_settings(support_contact="Ext 1400\nsupport@agency.example")
		self.assertIn("Ext 1400\nsupport@agency.example", render()["body_include"])

	def test_language_links_keep_the_query(self) -> None:
		request = mock.Mock(path="/login", args=MultiDict([("redirect-to", "/app"), ("_lang", "en")]))
		with mock.patch.object(frappe.local, "request", request, create=True):
			links = render(lang="ar")["banner_html"]
		self.assertIn("/login?redirect-to=%2Fapp&amp;_lang=en", links)
		self.assertIn('hreflang="ar"', links)
		self.assertEqual(links.count('aria-current="true"'), 1)

	def test_environment_words(self) -> None:
		cases = {"Production": "Production", "training": "Training", "UAT": "UAT", "lab": "Non-production"}
		for configured, word in cases.items():
			with mock.patch.dict(frappe.local.conf, {"ins_environment": configured}):
				self.assertIn(word, render()["body_include"], configured)
		with mock.patch.dict(frappe.local.conf, {"ins_environment": ""}):
			self.assertEqual(web_content.environment_label(), "")

	def test_release_line(self) -> None:
		with mock.patch.dict(frappe.local.conf, {"ins_release": "1.2.0", "ins_environment": "Training"}):
			self.assertIn("Release 1.2.0 · Training", render()["body_include"])

	def test_error_page_reference(self) -> None:
		with mock.patch("frappe.monitor.get_trace_id", return_value="abc-123"):
			body = render("www/error.html")["body_include"]
		self.assertIn("<code>abc-123</code>", body)
		self.assertNotIn("ins-notice", body)

	def test_forged_reference_falls_back_to_time_of_error(self) -> None:
		with mock.patch("frappe.monitor.get_trace_id", return_value="<b>"):
			body = render("www/error.html")["body_include"]
		self.assertNotIn("<b>", body)
		self.assertIn("ins-reference-label", body)
		self.assertNotIn("<code>", body)

	def test_not_found_has_no_reference(self) -> None:
		result = render("www/404.html")
		self.assertNotIn("ins-reference", result["body_include"])
		self.assertIn(" ins-error", result["body_class"])
		self.assertNotIn("ins-lang", result["banner_html"])

	def test_message_reference_only_on_error_status(self) -> None:
		self.assertNotIn("ins-reference", render("www/message.html")["body_include"])
		self.assertIn("ins-reference", render("www/message.html", error_code=500)["body_include"])

	def test_hook_never_raises(self) -> None:
		with mock.patch.object(web_content.frappe, "render_template", side_effect=RuntimeError("boom")):
			self.assertIsNone(web_content.update_website_context(frappe._dict(template="www/login.html")))
