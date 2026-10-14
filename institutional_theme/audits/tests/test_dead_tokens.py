"""Dead-token audit: categories, the committed snapshot, and the failure rule."""

import json
import tempfile
import unittest
from pathlib import Path

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
		self.names = dead_tokens.overridden_variables(self.model)

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
		overridden = set(self.names)
		core = _core(set(), set())
		results = dead_tokens.audit(self.model, core, PUBLIC)
		for result in results:
			self.assertEqual(
				result.where, "theme" if result.name in theme and result.name in overridden else "dead"
			)

	def test_counts_add_up(self):
		results = dead_tokens.audit(self.model, _core(self.names[:10], self.names[:5]), PUBLIC)
		total = dead_tokens.counts(results)
		self.assertEqual(sum(total.values()), len(self.names))
		self.assertEqual(total["declared-read"], 5)
		self.assertEqual(total["declared-only"], 5)

	def test_report_names_the_origin_and_hashes(self):
		core = _core(self.names, self.names)
		text = dead_tokens.render_text(dead_tokens.audit(self.model, core, PUBLIC), core, "a test")
		self.assertIn("Core variables from: a test", text)
		self.assertIn("x.css (000000000000)", text)
		self.assertIn("No dead variables.", text)


class Snapshot(unittest.TestCase):
	def test_committed_snapshot_has_a_generated_header_and_sources(self):
		data = json.loads(dead_tokens.DEFAULT_SNAPSHOT.read_text(encoding="utf-8"))
		self.assertIn("do not edit", data["_generated"])
		self.assertTrue(data["sources"])
		for source in data["sources"]:
			self.assertRegex(source["sha256"], r"^[0-9a-f]{64}$")
			self.assertTrue(source["file"].endswith(".css"))
		self.assertEqual(data["declared"], sorted(data["declared"]))

	def test_every_overridden_variable_is_in_core_or_used_by_the_theme(self):
		model = model_mod.load_model()
		results = dead_tokens.audit(model, dead_tokens.load_snapshot(), PUBLIC)
		self.assertEqual([r.name for r in results if r.where == "dead"], [])

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


if __name__ == "__main__":
	unittest.main()
