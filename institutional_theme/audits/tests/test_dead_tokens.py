"""Dead-token audit: categories, the committed snapshots, the dual-version rule and the CLI."""

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from institutional_theme.audits import dead_tokens
from institutional_theme.midad import model as model_mod

PUBLIC = Path(dead_tokens.__file__).resolve().parents[1] / "public"


def _core(declared, read):
	return dead_tokens.CoreVars(
		frozenset(declared), frozenset(read), ({"file": "x.css", "sha256": "0" * 64},)
	)


class Categories(unittest.TestCase):
	def setUp(self):
		self.model = model_mod.load_model()
		self.names = dead_tokens.watched_variables(self.model, PUBLIC)

	def test_each_category(self):
		# The theme's own SCSS may read any variable, which makes it "theme" rather than
		# "dead", so the dead example is the first name the theme does not read.
		theme = dead_tokens.scan_theme(PUBLIC)
		a, b, c = self.names[:3]
		d = next(n for n in self.names[3:] if n not in theme)
		results = dead_tokens.audit(self.model, _core({a, b}, {a, c}), PUBLIC)
		where = {r.name: r.where for r in results}
		self.assertEqual(where[a], "declared-read")
		self.assertEqual(where[b], "declared-only")
		self.assertEqual(where[c], "read-only")
		self.assertEqual(where[d], "dead")

	def test_a_variable_the_theme_reads_is_not_dead(self):
		theme = dead_tokens.scan_theme(PUBLIC)
		core = _core(set(), set())
		results = dead_tokens.audit(self.model, core, PUBLIC)
		self.assertEqual([r.name for r in results], self.names)
		for result in results:
			self.assertEqual(result.where, "theme" if result.name in theme else "dead")

	def test_counts_add_up(self):
		results = dead_tokens.audit(self.model, _core(self.names[:10], self.names[:5]), PUBLIC)
		total = dead_tokens.counts(results)
		self.assertEqual(sum(total.values()), len(self.names))
		self.assertEqual(total["declared-read"], 5)
		self.assertEqual(total["declared-only"], 5)

	def test_report_names_the_origin_and_hashes(self):
		core = _core(self.names, self.names)
		combined = dead_tokens.audit_versions(self.model, {"1.0.0": (core, "a test")}, PUBLIC)
		text = dead_tokens.render_text(combined)
		self.assertIn("Core variables from: a test", text)
		self.assertIn("x.css (000000000000)", text)
		self.assertIn("No dead variables.", text)


class ScopedDeclarations(unittest.TestCase):
	"""ADR 0011 R5 (F1): custom properties declared in hand-written SCSS are watched like the map."""

	def _scan(self, files):
		with tempfile.TemporaryDirectory() as tmp:
			root = Path(tmp)
			for name, text in files.items():
				path = root / name
				path.parent.mkdir(parents=True, exist_ok=True)
				path.write_text(text, encoding="utf-8")
			return dead_tokens.scan_theme_declared(root)

	def test_declarations_outside_the_ins_namespace_are_found(self):
		found = self._scan(
			{"a/_x.scss": ".a { --bt-solid-bg: var(--ins-primary); --ins-own: 1; --c-fill: red; }"}
		)
		self.assertEqual(found, {"--bt-solid-bg", "--c-fill"})

	def test_generated_files_comments_and_reads_are_ignored(self):
		found = self._scan(
			{
				"generated/_map.scss": ".a { --from-the-map: 1; }",
				"_y.scss": "// --line-comment: 1\n/* --block-comment: 1 */\n.a { color: var(--only-read); --real: 1; }",
				"z.css": ".a { --not-scss: 1 }",
			}
		)
		self.assertEqual(found, {"--real"})

	def test_the_theme_declares_the_names_the_round_4_map_asks_for(self):
		found = dead_tokens.scan_theme_declared(PUBLIC)
		for name in ("--bt-solid-bg", "--g-bar-color", "--control-bg", "--fc-border-color"):
			self.assertIn(name, found)
		self.assertFalse([n for n in found if n.startswith("--ins-")])

	def test_watched_names_are_the_map_then_the_scoped_ones_without_duplicates(self):
		model = model_mod.load_model()
		watched = dead_tokens.watched_variables(model, PUBLIC)
		mapped = dead_tokens.overridden_variables(model)
		self.assertEqual(watched[: len(mapped)], mapped)
		self.assertEqual(len(watched), len(set(watched)))
		self.assertIn("--bt-solid-bg", watched[len(mapped) :])
		self.assertNotIn("--control-bg", watched[len(mapped) :])  # already in the map

	def test_a_scoped_name_no_core_knows_and_the_theme_never_reads_is_dead(self):
		model = model_mod.load_model()
		with tempfile.TemporaryDirectory() as tmp:
			root = Path(tmp)
			(root / "_k.scss").write_text(
				".a { --orphan-token: 1; --used-token: 1; } .b { x: var(--used-token); }"
			)
			results = dead_tokens.audit(model, _core(set(), set()), root)
		where = {r.name: r.where for r in results}
		self.assertEqual(where["--orphan-token"], "dead")
		self.assertEqual(where["--used-token"], "theme")

	def test_scoped_names_are_live_through_either_version(self):
		model = model_mod.load_model()
		cores = {
			v: (dead_tokens.load_snapshot(dead_tokens.snapshot_path(v)), "snapshot")
			for v in dead_tokens.snapshot_versions()
		}
		combined = dead_tokens.audit_versions(model, cores, PUBLIC)
		where = {r.name: r.where for r in combined.results}
		self.assertEqual(where["--bt-solid-bg"], "declared-read")
		self.assertEqual(where["--g-bar-color"], "declared-read")
		old = next(v for v in combined.versions if v.version == "16.32.0")
		self.assertIn("--bt-solid-bg", [r.name for r in old.results if r.where == "dead"])


class Snapshot(unittest.TestCase):
	def test_two_versions_have_a_committed_snapshot(self):
		self.assertEqual(dead_tokens.snapshot_versions(), ["16.32.0", "16.52.0"])

	def test_committed_snapshots_have_a_generated_header_and_sources(self):
		for version in dead_tokens.snapshot_versions():
			with self.subTest(version=version):
				path = dead_tokens.snapshot_path(version)
				data = json.loads(path.read_text(encoding="utf-8"))
				self.assertIn("do not edit", data["_generated"])
				self.assertEqual(data["versions"]["frappe"], version)
				self.assertTrue(data["sources"])
				for source in data["sources"]:
					self.assertRegex(source["sha256"], r"^[0-9a-f]{64}$")
					self.assertTrue(source["file"].endswith(".css"))
				self.assertEqual(data["declared"], sorted(data["declared"]))
				self.assertEqual(data["read"], sorted(data["read"]))

	def test_every_overridden_variable_is_in_core_or_used_by_the_theme_in_some_version(self):
		model = model_mod.load_model()
		cores = {
			v: (dead_tokens.load_snapshot(dead_tokens.snapshot_path(v)), "snapshot")
			for v in dead_tokens.snapshot_versions()
		}
		combined = dead_tokens.audit_versions(model, cores, PUBLIC)
		self.assertEqual(combined.dead, [])

	def test_a_name_dead_in_16_32_0_alone_is_live_in_16_52_0(self):
		# R1: names only v16.52.0 reads (the new Espresso names, --bt-*, --c-*, --g-*) are dead on
		# 16.32.0 alone and live on the newer version; none is dead on both.
		model = model_mod.load_model()
		old = dead_tokens.audit(
			model, dead_tokens.load_snapshot(dead_tokens.snapshot_path("16.32.0")), PUBLIC
		)
		new = {
			r.name: r.where
			for r in dead_tokens.audit(
				model, dead_tokens.load_snapshot(dead_tokens.snapshot_path("16.52.0")), PUBLIC
			)
		}
		dead_old = [r.name for r in old if r.where == "dead"]
		self.assertTrue(dead_old)
		self.assertEqual([n for n in dead_old if new[n] == "dead"], [])

	def test_the_map_that_predates_round_4_is_still_live_in_16_32_0(self):
		from institutional_theme.midad.tests import test_round4_map as round4

		model = model_mod.load_model()
		core = dead_tokens.load_snapshot(dead_tokens.snapshot_path("16.32.0"))
		new_names = {*round4.ADDED, *round4.RAW_950}
		dead = [
			r.name
			for r in dead_tokens.audit(model, core, PUBLIC)
			if r.where == "dead" and r.name in set(dead_tokens.overridden_variables(model)) - new_names
		]
		self.assertEqual(dead, [])

	def test_a_variable_core_dropped_would_fail(self):
		model = model_mod.load_model()
		core = dead_tokens.load_snapshot()
		victim = dead_tokens.overridden_variables(model)[0]
		reduced = _core(core.declared - {victim}, core.read - {victim})
		results = dead_tokens.audit(model, reduced, PUBLIC)
		self.assertIn(victim, [r.name for r in results if r.where == "dead"])

	def test_scan_and_round_trip(self):
		with tempfile.TemporaryDirectory() as tmp:
			css = Path(tmp) / "a.css"
			css.write_text(":root{--one:1;--two:var(--three)}", encoding="utf-8")
			core = dead_tokens.scan_core([Path(tmp)])
			self.assertEqual(core.declared, {"--one", "--two"})
			self.assertEqual(core.read, {"--three"})
			target = Path(tmp) / "out" / "snap.json"
			dead_tokens.write_snapshot(core, target, {"frappe": "x"})
			again = dead_tokens.load_snapshot(target)
			self.assertEqual((again.declared, again.read), (core.declared, core.read))


class DualVersion(unittest.TestCase):
	"""A variable is dead only when it is dead in every supported version."""

	def setUp(self):
		self.model = model_mod.load_model()
		theme = dead_tokens.scan_theme(PUBLIC)
		names = [n for n in dead_tokens.overridden_variables(self.model) if n not in theme]
		self.a, self.b, self.c, self.d = names[:4]

	def _combined(self, old, new):
		return dead_tokens.audit_versions(self.model, {"2.0.0": (new, "new"), "1.0.0": (old, "old")}, PUBLIC)

	def test_versions_are_ordered_numerically(self):
		core = _core(set(), set())
		combined = dead_tokens.audit_versions(
			self.model, {"16.52.0": (core, ""), "16.9.0": (core, ""), "16.32.0": (core, "")}, PUBLIC
		)
		self.assertEqual([v.version for v in combined.versions], ["16.9.0", "16.32.0", "16.52.0"])

	def test_dead_in_one_version_only_is_not_fatal(self):
		combined = self._combined(_core({self.a}, {self.a}), _core(set(), set()))
		where = {r.name: r.where for r in combined.results}
		self.assertEqual(where[self.a], "declared-read")
		self.assertNotIn(self.a, combined.dead)
		per_version = {v.version: {r.name: r.where for r in v.results} for v in combined.versions}
		self.assertEqual(per_version["1.0.0"][self.a], "declared-read")
		self.assertEqual(per_version["2.0.0"][self.a], "dead")
		self.assertEqual(dead_tokens.dead_in_some(combined)["2.0.0"].count(self.a), 1)

	def test_dead_in_every_version_is_fatal(self):
		combined = self._combined(_core({self.a}, set()), _core({self.a}, {self.a}))
		self.assertIn(self.b, combined.dead)
		self.assertNotIn(self.a, combined.dead)

	def test_strongest_category_wins(self):
		old = _core({self.a, self.b}, {self.c})  # a, b declared-only; c read-only
		new = _core({self.a}, {self.a, self.b})  # a declared-read; b read-only
		where = {r.name: r.where for r in self._combined(old, new).results}
		self.assertEqual(where[self.a], "declared-read")
		self.assertEqual(where[self.b], "declared-only")
		self.assertEqual(where[self.c], "read-only")
		self.assertEqual(where[self.d], "dead")

	def test_version_specific_reads(self):
		old = _core({self.a, self.b}, {self.a, self.b})
		new = _core({self.b, self.c}, {self.b, self.c})
		specific = dead_tokens.version_specific(self._combined(old, new))
		self.assertEqual([n for n, _ in specific["1.0.0"]], [self.a])
		self.assertEqual([n for n, _ in specific["2.0.0"]], [self.c])
		self.assertEqual(specific["1.0.0"][0][1], "2.0.0: dead")

	def test_declared_but_unread_elsewhere_counts_as_version_specific(self):
		# G2: inert in the old core, read by the new one.
		old = _core({self.a}, set())
		new = _core({self.a}, {self.a})
		specific = dead_tokens.version_specific(self._combined(old, new))
		self.assertEqual(specific["1.0.0"], [])
		self.assertEqual(specific["2.0.0"], [(self.a, "1.0.0: declared-only")])

	def test_a_single_version_has_nothing_version_specific(self):
		combined = dead_tokens.audit_versions(self.model, {"1.0.0": (_core({self.a}, {self.a}), "x")}, PUBLIC)
		self.assertEqual(dead_tokens.version_specific(combined), {"1.0.0": []})

	def test_report_has_one_table_column_per_version_and_the_verdict(self):
		combined = self._combined(_core({self.a}, {self.a}), _core({self.b}, {self.b}))
		text = dead_tokens.render_text(combined)
		self.assertIn("Supported versions audited: 1.0.0, 2.0.0", text)
		self.assertRegex(text, r"1\.0\.0\s+2\.0\.0\s+combined")
		self.assertIn("Frappe 1.0.0", text)
		self.assertIn("Frappe 2.0.0", text)
		self.assertIn("Read by core in one version only", text)
		self.assertIn(f"DEAD in every version ({len(combined.dead)}):", text)
		self.assertNotIn("No dead variables.", text)


class CommandLine(unittest.TestCase):
	def test_a_bare_path_is_the_default_version(self):
		groups = dead_tokens.parse_core_css(["/a/x.css", "/b"])
		self.assertEqual(groups, {dead_tokens.DEFAULT_VERSION: [Path("/a/x.css"), Path("/b")]})

	def test_labelled_paths_group_by_version(self):
		groups = dead_tokens.parse_core_css(
			["16.52.0=/n/a.css", "16.32.0=/o/a.css", "16.52.0=/n/b.css", "/odd=name/c.css"], "0.0.1"
		)
		self.assertEqual(groups["16.52.0"], [Path("/n/a.css"), Path("/n/b.css")])
		self.assertEqual(groups["16.32.0"], [Path("/o/a.css")])
		# an equals sign inside a path is not a label
		self.assertEqual(groups["0.0.1"], [Path("/odd=name/c.css")])

	def test_snapshot_is_named_after_its_version(self):
		self.assertEqual(dead_tokens.snapshot_path("16.52.0").name, "core_vars_frappe_16.52.0.json")
		self.assertEqual(
			dead_tokens.snapshot_versions_for("16.52.0"), {"frappe": "16.52.0", "erpnext": "16.50.0"}
		)
		self.assertEqual(dead_tokens.snapshot_versions_for("9.9.9"), {"frappe": "9.9.9"})

	def _run(self, *argv):
		from institutional_theme.audits import __main__ as audits

		out = io.StringIO()
		with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
			try:
				code = audits.main([*argv, "--no-write", "--dist", "/nonexistent-dist"])
			except SystemExit as exit_:
				code = exit_.code
		return code, out.getvalue()

	def test_default_run_audits_every_committed_snapshot(self):
		code, out = self._run()
		self.assertEqual(code, 0)
		self.assertIn("dead-tokens 16.32.0:", out)
		self.assertIn("dead-tokens 16.52.0:", out)
		self.assertIn("dead-tokens: combined over 16.32.0, 16.52.0:", out)

	def test_a_live_scan_of_a_version_replaces_its_snapshot_and_a_dead_name_fails(self):
		with tempfile.TemporaryDirectory() as tmp:
			Path(tmp, "a.css").write_text(":root{--unrelated:1}", encoding="utf-8")
			# Both versions are given live and contain none of the overridden variables.
			code, out = self._run("--core-css", f"16.32.0={tmp}", "--core-css", f"16.52.0={tmp}")
		self.assertEqual(code, 1)
		self.assertIn("dead-tokens FAIL", out)
		self.assertRegex(
			out, r"dead-tokens: combined over 16\.32\.0, 16\.52\.0: .* [1-9]\d* dead in every version"
		)

	def test_one_live_version_is_combined_with_the_other_snapshot(self):
		snapshot = dead_tokens.load_snapshot(dead_tokens.snapshot_path("16.52.0"))
		css = "".join(f":root{{{name}:1}}" for name in sorted(snapshot.declared)) + "".join(
			f".x{{color:var({name})}}" for name in sorted(snapshot.read)
		)
		with tempfile.TemporaryDirectory() as tmp:
			Path(tmp, "a.css").write_text(css, encoding="utf-8")
			code, out = self._run("--core-css", f"16.52.0={tmp}")
		# 16.52.0 is a live scan that equals its snapshot; 16.32.0 still comes from its snapshot.
		self.assertEqual(code, 0)
		self.assertIn("dead-tokens 16.52.0:", out)
		self.assertNotIn("dead-tokens FAIL", out)

	def test_a_live_scan_without_the_scoped_names_fails_on_them(self):
		with tempfile.TemporaryDirectory() as tmp:
			Path(tmp, "a.css").write_text(":root{--unrelated:1}", encoding="utf-8")
			code, out = self._run("--core-css", f"16.52.0={tmp}")
		# --bt-*, --c-* and --g-* are core's only on v16.52.0: without them nothing keeps them alive.
		self.assertEqual(code, 1)
		self.assertIn("dead-tokens FAIL --bt-solid-bg", out)

	def test_write_core_snapshot_writes_one_file_per_version_named_after_it(self):
		with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as css:
			Path(css, "a.css").write_text(":root{--one:1;--two:var(--three)}", encoding="utf-8")
			data = Path(tmp)
			with mock.patch.object(dead_tokens, "DATA_DIR", data):
				self._run(
					"--core-css", f"16.52.0={css}", "--core-css", f"16.32.0={css}", "--write-core-snapshot"
				)
				self.assertEqual(dead_tokens.snapshot_versions(), ["16.32.0", "16.52.0"])
			self.assertEqual(
				sorted(p.name for p in data.iterdir()),
				[
					"core_vars_frappe_16.32.0.json",
					"core_vars_frappe_16.52.0.json",
				],
			)
			written = json.loads((data / "core_vars_frappe_16.52.0.json").read_text(encoding="utf-8"))
			self.assertIn("do not edit", written["_generated"])
			self.assertEqual(written["versions"], {"frappe": "16.52.0", "erpnext": "16.50.0"})
			self.assertEqual(written["declared"], ["--one", "--two"])
			self.assertEqual(written["read"], ["--three"])

	def test_write_core_snapshot_needs_core_css(self):
		code, _ = self._run("--write-core-snapshot")
		self.assertEqual(code, 2)


if __name__ == "__main__":
	unittest.main()
