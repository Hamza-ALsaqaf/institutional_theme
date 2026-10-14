"""Counterpart table (ADR 0011 R5, F2): the committed table passes, and each rule fails when broken."""

import copy
import json
import tempfile
import unittest
from pathlib import Path

from institutional_theme.audits import counterparts, dead_tokens
from institutional_theme.midad import model as model_mod

PUBLIC = Path(dead_tokens.__file__).resolve().parents[1] / "public"
MODEL = model_mod.load_model()
OLD = dead_tokens.load_snapshot(dead_tokens.snapshot_path(counterparts.OLD))
NEW = dead_tokens.load_snapshot(dead_tokens.snapshot_path(counterparts.NEW))
CORES = {counterparts.OLD: OLD, counterparts.NEW: NEW}


def _pair(old, new, value="same", why=""):
	return counterparts.Pair(old, new, value, why)


def _model_with(**changes):
	"""A copy of the model with some `frappe.vars` entries replaced or removed (None removes)."""
	other = copy.deepcopy(MODEL)
	for name, entry in changes.items():
		key = name.replace("_", "-")
		key = key if key.startswith("--") else f"--{key}"
		if entry is None:
			del other["frappe"]["vars"][key]
		else:
			other["frappe"]["vars"][key] = entry
	return other


class CommittedTable(unittest.TestCase):
	def setUp(self):
		self.pairs = counterparts.load_pairs()

	def test_the_table_has_the_30_pairs_of_the_token_map(self):
		self.assertEqual(len(self.pairs), 30)
		self.assertEqual(sum(1 for p in self.pairs if p.value == "differs"), 2)

	def test_the_committed_table_passes_against_both_snapshots(self):
		self.assertEqual(counterparts.check(MODEL, self.pairs, CORES), [])

	def test_every_differs_pair_says_why(self):
		for pair in self.pairs:
			if pair.value == "differs":
				self.assertTrue(pair.why, pair.label())

	def test_a_differs_pair_really_differs(self):
		self.assertEqual(counterparts.stale_differs(MODEL, self.pairs), [])

	def test_the_table_names_the_version_keys(self):
		data = json.loads(counterparts.COUNTERPARTS_PATH.read_text(encoding="utf-8"))
		for row in data["pairs"]:
			self.assertEqual(sorted(row), sorted(["16.32.0", "16.52.0", "value", "why"]))


class MissingFromItsSnapshot(unittest.TestCase):
	"""F2(i): the table cannot go stale."""

	def test_an_old_name_that_16_32_0_neither_declares_nor_reads_fails(self):
		pair = _pair("--no-such-name-in-1632", "--surface-base")
		findings = counterparts.check(MODEL, [pair], CORES)
		self.assertIn("F2(i)", [f.rule for f in findings])
		self.assertIn("neither declared nor read", " ".join(f.message for f in findings))

	def test_an_old_name_that_is_only_declared_passes_the_snapshot_check(self):
		declared_only = next(iter(sorted(OLD.declared - OLD.read)))
		findings = counterparts.check(MODEL, [_pair(declared_only, "--surface-base")], CORES)
		self.assertNotIn("neither declared nor read", " ".join(f.message for f in findings))

	def test_a_new_name_that_16_52_0_does_not_read_fails(self):
		declared_only = next(iter(sorted(NEW.declared - NEW.read)))
		findings = counterparts.check(MODEL, [_pair("--surface-white", declared_only)], CORES)
		self.assertIn("not read in the 16.52.0 snapshot", " ".join(f.message for f in findings))

	def test_a_version_without_a_snapshot_is_reported(self):
		findings = counterparts.check(MODEL, [], {counterparts.OLD: OLD})
		self.assertEqual([f.rule for f in findings], ["table"])


class OneSideMapped(unittest.TestCase):
	"""F2(ii): the theme maps both sides or neither."""

	def test_dropping_the_new_side_of_a_pair_fails(self):
		pair = _pair("--surface-white", "--surface-base")
		findings = counterparts.check(_model_with(surface_base=None), [pair], CORES)
		self.assertEqual([f.rule for f in findings], ["F2(ii)"])
		self.assertIn("maps --surface-white but not --surface-base", findings[0].message)

	def test_dropping_the_old_side_of_a_pair_fails(self):
		pair = _pair("--surface-white", "--surface-base")
		findings = counterparts.check(_model_with(surface_white=None), [pair], CORES)
		self.assertEqual([f.rule for f in findings], ["F2(ii)"])
		self.assertIn("maps --surface-base but not --surface-white", findings[0].message)

	def test_neither_side_mapped_is_not_a_finding(self):
		model = _model_with(surface_white=None, surface_base=None)
		self.assertEqual(counterparts.check(model, [_pair("--surface-white", "--surface-base")], CORES), [])


class SamePairsAgree(unittest.TestCase):
	"""F2(iii): a same pair has one Light and one Dark value; a differs pair has a reason."""

	def test_a_same_pair_that_differs_in_light_fails_and_names_the_mode(self):
		model = _model_with(surface_base={"light": "@surface-sunken", "dark": "@surface-base"})
		findings = counterparts.check(model, [_pair("--surface-white", "--surface-base")], CORES)
		self.assertEqual([f.rule for f in findings], ["F2(iii)"])
		self.assertIn("differs in light", findings[0].message)

	def test_a_same_pair_that_differs_in_dark_fails(self):
		model = _model_with(surface_base={"light": "@surface-base", "dark": "@surface-sunken"})
		findings = counterparts.check(model, [_pair("--surface-white", "--surface-base")], CORES)
		self.assertEqual([f.rule for f in findings], ["F2(iii)"])
		self.assertIn("differs in dark", findings[0].message)

	def test_two_expressions_with_the_same_resolved_value_are_the_same(self):
		model = _model_with(surface_base={"light": "#ffffff", "dark": "night.900"})
		self.assertEqual(counterparts.check(model, [_pair("--surface-white", "--surface-base")], CORES), [])

	def test_a_differs_pair_without_a_reason_fails(self):
		findings = counterparts.check(
			MODEL, [_pair("--modal-shadow", "--elevation-lg", "differs", "")], CORES
		)
		self.assertEqual([f.rule for f in findings], ["F2(iii)"])
		self.assertIn("needs a why", findings[0].message)

	def test_a_differs_pair_with_a_reason_passes(self):
		pair = _pair("--modal-shadow", "--elevation-lg", "differs", "toast alias")
		self.assertEqual(counterparts.check(MODEL, [pair], CORES), [])

	def test_a_stale_differs_pair_is_noted(self):
		pair = _pair("--surface-white", "--surface-base", "differs", "was different once")
		self.assertEqual(counterparts.stale_differs(MODEL, [pair]), [pair])

	def test_scale_and_shadow_values_resolve(self):
		values = counterparts.values_of(MODEL, "--radius")
		self.assertEqual(values["light"], ("var(--ins-radius-sm)", "4px"))
		shadow = counterparts.values_of(MODEL, "--elevation-xl")
		self.assertIn("rgba(", shadow["light"][1])
		self.assertNotIn("var(", shadow["dark"][1])


class TableFile(unittest.TestCase):
	def _load(self, rows):
		with tempfile.TemporaryDirectory() as tmp:
			path = Path(tmp) / "pairs.json"
			path.write_text(json.dumps({"pairs": rows}), encoding="utf-8")
			return counterparts.load_pairs(path)

	def test_a_good_row_loads(self):
		rows = [{"16.32.0": "--a", "16.52.0": "--b", "value": "same", "why": ""}]
		self.assertEqual(self._load(rows), [counterparts.Pair("--a", "--b", "same", "")])

	def test_a_bad_value_is_rejected(self):
		with self.assertRaisesRegex(ValueError, "value must be one of"):
			self._load([{"16.32.0": "--a", "16.52.0": "--b", "value": "maybe", "why": ""}])

	def test_a_missing_name_is_rejected(self):
		with self.assertRaisesRegex(ValueError, "missing 16.52.0"):
			self._load([{"16.32.0": "--a", "value": "same"}])

	def test_a_name_that_is_not_a_custom_property_is_rejected(self):
		with self.assertRaisesRegex(ValueError, "not a custom property"):
			self._load([{"16.32.0": "a", "16.52.0": "--b", "value": "same"}])

	def test_a_duplicate_pair_is_rejected(self):
		row = {"16.32.0": "--a", "16.52.0": "--b", "value": "same", "why": ""}
		with self.assertRaisesRegex(ValueError, "duplicate pair"):
			self._load([row, dict(row)])


class UnmappedReads(unittest.TestCase):
	def test_the_report_lists_names_read_in_one_version_only(self):
		pairs = counterparts.load_pairs()
		found = counterparts.unmapped_reads(MODEL, pairs, CORES, PUBLIC)
		self.assertEqual(list(found), ["16.32.0", "16.52.0"])
		known = set(dead_tokens.watched_variables(MODEL, PUBLIC))
		for version, names in found.items():
			others = OLD.read if version == "16.52.0" else NEW.read
			for name in names:
				self.assertNotIn(name, others)
				self.assertNotIn(name, known)

	def test_mapped_and_listed_names_are_left_out(self):
		pairs = [_pair("--only-old", "--only-new")]
		old = dead_tokens.CoreVars(frozenset(), frozenset({"--only-old", "--surface-base", "--x"}), ())
		new = dead_tokens.CoreVars(frozenset(), frozenset({"--only-new", "--y"}), ())
		found = counterparts.unmapped_reads(MODEL, pairs, {"1.0.0": old, "2.0.0": new}, PUBLIC)
		# --surface-base is mapped, --only-old/--only-new are in the table
		self.assertEqual(found, {"1.0.0": ["--x"], "2.0.0": ["--y"]})

	def test_the_text_report_has_counts_findings_and_the_unmapped_lists(self):
		pairs = counterparts.load_pairs()
		text = counterparts.render_text(pairs, [], {"16.32.0": ["--a", "--b"], "16.52.0": []}, [])
		self.assertIn("30 pair(s): 28 same, 2 differs; 0 finding(s)", text)
		self.assertIn("only in 16.32.0 (2):", text)
		self.assertIn("--a, --b", text)
		wrapped = counterparts.render_text(
			pairs, [], {"16.32.0": [f"--a-long-token-name-{n}" for n in range(30)]}, []
		)
		for line in wrapped.splitlines():
			self.assertNotRegex(line, r"--[a-z-]*-$", "a token name is never split across lines")
		finding = counterparts.Finding("F2(ii)", "p", "boom")
		self.assertIn("FAIL F2(ii) p: boom", counterparts.render_text(pairs, [finding], {}, []))


if __name__ == "__main__":
	unittest.main()
