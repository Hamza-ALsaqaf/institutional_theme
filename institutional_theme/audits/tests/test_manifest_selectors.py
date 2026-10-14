"""`tools/bench/manifest_selectors.py` reads every `### 2x` section of the dependency manifest.

Round 3 upgrade review, blocking 2: sections 2i and 2j were not checked against a new Frappe tag. These tests
fail when a section, present or future, is read as zero rows, or when a table in a `2x` section is skipped.
"""

import importlib.util
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MANIFEST = ROOT / "docs" / "DEPENDENCY_MANIFEST.md"
SCRIPT = ROOT / "tools" / "bench" / "manifest_selectors.py"


def _load():
	spec = importlib.util.spec_from_file_location("manifest_selectors", SCRIPT)
	module = importlib.util.module_from_spec(spec)
	sys.modules["manifest_selectors"] = module  # dataclasses with postponed annotations look the module up
	spec.loader.exec_module(module)
	return module


ms = _load()


def table_rows_per_2x_section(text: str) -> dict[str, int]:
	"""Data rows of every table under a `### 2x.` heading, counted without the parser under test."""
	counts: dict[str, int] = {}
	section, block = "", 0

	def close() -> None:
		nonlocal block
		if section and block > 2:
			counts[section] = counts.get(section, 0) + block - 2
		block = 0

	for line in text.splitlines():
		if line.startswith("#"):
			close()
			match = re.match(r"^### (2[a-z]+)\.", line)
			section = match.group(1) if match else ""
		elif line.startswith("|"):
			block += 1
		else:
			close()
	close()
	return counts


class TestManifestSelectors(unittest.TestCase):
	def test_every_2x_section_of_the_manifest_is_read_in_full(self) -> None:
		expected = table_rows_per_2x_section(MANIFEST.read_text(encoding="utf-8"))
		unread: list[str] = []
		rows = ms.read_rows(MANIFEST, unread)
		read: dict[str, int] = {}
		for row in rows:
			if re.fullmatch(r"2[a-z]+", row.section):
				read[row.section] = read.get(row.section, 0) + 1
		self.assertEqual(unread, [])
		self.assertEqual(read, expected)
		for section in ("2i", "2j"):
			self.assertGreater(read.get(section, 0), 0, f"section {section} must be checked at an upgrade")

	def test_a_future_section_and_an_unknown_header_are_handled(self) -> None:
		text = "\n".join(
			[
				"## 2. Frappe selectors",
				"",
				"### 2k. Later round",
				"",
				"| Selector | Our file | Frappe 16.32.0 source (file:line) | What breaks | Status |",
				"|---|---|---|---|---|",
				"| `.some-class` | `a.scss` | `frappe/public/scss/x.scss:1-3` | looks | VERIFIED |",
				"",
				"### 2m. Odd table",
				"",
				"| Thing | Our file | Source |",
				"|---|---|---|",
				"| `.other` | `b.scss` | `frappe/y.scss:1` |",
				"",
			]
		)
		with tempfile.TemporaryDirectory() as tmp:
			path = Path(tmp) / "manifest.md"
			path.write_text(text, encoding="utf-8")
			unread: list[str] = []
			rows = ms.read_rows(path, unread)
		self.assertEqual([(row.section, row.item) for row in rows], [("2k", "`.some-class`")])
		self.assertEqual(len(unread), 1)
		self.assertIn("2m", unread[0])


if __name__ == "__main__":
	unittest.main()
