"""Round 6: an identity save clears exactly the caches that hold the identity values, and what a user sees
is fresh afterwards (decision 82).

The tests run on a bench site, as Administrator, in one process: they warm the caches the way a request
would, save the settings document (which writes the identity through, `identity_sync.apply`), commit, and read
back through the readers core itself uses (`frappe.sessions.get` for the desk boot payload, the website
renderer for a published page, `frappe.get_website_settings`, `get_app_logo`).
"""

from __future__ import annotations

import copy
import glob
import os
from unittest import mock

import frappe
from frappe.core.doctype.navbar_settings.navbar_settings import get_app_logo
from frappe.tests import IntegrationTestCase
from frappe.utils import get_html_for_route, set_request

from institutional_theme import cache_guard, guard_log
from institutional_theme.institutional_theme.doctype.institutional_theme_settings import identity_sync

DOCTYPE = "Institutional Theme Settings"
ROUTE = "ins-cache-probe"
PAGE_KEY = f"website_page::{ROUTE}"
SENTINEL = "ins_cache_sentinel"
ROUTES_KEY = "website_generator_routes"
NAME = "Cache Test Authority"


def _image(seed: int) -> bytes:
	"""Bytes that no text encoding of `File.get_content` accepts, so core attaches a byte-identical copy."""
	return b"\x89PNG\r\n\x1a\n\x81\x90" + bytes([seed]) * 40


def doc_key(doctype: str) -> str:
	return frappe.get_document_cache_key(doctype, doctype)


class TestIdentityCaches(IntegrationTestCase):
	@classmethod
	def tearDownClass(cls) -> None:
		frappe.set_user("Administrator")
		for name in frappe.get_all("File", filters={"file_name": ("like", "ins-cache-%")}, pluck="name"):
			frappe.delete_doc("File", name, force=True, ignore_permissions=True)
		frappe.db.commit()
		for leftover in glob.glob(frappe.get_site_path("public", "files", "ins-cache-*")):
			os.remove(leftover)
		super().tearDownClass()

	def setUp(self) -> None:
		frappe.set_user("Administrator")
		self.use_private_cache_namespace()
		guard_log.reset()
		self._files: list[str] = []
		self._reset()
		frappe.flags.force_website_cache = True
		self.addCleanup(setattr, frappe.flags, "force_website_cache", False)
		# `frappe.sessions.get` and the website renderer read `frappe.local.request`.
		set_request(method="GET", path="/app")
		self.addCleanup(self._drop_request)

	def use_private_cache_namespace(self) -> None:
		"""Give this test its own Redis key prefix (`RedisWrapper.make_key` starts every key with the site's
		`db_name`).

		On a site that serves other requests, a request that began before one of this test's commits can read
		the old committed rows after it and put the old document back into the shared cache (REPEATABLE READ,
		`cache_guard`). That is core behaviour the app cannot prevent, and it would make a test that reads a core
		document back after a commit fail depending on the traffic (round 5 loaded runs, round 6 reproduction).
		With a private prefix only this process fills the caches, so what the tests read is what the app's own
		clear left behind. The database is the real one; nothing else changes. The prefix is restored, and the
		keys under it are removed, when the test ends (`tearDown`, `addCleanup`).
		"""
		original = frappe.local.conf.get("db_name")
		frappe.local.conf["db_name"] = f"{original}_ins_cache_test"
		self.addCleanup(self.restore_cache_namespace, original)
		frappe.clear_cache()

	@staticmethod
	def restore_cache_namespace(original: str | None) -> None:
		frappe.clear_cache()
		frappe.local.conf["db_name"] = original

	@staticmethod
	def _drop_request() -> None:
		if hasattr(frappe.local, "request"):
			del frappe.local.request

	def tearDown(self) -> None:
		frappe.set_user("Administrator")
		frappe.db.rollback()
		for name in frappe.get_all("Web Page", filters={"route": ROUTE}, pluck="name"):
			frappe.delete_doc("Web Page", name, force=True, ignore_permissions=True)
		self._reset()
		for name in self._files:
			if frappe.db.exists("File", name):
				frappe.delete_doc("File", name, force=True, ignore_permissions=True)
		frappe.cache.delete_value([SENTINEL, ROUTES_KEY])
		frappe.db.commit()
		frappe.clear_cache()

	def _reset(self) -> None:
		"""Back to a never-saved settings document and to the original core identity values."""
		identity_sync.restore()
		identity_sync.delete_attachments()
		frappe.db.delete("Singles", {"doctype": DOCTYPE})
		frappe.clear_document_cache(DOCTYPE, DOCTYPE)
		frappe.db.commit()
		frappe.clear_cache()

	# -- helpers ---------------------------------------------------------------------------------

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

	def save_identity(self, **values) -> None:
		doc = frappe.get_doc(DOCTYPE)
		doc.update(values)
		doc.save()

	def write_identity(self, **values) -> None:
		"""The write-through alone (`identity_sync.apply`), without the settings save around it: a save also
		makes `site_files.on_settings_update` clear the website caches after the commit, which would hide
		what the identity clear itself does."""
		doc = frappe.get_doc(DOCTYPE)
		doc.update(values)
		identity_sync.apply(doc, None)

	def make_page(self) -> None:
		frappe.get_doc(
			{
				"doctype": "Web Page",
				"title": "Ins cache probe",
				"route": ROUTE,
				"published": 1,
				"content_type": "Rich Text",
				"main_section": "<p>probe</p>",
			}
		).insert(ignore_permissions=True)
		frappe.db.commit()

	# -- what the user sees is fresh -------------------------------------------------------------

	def test_a_cached_website_page_shows_the_new_favicon_after_an_identity_save(self) -> None:
		self.make_page()
		icon = self.public_file("ins-cache-favicon.ico", _image(3))
		before = get_html_for_route(f"/{ROUTE}")
		self.assertNotIn(icon, before)
		self.assertIsNotNone(frappe.cache.get_value(PAGE_KEY), "premise: the page is in the page cache")
		self.assertEqual(get_html_for_route(f"/{ROUTE}"), before, "premise: it is served from that cache")
		self.write_identity(favicon=icon)
		frappe.db.commit()
		after = get_html_for_route(f"/{ROUTE}")
		self.assertIn(icon, after)

	def test_the_desk_boot_payload_shows_the_new_logo_after_an_identity_save(self) -> None:
		logo = self.public_file("ins-cache-emblem.png", _image(4))
		first = frappe.sessions.get()
		self.assertNotEqual(first.app_logo_url, logo)
		self.assertTrue(
			frappe.sessions.get().get("from_cache"), "premise: the payload is served from the cache"
		)
		self.save_identity(emblem=logo)
		frappe.db.commit()
		after = frappe.sessions.get()
		self.assertFalse(after.get("from_cache"), "the payload was rebuilt")
		self.assertEqual(after.app_logo_url, logo)
		self.assertEqual(after.navbar_settings.app_logo, logo)

	def test_every_reader_of_the_core_settings_sees_the_new_values_at_once(self) -> None:
		logo = self.public_file("ins-cache-emblem2.png", _image(5))
		# Warm every reader: the in-process copy of the client cache, the request-local website settings.
		self.assertNotEqual(frappe.get_website_settings("app_name"), NAME)
		self.assertNotEqual(frappe.client_cache.get_doc("Navbar Settings").app_logo, logo)
		self.assertNotEqual(get_app_logo(), logo)
		self.save_identity(system_name=NAME, emblem=logo)
		frappe.db.commit()
		self.assertEqual(frappe.get_website_settings("app_name"), NAME)
		self.assertEqual(frappe.client_cache.get_doc("Website Settings").app_name, NAME)
		self.assertEqual(frappe.client_cache.get_doc("Navbar Settings").app_logo, logo)
		self.assertEqual(frappe.get_cached_value("Navbar Settings", "Navbar Settings", "app_logo"), logo)
		self.assertEqual(get_app_logo(), logo)

	def test_the_desk_page_title_is_the_new_name_after_an_identity_save(self) -> None:
		"""`www/desk.py` reads `frappe.get_website_settings("app_name")` for the page title."""
		self.assertNotEqual(frappe.get_website_settings("app_name"), NAME)
		self.save_identity(system_name=NAME)
		frappe.db.commit()
		context = frappe._dict()
		with mock.patch.object(frappe.sessions, "get", return_value=frappe._dict(desk_theme="Light")):
			from frappe.www import desk

			desk.get_context(context)
		self.assertEqual(context.app_name, NAME)

	# -- a refill by a request that began before the commit does not survive it -------------------

	def test_a_refill_with_the_old_values_between_the_write_and_the_commit_does_not_survive(self) -> None:
		self.make_page()
		logo = self.public_file("ins-cache-emblem3.png", _image(6))
		old_boot = frappe.sessions.get()
		get_html_for_route(f"/{ROUTE}")
		old_page = copy.deepcopy(frappe.cache.get_value(PAGE_KEY))
		old_docs = {d: copy.deepcopy(frappe.get_doc(d)) for d in identity_sync._identity_documents()}
		self.assertTrue(old_page)
		self.write_identity(system_name=NAME, emblem=logo)
		# What a request served in the meantime does with the old committed rows.
		frappe.cache.hset("bootinfo", frappe.session.user, copy.deepcopy(old_boot))
		frappe.cache.set_value(PAGE_KEY, copy.deepcopy(old_page), expires_in_sec=60)
		for doctype, doc in old_docs.items():
			frappe.client_cache.set_value(doc_key(doctype), doc)
		frappe.db.commit()
		self.assertIsNone(frappe.cache.hget("bootinfo", frappe.session.user))
		self.assertIsNone(frappe.cache.get_value(PAGE_KEY))
		self.assertEqual(frappe.client_cache.get_doc("Website Settings").app_name, NAME)
		self.assertEqual(frappe.client_cache.get_doc("Navbar Settings").app_logo, logo)
		self.assertEqual(frappe.sessions.get().app_logo_url, logo)

	def test_the_caches_are_cleared_again_after_a_rollback(self) -> None:
		frappe.cache.set_value(PAGE_KEY, {"en": "<html>old</html>"})
		frappe.cache.hset("bootinfo", frappe.session.user, {"old": 1})
		identity_sync.clear_website_caches()
		frappe.cache.set_value(PAGE_KEY, {"en": "<html>old</html>"})
		frappe.cache.hset("bootinfo", frappe.session.user, {"old": 1})
		frappe.db.rollback()
		self.assertIsNone(frappe.cache.get_value(PAGE_KEY))
		self.assertIsNone(frappe.cache.hget("bootinfo", frappe.session.user))

	# -- nothing else is cleared -----------------------------------------------------------------

	def test_the_clear_does_not_touch_routes_meta_or_the_desk_metadata_version(self) -> None:
		version = frappe.client_cache.get_value("metadata_version")
		self.assertTrue(version)
		frappe.cache.set_value(SENTINEL, "kept")
		frappe.cache.set_value(ROUTES_KEY, {"kept": 1})
		frappe.get_meta("ToDo")
		with (
			mock.patch.object(frappe, "clear_cache") as full,
			mock.patch("frappe.website.utils.clear_cache") as website,
			mock.patch("frappe.website.router.clear_routing_cache") as routing,
			mock.patch("frappe.cache_manager.clear_doctype_cache") as doctype,
		):
			identity_sync.clear_website_caches()
			frappe.db.commit()
		full.assert_not_called()
		website.assert_not_called()
		routing.assert_not_called()
		doctype.assert_not_called()
		self.assertEqual(frappe.client_cache.get_value("metadata_version"), version)
		self.assertEqual(frappe.cache.get_value(SENTINEL), "kept")
		self.assertEqual(frappe.cache.get_value(ROUTES_KEY), {"kept": 1})
		self.assertTrue(frappe.client_cache.get_value("doctype_meta::ToDo"))

	def test_nothing_clears_the_whole_site_cache_when_an_identity_save_commits(self) -> None:
		"""Round 5 cleared the whole site cache a second time at the commit, while requests were in flight
		(decision 82). The clears that core makes while a global is written (`defaults._clear_cache`) happen
		inside the save and are not part of this test."""
		logo = self.public_file("ins-cache-emblem4.png", _image(7))
		with mock.patch.object(frappe, "clear_cache") as full:
			self.save_identity(system_name=NAME, emblem=logo)
			full.reset_mock()
			frappe.db.commit()
		whole_site = [
			c
			for c in full.call_args_list
			if not c.args and not (c.kwargs.get("user") or c.kwargs.get("doctype"))
		]
		self.assertEqual(whole_site, [])

	def test_the_documents_that_are_cleared_are_the_ones_the_write_through_writes(self) -> None:
		self.assertEqual(identity_sync._identity_documents(), ("Website Settings", "Navbar Settings"))

	# -- a failing step does not stop the others -------------------------------------------------

	def test_a_failing_step_is_logged_and_the_other_steps_still_run(self) -> None:
		frappe.cache.set_value(PAGE_KEY, {"en": "<html>old</html>"})
		with (
			mock.patch.object(identity_sync, "_drop_boot_payloads", side_effect=RuntimeError("boom")),
			mock.patch.object(guard_log, "log_once") as logged,
		):
			identity_sync.clear_website_caches()
		logged.assert_called_once()
		self.assertIn("boot payloads", logged.call_args.args[0])
		self.assertIsNone(frappe.cache.get_value(PAGE_KEY))
		frappe.db.rollback()

	def test_the_after_transaction_callback_is_queued_once_for_each_outcome(self) -> None:
		with mock.patch.object(cache_guard, "after_transaction") as queued:
			identity_sync.clear_website_caches()
		queued.assert_called_once_with(identity_sync._clear_website_caches)
