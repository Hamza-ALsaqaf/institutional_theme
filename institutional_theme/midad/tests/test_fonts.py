"""Fonts: bundled files, the SCSS faces, upload validation, uploaded CSS and the print block."""

from __future__ import annotations

import hashlib
import re
import tempfile
import unittest
from pathlib import Path

from institutional_theme import fonts
from institutional_theme.audits import parity

PACKAGE = Path(__file__).resolve().parents[2]
REPO = PACKAGE.parent
FONT_DIR = PACKAGE / "public" / "fonts"
SCSS_DIR = PACKAGE / "public" / "scss" / "fonts"
GENERATED = PACKAGE / "public" / "scss" / "generated"

FACE = re.compile(
	r'@include ins-face\("([^"]+)", ("?[0-9 ]+"?), "([^"]+)", (\$ins-range-(?:arabic|latin))\);'
)


def _faces(path: Path) -> list[tuple[str, str, str, str]]:
	return [(f, w.strip('"'), file, r) for f, w, file, r in FACE.findall(path.read_text(encoding="utf-8"))]


def _all_faces() -> dict[str, list[tuple[str, str, str, str]]]:
	return {p.name: _faces(p) for p in sorted(SCSS_DIR.glob("*.scss")) if p.name != "_ranges.scss"}


class BundledFiles(unittest.TestCase):
	def test_every_woff2_is_woff2_and_every_ttf_is_truetype(self):
		for path in sorted(FONT_DIR.rglob("*.woff2")):
			self.assertEqual(fonts.file_kind(path), "woff2", path.name)
		for path in sorted(FONT_DIR.rglob("*.ttf")):
			self.assertEqual(fonts.file_kind(path), "ttf", path.name)

	def test_each_family_folder_has_its_licence(self):
		for folder in ("plex", "noto", "tajawal"):
			text = (FONT_DIR / folder / "OFL.txt").read_text(encoding="utf-8")
			self.assertIn("SIL OPEN FONT LICENSE Version 1.1", text, folder)

	def test_default_pairing_stays_inside_the_woff2_budget(self):
		total = sum(p.stat().st_size for p in (FONT_DIR / "plex").glob("*.woff2"))
		self.assertLess(total, 350 * 1024)

	def test_the_licence_record_matches_the_files(self):
		text = (REPO / "docs" / "FONTS.md").read_text(encoding="utf-8")
		recorded = dict(
			re.findall(r"\| `((?:plex|noto|tajawal)/[^`]+)` \|.*\| `([0-9a-f]{64})` \|$", text, re.M)
		)
		on_disk = {
			p.relative_to(FONT_DIR).as_posix()
			for p in FONT_DIR.rglob("*")
			if p.is_file() and not p.name.startswith(".")
		}
		self.assertEqual(set(recorded), on_disk)
		for name, digest in recorded.items():
			self.assertEqual(hashlib.sha256((FONT_DIR / name).read_bytes()).hexdigest(), digest, name)


class ScssFaces(unittest.TestCase):
	def test_every_face_points_at_a_bundled_file(self):
		count = 0
		for name, faces in _all_faces().items():
			for _family, _weight, file, _range in faces:
				self.assertTrue((FONT_DIR / file).is_file(), f"{name}: {file}")
				count += 1
		self.assertEqual(count, 8 + 6 + 6)

	def test_family_names_are_private(self):
		for name, faces in _all_faces().items():
			for family, *_ in faces:
				self.assertTrue(family.startswith("Midad "), f"{name}: {family}")
		for path in SCSS_DIR.glob("*.scss"):
			code = re.sub(r"//[^\n]*", "", path.read_text(encoding="utf-8"))
			self.assertNotIn("IBM Plex Sans Arabic", code, path.name)

	def test_arabic_faces_use_the_arabic_range_and_the_rest_the_latin_range(self):
		for name, faces in _all_faces().items():
			for family, _weight, _file, unicode_range in faces:
				expected = (
					"$ins-range-arabic"
					if family.endswith("Arabic") or family == "Midad Tajawal"
					else "$ins-range-latin"
				)
				self.assertEqual(unicode_range, expected, f"{name}: {family}")

	def test_the_arabic_range_matches_adr_0004_and_the_python_constant(self):
		ranges = (SCSS_DIR / "_ranges.scss").read_text(encoding="utf-8")
		match = re.search(r'\$ins-range-arabic: "([^"]+)";', ranges)
		self.assertEqual(match.group(1), fonts.ARABIC_RANGE)
		self.assertEqual(
			fonts.ARABIC_RANGE, "U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F"
		)
		self.assertNotIn("U+0030", fonts.ARABIC_RANGE, "digits must come from the Latin face")

	def test_swap_everywhere_and_asset_paths_are_absolute(self):
		ranges = (SCSS_DIR / "_ranges.scss").read_text(encoding="utf-8")
		self.assertIn("font-display: swap;", ranges)
		self.assertNotIn("font-display: block", ranges)
		self.assertIn('$ins-font-path: "/assets/institutional_theme/fonts";', ranges)
		self.assertEqual(fonts.ASSET_BASE, "/assets/institutional_theme/fonts")

	def test_weights_are_400_500_600_only(self):
		for name, faces in _all_faces().items():
			for family, weight, *_ in faces:
				self.assertIn(
					weight,
					("400", "500", "600", "600 700", "700") if "Tajawal" in family else ("400", "500", "600"),
					f"{name} {family} {weight}",
				)

	def test_tajawal_semibold_uses_the_700_file(self):
		for family, weight, file, _ in _all_faces()["ins_fonts_tajawal.bundle.scss"]:
			if weight == "600 700":
				self.assertTrue(file.endswith("-700-normal.woff2"), family)

	def test_plex_partial_sets_the_stacks_and_disables_synthesis(self):
		text = (SCSS_DIR / "_plex.scss").read_text(encoding="utf-8")
		self.assertIn("html:root[dir] {", text)
		self.assertIn("--ins-font-sans:", text)
		self.assertIn("--ins-font-arabic:", text)
		self.assertIn("--ins-font-mono:", text)
		self.assertIn("font-synthesis: none;", text)

	def test_pairing_bundles_win_by_specificity_and_are_wrapped_for_rtlcss(self):
		for name in ("ins_fonts_noto.bundle.scss", "ins_fonts_tajawal.bundle.scss"):
			text = (SCSS_DIR / name).read_text(encoding="utf-8")
			self.assertIn("html:root[dir][lang] {", text, name)
			self.assertIn("/*rtl:begin:ignore*/", text)
			self.assertIn("/*rtl:end:ignore*/", text)
			self.assertIn(
				'"Midad Plex Sans Arabic", "Midad Plex Sans", system-ui, sans-serif;',
				text,
				"Plex stays as fallback",
			)

	def test_bundle_names_match_the_python_table(self):
		self.assertEqual(fonts.PAIRING_BUNDLES["Noto"], "ins_fonts_noto.bundle.css")
		self.assertTrue((SCSS_DIR / "ins_fonts_noto.bundle.scss").exists())
		self.assertEqual(fonts.PAIRING_BUNDLES["Tajawal"], "ins_fonts_tajawal.bundle.css")
		self.assertTrue((SCSS_DIR / "ins_fonts_tajawal.bundle.scss").exists())
		self.assertIsNone(fonts.PAIRING_BUNDLES["IBM Plex"])
		self.assertEqual(set(fonts.PAIRING_BUNDLES), set(fonts.PAIRINGS))

	def test_python_family_names_are_declared_in_the_scss(self):
		declared = {family for faces in _all_faces().values() for family, *_ in faces}
		for family in (fonts.FAMILY_PLEX_ARABIC, fonts.FAMILY_PLEX_LATIN, fonts.FAMILY_PLEX_MONO):
			self.assertIn(family, declared)


class FrappeVariables(unittest.TestCase):
	"""The font variables reach core through the generated map; names verified in espresso/_typography.scss."""

	def test_font_stack_and_weights_are_mapped(self):
		text = (GENERATED / "_frappe_map.scss").read_text(encoding="utf-8")
		for line in (
			"--font-stack: var(--ins-font-sans);",
			"--weight-regular: var(--ins-weight-regular);",
			"--weight-medium: var(--ins-weight-medium);",
			"--weight-semibold: var(--ins-weight-strong);",
			"--weight-bold: var(--ins-weight-strong);",
		):
			self.assertIn(line, text)

	def test_regular_is_400_and_strong_is_600(self):
		text = (GENERATED / "_scale.scss").read_text(encoding="utf-8")
		self.assertIn("--ins-weight-regular: 400;", text)
		self.assertIn("--ins-weight-medium: 500;", text)
		self.assertIn("--ins-weight-strong: 600;", text)

	def test_every_ins_font_variable_the_map_uses_is_defined_by_a_font_partial(self):
		partial = (SCSS_DIR / "_plex.scss").read_text(encoding="utf-8")
		for token in ("--ins-font-sans", "--ins-font-mono"):
			self.assertIn(f"{token}:", partial)


class MagicNumbers(unittest.TestCase):
	def test_accepted_formats(self):
		self.assertEqual(fonts.font_kind(b"wOF2\x00\x01"), "woff2")
		self.assertEqual(fonts.font_kind(b"\x00\x01\x00\x00rest"), "ttf")
		self.assertEqual(fonts.font_kind(b"true...."), "ttf")

	def test_everything_else_is_rejected(self):
		for head in (
			b"",
			b"wOFF",
			b"OTTO",
			b"%PDF",
			b"\x00\x01\x00",
			b"<svg",
			b"GIF8",
			b"\x89PNG",
			b"ttcf",
			b"WOF2",
		):
			with self.subTest(head=head):
				self.assertIsNone(fonts.font_kind(head))

	def test_file_kind_reads_from_disk(self):
		with tempfile.TemporaryDirectory() as folder:
			path = Path(folder) / "x.bin"
			path.write_bytes(b"wOF2" + b"\x00" * 10)
			self.assertEqual(fonts.file_kind(path), "woff2")
			path.write_bytes(b"<html>")
			self.assertIsNone(fonts.file_kind(path))
			self.assertIsNone(fonts.file_kind(Path(folder) / "missing.woff2"))


def _upload(script: str, kind: str = "woff2", *, regular: bool = True, semibold: bool = True) -> dict:
	out = {}
	out[f"{script}_regular"] = (
		fonts.UploadedFont(f"/files/institutional_theme/{script}-r.{kind}", kind) if regular else None
	)
	out[f"{script}_semibold"] = (
		fonts.UploadedFont(f"/files/institutional_theme/{script}-s.{kind}", kind) if semibold else None
	)
	return out


def _all(kind: str = "woff2") -> dict:
	return {**_upload("arabic", kind), **_upload("latin", kind)}


class UploadedUrls(unittest.TestCase):
	def test_safe_urls(self):
		for url in ("/files/My%20Font.woff2", "/files/institutional_theme/a-b_c.1.ttf", "/files/a@2x.woff2"):
			fonts.UploadedFont(url, "woff2")

	def test_unsafe_urls_cannot_reach_the_stylesheet(self):
		for url in (
			'/files/a");}body{x:y',
			"/files/a b.woff2",
			"//evil.example/x.woff2",
			"https://evil.example/x.woff2",
			"/files/a\nb.woff2",
			"/files/a'b",
			"/files/a(b)",
			"/files/a\\b",
			"/files/../private/a.woff2",
			"files/a.woff2",
			"/",
			"",
		):
			with self.subTest(url=url), self.assertRaises(ValueError):
				fonts.UploadedFont(url, "woff2")

	def test_unknown_kind(self):
		with self.assertRaises(ValueError):
			fonts.UploadedFont("/files/a.woff", "woff")


class UploadedCss(unittest.TestCase):
	def test_complete_set(self):
		css = fonts.uploaded_font_css(_all())
		self.assertTrue(css.startswith("/* generated by institutional_theme.fonts"))
		self.assertEqual(css.count("@font-face"), 4)
		self.assertIn('font-family: "Midad Uploaded Arabic";', css)
		self.assertIn('font-family: "Midad Uploaded Latin";', css)
		self.assertEqual(css.count("font-weight: 400;"), 2)
		self.assertEqual(css.count("font-weight: 500 600;"), 2)
		self.assertEqual(css.count("font-display: swap;"), 4)
		self.assertEqual(css.count("unicode-range:"), 2, "only the Arabic faces are range-limited")
		self.assertIn(fonts.ARABIC_RANGE, css)
		self.assertIn('format("woff2")', css)
		self.assertNotIn("IBM Plex Sans Arabic", css)

	def test_variables_sit_at_the_pairing_specificity_with_weights_at_600(self):
		css = fonts.uploaded_font_css(_all())
		block = parity.parse_blocks(css)[-1]
		self.assertEqual(block.selectors, ("html:root[dir][lang]",))
		values = dict(block.declarations)
		self.assertEqual(
			values["--ins-font-sans"],
			'"Midad Uploaded Arabic", "Midad Uploaded Latin", "Midad Plex Sans Arabic", "Midad Plex Sans", system-ui, sans-serif',
		)
		self.assertEqual(
			values["--ins-font-arabic"],
			'"Midad Uploaded Arabic", "Midad Plex Sans Arabic", system-ui, sans-serif',
		)
		for name in (
			"--ins-weight-medium",
			"--ins-weight-strong",
			"--weight-medium",
			"--weight-semibold",
			"--weight-bold",
		):
			self.assertEqual(values[name], "600", name)

	def test_truetype_files_declare_truetype(self):
		css = fonts.uploaded_font_css(_all("ttf"))
		self.assertIn('format("truetype")', css)
		self.assertNotIn('format("woff2")', css)

	def test_a_script_missing_a_file_loses_both_faces(self):
		for missing in ({"arabic_semibold": None}, {"arabic_regular": None}):
			css = fonts.uploaded_font_css({**_all(), **missing})
			self.assertNotIn("Midad Uploaded Arabic", css)
			self.assertIn("Midad Uploaded Latin", css)
			self.assertEqual(css.count("@font-face"), 2)
			self.assertIn('--ins-font-arabic: "Midad Plex Sans Arabic", system-ui, sans-serif;', css)
		css = fonts.uploaded_font_css({**_all(), "latin_semibold": None})
		self.assertNotIn("Midad Uploaded Latin", css)
		self.assertIn('--ins-font-sans: "Midad Uploaded Arabic", "Midad Plex Sans Arabic"', css)

	def test_nothing_usable_gives_no_stylesheet(self):
		self.assertEqual(fonts.uploaded_font_css({}), "")
		self.assertEqual(
			fonts.uploaded_font_css({**_upload("arabic", semibold=False), **_upload("latin", regular=False)}),
			"",
		)

	def test_output_is_deterministic_and_changes_with_content(self):
		self.assertEqual(fonts.uploaded_font_css(_all()), fonts.uploaded_font_css(_all()))
		self.assertNotEqual(
			fonts.uploaded_font_css(_all()), fonts.uploaded_font_css({**_all(), "latin_semibold": None})
		)

	def test_no_forbidden_syntax(self):
		css = fonts.uploaded_font_css(_all())
		self.assertNotIn("!important", css)
		self.assertNotRegex(css, r"(?<!-)color-scheme\s*:")


class PrintBlock(unittest.TestCase):
	def _check_urls_exist(self, css: str):
		for url in re.findall(r'url\("(/assets/institutional_theme/fonts/[^"]+)"\)', css):
			self.assertTrue(
				(FONT_DIR / url.removeprefix("/assets/institutional_theme/fonts/")).is_file(), url
			)

	def test_plex_pairing_declares_one_ttf_url_per_face_and_no_format(self):
		css = fonts.print_font_css("IBM Plex")
		self.assertEqual(css.count("@font-face"), 8)
		self.assertEqual(css.count("src: url("), 8)
		self.assertEqual(len(re.findall(r"src: url\(\"[^\"]+\.ttf\"\);", css)), 8)
		self.assertNotIn("format(", css)
		self.assertNotIn("woff2", css)
		self._check_urls_exist(css)
		self.assertNotIn("IBM Plex Sans Arabic", css)

	def test_noto_and_tajawal_print_in_plex(self):
		plex = fonts.print_font_css("IBM Plex")
		self.assertEqual(fonts.print_font_css("Noto"), plex)
		self.assertEqual(fonts.print_font_css("Tajawal"), plex)

	def test_uploaded_ttf_files_are_used_per_script(self):
		css = fonts.print_font_css("Uploaded", _all("ttf"))
		self.assertIn('"Midad Uploaded Arabic"', css)
		self.assertIn('"Midad Uploaded Latin"', css)
		self.assertIn("/files/institutional_theme/arabic-r.ttf", css)
		self.assertNotIn(fonts.FAMILY_PLEX_LATIN + '";\n\tfont-style: normal;\n\tfont-weight: 400', css)
		self.assertIn(fonts.FAMILY_PLEX_MONO, css)
		self.assertNotIn("format(", css)
		self.assertEqual(css.count("src: url("), 4 + 2)

	def test_woff2_only_uploads_print_in_plex(self):
		css = fonts.print_font_css("Uploaded", _all("woff2"))
		self.assertEqual(css, fonts.print_font_css("IBM Plex"))

	def test_mixed_uploads(self):
		css = fonts.print_font_css("Uploaded", {**_upload("arabic", "ttf"), **_upload("latin", "woff2")})
		self.assertIn("Midad Uploaded Arabic", css)
		self.assertNotIn("Midad Uploaded Latin", css)
		self.assertIn("IBMPlexSans-Regular.ttf", css)
		self.assertNotIn("IBMPlexSansArabic-Regular.ttf", css)

	def test_incomplete_upload_prints_in_plex(self):
		css = fonts.print_font_css("Uploaded", {**_all("ttf"), "arabic_semibold": None})
		self.assertNotIn("Midad Uploaded Arabic", css)
		self.assertIn("IBMPlexSansArabic-SemiBold.ttf", css)

	def test_uploaded_pairing_without_uploads_is_plex(self):
		self.assertEqual(fonts.print_font_css("Uploaded", None), fonts.print_font_css("IBM Plex"))

	def test_unknown_pairing(self):
		with self.assertRaises(ValueError):
			fonts.print_font_css("Comic Sans")

	def test_font_families(self):
		plex = fonts.print_font_families("IBM Plex")
		self.assertEqual(plex["sans"], '"Midad Plex Sans Arabic", "Midad Plex Sans", sans-serif')
		self.assertEqual(plex["mono"], '"Midad Plex Mono", monospace')
		uploaded = fonts.print_font_families("Uploaded", _all("ttf"))
		self.assertTrue(
			uploaded["sans"].startswith(
				'"Midad Uploaded Arabic", "Midad Uploaded Latin", "Midad Plex Sans Arabic"'
			)
		)

	def test_every_print_ttf_exists(self):
		for faces in fonts.PLEX_PRINT_FACES.values():
			for _family, _weight, name in faces:
				self.assertTrue((FONT_DIR / "plex" / name).is_file(), name)


if __name__ == "__main__":
	unittest.main()
