"""Probe: does a request that began before a commit refill the document cache with the OLD document afterwards?

Run inside the bench environment (sites folder as the working directory):
    ../env/bin/python snapshot_probe.py midad.test

Reader and writer are two threads with their own frappe.local and database connection, as two web workers.
The probe writes `default_density` of the Institutional Theme Settings Single through the document API and
restores it. It prints facts only; the conclusion is in README.md.
"""

import sys
import threading

import frappe

SITE = sys.argv[1]
DOCTYPE = "Institutional Theme Settings"
KEY = f"document_cache::{DOCTYPE}::{DOCTYPE}"
reader_started = threading.Event()
writer_committed = threading.Event()
out: dict = {}


def connect() -> None:
	frappe.init(site=SITE, sites_path=".")
	frappe.connect()


def reader() -> None:
	connect()
	frappe.set_user("Administrator")
	frappe.db.sql("select 1")  # the snapshot of this request starts with its first query
	out["isolation"] = frappe.db.sql("show transaction_isolation")[0][0]
	out["reader_before"] = frappe.db.get_single_value(DOCTYPE, "default_density", cache=False)
	reader_started.set()
	writer_committed.wait(30)
	# the same request goes on after the commit, as `frappe.get_cached_doc` does: read, then fill the cache
	doc = frappe.get_cached_doc(DOCTYPE)
	out["reader_after_commit"] = doc.default_density
	frappe.db.rollback()
	frappe.destroy()


def writer() -> None:
	connect()
	frappe.set_user("Administrator")
	reader_started.wait(30)
	doc = frappe.get_doc(DOCTYPE)
	out["original"] = doc.default_density
	doc.default_density = "Compact" if doc.default_density != "Compact" else "Comfortable"
	doc.save()
	out["written"] = doc.default_density
	frappe.db.commit()  # core clears the document cache here (after_commit)
	out["cache_right_after_commit"] = frappe.cache.get_value(KEY) is not None
	writer_committed.set()


t = [threading.Thread(target=reader), threading.Thread(target=writer)]
for th in t:
	th.start()
for th in t:
	th.join()

connect()
cached = frappe.cache.get_value(KEY)
out["cached_default_density_after_reader_finished"] = cached.default_density if cached else None
out["database_default_density"] = frappe.db.get_single_value(DOCTYPE, "default_density", cache=False)
# restore
doc = frappe.get_doc(DOCTYPE)
doc.default_density = out["original"]
doc.save()
frappe.db.commit()
frappe.cache.delete_value(KEY)
for k, v in out.items():
	print(f"{k} = {v!r}")
