"""Avatar contrast audit: the shipped files pass, and the audit fails on a bad or missing pair."""

import tempfile
import unittest
from pathlib import Path

from institutional_theme.audits import avatars
from institutional_theme.midad import model as model_mod

PUBLIC = Path(avatars.__file__).resolve().parents[1] / "public"
MODEL = model_mod.load_model()
PALETTES = {name: model_mod.palette(MODEL, name) for name in MODEL["palettes"]["presets"]}
GOOD = {
	"orange": "pending",
	"pink": "plum",
	"blue": "progress",
	"green": "success",
	"dark-green": "teal",
	"red": "danger",
	"yellow": "warning",
	"purple": "special",
	"gray": "neutral",
}


def _scss(mapping, *, drop=None, extra=""):
	rows = []
	for name, status in mapping.items():
		if name == drop:
			continue
		bg, fg = (f"{status}-bg", f"{status}-fg") if isinstance(status, str) else status
		rows.append(f"\t--{name}-avatar-bg: var(--ins-{bg});\n\t--{name}-avatar-color: var(--ins-{fg});")
	return "html:root[dir] {\n" + "\n".join(rows) + extra + "\n}\n"


def _public(desk, web):
	root = Path(tempfile.mkdtemp())
	for source, text in zip(avatars.SOURCES, (desk, web), strict=True):
		path = root / source
		path.parent.mkdir(parents=True, exist_ok=True)
		path.write_text(text, encoding="utf-8")
	return root


def _good_public():
	text = _scss({n: f"status-{s}" for n, s in GOOD.items()})
	return _public(text, text)


class ShippedFiles(unittest.TestCase):
	def test_nine_colours_are_the_core_ones(self):
		core = Path("/home/frappe/frappe-bench/apps/frappe/frappe/public/scss/desk/avatar.scss")
		if core.is_file():
			found = {n for n, _part, _v in avatars._DECLARATION.findall(core.read_text())}
			self.assertEqual(found, set(avatars.COLOURS))

	def test_every_pair_passes_in_every_preset_and_mode(self):
		audit = avatars.run(MODEL, PALETTES, PUBLIC)
		self.assertEqual(audit.problems, [])
		self.assertEqual(audit.failures, [])
		# 2 files x 9 colours x 2 modes x every preset
		self.assertEqual(len(audit.results), 2 * 9 * 2 * len(PALETTES))
		self.assertTrue(all(r.passed for r in audit.results), min(r.ratio for r in audit.results))

	def test_both_modes_and_all_shipped_presets_are_measured(self):
		audit = avatars.run(MODEL, PALETTES, PUBLIC)
		self.assertEqual({r.mode for r in audit.results}, {"light", "dark"})
		self.assertTrue(set(MODEL["palettes"]["shipped"]) <= {r.preset for r in audit.results})

	def test_the_approved_midad_ratios_are_computed_from_the_reference_values(self):
		audit = avatars.run(MODEL, PALETTES, PUBLIC)
		by = {
			(r.colour, r.mode): r.ratio
			for r in audit.results
			if r.preset == "midad" and r.source == avatars.SOURCES[0]
		}
		# #652b00 on #ffe7db (orange, Light) and #ffd1b9 on #471b00 (orange, Dark), css-engineer's mapping
		self.assertGreater(by[("orange", "light")], 7)
		self.assertGreater(by[("orange", "dark")], 7)


class Failures(unittest.TestCase):
	def test_good_synthetic_files_pass(self):
		audit = avatars.run(MODEL, PALETTES, _good_public())
		self.assertEqual(audit.fatal, 0)

	def test_a_low_contrast_pair_fails_in_a_shipped_preset(self):
		bad = {n: f"status-{s}" for n, s in GOOD.items()}
		bad["blue"] = ("surface-base", "surface-base")  # the same colour on itself: 1:1
		text = _scss(bad)
		audit = avatars.run(MODEL, PALETTES, _public(text, text))
		self.assertTrue(audit.failures)
		self.assertTrue(all(r.colour == "blue" and r.ratio == 1 for r in audit.failures))
		self.assertEqual({r.mode for r in audit.failures}, {"light", "dark"})
		self.assertGreater(audit.fatal, 0)

	def test_a_missing_colour_is_a_problem(self):
		text = _scss({n: f"status-{s}" for n, s in GOOD.items()}, drop="purple")
		audit = avatars.run(MODEL, PALETTES, _public(text, text))
		self.assertTrue(any("purple" in p and "not declared" in p for p in audit.problems))

	def test_an_unknown_token_or_a_literal_is_a_problem(self):
		text = _scss({n: f"status-{s}" for n, s in GOOD.items()}, extra="\n\t--gray-avatar-color: #333333;")
		audit = avatars.run(MODEL, PALETTES, _public(text, text))
		self.assertTrue(any("gray-avatar-color" in p and "#333333" in p for p in audit.problems))

	def test_desk_and_website_must_agree(self):
		good = _scss({n: f"status-{s}" for n, s in GOOD.items()})
		other = {n: f"status-{s}" for n, s in GOOD.items()}
		other["red"] = "status-warning"
		audit = avatars.run(MODEL, PALETTES, _public(good, _scss(other)))
		self.assertTrue(any("differ for red" in p for p in audit.problems))

	def test_a_tenth_colour_is_a_problem(self):
		text = _scss(
			{n: f"status-{s}" for n, s in GOOD.items()},
			extra="\n\t--teal-avatar-bg: var(--ins-status-teal-bg);",
		)
		audit = avatars.run(MODEL, PALETTES, _public(text, text))
		self.assertTrue(any("teal" in p and "nine core colours" in p for p in audit.problems))

	def test_a_missing_file_is_a_problem(self):
		audit = avatars.run(MODEL, PALETTES, Path(tempfile.mkdtemp()))
		self.assertEqual(len(audit.problems), 2)

	def test_the_report_names_each_pair(self):
		audit = avatars.run(MODEL, PALETTES, PUBLIC)
		text = avatars.render_text(audit, PALETTES)
		self.assertIn("Failing pairs in shipped presets: 0; problems: 0", text)
		for name in avatars.COLOURS:
			self.assertIn(name, text)
