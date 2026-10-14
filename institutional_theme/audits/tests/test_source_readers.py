"""Readers of the watched custom properties outside the compiled CSS (finding N3d, N3b)."""

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from institutional_theme.audits import dead_tokens, source_readers


class ReadersInText(unittest.TestCase):
	def _names(self, text, suffix):
		return [name for name, _ in source_readers.readers_in_text(text, suffix)]

	def test_var_reads_and_quoted_names_are_reads(self):
		js = "el.style.cssText = `border-radius: var(--radius-lg)`;\nconst c = [\"--blue-avatar-bg\", '--blue-avatar-color'];\n"
		self.assertEqual(self._names(js, ".js"), ["--radius-lg", "--blue-avatar-bg", "--blue-avatar-color"])

	def test_a_declaration_is_not_a_read(self):
		self.assertEqual(self._names(":root { --declared: 1; --other: var(--read); }", ".css"), ["--read"])

	def test_comments_are_not_reads(self):
		text = '/* var(--block) */\n// var(--line)\nx = 1; // "--trailing"\n.a { color: var(--real); }\n'
		self.assertEqual(self._names(text, ".scss"), ["--real"])
		self.assertEqual(self._names(text, ".js"), ["--real"])

	def test_html_comments_are_not_reads(self):
		html = "<!-- var(--gone) -->\n<style>.a { color: var(--kept); }</style>\n"
		self.assertEqual(self._names(html, ".html"), ["--kept"])

	def test_line_numbers_survive_a_block_comment(self):
		text = "/* a\nb\nc */\n.x { color: var(--here); }\n"
		self.assertEqual(source_readers.readers_in_text(text, ".css"), [("--here", 4)])


class Scan(unittest.TestCase):
	def _tree(self, tmp, files):
		for relative, text in files.items():
			path = Path(tmp, relative)
			path.parent.mkdir(parents=True, exist_ok=True)
			path.write_text(text, encoding="utf-8")

	def test_names_are_filtered_and_located(self):
		with tempfile.TemporaryDirectory() as tmp:
			self._tree(
				tmp,
				{"a/error_log.js": "x\nborder-radius: var(--radius-lg)\n", "b.css": ".a{color:var(--other)}"},
			)
			found = source_readers.scan({"frappe": Path(tmp)}, {"--radius-lg"})
		self.assertEqual(found, {"--radius-lg": ["frappe/a/error_log.js:2"]})

	def test_all_names_when_none_given(self):
		with tempfile.TemporaryDirectory() as tmp:
			self._tree(tmp, {"b.css": ".a{color:var(--other)}"})
			self.assertEqual(list(source_readers.scan({"t": Path(tmp)}, None)), ["--other"])

	def test_excluded_prefixes_node_modules_and_dist_are_skipped(self):
		with tempfile.TemporaryDirectory() as tmp:
			self._tree(
				tmp,
				{
					"ui/c.vue": "var(--x)",
					"banking/d.css": "var(--x)",
					"keep/e.css": "var(--x)",
					"node_modules/f.js": "var(--x)",
					"public/dist/g.js": "var(--x)",
					"uix/h.css": "var(--x)",
				},
			)
			found = source_readers.scan({"t": Path(tmp)}, {"--x"}, {"t": ("ui", "banking")})
		self.assertEqual(sorted(found["--x"]), ["t/keep/e.css:1", "t/uix/h.css:1"])

	def test_a_single_file_is_a_tree(self):
		with tempfile.TemporaryDirectory() as tmp:
			path = Path(tmp, "internal-common.js")
			path.write_text("a = 'var(--fc-border-color)'", encoding="utf-8")
			self.assertEqual(
				source_readers.scan({"fullcalendar": path}, {"--fc-border-color"}),
				{"--fc-border-color": ["fullcalendar/internal-common.js:1"]},
			)

	def test_a_name_only_in_a_comment_has_no_reader(self):
		with tempfile.TemporaryDirectory() as tmp:
			self._tree(tmp, {"a.js": "// var(--x)\n/* var(--x) */\n"})
			self.assertEqual(source_readers.scan({"t": Path(tmp)}, {"--x"}), {})

	def test_locations_are_capped(self):
		with tempfile.TemporaryDirectory() as tmp:
			self._tree(tmp, {f"f{i}.css": "a{color:var(--x)}" for i in range(9)})
			found = source_readers.scan({"t": Path(tmp)}, {"--x"})
		self.assertEqual(len(found["--x"]), source_readers.LOCATIONS_PER_NAME)


class Snapshot(unittest.TestCase):
	def test_round_trip_and_missing_version(self):
		with tempfile.TemporaryDirectory() as tmp:
			target = Path(tmp, "source_readers_frappe_9.9.9.json")
			source_readers.write_snapshot(
				target, "9.9.9", {"--a": ["t/x.js:1"]}, {"t": "tree"}, {"t": ("ui",)}, 3
			)
			data = json.loads(target.read_text(encoding="utf-8"))
			self.assertIn("do not edit", data["_generated"])
			self.assertEqual(source_readers.load_snapshot("9.9.9", Path(tmp)), {"--a": ["t/x.js:1"]})
			self.assertEqual(source_readers.load_snapshot("1.1.1", Path(tmp)), {})

	def test_the_committed_snapshots_hold_the_two_16_32_0_radius_readers(self):
		found = source_readers.load_snapshot("16.32.0")
		self.assertTrue(any("desktop.css" in where for where in found["--radius-md"]))
		self.assertTrue(any("error_log.js" in where for where in found["--radius-lg"]))
		core = dead_tokens.load_snapshot(dead_tokens.snapshot_path("16.32.0"))
		for name in ("--radius-md", "--radius-lg"):
			self.assertNotIn(name, core.read)

	def test_the_committed_snapshots_cover_the_libraries_and_the_dynamic_avatar_names(self):
		new = source_readers.load_snapshot("16.52.0")
		self.assertTrue(any(w.startswith("frappe-gantt/") for w in new["--g-weekend-highlight-color"]))
		self.assertTrue(any(w.startswith("fullcalendar/") for w in new["--fc-border-color"]))
		for version in ("16.32.0", "16.52.0"):
			self.assertIn("--blue-avatar-bg", source_readers.load_snapshot(version))

	def test_the_command_writes_a_snapshot_for_a_tree(self):
		with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as data:
			Path(tmp, "a.css").write_text(".a{border-radius:var(--radius-lg)}", encoding="utf-8")
			with (
				mock.patch.object(dead_tokens, "DATA_DIR", Path(data)),
				contextlib.redirect_stdout(io.StringIO()),
			):
				code = source_readers.main(["--version", "9.9.9", "--tree", f"x={tmp}", "--write"])
				written = json.loads(
					Path(data, "source_readers_frappe_9.9.9.json").read_text(encoding="utf-8")
				)
		self.assertEqual(code, 0)
		self.assertEqual(written["readers"], {"--radius-lg": ["x/a.css:1"]})


if __name__ == "__main__":
	unittest.main()
