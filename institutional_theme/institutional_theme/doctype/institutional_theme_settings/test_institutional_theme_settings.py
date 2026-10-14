"""Integration tests of the Institutional Theme Settings. They run on a bench site:

bench --site midad.test run-tests --app institutional_theme
"""

from __future__ import annotations

import copy
import glob
import json
import os
from pathlib import Path
from unittest import mock

import frappe
from frappe.tests import IntegrationTestCase

from institutional_theme import cache_guard, install
from institutional_theme.midad import model as midad

from . import identity_sync
from . import institutional_theme_settings as controller

DOCTYPE = "Institutional Theme Settings"
JSON_PATH = Path(__file__).with_name("institutional_theme_settings.json")
SYSTEM_MANAGER_ONLY = "ins_sysmgr@example.com"
WEBSITE_MANAGER_ONLY = "ins_webmgr@example.com"
WOFF2 = b"wOF2" + b"\x00" * 60
TTF = b"\x00\x01\x00\x00" + b"\x00" * 60
NOT_A_FONT = b"<html>not a font</html>"


def _image(seed: int) -> bytes:
	"""Bytes that no text encoding of `File.get_content` accepts (0x81 is undefined in windows-1250, windows-1252
	and UTF-8), as with a real image: core then attaches a byte-identical copy instead of a re-encoded one."""
	return b"\x89PNG\r\n\x1a\n\x81\x90" + bytes([seed]) * 40


def _make_user(email: str, role: str) -> None:
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


class TestInstitutionalThemeSettings(IntegrationTestCase):
	@classmethod
	def setUpClass(cls) -> None:
		super().setUpClass()
		_make_user(SYSTEM_MANAGER_ONLY, "System Manager")
		_make_user(WEBSITE_MANAGER_ONLY, "Website Manager")
		frappe.db.commit()

	@classmethod
	def tearDownClass(cls) -> None:
		# Saving a document that points at a file adds File rows of its own: sweep them.
		frappe.set_user("Administrator")
		identity_sync.delete_attachments()
		# Rows that core attached to the core settings for the test images (their names start with the
		# test file name plus a hash suffix).
		for name in frappe.get_all("File", filters={"file_name": ("like", "ins-test-%")}, pluck="name"):
			frappe.delete_doc("File", name, force=True, ignore_permissions=True)
		frappe.db.delete("Version", {"ref_doctype": DOCTYPE})
		frappe.db.commit()
		for leftover in glob.glob(frappe.get_site_path("public", "files", "ins-test-*")):
			os.remove(leftover)
		for email in (SYSTEM_MANAGER_ONLY, WEBSITE_MANAGER_ONLY):
			frappe.delete_doc("User", email, force=True, ignore_permissions=True)
		frappe.db.commit()
		super().tearDownClass()

	def setUp(self) -> None:
		frappe.set_user("Administrator")
		self._files: list[str] = []
		self._reset()

	def tearDown(self) -> None:
		frappe.set_user("Administrator")
		self._reset()
		for name in self._files:
			if frappe.db.exists("File", name):
				frappe.delete_doc("File", name, force=True, ignore_permissions=True)
		frappe.db.commit()
		frappe.clear_cache()

	def _reset(self) -> None:
		"""Back to a never-saved settings document and to the original core identity values."""
		identity_sync.restore()
		identity_sync.delete_attachments()
		frappe.db.delete("Singles", {"doctype": DOCTYPE})
		frappe.clear_document_cache(DOCTYPE, DOCTYPE)
		frappe.db.commit()

	def settings(self, **values) -> frappe.model.document.Document:
		doc = frappe.get_doc(DOCTYPE)
		doc.update(values)
		return doc

	def public_file(self, name: str, content: bytes) -> str:
		file = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": name,
				"content": content,
				"is_private": 0,
				"attached_to_doctype": DOCTYPE,
				"attached_to_name": DOCTYPE,
			}
		).insert(ignore_permissions=True)
		self._files.append(file.name)
		return file.file_url

	def all_fonts(self, content: bytes = WOFF2) -> dict[str, str]:
		return {
			"font_arabic_regular": self.public_file("ins-test-ar-400.woff2", content),
			"font_arabic_semibold": self.public_file("ins-test-ar-600.woff2", content),
			"font_latin_regular": self.public_file("ins-test-la-400.woff2", content),
			"font_latin_semibold": self.public_file("ins-test-la-600.woff2", content),
		}

	# -- shape ---------------------------------------------------------------------------------

	def test_doctype_lists_exactly_the_shipped_presets(self) -> None:
		shipped = midad.load_model()["palettes"]["shipped"]
		self.assertNotIn("umber", shipped)
		spec = json.loads(JSON_PATH.read_text(encoding="utf-8"))
		fields = {field["fieldname"]: field for field in spec["fields"]}
		self.assertEqual(fields["default_palette"]["options"].split("\n"), [*shipped, "custom"])
		self.assertEqual(
			sorted(name for name in fields if name.startswith("allow_")),
			sorted([*(f"allow_{p}" for p in shipped), "allow_custom"]),
		)
		self.assertEqual(controller.shipped_presets(), shipped)

	def test_only_system_manager_has_permissions(self) -> None:
		spec = json.loads(JSON_PATH.read_text(encoding="utf-8"))
		self.assertEqual([p["role"] for p in spec["permissions"]], ["System Manager"])
		self.assertEqual(spec["issingle"], 1)
		self.assertFalse(frappe.has_permission(DOCTYPE, "read", user=WEBSITE_MANAGER_ONLY))
		self.assertTrue(frappe.has_permission(DOCTYPE, "write", user=SYSTEM_MANAGER_ONLY))

	def test_defaults_save(self) -> None:
		doc = self.settings()
		doc.save()
		self.assertEqual(doc.default_palette, "midad")
		self.assertEqual(doc.font_pairing, "IBM Plex")
		self.assertEqual(doc.default_density, "Comfortable")
		self.assertFalse(doc.custom_audit)

	# -- colour --------------------------------------------------------------------------------

	def test_default_must_be_allowed(self) -> None:
		doc = self.settings(default_palette="graphite", allow_graphite=0)
		with self.assertRaises(frappe.ValidationError) as caught:
			doc.save()
		self.assertIn("must also be allowed", str(caught.exception))
		self.assertIn("Graphite", str(caught.exception))

	def test_custom_default_needs_allow_custom(self) -> None:
		doc = self.settings(
			default_palette="custom", allow_custom=0, custom_primary="#1F3A5F", custom_accent="#B08D57"
		)
		with self.assertRaises(frappe.ValidationError) as caught:
			doc.save()
		self.assertIn("must also be allowed", str(caught.exception))

	def test_dropped_preset_is_not_a_valid_default(self) -> None:
		doc = self.settings(default_palette="umber")
		with self.assertRaises(frappe.ValidationError):
			doc.save()

	def test_other_shipped_default_saves_when_allowed(self) -> None:
		doc = self.settings(default_palette="petrol")
		doc.save()
		self.assertEqual(frappe.get_doc(DOCTYPE).default_palette, "petrol")

	def test_custom_colours_are_required_and_must_be_hex(self) -> None:
		with self.assertRaises(frappe.ValidationError):
			self.settings(allow_custom=1).save()
		with self.assertRaises(frappe.ValidationError) as caught:
			self.settings(allow_custom=1, custom_primary="navy", custom_accent="#B08D57").save()
		self.assertIn("six hex digits", str(caught.exception))

	def test_custom_palette_that_passes_is_saved_with_its_audit(self) -> None:
		doc = self.settings(allow_custom=1, custom_primary="#1F3A5F", custom_accent="#B08D57")
		doc.save()
		self.assertRegex(doc.custom_audit, r"^\d+ / \d+ · \d+\.\d\d:1$")
		passed, total = doc.custom_audit.split(" · ")[0].split(" / ")
		self.assertEqual(passed, total)

	def test_pale_custom_colour_keeps_curve_lightness_and_passes(self) -> None:
		# Only hue and chroma come from the input, so a pale input cannot lower the contrast.
		self.settings(allow_custom=1, custom_primary="#D9E2F3", custom_accent="#FFF2CC").save()

	def test_custom_palette_failing_a_pair_is_rejected_naming_every_pair(self) -> None:
		model = copy.deepcopy(midad.load_model())
		for group in model["contrast"]["groups"]:
			if group["name"] == "Text on primary action":
				group["min"] = 30  # unreachable on purpose: the pair must fail
		with mock.patch.object(midad, "load_model", return_value=model):
			failures = midad.custom_preset("#1F3A5F", "#B08D57").failures
			self.assertTrue(failures)
			doc = self.settings(allow_custom=1, custom_primary="#1F3A5F", custom_accent="#B08D57")
			with self.assertRaises(frappe.ValidationError) as caught:
				doc.save()
		message = str(caught.exception)
		self.assertIn("Custom colour preset rejected", message)
		self.assertIn("<ul>", message)
		self.assertEqual(message.count("<li>"), len(failures))
		self.assertIn("Text on primary action", message)
		self.assertIn("Primary action", message)
		for token in ("on-primary", "primary-hover", "primary-active", "<code>"):
			self.assertNotIn(token, message)  # human labels only
		self.assertIn('<bdi dir="ltr">30</bdi>', message)
		self.assertIn("at least", message)
		self.assertIn("Adjust the primary colour.", message)
		self.assertRegex(message, r"(Light|Dark) mode")
		self.assertFalse(frappe.get_doc(DOCTYPE).allow_custom)  # nothing was stored

	def test_contrast_line_wording_for_a_maximum(self) -> None:
		failure = {
			"kind": "max",
			"fg": "chart-grid",
			"bg": "surface-base",
			"fg_label": "Chart gridlines",
			"bg_label": "Page background",
			"mode_label": "Dark",
			"ratio_text": "1.50",
			"required": 1.35,
			"adjust": None,
			"adjust_label": "",
		}
		line = controller.contrast_line(failure)
		self.assertIn("at most", line)
		self.assertNotIn("Adjust", line)

	# -- fonts ---------------------------------------------------------------------------------

	def test_uploaded_pairing_requires_all_four_files(self) -> None:
		fonts = self.all_fonts()
		fonts.pop("font_latin_semibold")
		with self.assertRaises(frappe.MandatoryError) as caught:
			self.settings(font_pairing="Uploaded", **fonts).save()
		self.assertIn("Latin semibold", str(caught.exception))

	def test_uploaded_pairing_with_real_fonts_saves(self) -> None:
		doc = self.settings(font_pairing="Uploaded", **self.all_fonts())
		doc.save()
		self.assertNotIn("missing_font_message", doc.get("__onload") or {})

	def test_truetype_is_accepted(self) -> None:
		self.settings(font_pairing="Uploaded", **self.all_fonts(TTF)).save()

	def test_file_that_is_not_a_font_is_rejected(self) -> None:
		fonts = self.all_fonts()
		fonts["font_arabic_regular"] = self.public_file("ins-test-fake.woff2", NOT_A_FONT)
		with self.assertRaises(frappe.ValidationError) as caught:
			self.settings(font_pairing="Uploaded", **fonts).save()
		self.assertIn("is not a WOFF2 or TrueType font file", str(caught.exception))
		self.assertIn('<bdi dir="ltr">ins-test-fake', str(caught.exception))

	def test_private_font_is_rejected(self) -> None:
		fonts = self.all_fonts()
		private = frappe.get_doc(
			{"doctype": "File", "file_name": "ins-test-private.woff2", "content": WOFF2, "is_private": 1}
		).insert(ignore_permissions=True)
		self._files.append(private.name)
		fonts["font_latin_regular"] = private.file_url
		with self.assertRaises(frappe.ValidationError) as caught:
			self.settings(font_pairing="Uploaded", **fonts).save()
		self.assertIn("must be public", str(caught.exception))

	def test_external_font_url_is_rejected(self) -> None:
		fonts = self.all_fonts()
		fonts["font_latin_regular"] = "https://example.com/x.woff2"
		with self.assertRaises(frappe.ValidationError):
			self.settings(font_pairing="Uploaded", **fonts).save()

	def test_restore_without_files_still_saves_with_another_pairing(self) -> None:
		"""Upgrade review U1: URLs set, files gone (a restore), then switch to IBM Plex."""
		doc = self.settings(font_pairing="Uploaded", **self.all_fonts())
		doc.save()
		for url in {doc.font_arabic_regular, doc.font_latin_regular}:
			path = frappe.get_site_path("public", url.lstrip("/"))
			if os.path.exists(path):
				os.remove(path)
		frappe.clear_document_cache(DOCTYPE, DOCTYPE)

		# An unrelated change while the pairing stays Uploaded is allowed: the fields did not change.
		again = frappe.get_doc(DOCTYPE)
		again.default_density = "Compact"
		again.save()

		# Switching to another pairing is allowed.
		switch = frappe.get_doc(DOCTYPE)
		switch.font_pairing = "IBM Plex"
		switch.save()
		self.assertEqual(frappe.get_doc(DOCTYPE).font_pairing, "IBM Plex")

		# Choosing Uploaded again checks every file, and the missing ones are refused.
		back = frappe.get_doc(DOCTYPE)
		back.font_pairing = "Uploaded"
		with self.assertRaises(frappe.ValidationError) as caught:
			back.save()
		self.assertIn("is not a WOFF2 or TrueType font file", str(caught.exception))

	def test_a_changed_font_is_checked_while_the_pairing_stays_uploaded(self) -> None:
		self.settings(font_pairing="Uploaded", **self.all_fonts()).save()
		doc = frappe.get_doc(DOCTYPE)
		doc.font_latin_regular = self.public_file("ins-test-fake2.woff2", NOT_A_FONT)
		with self.assertRaises(frappe.ValidationError):
			doc.save()

	def test_other_pairings_do_not_check_stale_font_fields(self) -> None:
		not_a_font = self.public_file("ins-test-stale.woff2", NOT_A_FONT)
		self.settings(font_pairing="IBM Plex", font_arabic_regular=not_a_font).save()

	def test_track_changes_is_on(self) -> None:
		self.assertEqual(json.loads(JSON_PATH.read_text(encoding="utf-8"))["track_changes"], 1)

	def test_audit_text_uses_labels_not_token_names(self) -> None:
		result = midad.custom_preset("#1F3A5F", "#B08D57")
		text = controller.audit_text(result)
		self.assertRegex(text, r"^\d+ of \d+ contrast pairs pass\. Tightest: ")
		self.assertIn('<bdi dir="ltr">', text)
		# Single-word tokens such as "border" are also ordinary words in the labels
		# ("Input border"), so only hyphenated token names are distinctive.
		for token in midad.load_model()["semantic"]:
			if "-" in token:
				self.assertNotIn(f" {token} ", text)

	def test_form_shows_the_audit_in_words_and_storage_stays_neutral(self) -> None:
		doc = self.settings(allow_custom=1, custom_primary="#1F3A5F", custom_accent="#B08D57")
		doc.save()
		stored = frappe.db.get_single_value(DOCTYPE, "custom_audit")
		self.assertRegex(stored, r"^\d+ / \d+ · ")
		shown = frappe.get_doc(DOCTYPE)
		shown.run_method("onload")
		self.assertIn("contrast pairs pass", shown.custom_audit)

	def test_missing_upload_is_named_on_the_form(self) -> None:
		doc = self.settings(font_pairing="Uploaded", **self.all_fonts())
		doc.save()
		path = frappe.get_site_path("public", doc.font_arabic_regular.lstrip("/"))
		os.remove(path)
		message = frappe.get_doc(DOCTYPE)
		message.run_method("onload")
		self.assertIn('<bdi dir="ltr">ins-test-ar-400', message.get_onload("missing_font_message"))
		self.assertIn("IBM Plex is used", message.get_onload("missing_font_message"))

	# -- behaviour -----------------------------------------------------------------------------

	def test_idle_warning_range(self) -> None:
		for minutes in (0, 31):
			with self.assertRaises(frappe.ValidationError) as caught:
				self.settings(enable_idle_warning=1, idle_warning_minutes=minutes).save()
			self.assertIn("between 1 and 30 minutes", str(caught.exception))
		self.settings(enable_idle_warning=1, idle_warning_minutes=30).save()
		# A value outside the range is ignored while the warning is off.
		self.settings(enable_idle_warning=0, idle_warning_minutes=99).save()

	def test_behaviour_ships_disabled(self) -> None:
		doc = frappe.get_doc(DOCTYPE)
		self.assertFalse(doc.enable_idle_warning)
		self.assertFalse(doc.enable_connection_banner)
		self.assertFalse(doc.allow_custom)

	def test_environment_labels(self) -> None:
		self.assertEqual(controller.environment_label(None), "")
		self.assertEqual(controller.environment_label(""), "")
		self.assertEqual(controller.environment_label("Production"), "")
		self.assertEqual(controller.environment_label("training"), "Training")
		self.assertEqual(controller.environment_label("UAT"), "UAT")
		self.assertEqual(controller.environment_label("Staging"), "Staging")
		self.assertEqual(controller.environment_label("whatever"), "Non-production")

	def test_environment_comes_from_site_config_and_is_not_stored(self) -> None:
		frappe.conf.ins_environment = "Training"
		try:
			doc = frappe.get_doc(DOCTYPE)
			doc.run_method("onload")
			self.assertEqual(doc.environment, "Training")
			doc.save()
		finally:
			del frappe.conf["ins_environment"]
		self.assertFalse(frappe.db.get_single_value(DOCTYPE, "environment"))

	# -- identity write-through ----------------------------------------------------------------

	def website(self, field: str):
		return frappe.db.get_single_value("Website Settings", field)

	def test_identity_is_written_through_by_a_system_manager_without_website_manager(self) -> None:
		original = self.website("app_name")
		self.assertNotIn("Website Manager", frappe.get_roles(SYSTEM_MANAGER_ONLY))
		logo = self.public_file("ins-test-emblem.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 16)
		frappe.set_user(SYSTEM_MANAGER_ONLY)
		self.settings(system_name="Test Authority", emblem=logo).save()
		frappe.set_user("Administrator")
		self.assertEqual(self.website("app_name"), "Test Authority")
		self.assertEqual(self.website("app_logo"), logo)
		self.assertEqual(self.website("splash_image"), logo)
		self.assertEqual(frappe.db.get_single_value("Navbar Settings", "app_logo"), logo)
		prior = json.loads(cache_guard.get_global(identity_sync.PRIOR_KEY))
		self.assertEqual(prior["Website Settings.app_name"], original)

	def test_save_without_identity_change_writes_nothing(self) -> None:
		self.settings(system_name="Test Authority").save()
		with mock.patch.object(frappe.db, "set_single_value") as writer:
			doc = frappe.get_doc(DOCTYPE)
			doc.default_density = "Compact"
			doc.save()
		writer.assert_not_called()

	def test_identity_changed_elsewhere_is_not_overwritten_by_an_unrelated_save(self) -> None:
		self.settings(system_name="Test Authority").save()
		frappe.db.set_single_value("Website Settings", "app_name", "Changed by an administrator")
		doc = frappe.get_doc(DOCTYPE)
		doc.default_density = "Compact"
		doc.save()
		self.assertEqual(self.website("app_name"), "Changed by an administrator")

	def test_broken_website_settings_does_not_block_saving(self) -> None:
		frappe.db.set_single_value("Website Settings", "home_page", "no-such-page-anywhere")
		try:
			self.settings(system_name="Test Authority").save()
			self.assertEqual(self.website("app_name"), "Test Authority")
		finally:
			frappe.db.set_single_value("Website Settings", "home_page", "")

	def test_clearing_a_field_restores_the_original(self) -> None:
		original = self.website("app_name")
		self.settings(system_name="Test Authority").save()
		doc = frappe.get_doc(DOCTYPE)
		doc.system_name = ""
		doc.save()
		self.assertEqual(self.website("app_name"), original)
		self.assertNotIn(
			"Website Settings.app_name", json.loads(cache_guard.get_global(identity_sync.WRITTEN_KEY))
		)

	def test_clearing_does_not_overwrite_an_administrators_later_edit(self) -> None:
		"""Upgrade review U3."""
		original = self.website("app_name")
		self.settings(system_name="Test Authority").save()
		frappe.db.set_single_value("Website Settings", "app_name", "Changed by an administrator")
		doc = frappe.get_doc(DOCTYPE)
		doc.system_name = ""
		doc.save()
		self.assertEqual(self.website("app_name"), "Changed by an administrator")
		self.assertNotEqual(self.website("app_name"), original)
		self.assertNotIn(
			"Website Settings.app_name", json.loads(cache_guard.get_global(identity_sync.WRITTEN_KEY))
		)
		frappe.db.set_single_value("Website Settings", "app_name", original)

	def test_before_uninstall_leaves_nothing_behind_and_is_idempotent(self) -> None:
		original = self.website("app_name")
		logo = self.public_file("ins-test-emblem3.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 16)
		self.settings(system_name="Test Authority", emblem=logo, default_density="Compact").save()
		frappe.defaults.set_user_default("ins_palette", "graphite", "Administrator")
		frappe.defaults.set_user_default("ins_density", "Compact", SYSTEM_MANAGER_ONLY)
		frappe.defaults.set_user_default("unrelated_key", "keep", "Administrator")
		folder = frappe.get_site_path(*install.SITE_FILES_FOLDER)
		os.makedirs(folder, exist_ok=True)
		Path(folder, "ins_palette_custom.test.css").write_text("/* test */", encoding="utf-8")
		frappe.db.commit()

		install.before_uninstall()
		install.before_uninstall()  # idempotent

		self.assertEqual(self.website("app_name"), original)
		self.assertFalse(cache_guard.get_global(identity_sync.PRIOR_KEY))
		self.assertFalse(cache_guard.get_global(identity_sync.WRITTEN_KEY))
		self.assertFalse(frappe.get_all("File", filters={"attached_to_doctype": DOCTYPE}))
		self.assertFalse(frappe.db.count("DefaultValue", {"defkey": ("in", install.USER_DEFAULT_KEYS)}))
		self.assertFalse(frappe.db.count("DefaultValue", {"defkey": ("like", "ins_identity_%")}))
		self.assertFalse(frappe.db.count("Version", {"ref_doctype": DOCTYPE}))
		self.assertFalse(os.path.exists(folder))
		self.assertEqual(frappe.db.count("DefaultValue", {"defkey": "unrelated_key"}), 1)
		frappe.defaults.clear_default(key="unrelated_key", parent="Administrator")

	def test_before_uninstall_continues_after_a_failing_step(self) -> None:
		self.settings(system_name="Test Authority").save()
		frappe.defaults.set_user_default("ins_palette", "graphite", "Administrator")
		frappe.db.commit()
		with (
			mock.patch.object(identity_sync, "restore", side_effect=RuntimeError("boom")),
			mock.patch.object(install.frappe, "log_error") as log_error,
		):
			install.before_uninstall()
		log_error.assert_called()
		self.assertIn("restore identity", log_error.call_args_list[0].kwargs["title"])
		self.assertFalse(frappe.db.count("DefaultValue", {"defkey": ("in", install.USER_DEFAULT_KEYS)}))
		frappe.db.set_single_value("Website Settings", "app_name", "Frappe")

	def test_hook_is_registered(self) -> None:
		self.assertEqual(
			frappe.get_hooks("before_uninstall", app_name="institutional_theme"),
			["institutional_theme.install.before_uninstall"],
		)

	def test_restore_gives_back_prior_values_and_is_idempotent(self) -> None:
		original = self.website("app_name")
		navbar_original = frappe.db.get_single_value("Navbar Settings", "app_logo")
		logo = self.public_file("ins-test-emblem2.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 16)
		self.settings(system_name="Test Authority", emblem=logo).save()
		restored = identity_sync.restore()
		self.assertIn("Website Settings.app_name", restored)
		self.assertEqual(self.website("app_name"), original)
		self.assertEqual(frappe.db.get_single_value("Navbar Settings", "app_logo"), navbar_original)
		self.assertFalse(cache_guard.get_global(identity_sync.PRIOR_KEY))
		self.assertFalse(cache_guard.get_global(identity_sync.WRITTEN_KEY))
		self.assertEqual(identity_sync.restore(), [])

	def test_restore_leaves_a_value_an_administrator_changed(self) -> None:
		self.settings(system_name="Test Authority").save()
		frappe.db.set_single_value("Website Settings", "app_name", "Changed by an administrator")
		self.assertEqual(identity_sync.restore(), [])
		self.assertEqual(self.website("app_name"), "Changed by an administrator")
		frappe.db.set_single_value("Website Settings", "app_name", "Frappe")

	def test_delete_attachments_removes_only_this_doctypes_files(self) -> None:
		self.public_file("ins-test-attached.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 16)
		other = frappe.get_doc(
			{"doctype": "File", "file_name": "ins-test-other.txt", "content": b"other", "is_private": 1}
		).insert(ignore_permissions=True)
		self._files.append(other.name)
		self.assertGreaterEqual(identity_sync.delete_attachments(), 1)
		self.assertFalse(frappe.get_all("File", filters={"attached_to_doctype": DOCTYPE}))
		self.assertTrue(frappe.db.exists("File", other.name))

	def test_delete_attachments_removes_the_navbar_copies_core_made(self) -> None:
		logo = self.public_file("ins-test-emblem-nav.png", _image(13))
		navbar = {"attached_to_doctype": "Navbar Settings", "attached_to_field": "app_logo"}
		before = frappe.get_all("File", filters=navbar, pluck="name")
		self.settings(system_name="Test Authority", emblem=logo).save()
		copies = [name for name in frappe.get_all("File", filters=navbar, pluck="name") if name not in before]
		self.assertTrue(copies, "core attaches a copy of the emblem to Navbar Settings when it is saved")
		# An unrelated logo file of the administrator, attached to the same field, must stay.
		theirs = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": "ins-test-theirs.png",
				"content": b"\x89PNG\r\n\x1a\n" + b"\x01" * 24,
				"is_private": 0,
				"attached_to_doctype": "Navbar Settings",
				"attached_to_name": "Navbar Settings",
				"attached_to_field": "app_logo",
			}
		).insert(ignore_permissions=True)
		self._files.append(theirs.name)
		identity_sync.restore()
		identity_sync.delete_attachments()
		self.assertFalse(frappe.get_all("File", filters={**navbar, "name": ("in", copies)}))
		self.assertTrue(frappe.db.exists("File", theirs.name))

	def test_delete_attachments_keeps_a_navbar_copy_that_is_showing(self) -> None:
		"""The administrator already used this image as the logo: it is the prior value, so it stays shown
		and the File row behind it stays."""
		logo = self.public_file("ins-test-emblem-keep.png", _image(12))
		frappe.db.set_single_value("Navbar Settings", "app_logo", logo)
		self.settings(system_name="Test Authority", emblem=logo).save()
		navbar = {"attached_to_doctype": "Navbar Settings", "attached_to_field": "app_logo"}
		copy_row = frappe.get_all("File", filters={**navbar, "file_url": logo}, fields=["name", "file_url"])[
			0
		]
		identity_sync.restore()
		self.assertEqual(frappe.db.get_single_value("Navbar Settings", "app_logo"), logo)
		identity_sync.delete_attachments()
		self.assertTrue(frappe.db.exists("File", copy_row.name))
		frappe.db.set_single_value("Navbar Settings", "app_logo", None)
		frappe.delete_doc("File", copy_row.name, force=True, ignore_permissions=True)

	def admin_file(self, name: str, content: bytes, doctype: str, field: str) -> str:
		"""A File the administrator uploaded earlier, attached to a core settings field."""
		file = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": name,
				"content": content,
				"is_private": 0,
				"attached_to_doctype": doctype,
				"attached_to_name": doctype,
				"attached_to_field": field,
			}
		).insert(ignore_permissions=True)
		self._files.append(file.name)
		return file.name

	def test_an_administrators_file_with_the_emblems_bytes_survives_uninstall(self) -> None:
		"""Upgrade review round 3, should-fix 2: the same bytes mean the same `content_hash` and `file_url`."""
		png = _image(7)
		# The administrator uploaded the emblem as the navbar logo and as the website logo long ago, then
		# put other logos in. Their rows stay attached, not shown.
		theirs_nav = self.admin_file("ins-test-admin-nav.png", png, "Navbar Settings", "app_logo")
		theirs_web = self.admin_file("ins-test-admin-web.png", png, "Website Settings", "app_logo")
		logo = self.public_file("ins-test-emblem-same.png", png)
		self.assertEqual(frappe.db.get_value("File", theirs_nav, "file_url"), logo)
		self.settings(system_name="Test Authority", emblem=logo).save()
		frappe.get_doc("Website Settings").save()  # core copies the logo while the theme's value is in it
		identity_sync.restore()
		identity_sync.delete_attachments()
		self.assertTrue(frappe.db.exists("File", theirs_nav))
		self.assertTrue(frappe.db.exists("File", theirs_web))
		self.assertTrue(
			os.path.exists(frappe.get_site_path("public", logo.lstrip("/"))), "the file stays on disk"
		)

	def test_the_theme_copies_go_while_an_administrators_same_bytes_row_stays(self) -> None:
		png = _image(8)
		theirs = self.admin_file("ins-test-admin-other.png", png, "Website Settings", "favicon")
		logo = self.public_file("ins-test-emblem-copies.png", png)
		self.settings(system_name="Test Authority", emblem=logo).save()
		navbar_copies = frappe.get_all(
			"File",
			filters={
				"attached_to_doctype": "Navbar Settings",
				"attached_to_field": "app_logo",
				"file_url": logo,
			},
			pluck="name",
		)
		self.assertTrue(navbar_copies, "the sync itself makes core attach a copy to Navbar Settings")
		recorded = json.loads(cache_guard.get_global(identity_sync.FILES_KEY))
		self.assertEqual(recorded["Navbar Settings.app_logo"][0]["names"], sorted(navbar_copies))
		identity_sync.restore()
		self.assertGreaterEqual(identity_sync.delete_attachments(), 2)
		self.assertFalse(frappe.db.exists("File", {"name": ("in", navbar_copies)}))
		self.assertTrue(frappe.db.exists("File", theirs))
		self.assertTrue(
			os.path.exists(frappe.get_site_path("public", logo.lstrip("/"))), "theirs keeps the file"
		)
		self.assertFalse(cache_guard.get_global(identity_sync.FILES_KEY))

	def test_website_settings_copies_made_by_a_later_save_are_removed(self) -> None:
		"""Upgrade review round 3, should-fix 1."""
		png = _image(9)
		ico = _image(10)
		logo = self.public_file("ins-test-emblem-web.png", png)
		icon = self.public_file("ins-test-favicon-web.ico", ico)
		web = {
			"attached_to_doctype": "Website Settings",
			"attached_to_field": ("in", ["app_logo", "splash_image", "favicon"]),
		}
		before = frappe.get_all("File", filters=web, pluck="name")
		self.settings(emblem=logo, favicon=icon).save()
		frappe.get_doc("Website Settings").save()
		fields = ["name", "attached_to_field", "file_url", "creation"]
		copies = [row for row in frappe.get_all("File", filters=web, fields=fields) if row.name not in before]
		self.assertGreaterEqual(len(copies), 3, "core attached a copy per field on that save")
		identity_sync.restore()
		identity_sync.delete_attachments()
		left = frappe.get_all("File", filters={"name": ("in", [row.name for row in copies])}, fields=fields)
		self.assertFalse(left, f"left: {left}; recorded: {cache_guard.get_global(identity_sync.FILES_KEY)}")
		self.assertFalse(os.path.exists(frappe.get_site_path("public", logo.lstrip("/"))))

	def test_a_website_copy_that_is_still_shown_stays(self) -> None:
		png = _image(11)
		logo = self.public_file("ins-test-emblem-shown.png", png)
		frappe.db.set_single_value("Website Settings", "splash_image", logo)  # prior value is the same image
		self.settings(emblem=logo).save()
		frappe.get_doc("Website Settings").save()
		shown = frappe.get_all(
			"File",
			filters={"attached_to_doctype": "Website Settings", "attached_to_field": "splash_image"},
			pluck="name",
		)
		self.assertTrue(shown)
		identity_sync.restore()
		self.assertEqual(self.website("splash_image"), logo)
		identity_sync.delete_attachments()
		self.assertTrue(all(frappe.db.exists("File", name) for name in shown))
		frappe.db.set_single_value("Website Settings", "splash_image", None)
		for name in shown:
			frappe.delete_doc("File", name, force=True, ignore_permissions=True)

	def test_private_emblem_is_rejected(self) -> None:
		private = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": "ins-test-private.png",
				"content": b"\x89PNG\r\n\x1a\n",
				"is_private": 1,
			}
		).insert(ignore_permissions=True)
		self._files.append(private.name)
		with self.assertRaises(frappe.ValidationError) as caught:
			self.settings(emblem=private.file_url).save()
		self.assertIn("must be public", str(caught.exception))

	def test_website_manager_cannot_write_the_settings(self) -> None:
		frappe.set_user(WEBSITE_MANAGER_ONLY)
		with self.assertRaises(frappe.PermissionError):
			self.settings(system_name="Nope").save()
