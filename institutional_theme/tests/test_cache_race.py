"""Cache races (round 5): a request served between a write and its commit refills a cache with the old rows.

Frappe clears a cache while the save is still inside its transaction. A concurrent request then reads the
old committed rows and refills the cache, and nothing clears it again at the commit. Each test here
writes, plants the old value in the cache exactly as that request would, commits, and reads back through
the normal cached path. The tests call only this app's entry points and core's own readers, so they fail
on code that clears once and pass on code that clears again after the transaction (`cache_guard`).

Planting is deterministic: no thread, no timing.
"""

from __future__ import annotations

import copy
import json
from unittest import mock

import frappe
from frappe.tests import IntegrationTestCase

from institutional_theme import api, install, preferences, site_files, website
from institutional_theme.institutional_theme.doctype.institutional_theme_settings import identity_sync
from institutional_theme.print import ship

from .helpers import DOCTYPE, all_bundles_linkable, delete_user, make_user, reset_settings, set_settings

USER = "ins_race_user@example.com"
PETROL = "ins_palette_petrol.bundle.css"
GLOBAL_PREFIXES = ("ins_identity_", "ins_print_")


def defaults_key(parent: str) -> str:
	return f"defaults::{parent}"


def snapshot_defaults(parent: str) -> frappe._dict:
	"""The defaults of `parent` as the committed rows show them now (read through core's cache)."""
	return copy.deepcopy(frappe.defaults.get_defaults_for(parent))


def refill_defaults(parent: str, committed: frappe._dict) -> None:
	"""What a request served between the write and the commit does: caches the old committed rows."""
	frappe.client_cache.set_value(defaults_key(parent), copy.deepcopy(committed))


def drop_global(key: str) -> None:
	frappe.defaults.clear_default(key=key, parent="__global")
	frappe.db.commit()


class TestCacheRace(IntegrationTestCase):
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
		frappe.db.commit()

	def tearDown(self) -> None:
		frappe.set_user("Administrator")
		frappe.db.commit()

	# -- globals written by the identity write-through and the print shipping --------------------

	def test_the_identity_record_is_read_back_after_a_refill_with_the_old_rows(self) -> None:
		"""The flaky `ins_identity_prior` read of round 4: the app reads its own record in the same save."""
		key = "ins_identity_racetest"
		self.addCleanup(drop_global, key)
		old = snapshot_defaults("__global")
		identity_sync._store(key, {"Website Settings.app_name": "Frappe"})
		refill_defaults("__global", old)
		self.assertEqual(identity_sync._load(key), {"Website Settings.app_name": "Frappe"})

	def test_the_identity_record_is_not_cached_old_after_the_commit(self) -> None:
		key = "ins_identity_racetest"
		self.addCleanup(drop_global, key)
		old = snapshot_defaults("__global")
		identity_sync._store(key, {"Website Settings.app_name": "Frappe"})
		refill_defaults("__global", old)
		frappe.db.commit()
		self.assertEqual(json.loads(frappe.db.get_global(key)), {"Website Settings.app_name": "Frappe"})

	def test_a_print_record_that_is_cleared_stays_cleared_after_the_commit(self) -> None:
		with mock.patch.object(ship, "GLOBAL_KEY", "ins_print_racetest"):
			self.addCleanup(drop_global, "ins_print_racetest")
			ship._store({"style": "abc"})
			frappe.db.commit()
			old = snapshot_defaults("__global")
			self.assertIn("ins_print_racetest", old)
			ship._store({})  # nothing shipped any more: the record is removed
			refill_defaults("__global", old)
			frappe.db.commit()
			self.assertIsNone(frappe.db.get_global("ins_print_racetest"))

	def test_the_print_record_is_read_back_after_a_refill_with_the_old_rows(self) -> None:
		with mock.patch.object(ship, "GLOBAL_KEY", "ins_print_racetest"):
			self.addCleanup(drop_global, "ins_print_racetest")
			old = snapshot_defaults("__global")
			ship._store({"style": "abc"})
			refill_defaults("__global", old)
			self.assertEqual(ship._load(), {"style": "abc"})
			frappe.db.commit()
			self.assertEqual(json.loads(frappe.db.get_global("ins_print_racetest")), {"style": "abc"})

	# -- the user's own choice -------------------------------------------------------------------

	def test_a_palette_saved_through_the_api_is_not_cached_old_after_the_commit(self) -> None:
		old = snapshot_defaults(USER)
		frappe.set_user(USER)
		with all_bundles_linkable():
			api.set_appearance(palette="graphite")
			refill_defaults(USER, old)
			frappe.cache.hset("bootinfo", USER, {"stale": 1})
			self.assertEqual(preferences.get_effective(USER)["palette"], "graphite", "read before the commit")
			frappe.db.commit()
			self.assertEqual(frappe.defaults.get_defaults_for(USER).get("ins_palette"), "graphite")
			self.assertEqual(preferences.get_effective(USER)["palette"], "graphite")
		self.assertIsNone(frappe.cache.hget("bootinfo", USER), "the user's boot payload cache is dropped")

	def test_a_palette_choice_is_read_from_the_table_not_from_the_defaults_cache(self) -> None:
		with all_bundles_linkable():
			frappe.defaults.set_user_default("ins_palette", "graphite", USER)
			frappe.db.commit()
			refill_defaults(USER, frappe._dict())  # a request whose snapshot predates the commit
			self.assertEqual(preferences.get_effective(USER)["palette"], "graphite")

	def test_uninstalling_the_globals_leaves_no_cached_row_after_the_commit(self) -> None:
		rows = frappe.get_all(
			"DefaultValue",
			filters={"parent": "__global", "defkey": ("like", "ins_%")},
			fields=["defkey", "defvalue"],
		)
		frappe.db.set_global("ins_identity_racetest", "x")
		frappe.db.commit()

		def restore() -> None:
			for row in rows:
				frappe.db.set_global(row.defkey, row.defvalue)
			frappe.db.commit()

		self.addCleanup(restore)
		old = snapshot_defaults("__global")
		self.assertEqual(old.get("ins_identity_racetest"), "x")
		install.clear_globals()
		refill_defaults("__global", old)
		frappe.db.commit()
		self.assertIsNone(frappe.db.get_global("ins_identity_racetest"))

	def test_uninstalling_the_user_choices_leaves_no_cached_row_after_the_commit(self) -> None:
		frappe.defaults.set_user_default("ins_density", "compact", USER)
		frappe.db.commit()
		old = snapshot_defaults(USER)
		self.assertEqual(old.get("ins_density"), "compact")
		install.clear_user_defaults()
		refill_defaults(USER, old)
		frappe.db.commit()
		self.assertIsNone(frappe.defaults.get_defaults_for(USER).get("ins_density"))

	# -- the settings document and the website caches ---------------------------------------------

	def stale_settings(self):
		"""The settings document as it was before the save (a copy: the save must not change it)."""
		return copy.deepcopy(frappe.get_doc(DOCTYPE))

	def plant_settings(self, stale) -> None:
		"""A request whose snapshot predates the commit puts the old document back after core cleared it."""
		frappe.cache.set_value(frappe.get_document_cache_key(DOCTYPE, DOCTYPE), copy.deepcopy(stale))

	def test_the_settings_document_is_fresh_after_a_late_refill_with_the_old_one(self) -> None:
		stale = self.stale_settings()
		set_settings(default_palette="petrol")
		self.plant_settings(stale)
		self.assertEqual(site_files.get_settings().default_palette, "petrol")

	def test_website_pages_get_the_new_default_after_a_late_refill_with_the_old_settings(self) -> None:
		"""The flaky `test_website_pages_get_the_site_default_in_a_new_list` of round 4."""
		stale = self.stale_settings()
		with all_bundles_linkable():
			set_settings(default_palette="petrol")
			self.plant_settings(stale)
			context = frappe._dict(template="www/login.html", web_include_css=["ins_web.bundle.css"])
			result = website.update_website_context(context)
		self.assertEqual(result, {"web_include_css": ["ins_web.bundle.css", PETROL]})

	def test_the_settings_document_is_dropped_before_the_website_caches_are_cleared(self) -> None:
		"""A page rendered after the website caches were cleared must not read the old document."""
		stale = self.stale_settings()
		seen: list[object] = []
		key = frappe.get_document_cache_key(DOCTYPE, DOCTYPE)
		doc = frappe.get_doc(DOCTYPE)
		doc.default_palette = "petrol"
		with mock.patch(
			"frappe.website.utils.clear_cache",
			side_effect=lambda *a, **k: seen.append(frappe.cache.get_value(key)),
		):
			doc.save()
			self.plant_settings(stale)
			frappe.db.commit()
		self.assertTrue(seen, "the website caches were cleared after the commit")
		self.assertEqual(seen[0], None, "the old settings document was still cached when they were cleared")

	def test_the_website_caches_are_cleared_again_after_the_identity_write(self) -> None:
		identity_sync.clear_website_caches()
		frappe.cache.set_value("website_page::/ins-race", "<html>old name</html>")
		frappe.db.commit()
		self.assertIsNone(frappe.cache.get_value("website_page::/ins-race"))
