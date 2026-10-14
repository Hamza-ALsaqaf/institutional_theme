"""The website scope audit: a variable marked scope desk must be read by no website page (F6)."""

import contextlib
import copy
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from institutional_theme.audits import __main__ as audits
from institutional_theme.audits import dead_tokens, web_scope
from institutional_theme.midad import model as model_mod

PUBLIC = Path(web_scope.__file__).resolve().parents[1] / "public"
MODEL = model_mod.load_model()


def _model_with(marked: dict[str, str | None]):
	"""A copy of the model where only the named variables carry the given scope."""
	model = copy.deepcopy(MODEL)
	for entry in model["frappe"]["vars"].values():
		entry.pop("scope", None)
	for name, scope in marked.items():
		if scope:
			model["frappe"]["vars"][name]["scope"] = scope
	return model


class Check(unittest.TestCase):
	def setUp(self):
		names = list(MODEL["frappe"]["vars"])
		self.a, self.b, self.c = names[:3]

	def test_a_desk_only_name_read_by_a_website_page_of_any_version_fails(self):
		model = _model_with({self.a: "desk"})
		reads = {"1.0.0": {}, "2.0.0": {self.a: "website.bundle.css"}}
		scope = web_scope.check(model, reads, {})
		self.assertEqual(len(scope.problems), 1)
		self.assertIn(self.a, scope.problems[0])
		self.assertIn("Frappe 2.0.0", scope.problems[0])
		self.assertIn("website.bundle.css", scope.problems[0])

	def test_a_desk_only_name_read_by_the_theme_website_sources_fails(self):
		scope = web_scope.check(
			_model_with({self.a: "desk"}), {"1.0.0": {}}, {self.a: "scss/web/_login.scss"}
		)
		self.assertEqual(len(scope.problems), 1)
		self.assertIn("this theme's website sources", scope.problems[0])

	def test_a_desk_only_name_nobody_reads_passes(self):
		scope = web_scope.check(_model_with({self.a: "desk"}), {"1.0.0": {self.b: "x.css"}}, {})
		self.assertEqual(scope.problems, [])
		self.assertEqual(scope.desk_only, [self.a])

	def test_without_a_snapshot_nothing_can_be_proven(self):
		scope = web_scope.check(_model_with({self.a: "desk"}), {}, {})
		self.assertEqual(len(scope.problems), 1)
		self.assertIn("cannot be proven", scope.problems[0])

	def test_unmarked_names_no_page_reads_are_candidates_not_failures(self):
		scope = web_scope.check(_model_with({self.a: "desk"}), {"1.0.0": {self.c: "x.css"}}, {})
		self.assertEqual(scope.problems, [])
		self.assertNotIn(self.a, scope.candidates)
		self.assertNotIn(self.c, scope.candidates)
		self.assertIn(self.b, scope.candidates)

	def test_a_name_read_in_only_one_of_two_versions_is_still_a_web_read(self):
		model = _model_with({self.a: "desk", self.b: "desk"})
		scope = web_scope.check(model, {"1.0.0": {self.a: "a.css"}, "2.0.0": {self.b: "b.css"}}, {})
		self.assertEqual(len(scope.problems), 2)

	def test_the_report_lists_problems_and_the_marked_names(self):
		scope = web_scope.check(_model_with({self.a: "desk"}), {"1.0.0": {self.a: "w.css"}}, {})
		text = web_scope.render_text(scope, 5)
		self.assertIn("PROBLEMS (1)", text)
		self.assertIn(f"  {self.a}", text)
		ok = web_scope.render_text(web_scope.check(_model_with({self.a: "desk"}), {"1.0.0": {}}, {}), 5)
		self.assertIn("No problems", ok)


class Committed(unittest.TestCase):
	"""The shipped marks against the shipped snapshots, with a negative case that proves the check bites."""

	def setUp(self):
		self.versions = dead_tokens.snapshot_versions()
		self.reads = {v: web_scope.load_reads(v) for v in self.versions}
		self.theme = web_scope.theme_reads(PUBLIC)

	def test_every_supported_version_has_a_web_snapshot(self):
		self.assertEqual(self.versions, ["16.32.0", "16.52.0"])
		for version in self.versions:
			self.assertGreater(len(self.reads[version]), 100, version)

	def test_the_shipped_marks_pass_and_cover_every_unread_name(self):
		scope = web_scope.check(MODEL, self.reads, self.theme)
		self.assertEqual(scope.problems, [])
		self.assertEqual(scope.candidates, [], "every variable no website page reads is marked")
		self.assertGreaterEqual(len(scope.desk_only), 50)

	def test_marking_a_name_a_page_reads_makes_the_check_fail(self):
		read = sorted(set(self.reads["16.52.0"]) & set(MODEL["frappe"]["vars"]))
		self.assertIn("--surface-elevation-2", read)
		model = copy.deepcopy(MODEL)
		model["frappe"]["vars"]["--surface-elevation-2"]["scope"] = "desk"
		scope = web_scope.check(model, self.reads, self.theme)
		self.assertTrue(any(p.startswith("--surface-elevation-2:") for p in scope.problems))

	def test_the_names_the_task_called_desk_only_that_a_page_reads_stay_in_the_website_map(self):
		web = {n for n, _ in model_mod.frappe_map(MODEL, model_mod.WEB).declarations["light"]}
		for name in ("--surface-elevation-1", "--surface-elevation-2", "--surface-elevation-3"):
			self.assertIn(name, web)
		for name in ("--desk-sidebar-bg", "--sidebar-hover-color", "--kanban-card-bg", "--surface-menu-bar"):
			self.assertNotIn(name, web)
			self.assertEqual(MODEL["frappe"]["vars"][name].get("scope"), "desk")

	def test_the_compiled_files_the_pages_load_are_recorded_with_hashes(self):
		for version in self.versions:
			data = json.loads(web_scope.snapshot_path(version).read_text(encoding="utf-8"))
			files = {c["file"] for c in data["compiled"]}
			self.assertTrue({"website.bundle.css", "login.bundle.css", "web_form.bundle.css"} <= files)
			self.assertTrue({"frappe-web.bundle.js", "web_form.bundle.js"} <= files)
			self.assertTrue(all(len(c["sha256"]) == 64 for c in data["compiled"]))

	def test_the_command_fails_when_the_marks_collide_with_a_read(self):
		model = copy.deepcopy(MODEL)
		model["frappe"]["vars"]["--surface-elevation-2"]["scope"] = "desk"
		out = io.StringIO()
		with (
			mock.patch.object(model_mod, "load_model", return_value=model),
			contextlib.redirect_stdout(out),
			contextlib.redirect_stderr(io.StringIO()),
		):
			code = audits.main(["--no-write", "--dist", "/nonexistent-dist"])
		self.assertEqual(code, 1)
		self.assertIn("web-scope FAIL --surface-elevation-2: marked scope desk", out.getvalue())


class Scanning(unittest.TestCase):
	def _bench(self, tmp, css="", js=""):
		assets = Path(tmp, "assets")
		for folder, stems, suffix, text in (
			("frappe/dist/css", web_scope.FRAPPE_STYLES, ".css", css),
			("erpnext/dist/css", web_scope.ERPNEXT_STYLES, ".css", css),
			("frappe/dist/js", web_scope.FRAPPE_SCRIPTS, ".js", js),
		):
			(assets / folder).mkdir(parents=True)
			for stem in stems:
				(assets / folder / f"{stem}.ABCD1234{suffix}").write_text(text, encoding="utf-8")
				(assets / folder / f"{stem}.ABCD1234{suffix}.map").write_text(
					"var(--map-only)", encoding="utf-8"
				)
		return assets

	def test_compiled_files_are_found_by_stem_and_maps_are_ignored(self):
		with tempfile.TemporaryDirectory() as tmp:
			files = web_scope.compiled_files(self._bench(tmp, css=".a{color:var(--x)}", js="g('--y')"))
			reads, sources = web_scope.scan_compiled(files)
		self.assertEqual(sorted(reads), ["--x", "--y"])
		self.assertNotIn("--map-only", reads)
		self.assertEqual(
			len(files),
			len(web_scope.FRAPPE_STYLES) + len(web_scope.ERPNEXT_STYLES) + len(web_scope.FRAPPE_SCRIPTS),
		)
		self.assertTrue(all(len(s["sha256"]) == 64 for s in sources))

	def test_a_missing_bundle_is_an_error_not_an_empty_scan(self):
		with tempfile.TemporaryDirectory() as tmp:
			assets = self._bench(tmp)
			next((assets / "frappe/dist/css").glob("login.bundle.*.css")).unlink()
			with self.assertRaises(FileNotFoundError):
				web_scope.compiled_files(assets)

	def test_css_reads_need_var_but_scripts_also_count_quoted_names(self):
		with tempfile.TemporaryDirectory() as tmp:
			assets = self._bench(
				tmp, css=".a{--declared:1;content:'--quoted'}", js='v("--named");var(--called)'
			)
			reads, _ = web_scope.scan_compiled(web_scope.compiled_files(assets))
		self.assertEqual(sorted(reads), ["--called", "--named"])

	def test_theme_website_reads_skip_comments_and_the_desk_partials(self):
		with tempfile.TemporaryDirectory() as tmp:
			root = Path(tmp)
			(root / "scss/web").mkdir(parents=True)
			(root / "scss/desk").mkdir(parents=True)
			(root / "scss/web/_a.scss").write_text(
				"/* var(--c) */ .a { color: var(--web-used); }", encoding="utf-8"
			)
			(root / "scss/desk/_b.scss").write_text(".a { color: var(--desk-used); }", encoding="utf-8")
			(root / "scss/ins_web.bundle.scss").write_text("// var(--c2)\n", encoding="utf-8")
			(root / "js").mkdir()
			(root / "js/ins_web.bundle.js").write_text(
				"x = getComputedStyle(e).getPropertyValue('--from-js');", encoding="utf-8"
			)
			found = web_scope.theme_reads(root)
		self.assertEqual(sorted(found), ["--from-js", "--web-used"])

	def test_the_real_theme_website_sources_read_no_desk_only_name(self):
		self.assertFalse(set(model_mod.desk_only(MODEL)) & set(web_scope.theme_reads(PUBLIC)))

	def test_snapshot_round_trip_and_missing_version(self):
		with tempfile.TemporaryDirectory() as tmp:
			target = Path(tmp, "web_reads_frappe_9.9.9.json")
			web_scope.write_snapshot(target, "9.9.9", {"--b": "w.css", "--a": "x.js"}, [], {})
			self.assertEqual(web_scope.load_reads("9.9.9", Path(tmp)), {"--a": "x.js", "--b": "w.css"})
			self.assertEqual(web_scope.load_reads("1.1.1", Path(tmp)), {})


if __name__ == "__main__":
	unittest.main()
