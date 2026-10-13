"""Preset resolution, contrast, the custom preset and the labels."""

from __future__ import annotations

import copy
import json
import re
import unittest
from pathlib import Path

from institutional_theme.audits import colour_vision
from institutional_theme.midad import build, colour, labels, model

REPO = Path(__file__).resolve().parents[3]
TOKENS = build.load_tokens(REPO / "design" / "tokens.json")
MODEL = model.load_model()


class GeneratedModel(unittest.TestCase):
	def test_header_key_comes_first(self):
		with open(model.MODEL_PATH, encoding="utf-8") as handle:
			data = json.load(handle)
		self.assertEqual(next(iter(data)), "_generated")
		self.assertIn("do not edit", data["_generated"])

	def test_default_preset_is_shipped_and_first(self):
		self.assertEqual(MODEL["palettes"]["default"], "midad")
		self.assertEqual(MODEL["palettes"]["shipped"][0], "midad")

	def test_shipped_and_dropped_partition_the_presets(self):
		palettes = MODEL["palettes"]
		self.assertEqual(sorted([*palettes["shipped"], *palettes["dropped"]]), sorted(palettes["presets"]))

	def test_every_preset_hits_the_indicative_values_of_tokens_json(self):
		"""The approved chroma multipliers reproduce the owner-reviewed hex values."""
		for name, preset in TOKENS["palettes"]["presets"].items():
			if name.startswith("_"):
				continue
			built = model.palette(MODEL, name)
			indicative = preset["indicative"]
			with self.subTest(preset=name):
				self.assertEqual(built.ramps["ink"]["700"], indicative["button"])
				self.assertEqual(built.ramps["ink"]["800"], indicative["brand"])
				self.assertEqual(built.ramps["ink"]["300"], indicative["dark_button"])
				self.assertEqual(built.ramps["brass"]["600"], indicative["accent"])

	def test_model_json_matches_tokens_json(self):
		self.assertEqual(build.render_model_json(build.build_model(TOKENS)), build.render_model_json(MODEL))


class Contrast(unittest.TestCase):
	def test_midad_passes_every_pair_in_both_modes(self):
		results = model.contrast_results(MODEL, model.palette(MODEL, "midad"))
		self.assertEqual(len(results), 362)
		self.assertEqual([r for r in results if not r.passed], [])

	def test_every_shipped_preset_passes_every_pair(self):
		for name in MODEL["palettes"]["shipped"]:
			with self.subTest(preset=name):
				self.assertEqual(model.palette_failures(MODEL, model.palette(MODEL, name)), [])

	def test_every_pair_is_measured_in_both_modes(self):
		results = model.contrast_results(MODEL, model.palette(MODEL, "midad"))
		for mode in model.MODES:
			count = sum(1 for r in results if r.mode == mode)
			expected = sum(
				len(g["fg"]) * len(g["bg"]) for g in MODEL["contrast"]["groups"] + MODEL["contrast"]["max"]
			)
			self.assertEqual(count, expected)

	def test_max_rule_fails_above_its_limit(self):
		changed = copy.deepcopy(MODEL)
		changed["contrast"]["max"][0]["max"] = 1.01
		results = model.contrast_results(changed, model.palette(changed, "midad"))
		self.assertTrue(any(r.kind == "max" and not r.passed for r in results))

	def test_ratio_text_rounds_towards_the_failing_side(self):
		self.assertEqual(model.ratio_text(4.499), "4.49")
		self.assertEqual(model.ratio_text(1.351, "max"), "1.36")
		self.assertEqual(model.ratio_text(21), "21.00")

	def test_status_check_is_part_of_shipping(self):
		for name in MODEL["palettes"]["shipped"]:
			findings = colour_vision.status_findings(MODEL, model.palette(MODEL, name))
			with self.subTest(preset=name):
				self.assertTrue(all(f.passed for f in findings))
		for name, reasons in MODEL["palettes"]["dropped"].items():
			with self.subTest(dropped=name):
				self.assertTrue(reasons)


class CustomPreset(unittest.TestCase):
	def test_the_midad_colours_give_back_midad(self):
		result = model.custom_preset("#1b5086", "#997324", MODEL)
		self.assertEqual(result.failures, [])
		self.assertAlmostEqual(result.params["primary"]["h"], 252.098, places=3)
		self.assertAlmostEqual(result.params["accent"]["h"], 81.702, places=3)
		self.assertEqual(result.params["neutral_h"], 255)
		midad = model.palette(MODEL, "midad")
		for mode in model.MODES:
			# Same hue to 0.1 degree, same lightness curves: hex values stay within one step of midad.
			for name in ("primary", "on-primary", "text-strong"):
				self.assertLessEqual(
					colour.delta_e(result.palette.tokens[mode][name], midad.tokens[mode][name]), 1.0, name
				)

	def test_lightness_follows_the_approved_curves(self):
		for primary in ("#cfe3ff", "#7a1fa2", "#00796b", "#c0392b"):
			result = model.custom_preset(primary, None, MODEL)
			ink = MODEL["ramps"]["ink"]
			for index, step in enumerate(MODEL["steps"]):
				oklch = colour.hex_to_oklch(result.palette.ramps["ink"][step])
				self.assertAlmostEqual(
					oklch.lightness, ink["l"][index], delta=0.01, msg=f"{primary} ink.{step}"
				)

	def test_hue_is_kept_and_chroma_never_exceeds_the_ramp(self):
		result = model.custom_preset("#7a1fa2", None, MODEL)
		oklch = colour.hex_to_oklch("#7a1fa2")
		self.assertAlmostEqual(result.params["primary"]["h"], oklch.h, places=2)
		self.assertLessEqual(result.params["primary"]["chroma"], 1.0)
		for ramp_c, step in zip(MODEL["ramps"]["ink"]["c"], MODEL["steps"], strict=True):
			used = colour.hex_to_oklch(result.palette.ramps["ink"][step]).c
			self.assertLessEqual(used, ramp_c + 0.004, step)

	def test_a_dull_input_lowers_the_chroma_multiplier(self):
		result = model.custom_preset("#5f6b7a", None, MODEL)
		self.assertLess(result.params["primary"]["chroma"], 0.5)
		self.assertEqual(result.failures, [])

	def test_missing_input_keeps_the_midad_value(self):
		result = model.custom_preset("#7a1fa2", None, MODEL)
		self.assertEqual(result.params["accent"], MODEL["palettes"]["presets"]["midad"]["params"]["accent"])
		self.assertEqual(result.palette.ramps["brass"], model.palette(MODEL, "midad").ramps["brass"])

	def test_bad_input_is_rejected(self):
		for bad in ("blue", "#12", "#gg0000"):
			with self.subTest(value=bad), self.assertRaises(ValueError):
				model.custom_preset(bad, None, MODEL)

	def test_a_failing_palette_is_reported_with_every_pair_and_human_labels(self):
		strict = copy.deepcopy(MODEL)
		for group in strict["contrast"]["groups"]:
			if group["name"] in ("Text on primary action", "Primary-coloured text"):
				group["min"] = 30
		result = model.custom_preset("#1b5086", "#997324", strict)
		pairs = {(f["fg"], f["bg"], f["mode"]) for f in result.failures}
		self.assertIn(("on-primary", "primary", "light"), pairs)
		self.assertIn(("on-primary", "primary", "dark"), pairs)
		self.assertIn(("primary-text", "surface-base", "light"), pairs)
		self.assertEqual(len(pairs), len(result.failures), "one entry per (fg, bg, mode)")
		first = next(f for f in result.failures if f["fg"] == "on-primary" and f["bg"] == "primary")
		self.assertEqual(first["fg_label"], "Text on primary action")
		self.assertEqual(first["bg_label"], "Primary action")
		self.assertEqual(first["mode_label"] in ("Light", "Dark"), True)
		self.assertEqual(first["adjust"], "primary")
		self.assertEqual(first["adjust_label"], "primary")
		self.assertEqual(first["required"], 30)
		self.assertLess(first["ratio"], 30)
		self.assertRegex(first["ratio_text"], r"^\d+\.\d\d$")

	def test_accent_pairs_ask_for_the_accent_colour(self):
		strict = copy.deepcopy(MODEL)
		for group in strict["contrast"]["groups"]:
			if group["name"] == "Accent text":
				group["min"] = 30
		result = model.custom_preset(None, "#997324", strict)
		self.assertTrue(result.failures)
		self.assertEqual({f["adjust"] for f in result.failures}, {"accent"})

	def test_a_rejected_palette_is_never_turned_into_css(self):
		with self.assertRaises(model.PaletteRejected) as raised:
			model.custom_palette_css("#1b5086", "#997324", _strict_model())
		self.assertTrue(raised.exception.failures)

	def test_an_accepted_palette_becomes_css(self):
		css = model.custom_palette_css("#7a1fa2", "#b8860b", MODEL)
		self.assertTrue(
			css.startswith(
				"/* generated by institutional_theme.midad.build from design/tokens.json; do not edit */"
			)
		)
		self.assertIn("--ins-primary:", css)
		self.assertNotRegex(css, r"(?<!-)color-scheme\s*:")
		self.assertNotIn("!important", css)

	def test_no_input_change_gives_empty_blocks_only(self):
		css = model.custom_palette_css(None, None, MODEL)
		self.assertNotIn("--ins-", css)


def _strict_model() -> dict:
	strict = copy.deepcopy(MODEL)
	strict["contrast"]["groups"][5]["min"] = 30
	return strict


class FrappeMap(unittest.TestCase):
	def test_sets_exactly_the_variables_of_tokens_json(self):
		declared = {name for name, _ in model.frappe_map(MODEL).declarations["light"]}
		frappe = TOKENS["frappe"]
		expected = {name for name in frappe["vars"] if not name.startswith("_")}
		expected |= {f"--gray-{step}" for step in frappe["raw_gray_light"]}
		expected |= {f"--{hue}-{step}" for hue in frappe["raw_hues"] for step in frappe["raw_gray_light"]}
		self.assertEqual(declared, expected)

	def test_light_and_dark_declare_the_same_variables_in_the_same_order(self):
		fmap = model.frappe_map(MODEL)
		self.assertEqual(
			[n for n, _ in fmap.declarations["light"]], [n for n, _ in fmap.declarations["dark"]]
		)

	def test_values_reference_ins_tokens_only(self):
		for mode, declarations in model.frappe_map(MODEL).declarations.items():
			for name, value in declarations:
				self.assertNotIn("@", value, f"{mode} {name}")
				self.assertNotIn("$", value, f"{mode} {name}")

	def test_unknown_reference_is_an_error(self):
		broken = copy.deepcopy(MODEL)
		broken["frappe"]["vars"]["--neutral"]["light"] = "@no-such-token"
		with self.assertRaises(ValueError):
			model.frappe_map(broken)
		broken = copy.deepcopy(MODEL)
		broken["frappe"]["vars"]["--neutral"]["light"] = "$no-such-scale"
		with self.assertRaises(ValueError):
			model.frappe_map(broken)

	def test_names_do_not_collide(self):
		keys = set(model.base_keys(MODEL))
		scale = {prop.removeprefix(model.INS) for prop, _ in model.scale_tokens(MODEL)["comfortable"]}
		self.assertEqual(keys & scale, set())

	def test_every_scale_reference_is_defined_or_left_to_the_font_partials(self):
		scale = {prop.removeprefix(model.INS) for prop, _ in model.scale_tokens(MODEL)["comfortable"]}
		scale |= set(model.FONT_TOKENS)
		for _mode, declarations in model.frappe_map(MODEL).declarations.items():
			for _name, value in declarations:
				for ref in re.findall(r"var\(--ins-([a-z0-9-]+)\)", value):
					defined = ref in scale or ref in model.base_keys(MODEL)
					self.assertTrue(defined, ref)


class BrandEntryPoint(unittest.TestCase):
	def test_brand_hex_changes_the_default_preset_only_when_set(self):
		tokens = copy.deepcopy(TOKENS)
		self.assertEqual(
			build.build_base_model(tokens)["palettes"]["presets"]["midad"]["params"],
			MODEL["palettes"]["presets"]["midad"]["params"],
		)
		tokens["brand"]["primary_hex"] = "#7a1fa2"
		branded = build.build_base_model(tokens)
		self.assertNotEqual(branded["palettes"]["presets"]["midad"]["params"]["primary"]["h"], 252)
		self.assertAlmostEqual(
			branded["palettes"]["presets"]["midad"]["params"]["primary"]["h"],
			colour.hex_to_oklch("#7a1fa2").h,
			places=2,
		)


class Labels(unittest.TestCase):
	def test_every_token_in_a_contrast_pair_has_a_label(self):
		tokens = set()
		for group in MODEL["contrast"]["groups"] + MODEL["contrast"]["max"]:
			tokens.update(group["fg"], group["bg"])
		self.assertEqual(sorted(tokens - set(labels.TOKEN_LABELS)), [])
		self.assertEqual(sorted(set(labels.TOKEN_LABELS) - tokens), [], "label for a token no pair uses")

	def test_labels_are_unique_plain_english(self):
		strings = labels.all_strings()
		self.assertEqual(len(strings), len(set(strings)))
		for text in strings:
			self.assertTrue((text and text[0].isupper()) or text in labels.INPUT_LABELS.values(), text)
			self.assertTrue(text.isascii(), text)

	def test_the_adr_example_label(self):
		self.assertEqual(labels.token_label("on-primary"), "Text on primary action")

	def test_unknown_token_falls_back_to_its_name(self):
		self.assertEqual(labels.token_label("no-such-token"), "no-such-token")
		self.assertEqual(labels.input_label(None), "")


if __name__ == "__main__":
	unittest.main()
