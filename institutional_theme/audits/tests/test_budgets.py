"""Size budgets: figures from the brief, the skip without a build, and the failure on an excess."""

import contextlib
import gzip
import io
import json
import random
import tempfile
import unittest
from pathlib import Path

from institutional_theme.audits import budgets

KB = budgets.KB


def _main(*argv: str) -> int:
	with contextlib.redirect_stdout(io.StringIO()):
		return budgets.main(list(argv))


def _make_dist(root: Path, sizes: dict[str, int], rtl: bool = True) -> Path:
	"""A dist folder with one hashed file per bundle; content is incompressible-ish so gzip stays near raw."""
	dist = root / "dist"
	for folder in ("css", "css-rtl", "js"):
		(dist / folder).mkdir(parents=True)
	for name, size in sizes.items():
		stem, ext = name.rsplit(".", 1)
		body = bytes((i * 7919 + 13) % 251 for i in range(size))
		folders = ["js"] if ext == "js" else ["css"] + (["css-rtl"] if rtl else [])
		for folder in folders:
			(dist / folder / f"{stem}.ABCD1234.{ext}").write_bytes(body)
	return dist


SMALL = {
	"ins_desk.bundle.css": 1000,
	"ins_web.bundle.css": 1000,
	"ins_palette_petrol.bundle.css": 1000,
	"ins_fonts_noto.bundle.css": 1000,
	"ins_email.bundle.css": 1000,
	"ins_print.bundle.css": 1000,
	"ins_shell.bundle.js": 1000,
	"ins_web.bundle.js": 1000,
}


class Figures(unittest.TestCase):
	def test_the_brief_figures(self):
		self.assertEqual(budgets.BUDGETS["ins_desk.bundle.css"].raw, 150 * KB)
		self.assertEqual(budgets.BUDGETS["ins_web.bundle.css"].raw, 60 * KB)
		self.assertEqual(budgets.FONT_PAIRING_BUDGET, 350 * KB)
		self.assertEqual(budgets.BUDGETS["ins_desk.bundle.css"].origin, "brief")

	def test_the_brief_still_says_so(self):
		brief = (Path(budgets.__file__).resolve().parents[2] / "docs" / "BRIEF.md").read_text(
			encoding="utf-8"
		)
		self.assertIn("desk theme CSS about 150 KB", brief)
		self.assertIn("login and website about 60 KB", brief)
		self.assertIn("fonts about 350 KB", brief)

	def test_logical_name(self):
		self.assertEqual(budgets.logical_name("ins_desk.bundle.KBBUYUPB.css"), "ins_desk.bundle.css")
		self.assertEqual(budgets.logical_name("ins_shell.bundle.EPFQJJKH.js"), "ins_shell.bundle.js")
		self.assertIsNone(budgets.logical_name("ins_desk.bundle.KBBUYUPB.css.map"))
		self.assertIsNone(budgets.logical_name("desk.bundle.KBBUYUPB.css"))

	def test_patterns_and_unknown_bundles(self):
		self.assertIs(
			budgets.budget_for("ins_palette_forest.bundle.css"), budgets.BUDGETS["ins_palette_*.bundle.css"]
		)
		self.assertIsNotNone(budgets.budget_for("ins_fonts_tajawal.bundle.css"))
		self.assertIsNone(budgets.budget_for("ins_new.bundle.css"))

	def test_gzip_size_matches_gzip(self):
		data = b"abc" * 1000
		self.assertEqual(budgets.gzip_size(data), len(gzip.compress(data, 9, mtime=0)))


class Checks(unittest.TestCase):
	def test_within_budget(self):
		measure = budgets.check("ltr", "ins_desk.bundle.css", "x.css", b"a" * 1000)
		self.assertEqual(measure.problems, ())

	def test_raw_excess_fails(self):
		measure = budgets.check("ltr", "ins_web.bundle.css", "x.css", b"a" * (60 * KB + 1))
		self.assertTrue(any("raw" in p for p in measure.problems))

	def test_gzip_excess_fails(self):
		data = random.Random(1).randbytes(20 * KB)
		measure = budgets.check("js", "ins_web.bundle.js", "x.js", data)
		self.assertTrue(any("raw" in p for p in measure.problems))
		self.assertTrue(any("gzip" in p for p in measure.problems))

	def test_unknown_bundle_fails(self):
		measure = budgets.check("ltr", "ins_new.bundle.css", "x.css", b"a")
		self.assertEqual(measure.problems, ("no budget declared for this bundle",))

	def test_justified_excess_passes_and_is_empty_by_default(self):
		self.assertEqual(budgets.JUSTIFIED, {})
		original = dict(budgets.JUSTIFIED)
		budgets.JUSTIFIED["ins_web.bundle.css"] = (70 * KB, "a reason")
		try:
			measure = budgets.check("ltr", "ins_web.bundle.css", "x.css", b"a" * (65 * KB))
			self.assertEqual([p for p in measure.problems if "raw" in p], [])
		finally:
			budgets.JUSTIFIED.clear()
			budgets.JUSTIFIED.update(original)


class Run(unittest.TestCase):
	def test_not_built_is_a_skip(self):
		with tempfile.TemporaryDirectory() as tmp:
			outcome = budgets.run(None, environ={"BENCH_DIR": tmp})
			self.assertFalse(outcome.ran)
			self.assertEqual(outcome.problems, ())
			self.assertIn("not built", outcome.text)
			outcome = budgets.run(str(Path(tmp) / "missing"))
			self.assertFalse(outcome.ran)
			self.assertEqual(_main("--dist", str(Path(tmp) / "missing")), 0)

	def test_empty_dist_is_a_skip(self):
		with tempfile.TemporaryDirectory() as tmp:
			(Path(tmp) / "css").mkdir()
			outcome = budgets.run(tmp)
			self.assertFalse(outcome.ran)
			self.assertIn("not built", outcome.text)

	def test_passes_within_budget(self):
		with tempfile.TemporaryDirectory() as tmp:
			dist = _make_dist(Path(tmp), SMALL)
			outcome = budgets.run(str(dist))
			self.assertTrue(outcome.ran)
			self.assertEqual(outcome.problems, ())
			self.assertIn("RESULT: within budget", outcome.text)
			self.assertEqual(_main("--dist", str(dist)), 0)

	def test_fails_when_exceeded(self):
		with tempfile.TemporaryDirectory() as tmp:
			sizes = dict(SMALL, **{"ins_web.bundle.css": 61 * KB})
			dist = _make_dist(Path(tmp), sizes)
			outcome = budgets.run(str(dist))
			self.assertTrue(outcome.problems)
			self.assertTrue(any("ins_web.bundle.css" in p and "raw" in p for p in outcome.problems))
			self.assertIn("FAIL", outcome.text)
			self.assertEqual(_main("--dist", str(dist)), 1)

	def test_newest_hashed_build_is_measured(self):
		with tempfile.TemporaryDirectory() as tmp:
			dist = _make_dist(Path(tmp), SMALL)
			old = dist / "css" / "ins_desk.bundle.OLDOLD11.css"
			old.write_bytes(b"x" * (200 * KB))
			import os

			os.utime(old, (1, 1))
			outcome = budgets.run(str(dist))
			self.assertEqual(outcome.problems, ())

	def test_bench_lookup_uses_assets_json(self):
		with tempfile.TemporaryDirectory() as tmp:
			bench = Path(tmp)
			assets = bench / "sites" / "assets"
			dist = _make_dist(assets / "institutional_theme", SMALL)
			self.assertEqual(dist, assets / "institutional_theme" / "dist")
			self.assertIsNone(budgets.bench_dist(bench))
			url = "/assets/institutional_theme/dist/css/ins_desk.bundle.ABCD1234.css"
			(assets / "assets.json").write_text(json.dumps({"ins_desk.bundle.css": url}), encoding="utf-8")
			self.assertEqual(budgets.bench_dist(bench), dist)
			outcome = budgets.run(None, environ={"BENCH_DIR": str(bench)})
			self.assertTrue(outcome.ran)

	def test_a_missing_rtl_folder_is_not_an_error(self):
		with tempfile.TemporaryDirectory() as tmp:
			dist = _make_dist(Path(tmp), SMALL, rtl=False)
			self.assertEqual(budgets.run(str(dist)).problems, ())


class Fonts(unittest.TestCase):
	def test_shipped_pairings_are_within_the_budget(self):
		pairings = budgets.scan_fonts()
		self.assertTrue(pairings)
		self.assertEqual(budgets.font_problems(pairings), [])

	def test_font_excess_fails(self):
		with tempfile.TemporaryDirectory() as tmp:
			folder = Path(tmp) / "big"
			folder.mkdir()
			(folder / "a.woff2").write_bytes(random.Random(2).randbytes(351 * KB))
			(folder / "a.ttf").write_bytes(b"t" * 10)
			pairings = budgets.scan_fonts(Path(tmp))
			self.assertEqual(pairings[0].woff2_total, 351 * KB)
			self.assertEqual(len(budgets.font_problems(pairings)), 1)
			self.assertEqual(len(pairings[0].ttf), 1)
			with tempfile.TemporaryDirectory() as dist_tmp:
				dist = _make_dist(Path(dist_tmp), SMALL)
				outcome = budgets.run(str(dist), fonts_dir=Path(tmp))
				self.assertTrue(any("fonts/big" in p for p in outcome.problems))


if __name__ == "__main__":
	unittest.main()
