"""Colour maths. The first test reproduces design/reference/tokens.resolved.json exactly."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from institutional_theme.midad import build, colour, deviations, model

REPO = Path(__file__).resolve().parents[3]
FIXTURE = REPO / "design" / "reference" / "tokens.resolved.json"
TOKENS = REPO / "design" / "tokens.json"


def _fixture() -> dict:
	with open(FIXTURE, encoding="utf-8") as handle:
		return json.load(handle)


class FixtureReproduction(unittest.TestCase):
	"""Every hex of the fixture, both modes, computed from tokens.json by the Python port."""

	@classmethod
	def setUpClass(cls):
		cls.fixture = _fixture()
		cls.model = build.build_base_model(build.load_tokens(TOKENS))
		cls.palette = model.palette(cls.model, "midad")

	def test_every_primitive_hex_is_reproduced(self):
		checked = 0
		for ramp, steps in self.fixture["prim"].items():
			for step, expected in steps.items():
				self.assertEqual(self.palette.ramps[ramp][step], expected, f"{ramp}.{step}")
				checked += 1
		self.assertEqual(checked, 170)

	def test_every_semantic_hex_is_reproduced_in_both_modes(self):
		checked = 0
		for mode in ("light", "dark"):
			for name, approved in self.fixture["sem"][mode].items():
				if approved.startswith("#"):
					expected = deviations.expected(self.fixture, mode, name)
					self.assertEqual(self.palette.tokens[mode][name], expected, f"{mode} {name}")
					checked += 1
		self.assertEqual(checked, 2 * 121)

	def test_deviations_are_exactly_the_adr_0010_list(self):
		"""ADR 0010: one dark surface and chart series 2, 4, 5 and 6 in both modes; nothing else."""
		self.assertEqual(
			sorted(deviations.SEMANTIC),
			sorted(
				[("dark", "surface-selected-strong")]
				+ [(mode, f"chart-{n}") for mode in ("light", "dark") for n in (2, 4, 5, 6)]
			),
		)
		for (mode, name), value in deviations.SEMANTIC.items():
			self.assertNotEqual(value, self.fixture["sem"][mode][name], f"{mode} {name} is not a deviation")

	def test_reordered_series_reuse_the_approved_series_colours(self):
		"""Series 1,5,3,2,6,4: new 2 is old 5, new 4 is old 2, new 5 is old 6, new 6 is old 4."""
		sem = self.fixture["sem"]
		for mode in ("light", "dark"):
			for new, old in ((2, 5), (4, 2), (5, 6), (6, 4)):
				self.assertEqual(
					deviations.SEMANTIC[(mode, f"chart-{new}")], sem[mode][f"chart-{old}"], f"{mode} chart-{new}"
				)

	def test_non_hex_semantic_values_resolve(self):
		light, dark = self.palette.tokens["light"], self.palette.tokens["dark"]
		self.assertEqual(light["surface-scrim"], "rgba(9, 16, 24, 0.45)")
		self.assertEqual(dark["surface-scrim"], "rgba(5, 8, 12, 0.7)")
		for name in (
			"elevation-raised",
			"elevation-overlay",
			"elevation-dialog",
			"scroll-shadow-start",
			"scroll-shadow-end",
		):
			self.assertEqual(light[name], self.fixture["sem"]["light"][name], name)
		self.assertEqual(dark["elevation-raised"], "none")
		self.assertEqual(dark["elevation-overlay"], f"0 0 0 1px {dark['border']}")
		self.assertEqual(dark["elevation-dialog"], f"0 0 0 1px {dark['border-strong']}")
		self.assertEqual(dark["scroll-shadow-start"], f"inset 1px 0 0 0 {dark['border-strong']}")

	def test_fixture_and_palette_define_the_same_tokens(self):
		for mode in ("light", "dark"):
			self.assertEqual(set(self.fixture["sem"][mode]), set(self.palette.tokens[mode]))


class ColourMaths(unittest.TestCase):
	"""Values produced by design/reference/color.mjs (run under Node) for the same inputs."""

	def test_oklch_to_hex_matches_the_reference(self):
		cases = [
			(0.425, 0.105, 252, "#1b5086", False),
			(0.9, 0.2, 142, "#88fe7d", False),
			(0.7, 0.3, 30, "#ff6551", True),
			(0.5, 0.25, 300, "#7e1cd8", False),
			(0.975, 0.01, 252, "#f2f7fe", False),
			(0.2, 0.05, 10, "#280b11", False),
			(0.62, 0.17, 25, "#da534f", False),
			(0.99, 0.2, 100, "#fffdeb", True),
		]
		for lightness, chroma, hue, expected, clipped in cases:
			with self.subTest(oklch=(lightness, chroma, hue)):
				result = colour.oklch_to_hex(lightness, chroma, hue)
				self.assertEqual(result.hex, expected)
				self.assertEqual(result.clipped, clipped)
				if clipped:
					self.assertLess(result.c, chroma)
				else:
					self.assertEqual(result.c, chroma)

	def test_hex_to_oklch_matches_the_reference(self):
		cases = [
			("#1b5086", 0.4255581671717974, 0.10541831495100826, 252.09786194917206),
			("#a7c9f0", 0.8244429702397945, 0.06617674164244652, 252.10647057052915),
			("#997324", 0.5791326306511517, 0.10466647875391707, 81.70221557564628),
			("#be3737", 0.5393826968345701, 0.17199048439419937, 25.040377450020237),
			("#6a727d", 0.5490933436595004, 0.019682841441249915, 256.3336393430377),
		]
		for value, lightness, chroma, hue in cases:
			with self.subTest(hex=value):
				result = colour.hex_to_oklch(value)
				self.assertAlmostEqual(result.lightness, lightness, places=9)
				self.assertAlmostEqual(result.c, chroma, places=9)
				self.assertAlmostEqual(result.h, hue, places=7)

	def test_black_and_white(self):
		black = colour.hex_to_oklch("#000000")
		self.assertEqual((black.lightness, black.c, black.h), (0, 0, 0))
		self.assertAlmostEqual(colour.hex_to_oklch("#ffffff").lightness, 1, places=7)

	def test_contrast_matches_the_reference(self):
		cases = [
			("#1b5086", "#ffffff", 8.273212273746136),
			("#000000", "#ffffff", 21),
			("#a7c9f0", "#111820", 10.427588340675914),
			("#6a727d", "#f7f9fc", 4.613357415781872),
		]
		for a, b, expected in cases:
			with self.subTest(pair=(a, b)):
				self.assertAlmostEqual(colour.contrast(a, b), expected, places=9)
				self.assertAlmostEqual(colour.contrast(b, a), expected, places=9)

	def test_colour_vision_simulation_matches_the_reference(self):
		cases = {
			("#1b5086", "protanopia"): "#365488",
			("#1b5086", "deuteranopia"): "#254a85",
			("#1b5086", "tritanopia"): "#005d64",
			("#1b5086", "grayscale"): "#4e4e4e",
			("#be3737", "protanopia"): "#5e5636",
			("#be3737", "deuteranopia"): "#7f7333",
			("#be3737", "tritanopia"): "#d10339",
			("#0e8352", "protanopia"): "#82784f",
			("#0e8352", "tritanopia"): "#008276",
			("#d5ae63", "tritanopia"): "#e5a29c",
			("#d5ae63", "grayscale"): "#b3b3b3",
		}
		for (value, kind), expected in cases.items():
			with self.subTest(hex=value, kind=kind):
				self.assertEqual(colour.simulate(value, kind), expected)

	def test_unknown_simulation_is_rejected(self):
		with self.assertRaises(ValueError):
			colour.simulate("#ffffff", "monochromacy")

	def test_delta_e_matches_the_reference(self):
		cases = [
			("#1b5086", "#be3737", 27.99173157375429),
			("#0e8352", "#be3737", 27.05990576144354),
			("#a7c9f0", "#d5ae63", 17.81945064276184),
		]
		for a, b, expected in cases:
			with self.subTest(pair=(a, b)):
				self.assertAlmostEqual(colour.delta_e(a, b), expected, places=8)
		self.assertEqual(colour.delta_e("#123456", "#123456"), 0)

	def test_composite_matches_the_reference(self):
		self.assertEqual(colour.composite("#091018", 0.45, "#ffffff"), "#909397")
		self.assertEqual(colour.composite("#000000", 0.5, "#ffffff"), "#808080")

	def test_rounding_is_half_up_like_javascript(self):
		self.assertEqual(colour.composite("#000000", 0.5, "#ffffff"), "#808080")  # 127.5 rounds up
		self.assertEqual(colour.composite("#010101", 0.5, "#000000"), "#010101")  # 0.5 rounds up

	def test_hex_parsing(self):
		self.assertEqual(colour.hex_to_rgb("#fff"), (255, 255, 255))
		self.assertEqual(colour.hex_to_rgb("1B5086"), (27, 80, 134))
		for bad in ("#12345", "#gggggg", "", "#1234567", "rgb(1,2,3)"):
			with self.subTest(value=bad), self.assertRaises(ValueError):
				colour.hex_to_rgb(bad)

	def test_rgba_text_matches_javascript_number_formatting(self):
		self.assertEqual(colour.rgba("#091018", 0.45), "rgba(9, 16, 24, 0.45)")
		self.assertEqual(colour.rgba("#05080c", 0.7), "rgba(5, 8, 12, 0.7)")
		self.assertEqual(colour.rgba("#ffffff", 1), "rgba(255, 255, 255, 1)")

	def test_round_trip_through_oklch(self):
		for value in ("#1b5086", "#a7c9f0", "#997324", "#be3737", "#0e8352", "#d5ae63", "#6a727d"):
			with self.subTest(hex=value):
				oklch = colour.hex_to_oklch(value)
				self.assertEqual(colour.oklch_to_hex(oklch.lightness, oklch.c, oklch.h).hex, value)


if __name__ == "__main__":
	unittest.main()
