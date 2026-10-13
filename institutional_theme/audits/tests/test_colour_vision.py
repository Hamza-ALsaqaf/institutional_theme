"""Colour-vision audit: the neighbour rule and the committed gap baseline (ADR 0010)."""

import unittest

from institutional_theme.audits import colour_vision
from institutional_theme.midad import model as model_mod

MODEL = model_mod.load_model()
SHIPPED = MODEL["palettes"]["shipped"]


def _palettes():
	return {name: model_mod.palette(MODEL, name) for name in MODEL["palettes"]["presets"]}


class Baseline(unittest.TestCase):
	def test_baseline_covers_exactly_the_measured_gaps_of_every_shipped_preset(self):
		baseline = colour_vision.load_baseline()
		self.assertEqual(sorted(baseline), sorted(SHIPPED))
		for name in SHIPPED:
			with self.subTest(preset=name):
				measured = colour_vision.chart_gaps(model_mod.palette(MODEL, name))
				self.assertEqual(colour_vision.new_gaps(measured, baseline[name]), [])
				self.assertEqual(sorted(set(baseline[name]) - set(measured)), [])

	def test_audit_passes_with_the_committed_baseline(self):
		_lines, fatal, accepted = colour_vision.report(MODEL, _palettes())
		self.assertEqual(fatal, 0)
		self.assertGreater(accepted, 0)

	def test_a_gap_missing_from_the_baseline_is_fatal(self):
		baseline = colour_vision.load_baseline()
		emptied = {name: dict(gaps) for name, gaps in baseline.items()}
		removed = emptied["midad"].popitem()[0]
		lines, fatal, _accepted = colour_vision.report(MODEL, _palettes(), emptied)
		self.assertEqual(fatal, 1)
		self.assertTrue(any(removed.replace("|", " ") in line for line in lines))

	def test_a_gap_that_got_worse_is_fatal(self):
		baseline = colour_vision.load_baseline()
		key = next(k for k, v in baseline["midad"].items() if v >= 1.0)
		raised = {name: dict(gaps) for name, gaps in baseline.items()}
		raised["midad"][key] = baseline["midad"][key] + 1.0
		_lines, fatal, _accepted = colour_vision.report(MODEL, _palettes(), raised)
		self.assertEqual(fatal, 1)

	def test_no_baseline_means_every_gap_is_new(self):
		_lines, fatal, accepted = colour_vision.report(MODEL, _palettes(), {})
		self.assertGreater(fatal, 0)
		self.assertEqual(accepted, 0)


class Neighbours(unittest.TestCase):
	def test_every_neighbour_pair_passes_in_every_shipped_preset(self):
		for name in SHIPPED:
			built = model_mod.palette(MODEL, name)
			for finding in colour_vision.neighbour_findings(built):
				with self.subTest(preset=name, mode=finding.mode, vision=finding.vision):
					self.assertTrue(finding.passed, finding.describe())

	def test_neighbour_pairs_are_the_default_series_wrapping_6_to_1(self):
		self.assertEqual(
			colour_vision.neighbour_pairs(),
			[
				("chart-1", "chart-2"),
				("chart-2", "chart-3"),
				("chart-3", "chart-4"),
				("chart-4", "chart-5"),
				("chart-5", "chart-6"),
				("chart-6", "chart-1"),
			],
		)
