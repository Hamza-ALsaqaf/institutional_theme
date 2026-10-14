"""Row counts of every table of a site, and the difference between two snapshots.

	python fresh_check.py snapshot SITE OUT.json     write {table: row count} (run from the bench's `sites` folder
	                                                 with the bench interpreter)
	python fresh_check.py diff BEFORE.json AFTER.json [IGNORE_TABLE ...]
	                                                 print tables whose count differs; exit 1 when any does

Used by tools/bench/fresh_install.sh to prove that install followed by uninstall leaves nothing behind:
the snapshot "before install" and the snapshot "after uninstall" must be the same apart from tables that
record activity by their nature (see IGNORED_BY_NATURE). Nothing here is specific to this app.
"""

from __future__ import annotations

import json
import sys

# Tables that change when anything happens on a site (log in, run a command, save a record),
# not because of this app. Printed, never counted as residue.
IGNORED_BY_NATURE = (
	"tabActivity Log",
	"tabAccess Log",
	"tabComment",
	"tabDeleted Document",
	"tabError Log",
	"tabPermission Log",
	"tabRoute History",
	"tabSessions",
	"tabVersion",
	"tabRQ Job",
	"tabScheduled Job Log",
	"tabEmail Queue",
	"__global_search",
	"__UserSettings",
)


def snapshot(site: str, out: str) -> int:
	import frappe

	frappe.init(site)
	frappe.connect()
	try:
		tables = [
			row[0]
			for row in frappe.db.sql(
				"select table_name from information_schema.tables where table_schema = 'public' order by 1"
			)
		]
		counts = {}
		for table in tables:
			counts[table] = frappe.db.sql(f'select count(*) from "{table}"')[0][0]
		# Singles hold one row per field: also keep the value rows per doctype so a left-over setting shows up.
		counts.update(
			{
				f"tabSingles[{row[0]}]": row[1]
				for row in frappe.db.sql(
					'select doctype, count(*) from "tabSingles" group by doctype order by 1'
				)
			}
		)
		keys = [row[0] for row in frappe.db.sql('select defkey from "tabDefaultValue"')]
		counts["tabDefaultValue[ins_*]"] = sum(1 for key in keys if str(key).startswith("ins_"))
		counts["tabDefaultValue[other]"] = sum(1 for key in keys if not str(key).startswith("ins_"))
		with open(out, "w", encoding="utf-8") as handle:
			json.dump(counts, handle, indent=1, sort_keys=True)
		print(f"{len(tables)} tables written to {out}")
	finally:
		frappe.destroy()
	return 0


def diff(before: str, after: str, ignore: list[str]) -> int:
	with open(before, encoding="utf-8") as handle:
		a = json.load(handle)
	with open(after, encoding="utf-8") as handle:
		b = json.load(handle)
	skip = set(IGNORED_BY_NATURE) | set(ignore)
	bad, noted = [], []
	for table in sorted(set(a) | set(b)):
		if a.get(table) != b.get(table):
			line = f"{table}: before {a.get(table)}, after {b.get(table)}"
			(noted if table in skip else bad).append(line)
	print("Differences ignored (record activity by nature):" if noted else "No ignored differences.")
	for line in noted:
		print("  " + line)
	print("RESIDUE: " + ("none" if not bad else ""))
	for line in bad:
		print("  " + line)
	return 1 if bad else 0


def main() -> int:
	mode = sys.argv[1] if len(sys.argv) > 1 else ""
	if mode == "snapshot" and len(sys.argv) == 4:
		return snapshot(sys.argv[2], sys.argv[3])
	if mode == "diff" and len(sys.argv) >= 4:
		return diff(sys.argv[2], sys.argv[3], sys.argv[4:])
	print(__doc__)
	return 2


if __name__ == "__main__":
	sys.exit(main())
