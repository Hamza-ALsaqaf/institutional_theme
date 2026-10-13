"""`print/ship.py`: the Midad Print Style and Letter Head (ADR 0004, 0005)."""

from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from unittest import mock

import frappe
from frappe.tests import IntegrationTestCase
from jinja2 import DebugUndefined, Environment

from institutional_theme.print import ship

BUNDLE_CSS = (
	"body { margin: 0; }\n.ins-sig { border-top: 1px solid #000; }\n/*# sourceMappingURL=x.css.map */\n"
)
HEADER = "<div style=\"direction: rtl; font-family: 'Midad Print Plex Sans Arabic'\">{{ ins_identity().system_name }}</div>"
FOOTER = (
	'<div class="ins-footer"><style>.ins-footer { color: #333; }</style>{{ ins_identity().contact }}</div>'
)
# What the templates held before they guarded `ins_identity` (a site that shipped them has this stored).
UNGUARDED_HEADER = "{%- set ins = ins_identity() or {} -%}<div>{{ ins.get('system_name', '') | e }}</div>"
UNGUARDED_FOOTER = "{%- set ins = ins_identity() or {} -%}<div>{{ ins.get('contact', '') | e }}</div>"
DOCTYPES = (ship.STYLE_DOCTYPE, ship.LETTER_DOCTYPE)


class TestDecide(IntegrationTestCase):
	"""The pure decision table; no records are touched."""

	def test_decisions(self) -> None:
		self.assertEqual(ship.decide(False, None, None, "d")[0], "create")
		self.assertEqual(ship.decide(False, None, "s", "d")[0], "skip", "deleted by an administrator")
		self.assertEqual(ship.decide(True, "x", None, "d")[0], "skip", "not shipped by the theme")
		self.assertEqual(ship.decide(True, "d", None, "d")[0], "adopt")
		self.assertEqual(ship.decide(True, "d", "d", "d")[0], "unchanged")
		self.assertEqual(ship.decide(True, "s", "s", "d")[0], "update")
		self.assertEqual(ship.decide(True, "x", "s", "d")[0], "skip", "changed by an administrator")

	def test_the_checksum_separates_its_parts(self) -> None:
		self.assertNotEqual(ship.checksum("ab", "c"), ship.checksum("a", "bc"))
		self.assertEqual(ship.checksum("a", "b"), ship.checksum("a", "b"))

	def test_the_source_map_comment_is_dropped(self) -> None:
		css = ship.compose_style("@font-face {}\n", '"Midad Print Plex Sans"', BUNDLE_CSS)
		self.assertNotIn("sourceMappingURL", css)
		self.assertIn(".ins-sig", css)
		self.assertLess(css.index("@font-face"), css.index("body {"), "the faces come first")
		self.assertIn('.print-format {\n\tfont-family: "Midad Print Plex Sans";', css)
		self.assertLess(css.index(".print-format {"), css.index("body {"), "the bundle can still override it")


class TestShip(IntegrationTestCase):
	def setUp(self) -> None:
		frappe.set_user("Administrator")
		# The site may use real "Midad" records, a Print Settings choice and the shipped checksums: keep them,
		# empty the way for the test, and put them back (and assert so) in tearDown.
		self.before = self.snapshot()
		self.clean()
		self.bundle_dir = tempfile.TemporaryDirectory()
		self.bundle_file = os.path.join(self.bundle_dir.name, "ins_print.bundle.css")
		self.write_bundle(BUNDLE_CSS)
		self.defaults_before = frappe.db.count("Letter Head", {"is_default": 1})

	def tearDown(self) -> None:
		self.bundle_dir.cleanup()
		self.clean()
		self.restore(self.before)
		self.assertEqual(self.snapshot(), self.before, "the site's own records are back as they were")

	def snapshot(self) -> dict:
		"""Everything the tests touch: the two records, the Print Settings choice, the checksums."""
		return {
			"docs": {
				doctype: (
					frappe.get_doc(doctype, ship.NAME).as_dict()
					if frappe.db.exists(doctype, ship.NAME)
					else None
				)
				for doctype in DOCTYPES
			},
			"print_style": frappe.db.get_single_value("Print Settings", "print_style"),
			"global": frappe.db.get_global(ship.GLOBAL_KEY),
			"deleted": self.deleted_documents(),
			"defaults": sorted(frappe.get_all("Letter Head", filters={"is_default": 1}, pluck="name")),
		}

	def deleted_documents(self) -> list[str]:
		return sorted(
			frappe.get_all(
				"Deleted Document",
				filters={"deleted_doctype": ["in", list(DOCTYPES)], "deleted_name": ship.NAME},
				pluck="name",
			)
		)

	def clean(self) -> None:
		"""Remove the test's records without a trace (no `Deleted Document`, no link checks)."""
		frappe.db.set_single_value("Print Settings", "print_style", None)
		for doctype in DOCTYPES:
			frappe.db.delete(doctype, {"name": ship.NAME})
		frappe.defaults.clear_default(key=ship.GLOBAL_KEY, parent="__global")
		keep = self.before["deleted"]
		for name in self.deleted_documents():
			if name not in keep:
				frappe.db.delete("Deleted Document", {"name": name})

	def restore(self, before: dict) -> None:
		for doctype in DOCTYPES:
			row = before["docs"][doctype]
			if row is not None:
				frappe.get_doc(row).db_insert()
		frappe.db.set_single_value("Print Settings", "print_style", before["print_style"])
		if before["global"]:
			frappe.db.set_global(ship.GLOBAL_KEY, before["global"])

	def write_bundle(self, css: str) -> None:
		with open(self.bundle_file, "w", encoding="utf-8") as handle:
			handle.write(css)

	@contextmanager
	def sources(self, *, bundle: bool = True, letter: bool = True) -> Iterator[None]:
		with (
			mock.patch.object(ship, "bundle_path", return_value=self.bundle_file if bundle else None),
			mock.patch.object(ship, "letter_head_html", return_value=(HEADER, FOOTER) if letter else None),
		):
			yield

	def ship(self, **kwargs: bool) -> dict[str, str]:
		with self.sources(**kwargs):
			return ship.ship()

	def css(self) -> str:
		return frappe.db.get_value("Print Style", ship.NAME, "css")

	def letter(self) -> dict:
		return frappe.db.get_value(
			"Letter Head",
			ship.NAME,
			["source", "content", "footer_source", "footer", "is_default"],
			as_dict=True,
		)

	def test_ships_once(self) -> None:
		result = self.ship()
		self.assertEqual(result, {"print_style": "created", "letter_head": "created"})
		css = self.css()
		self.assertIn("@font-face", css)
		self.assertIn("Midad Print Plex Sans Arabic", css)
		self.assertNotIn("format(", css, "wkhtmltopdf: one TTF url() per face, no format()")
		self.assertRegex(
			css,
			r'\.print-format \{\s*font-family: "Midad Print Plex Sans Arabic", "Midad Print Plex Sans", sans-serif;',
		)
		self.assertIn(".ins-sig { border-top: 1px solid #000; }", css)
		letter = self.letter()
		self.assertEqual(
			(letter.source, letter.content, letter.footer_source, letter.footer),
			("HTML", HEADER, "HTML", FOOTER),
			"the shipped HTML is stored exactly, not sanitised",
		)

	def test_the_second_run_changes_nothing(self) -> None:
		self.ship()
		stamps = (
			frappe.db.get_value("Print Style", ship.NAME, "modified"),
			frappe.db.get_value("Letter Head", ship.NAME, "modified"),
		)
		self.assertEqual(self.ship(), {"print_style": "unchanged", "letter_head": "unchanged"})
		self.assertEqual(
			stamps,
			(
				frappe.db.get_value("Print Style", ship.NAME, "modified"),
				frappe.db.get_value("Letter Head", ship.NAME, "modified"),
			),
		)

	def test_nothing_becomes_the_default(self) -> None:
		self.ship()
		self.assertEqual(self.letter().is_default, 0)
		self.assertEqual(frappe.db.count("Letter Head", {"is_default": 1}), self.defaults_before)
		self.assertNotEqual(frappe.db.get_single_value("Print Settings", "print_style"), ship.NAME)

	def test_an_untouched_record_is_updated_when_the_content_changes(self) -> None:
		self.ship()
		self.write_bundle(BUNDLE_CSS + ".ins-new { color: #111; }\n")
		result = self.ship()
		self.assertEqual(result["print_style"], "updated")
		self.assertIn(".ins-new", self.css())

	def test_an_administrators_edit_is_not_overwritten(self) -> None:
		self.ship()
		frappe.db.set_value("Print Style", ship.NAME, "css", "body { color: red; }")
		frappe.db.set_value("Letter Head", ship.NAME, "content", "<p>mine</p>")
		self.write_bundle(BUNDLE_CSS + ".ins-new { color: #111; }\n")
		result = self.ship()
		self.assertTrue(result["print_style"].startswith("skipped: changed by an administrator"))
		self.assertTrue(result["letter_head"].startswith("skipped: changed by an administrator"))
		self.assertEqual(self.css(), "body { color: red; }")
		self.assertEqual(self.letter().content, "<p>mine</p>")

	def test_an_existing_record_the_theme_did_not_ship_is_left_alone(self) -> None:
		frappe.get_doc(
			{"doctype": "Print Style", "print_style_name": ship.NAME, "css": "p { margin: 0; }"}
		).insert(ignore_permissions=True)
		result = self.ship()
		self.assertTrue(result["print_style"].startswith("skipped: exists and was not shipped"))
		self.assertEqual(self.css(), "p { margin: 0; }")

	def test_a_deleted_record_is_not_created_again(self) -> None:
		self.ship()
		frappe.db.delete("Print Style", {"name": ship.NAME})
		self.assertEqual(self.ship()["print_style"], "skipped: deleted by an administrator")
		self.assertFalse(frappe.db.exists("Print Style", ship.NAME))

	def test_a_missing_bundle_skips_without_error(self) -> None:
		result = self.ship(bundle=False)
		self.assertTrue(result["print_style"].startswith("skipped"))
		self.assertEqual(result["letter_head"], "created", "the letter head does not wait for the bundle")
		self.assertFalse(frappe.db.exists("Print Style", ship.NAME))

	def test_missing_templates_skip_without_error(self) -> None:
		result = self.ship(letter=False)
		self.assertEqual(result["print_style"], "created")
		self.assertTrue(result["letter_head"].startswith("skipped"))
		self.assertFalse(frappe.db.exists("Letter Head", ship.NAME))

	def test_an_unbuilt_manifest_entry_skips(self) -> None:
		with (
			mock.patch.object(frappe.utils, "get_assets_json", return_value={}),
			mock.patch.object(ship, "letter_head_html", return_value=None),
		):
			result = ship.ship()
		self.assertTrue(result["print_style"].startswith("skipped"))
		self.assertTrue(result["letter_head"].startswith("skipped"))

	def test_the_bundle_is_found_through_the_manifest(self) -> None:
		site_assets = os.path.abspath(os.path.join(frappe.local.sites_path, "assets"))
		with tempfile.TemporaryDirectory(dir=site_assets) as folder:
			path = os.path.join(folder, "ins_print.bundle.TEST.css")
			with open(path, "w", encoding="utf-8") as handle:
				handle.write(BUNDLE_CSS)
			url = "/assets/" + os.path.relpath(path, site_assets)
			with mock.patch.object(frappe.utils, "get_assets_json", return_value={ship.PRINT_BUNDLE: url}):
				self.assertEqual(ship.bundle_path(), path)
			with mock.patch.object(
				frappe.utils, "get_assets_json", return_value={ship.PRINT_BUNDLE: "/assets/../x.css"}
			):
				self.assertIsNone(ship.bundle_path())

	def test_the_font_block_follows_the_pairing(self) -> None:
		settings = frappe._dict(font_pairing="Noto")
		with self.sources():
			css = ship.style_css(settings)
		self.assertIn("Midad Print Plex Sans", css, "Noto and Tajawal print in Plex (only Plex ships TTF)")

	def test_uninstall_removes_untouched_and_keeps_changed(self) -> None:
		self.ship()
		frappe.db.set_value("Letter Head", ship.NAME, "content", "<p>mine</p>")
		result = ship.remove()
		self.assertEqual(result["print_style"], "removed")
		self.assertTrue(result["letter_head"].startswith("kept"))
		self.assertFalse(frappe.db.exists("Print Style", ship.NAME))
		self.assertTrue(frappe.db.exists("Letter Head", ship.NAME))
		self.assertIsNone(frappe.db.get_global(ship.GLOBAL_KEY), "no orphan checksum")

	def test_uninstall_keeps_a_linked_record(self) -> None:
		self.ship()
		frappe.db.set_single_value("Print Settings", "print_style", ship.NAME)
		result = ship.remove()
		self.assertTrue(result["print_style"].startswith("kept"), result)
		self.assertTrue(frappe.db.exists("Print Style", ship.NAME))
		self.assertEqual(result["letter_head"], "removed")

	def test_the_shipped_templates_print_without_the_app(self) -> None:
		"""A kept Letter Head must still render after uninstall, when `ins_identity` is no longer registered."""
		header, footer = ship.letter_head_html()
		env = Environment(undefined=DebugUndefined)
		context = {"frappe": frappe._dict(lang="ar")}
		for source in (header, footer):
			self.assertEqual(env.from_string(source).render(context).strip(), "", "nothing to show, no error")
		for source in (header, footer):
			rendered = frappe.render_template(source, {"frappe": frappe})
			self.assertNotIn("Context Error", rendered)

	def test_the_header_with_the_app_still_shows_the_emblem(self) -> None:
		header, _ = ship.letter_head_html()
		rendered = frappe.render_template(header, {"frappe": frappe})
		self.assertIn('class="ins-lh"', rendered)
		self.assertIn("<img", rendered)

	def test_a_record_shipped_before_the_guard_is_updated_not_flagged(self) -> None:
		with mock.patch.object(ship, "letter_head_html", return_value=(UNGUARDED_HEADER, UNGUARDED_FOOTER)):
			with mock.patch.object(ship, "bundle_path", return_value=self.bundle_file):
				self.assertEqual(ship.ship()["letter_head"], "created")
		header, footer = ship.letter_head_html()
		with mock.patch.object(ship, "bundle_path", return_value=self.bundle_file):
			self.assertEqual(ship.ship()["letter_head"], "updated")
		self.assertEqual(self.letter().content, header)
		self.assertEqual(self.letter().footer, footer)

	def test_the_installed_hooks_are_registered(self) -> None:
		self.assertIn("institutional_theme.install.after_install", frappe.get_hooks("after_install"))
		self.assertIn("institutional_theme.install.after_migrate", frappe.get_hooks("after_migrate"))
		events = frappe.get_hooks("doc_events").get("Institutional Theme Settings", {}).get("on_update", [])
		self.assertIn("institutional_theme.print.ship.on_settings_update", events)
