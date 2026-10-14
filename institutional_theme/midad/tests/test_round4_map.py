"""Round 4 (ADR 0011): the v16.52.0 additions to the Frappe map must not move Frappe 16.32.0.

Rule R3 says a name that 16.32.0 reads keeps its value. The proof is data, not trust: every key that
round 4 remapped or added is checked against the committed 16.32.0 snapshot of core's compiled CSS,
and must be one that core does not read there, or one that keeps its previous value.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

from institutional_theme.audits import dead_tokens, effective_diff, parity, source_readers
from institutional_theme.midad import emit, model

REPO = Path(__file__).resolve().parents[3]
GENERATED = REPO / "institutional_theme" / "public" / "scss" / "generated"
MODEL = model.load_model()
VARS = MODEL["frappe"]["vars"]
OLD = dead_tokens.load_snapshot(dead_tokens.snapshot_path("16.32.0"))
NEW = dead_tokens.load_snapshot(dead_tokens.snapshot_path("16.52.0"))

# The 26 keys whose mapping moved (token map G2b "remap" and G1b `--ink-white`), with the value they had
# before round 4 as (light, dark). The new values are in design/tokens.json.
PREVIOUS = {
	"--surface-gray-5": ("slate.700", "night.300"),
	"--surface-gray-6": ("slate.800", "night.200"),
	"--surface-red-5": ("red.600", "red.400"),
	"--surface-red-6": ("red.700", "red.300"),
	"--surface-red-7": ("red.800", "red.200"),
	"--surface-green-3": ("green.600", "green.400"),
	"--surface-amber-3": ("amber.600", "amber.400"),
	"--ink-white": ("#ffffff", "night.950"),
	"--ink-red-1": ("red.50", "red.950"),
	"--ink-red-2": ("red.300", "red.700"),
	"--ink-red-3": ("red.600", "red.400"),
	"--ink-green-2": ("green.600", "green.400"),
	"--ink-amber-2": ("amber.600", "amber.400"),
	"--ink-blue-2": ("blue.600", "blue.400"),
	"--ink-cyan-1": ("cyan.700", "cyan.300"),
	"--ink-pink-1": ("pink.700", "pink.300"),
	"--ink-violet-1": ("violet.700", "violet.300"),
	"--outline-gray-5": ("slate.800", "night.200"),
	"--outline-red-1": ("red.200", "red.800"),
	"--outline-red-3": ("red.600", "red.400"),
	"--outline-green-1": ("green.200", "green.800"),
	"--outline-green-2": ("green.300", "green.700"),
	"--outline-amber-1": ("amber.200", "amber.800"),
	"--outline-amber-2": ("amber.300", "amber.700"),
	"--outline-blue-1": ("blue.200", "blue.800"),
	"--outline-orange-1": ("orange.300", "orange.700"),
}

# The 35 keys added to `frappe.vars` (token map section N, without the raw ramp step 950).
ADDED = (
	"--surface-base",
	"--surface-sidebar",
	"--desk-sidebar-bg",
	"--surface-elevation-1",
	"--surface-elevation-2",
	"--surface-elevation-3",
	"--surface-alpha-gray-2",
	"--surface-gray-10",
	"--ink-base",
	"--outline-elevation-2",
	"--bg-amber",
	"--text-on-amber",
	"--bg-violet",
	"--text-on-violet",
	"--elevation-sm",
	"--elevation-base",
	"--elevation-md",
	"--elevation-lg",
	"--elevation-xl",
	"--elevation-2xl",
	"--focus-outline-default",
	"--text-p-xs",
	"--text-p-sm",
	"--text-p-base",
	"--text-p-lg",
	"--text-p-xl",
	"--font-weight-regular",
	"--font-weight-medium",
	"--font-weight-semibold",
	"--font-weight-bold",
	"--radius",
	"--radius-sm",
	"--radius-md",
	"--radius-lg",
	"--radius-xl",
)
RAW_950 = ("--gray-950", *(f"--{hue}-950" for hue in MODEL["frappe"]["raw_hues"]))

# Names that no compiled stylesheet of 16.32.0 reads but that its source does (finding N1f): both are
# `border-radius` of an inline rule that reads a name 16.32.0 never declares, so it computes to 0 there and
# takes the design's container radius now. The readers live in the committed source snapshot
# (audits/data/source_readers_frappe_16.32.0.json) and the acceptance, with its reason, in
# audits/data/accepted_movement.json; effective_diff lists them, so no result says "does not move" without them.
SOURCE_READERS_16_32_0 = tuple(sorted(effective_diff.load_accepted("16.32.0")))


def _previous(name: str) -> tuple[str, str] | None:
	return PREVIOUS.get(name)


def moved_names(core, names, previous, current) -> list[str]:
	"""Names that `core` reads and whose value is not the one they had before."""
	return [
		name
		for name in names
		if name in core.read and (previous(name) is None or previous(name) != current(name))
	]


def _current(name: str) -> tuple[str, str]:
	return VARS[name]["light"], VARS[name]["dark"]


def _specificity(selector: str) -> tuple[int, int, int]:
	"""(ids, classes, elements) of one compound selector chain; enough for the shapes of emit.SHAPES."""
	ids = selector.count("#")
	attributes = len(re.findall(r"\[[^\]]*\]", selector))
	stripped = re.sub(r"\[[^\]]*\]", "", selector)
	classes = (
		attributes
		+ len(re.findall(r"\.[A-Za-z_-]", stripped))
		+ len(re.findall(r"(?<!:):[A-Za-z-]+", stripped))
	)
	elements = len(re.findall(r"(?:^|[\s>+~])[A-Za-z][A-Za-z0-9-]*", stripped))
	return ids, classes, elements


class Counts(unittest.TestCase):
	def test_the_map_has_26_remaps_35_additions_and_12_new_raw_steps(self):
		self.assertEqual(len(PREVIOUS), 26)
		self.assertEqual(len(ADDED), 35)
		self.assertEqual(len(RAW_950), 12)
		self.assertEqual(len(ADDED) + len(RAW_950), 47)

	def test_every_remap_moved_and_every_addition_is_new(self):
		for name, previous in PREVIOUS.items():
			with self.subTest(name=name):
				self.assertIn(name, VARS)
				self.assertNotEqual(_current(name), previous)
		for name in ADDED:
			with self.subTest(name=name):
				self.assertIn(name, VARS)
				self.assertNotIn(name, PREVIOUS)

	def test_raw_ramps_emit_step_950(self):
		frappe = MODEL["frappe"]
		self.assertEqual(frappe["raw_gray_light"]["950"], "slate.950")
		self.assertEqual(frappe["raw_gray_dark"]["950"], "night.950")
		declared = {name for name, _ in model.frappe_map(MODEL).declarations["light"]}
		for name in RAW_950:
			with self.subTest(name=name):
				self.assertIn(name, declared)

	def test_light_and_dark_define_the_same_names(self):
		fmap = model.frappe_map(MODEL)
		self.assertEqual(
			[n for n, _ in fmap.declarations["light"]], [n for n, _ in fmap.declarations["dark"]]
		)


class Frappe1632DoesNotMove(unittest.TestCase):
	"""R3: a remapped or added key is not read by 16.32.0 core, or it keeps its previous value."""

	def test_every_changed_key_is_inert_on_16_32_0_or_unchanged(self):
		moved = moved_names(OLD, (*PREVIOUS, *ADDED, *RAW_950), _previous, _current)
		self.assertEqual(moved, [], "16.32.0 core reads these names and their value changed")

	def test_the_same_holds_for_the_names_its_source_reads_except_the_accepted_two(self):
		everything = dead_tokens.CoreVars(
			OLD.declared, OLD.read | frozenset(source_readers.load_snapshot("16.32.0")), OLD.sources
		)
		moved = moved_names(everything, (*PREVIOUS, *ADDED, *RAW_950), _previous, _current)
		self.assertEqual(sorted(moved), sorted(SOURCE_READERS_16_32_0))

	def test_every_remap_is_declared_only_in_16_32_0(self):
		# The remaps replace a declared-only name: the theme set it, core never read it.
		for name in PREVIOUS:
			with self.subTest(name=name):
				self.assertIn(name, OLD.declared)
				self.assertNotIn(name, OLD.read)

	def test_every_addition_is_absent_from_the_16_32_0_stylesheets(self):
		for name in (*ADDED, *RAW_950):
			with self.subTest(name=name):
				self.assertNotIn(name, OLD.declared)
				self.assertNotIn(name, OLD.read)

	def test_source_readers_outside_the_scanned_css_are_listed_and_real(self):
		self.assertEqual(list(SOURCE_READERS_16_32_0), ["--radius-lg", "--radius-md"])
		readers = source_readers.load_snapshot("16.32.0")
		added_and_read_by_source = {n for n in ADDED if n in readers and n not in OLD.read}
		self.assertEqual(added_and_read_by_source, set(SOURCE_READERS_16_32_0))
		for name in SOURCE_READERS_16_32_0:
			self.assertIn(name, ADDED)
			self.assertNotIn(name, OLD.read)
			self.assertNotIn(name, OLD.declared)

	def test_the_check_reports_a_name_core_reads_whose_value_moved(self):
		core = dead_tokens.CoreVars(frozenset(), frozenset({"--a", "--b", "--c"}), ())
		previous = {"--a": ("x", "y"), "--b": ("x", "y")}.get
		current = {"--a": ("x", "y"), "--b": ("x", "z"), "--c": ("p", "q"), "--d": ("p", "q")}.get
		# --a keeps its value, --b moved, --c is new and read, --d is new and unread.
		self.assertEqual(moved_names(core, ["--a", "--b", "--c", "--d"], previous, current), ["--b", "--c"])


class Frappe1652IsMapped(unittest.TestCase):
	"""Each addition is a name v16.52.0 reads; each remap is one it reads with the new meaning."""

	def test_every_addition_is_read_by_v16_52_0(self):
		for name in (*ADDED, *RAW_950):
			with self.subTest(name=name):
				self.assertIn(name, NEW.read)

	def test_every_remap_is_read_by_v16_52_0(self):
		for name in PREVIOUS:
			with self.subTest(name=name):
				self.assertIn(name, NEW.read)

	def test_semantic_remaps_point_at_the_role_not_a_step(self):
		self.assertEqual(VARS["--surface-red-7"]["light"], "@danger")
		self.assertEqual(VARS["--ink-red-1"]["dark"], "@on-danger")
		self.assertEqual(VARS["--ink-white"]["light"], "@on-danger")

	def test_the_sidebar_background_uses_the_sunken_surface_in_both_modes(self):
		self.assertEqual(_current("--desk-sidebar-bg"), ("@surface-sunken", "@surface-sunken"))
		self.assertEqual(_current("--surface-elevation-3"), ("@surface-base", "@surface-hover"))


class DarkSpecificity(unittest.TestCase):
	"""Core redeclares `--desk-sidebar-bg` for Dark at (0,2,0); the palette dark shape must match or beat it."""

	def test_the_dark_shapes_beat_core(self):
		for selector in emit.SHAPES["palette"]["dark"]:
			with self.subTest(selector=selector):
				self.assertGreaterEqual(_specificity(selector), (0, 2, 0))
		self.assertEqual(_specificity('html:root[dir][data-theme="dark"]'), (0, 3, 1))
		self.assertEqual(_specificity('html[dir] [data-theme="dark"]'), (0, 2, 1))

	def test_the_map_shapes_beat_core(self):
		"""The map is one shared block plus a dark delta; every selector of either still beats core's (0,2,0)."""
		for block in ("shared", "dark", "automatic"):
			for selector in emit.SHAPES["map"][block]:
				with self.subTest(block=block, selector=selector):
					self.assertGreaterEqual(_specificity(selector), (0, 2, 0))
		self.assertEqual(_specificity("html:root[dir]"), (0, 2, 1))
		self.assertEqual(_specificity('html:root[dir][data-theme="automatic"]'), (0, 3, 1))

	def test_the_generated_map_gives_dark_the_sidebar_background_and_the_hover_elevation(self):
		"""Effective values, not text: `--desk-sidebar-bg` is the same in both modes, so only the shared block declares it."""
		text = (GENERATED / "_frappe_map.scss").read_text(encoding="utf-8")
		effective = effective_diff.effective_declarations(text)
		for context in effective_diff.CONTEXTS:
			with self.subTest(context=context):
				dark_like = context in ("root Dark", "root Automatic (dark OS)", "nested dark")
				self.assertEqual(effective[(context, "--desk-sidebar-bg")], "var(--ins-surface-sunken)")
				self.assertEqual(
					effective[(context, "--surface-elevation-3")],
					"var(--ins-surface-hover)" if dark_like else "var(--ins-surface-base)",
				)
		shared, dark = parity.parse_blocks(text)[:2]
		self.assertIn("--desk-sidebar-bg", [prop for prop, _ in shared.declarations])
		self.assertNotIn("--desk-sidebar-bg", [prop for prop, _ in dark.declarations])
		self.assertIn(("--surface-elevation-3", "var(--ins-surface-hover)"), dark.declarations)


if __name__ == "__main__":
	unittest.main()
