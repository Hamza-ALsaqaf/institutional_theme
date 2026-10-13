"""`site_files.ensure`: atomic, content-hash-named generated files (ADR 0004)."""

from __future__ import annotations

import hashlib
import os
import shutil
import threading
import time
from pathlib import Path
from unittest import mock

import frappe
from frappe.tests import IntegrationTestCase

from institutional_theme import fonts, guard_log, site_files

from .helpers import reset_settings, set_settings

PRIMARY, ACCENT = "#1F3A5F", "#8A6D1F"
WOFF2 = b"wOF2" + b"\x00" * 60


def folder() -> Path:
	return Path(site_files._folder())


def generated(prefix: str) -> list[Path]:
	return sorted(folder().glob(f"{prefix}.*.css")) if folder().is_dir() else []


class TestSiteFiles(IntegrationTestCase):
	@classmethod
	def tearDownClass(cls) -> None:
		frappe.set_user("Administrator")
		reset_settings()
		shutil.rmtree(folder(), ignore_errors=True)
		frappe.db.commit()
		super().tearDownClass()

	def setUp(self) -> None:
		frappe.set_user("Administrator")
		shutil.rmtree(folder(), ignore_errors=True)
		reset_settings()
		guard_log.reset()

	def test_nothing_is_written_when_nothing_is_wanted(self) -> None:
		self.assertEqual(site_files.ensure(), {})
		self.assertEqual(generated(site_files.PALETTE_PREFIX), [])

	def test_the_name_is_the_hash_of_the_content_and_deterministic(self) -> None:
		set_settings(allow_custom=1, custom_primary=PRIMARY, custom_accent=ACCENT)
		urls = site_files.ensure()
		path = generated(site_files.PALETTE_PREFIX)[0]
		digest = hashlib.sha256(path.read_bytes()).hexdigest()[:12]
		self.assertEqual(path.name, f"ins_palette_custom.{digest}.css")
		self.assertEqual(urls["palette"], f"/files/institutional_theme/{path.name}")
		site_files.clear_memo()
		self.assertEqual(site_files.ensure(), urls)
		self.assertEqual(len(generated(site_files.PALETTE_PREFIX)), 1)

	def test_a_deleted_folder_is_regenerated(self) -> None:
		set_settings(allow_custom=1, custom_primary=PRIMARY, custom_accent=ACCENT)
		first = site_files.ensure()
		shutil.rmtree(folder())
		self.assertEqual(site_files.ensure(), first)
		self.assertEqual(len(generated(site_files.PALETTE_PREFIX)), 1)

	def test_saving_the_settings_writes_the_file_through_the_on_update_hook(self) -> None:
		set_settings(allow_custom=1, custom_primary=PRIMARY, custom_accent=ACCENT)
		self.assertEqual(len(generated(site_files.PALETTE_PREFIX)), 1)
		set_settings(custom_primary="#2A4A6E")
		self.assertIn("ins_palette_custom", site_files.ensure()["palette"])
		self.assertLessEqual(len(generated(site_files.PALETTE_PREFIX)), 2)

	def test_a_palette_that_fails_its_audit_is_never_written(self) -> None:
		with mock.patch.object(site_files, "_custom_css", return_value=None):
			set_settings(allow_custom=1, custom_primary=PRIMARY, custom_accent=ACCENT)
			self.assertEqual(site_files.ensure(), {})
		self.assertEqual(generated(site_files.PALETTE_PREFIX), [])

	def test_concurrent_calls_leave_complete_files_whose_hash_equals_their_name(self) -> None:
		set_settings(allow_custom=1, custom_primary=PRIMARY, custom_accent=ACCENT)
		content = site_files.palette_content(frappe.get_cached_doc(site_files.DOCTYPE))
		name = site_files.file_name(site_files.PALETTE_PREFIX, content)
		errors: list[BaseException] = []
		target = str(folder())  # frappe.local is per thread: resolve the path here

		def write() -> None:
			try:
				site_files._write_atomic(target, name, content)
			except BaseException as error:
				errors.append(error)

		threads = [threading.Thread(target=write) for _ in range(8)]
		for thread in threads:
			thread.start()
		for thread in threads:
			thread.join()
		self.assertEqual(errors, [])
		self.assertEqual((folder() / name).read_text(encoding="utf-8"), content)
		self.assertEqual([p.name for p in folder().glob("*.tmp")], [])

	def test_a_read_only_folder_gives_no_link_and_no_error(self) -> None:
		set_settings(allow_custom=1, custom_primary=PRIMARY, custom_accent=ACCENT)
		shutil.rmtree(folder(), ignore_errors=True)
		site_files.clear_memo()
		with mock.patch("os.replace", side_effect=PermissionError("read-only")):
			self.assertEqual(site_files.ensure(), {})
		self.assertEqual([p.name for p in folder().glob("*.tmp")], [])

	def test_changing_the_colours_writes_a_new_name_and_keeps_one_previous(self) -> None:
		set_settings(allow_custom=1, custom_primary=PRIMARY, custom_accent=ACCENT)
		names = {site_files.ensure()["palette"]}
		for primary in ("#2A4A6E", "#103A55", "#243B7A"):
			set_settings(custom_primary=primary)
			names.add(site_files.ensure()["palette"])
			os.utime(generated(site_files.PALETTE_PREFIX)[-1])
		self.assertEqual(len(names), 4)
		self.assertLessEqual(len(generated(site_files.PALETTE_PREFIX)), 2)

	def test_uploaded_fonts_are_written_and_a_missing_semibold_drops_that_script(self) -> None:
		files = {}
		for field in site_files.fonts_fields():
			name = f"ins-test-{field}.woff2"
			Path(frappe.get_site_path("public", "files", name)).write_bytes(WOFF2)
			files[field] = f"/files/{name}"
		try:
			set_settings(font_pairing="Uploaded", **files)
			url = site_files.ensure()["fonts"]
			self.assertRegex(url, r"ins_fonts_uploaded\.[0-9a-f]{12}\.css$")
			text = (folder() / url.rsplit("/", 1)[1]).read_text(encoding="utf-8")
			self.assertIn(fonts.FAMILY_UPLOADED_ARABIC, text)
			self.assertIn(fonts.FAMILY_UPLOADED_LATIN, text)
			os.remove(frappe.get_site_path("public", files["font_arabic_semibold"].lstrip("/")))
			second = site_files.ensure()["fonts"]
			self.assertNotEqual(second, url)
			text = (folder() / second.rsplit("/", 1)[1]).read_text(encoding="utf-8")
			self.assertNotIn(fonts.FAMILY_UPLOADED_ARABIC, text)
			self.assertIn(fonts.FAMILY_UPLOADED_LATIN, text)
		finally:
			for url in files.values():
				try:
					os.remove(frappe.get_site_path("public", url.lstrip("/")))
				except FileNotFoundError:
					pass

	def test_ensure_never_writes_the_database(self) -> None:
		set_settings(allow_custom=1, custom_primary=PRIMARY, custom_accent=ACCENT)
		site_files.clear_memo()
		with mock.patch("frappe.db.sql", wraps=frappe.db.sql) as sql:
			site_files.ensure()
		writes = [
			c
			for c in sql.call_args_list
			if str(c.args[0]).lstrip().lower().startswith(("insert", "update", "delete"))
		]
		self.assertEqual(writes, [])

	def test_after_migrate_regenerates(self) -> None:
		set_settings(allow_custom=1, custom_primary=PRIMARY, custom_accent=ACCENT)
		shutil.rmtree(folder(), ignore_errors=True)
		site_files.after_migrate()
		self.assertEqual(len(generated(site_files.PALETTE_PREFIX)), 1)

	def test_the_files_wait_for_the_commit_and_a_rollback_writes_nothing(self) -> None:
		doc = frappe.get_doc(site_files.DOCTYPE)
		doc.update({"allow_custom": 1, "custom_primary": PRIMARY, "custom_accent": ACCENT})
		doc.save()
		self.assertEqual(generated(site_files.PALETTE_PREFIX), [])
		frappe.db.rollback()
		self.assertEqual(generated(site_files.PALETTE_PREFIX), [])
		doc = frappe.get_doc(site_files.DOCTYPE)
		doc.update({"allow_custom": 1, "custom_primary": PRIMARY, "custom_accent": ACCENT})
		doc.save()
		with mock.patch("frappe.website.utils.clear_cache") as clear_cache:
			clear_cache.assert_not_called()
			frappe.db.commit()
			clear_cache.assert_called_once()
		self.assertEqual(len(generated(site_files.PALETTE_PREFIX)), 1)

	def test_a_failure_after_the_commit_is_logged_once_and_does_not_raise(self) -> None:
		with (
			mock.patch.object(site_files, "ensure", side_effect=OSError("disk")),
			mock.patch("frappe.log_error") as log_error,
		):
			for _ in range(3):
				site_files._regenerate(None)
		self.assertEqual(log_error.call_count, 1)

	def test_old_temporary_files_are_pruned_and_young_ones_kept(self) -> None:
		folder().mkdir(parents=True, exist_ok=True)
		old = folder() / f"{site_files.PALETTE_PREFIX}.abc.1.2.tmp"
		young = folder() / f"{site_files.FONTS_PREFIX}.abc.3.4.tmp"
		foreign = folder() / "other.tmp"
		for path in (old, young, foreign):
			path.write_bytes(b"x")
		aged = time.time() - site_files.TEMPORARY_MAX_AGE - 60
		os.utime(old, (aged, aged))
		os.utime(foreign, (aged, aged))
		removed = site_files.prune()
		self.assertIn(old.name, removed)
		self.assertFalse(old.exists())
		self.assertTrue(young.exists())
		self.assertTrue(foreign.exists())
