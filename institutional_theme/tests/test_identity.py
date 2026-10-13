"""`ins_identity()`: the identity block of the Letter Head (ADR 0005)."""

from __future__ import annotations

from unittest import mock

import frappe
from frappe.tests import IntegrationTestCase

from institutional_theme import identity


def settings(**values: str) -> frappe._dict:
	return frappe._dict(values)


class TestIdentity(IntegrationTestCase):
	def run_identity(
		self, doc, *, company: str = "", app_name: str = "", address: str = ""
	) -> dict[str, str]:
		with (
			mock.patch.object(identity, "_settings", return_value=doc),
			mock.patch.object(identity, "_company", return_value=company),
			mock.patch.object(identity, "_company_address", return_value=address),
		):
			return identity.ins_identity()

	def test_the_keys_are_exactly_the_contract(self) -> None:
		result = self.run_identity(settings())
		self.assertEqual(
			sorted(result),
			["address", "contact", "emblem_url", "institution_name", "institution_name_ar", "system_name"],
		)
		self.assertTrue(all(isinstance(value, str) for value in result.values()))

	def test_values_come_from_the_settings(self) -> None:
		result = self.run_identity(
			settings(
				institution_name="Example Authority",
				institution_name_ar="الهيئة التجريبية",
				system_name="Midad",
				emblem="/files/emblem.png",
				support_contact=" 100 \n help@example.test ",
			),
			address="1 Example Street, Example City",
		)
		self.assertEqual(result["institution_name"], "Example Authority")
		self.assertEqual(result["institution_name_ar"], "الهيئة التجريبية")
		self.assertEqual(result["system_name"], "Midad")
		self.assertEqual(result["emblem_url"], "/files/emblem.png")
		self.assertEqual(result["contact"], "100 \n help@example.test")
		self.assertEqual(result["address"], "1 Example Street, Example City")

	def test_fallbacks_when_the_settings_are_empty(self) -> None:
		result = self.run_identity(settings(), company="Example Company")
		self.assertEqual(result["institution_name"], "Example Company")
		self.assertEqual(result["system_name"], "", "the stock Website Settings name is never offered")
		self.assertEqual(result["institution_name_ar"], "", "no English text is offered as the Arabic name")
		self.assertEqual(result["emblem_url"], "")
		self.assertEqual(result["contact"], "")

	def test_everything_is_empty_without_settings_and_company(self) -> None:
		self.assertEqual(self.run_identity(None), dict.fromkeys(identity.KEYS, ""))

	def test_a_private_or_foreign_emblem_is_not_offered(self) -> None:
		for value in (
			"/private/files/emblem.png",
			"//example.test/emblem.png",
			"https://example.test/emblem.png",
			"/files/../private/x.png",
			"files/emblem.png",
		):
			self.assertEqual(self.run_identity(settings(emblem=value))["emblem_url"], "", value)

	def test_an_emblem_url_cannot_end_an_attribute(self) -> None:
		url = self.run_identity(settings(emblem='/files/my "emblem".png'))["emblem_url"]
		self.assertEqual(url, "/files/my%20%22emblem%22.png")
		self.assertNotIn('"', url)

	def test_it_never_raises(self) -> None:
		with (
			mock.patch.object(identity, "_settings", side_effect=RuntimeError("broken")),
			mock.patch.object(identity.guard_log, "log_once") as logged,
		):
			self.assertEqual(identity.ins_identity(), dict.fromkeys(identity.KEYS, ""))
		logged.assert_called_once()

	def test_the_real_settings_give_strings(self) -> None:
		result = identity.ins_identity()
		self.assertEqual(sorted(result), sorted(identity.KEYS))
		self.assertTrue(all(isinstance(value, str) for value in result.values()))

	def test_the_jinja_hook_exposes_the_function(self) -> None:
		self.assertIn(
			"institutional_theme.identity.ins_identity", frappe.get_hooks("jinja").get("methods", [])
		)
		rendered = frappe.render_template("{% set ins = ins_identity() %}[{{ ins.institution_name_ar }}]", {})
		self.assertEqual(rendered, f"[{identity.ins_identity()['institution_name_ar']}]")
