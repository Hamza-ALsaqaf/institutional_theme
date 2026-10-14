"""Before and after of the generated declarations that a version's core reads (ADR 0011 R3)."""

import unittest
from pathlib import Path

from institutional_theme.audits import dead_tokens, effective_diff, source_readers

GENERATED = Path(effective_diff.__file__).resolve().parents[1] / "public" / "scss" / "generated"

BEFORE = """// generated header
html:root[dir],
html[dir] [data-theme="light"] {
	--read-kept: var(--ins-a);
	--read-moved: var(--ins-a);
	--read-dropped: var(--ins-a);
	--unread-moved: var(--ins-a);
}

html:root[dir][data-theme="dark"] {
	--read-kept: var(--ins-b);
}

@media (prefers-color-scheme: dark) {
	html:root[dir][data-theme="automatic"] {
		--read-kept: var(--ins-b);
	}
}
"""

AFTER = """// generated header
html:root[dir],
html[dir] [data-theme="light"] {
	--read-kept: var(--ins-a);
	--read-moved: var(--ins-c);
	--unread-moved: var(--ins-c);
	--read-new: var(--ins-a);
	--unread-new: var(--ins-a);
}

html:root[dir][data-theme="dark"] {
	--read-kept: var(--ins-b);
}

@media (prefers-color-scheme: dark) {
	html:root[dir][data-theme="automatic"] {
		--read-kept: var(--ins-b);
	}
}
"""

CORE = dead_tokens.CoreVars(
	frozenset(), frozenset({"--read-kept", "--read-moved", "--read-dropped", "--read-new"}), ()
)


class Parse(unittest.TestCase):
	def test_blocks_media_and_selector_lists_get_one_key_each(self):
		found = effective_diff.parse_declarations(BEFORE)
		light = 'html:root[dir], html[dir] [data-theme="light"]'
		self.assertEqual(found[(light, "--read-kept")], "var(--ins-a)")
		self.assertEqual(found[('html:root[dir][data-theme="dark"]', "--read-kept")], "var(--ins-b)")
		automatic = '@media (prefers-color-scheme: dark) html:root[dir][data-theme="automatic"]'
		self.assertEqual(found[(automatic, "--read-kept")], "var(--ins-b)")
		self.assertEqual(len(found), 6)

	def test_comments_are_ignored(self):
		self.assertEqual(
			effective_diff.parse_declarations("// a { --x: 1; }\n.b { --y: 2; }\n"), {(".b", "--y"): "2"}
		)


class Compare(unittest.TestCase):
	def test_changed_removed_and_added_reads_are_reported_and_unread_ones_are_only_counted(self):
		movement = effective_diff.compare(BEFORE, AFTER, CORE)
		self.assertEqual([m[1] for m in movement.changed], ["--read-moved"])
		self.assertEqual([m[1] for m in movement.removed], ["--read-dropped"])
		self.assertEqual([m[1] for m in movement.added], ["--read-new"])
		self.assertEqual(movement.changed_unread, 1)
		self.assertEqual(movement.added_unread, 1)
		self.assertTrue(movement.moved)

	def test_a_core_that_reads_none_of_the_changes_does_not_move(self):
		core = dead_tokens.CoreVars(frozenset(), frozenset({"--read-kept"}), ())
		movement = effective_diff.compare(BEFORE, AFTER, core)
		self.assertFalse(movement.moved)
		self.assertEqual(movement.effective_before, movement.effective_after)

	def test_a_changed_token_value_that_existed_before_is_a_movement(self):
		before_tokens = "html:root { --ins-a: #111111; --ins-b: #222222; }"
		after_tokens = "html:root { --ins-a: #111111; --ins-b: #333333; --ins-new: #444444; }"
		movement = effective_diff.compare(BEFORE, BEFORE, CORE, before_tokens, after_tokens)
		self.assertEqual([t[1] for t in movement.token_changes], ["--ins-b"])
		self.assertTrue(movement.moved)

	def test_the_same_text_never_moves(self):
		self.assertFalse(effective_diff.compare(BEFORE, BEFORE, CORE, BEFORE, BEFORE).moved)

	def test_the_report_names_each_movement(self):
		text = effective_diff.render(effective_diff.compare(BEFORE, AFTER, CORE), "9.9.9", "HEAD")
		self.assertIn("CHANGED --read-moved", text)
		self.assertIn("REMOVED --read-dropped", text)
		self.assertIn("ADDED --read-new", text)
		self.assertIn("RESULT: moved", text)
		quiet = effective_diff.render(effective_diff.compare(BEFORE, BEFORE, CORE), "9.9.9", "HEAD")
		self.assertIn("RESULT: Frappe 9.9.9 does not move", quiet)


class SourceReaders(unittest.TestCase):
	"""N3d: a version's source readers count as readers, and an accepted move is listed, never hidden."""

	SOURCE = frozenset({"--read-new"})
	ACCEPT = {"--read-new": "inline style of one form; cosmetic"}

	def test_a_source_reader_makes_an_added_declaration_a_movement(self):
		core = dead_tokens.CoreVars(frozenset(), frozenset({"--read-kept"}), ())
		blind = effective_diff.compare(BEFORE, AFTER, core)
		self.assertFalse(blind.moved, "the compiled CSS alone does not see the reader")
		movement = effective_diff.compare(BEFORE, AFTER, core, source_reads=self.SOURCE)
		self.assertTrue(movement.moved)
		self.assertEqual([m[1] for m in movement.added], ["--read-new"])

	def test_an_accepted_name_is_listed_apart_and_does_not_move_the_version(self):
		core = dead_tokens.CoreVars(frozenset(), frozenset({"--read-kept"}), ())
		movement = effective_diff.compare(BEFORE, AFTER, core, source_reads=self.SOURCE, accepted=self.ACCEPT)
		self.assertFalse(movement.moved)
		self.assertEqual([(a[0], a[2]) for a in movement.accepted], [("ADDED", "--read-new")])
		text = effective_diff.render(movement, "9.9.9", "HEAD")
		self.assertIn("ACCEPTED ADDED --read-new", text)
		self.assertIn("inline style of one form", text)
		self.assertIn("does not move except 1 accepted declaration(s) of 1 name(s)", text)
		self.assertNotIn("RESULT: moved", text)

	def test_a_name_the_compiled_css_reads_is_never_accepted(self):
		movement = effective_diff.compare(
			BEFORE, AFTER, CORE, source_reads=self.SOURCE, accepted={"--read-new": "x", "--read-moved": "x"}
		)
		# CORE reads both names in its compiled CSS: both moves stand, whatever the source snapshot says.
		self.assertTrue(movement.moved)
		self.assertEqual([m[1] for m in movement.added], ["--read-new"])
		self.assertEqual([m[1] for m in movement.changed], ["--read-moved"])
		self.assertEqual([a[2] for a in movement.accepted], [])

	def test_a_name_without_a_source_reader_cannot_be_accepted(self):
		core = dead_tokens.CoreVars(frozenset(), frozenset({"--read-kept"}), ())
		movement = effective_diff.compare(BEFORE, AFTER, core, accepted=self.ACCEPT)
		self.assertEqual(movement.accepted, [])

	def test_an_unaccepted_source_move_is_not_hidden_by_other_acceptances(self):
		core = dead_tokens.CoreVars(frozenset(), frozenset({"--read-kept"}), ())
		movement = effective_diff.compare(
			BEFORE,
			AFTER,
			core,
			source_reads=frozenset({"--read-new", "--read-moved"}),
			accepted=self.ACCEPT,
		)
		self.assertTrue(movement.moved)
		self.assertEqual([m[1] for m in movement.changed], ["--read-moved"])

	def test_load_accepted_reads_a_version_and_tolerates_none(self):
		self.assertEqual(effective_diff.load_accepted("9.9.9"), {})
		self.assertEqual(sorted(effective_diff.load_accepted("16.32.0")), ["--radius-lg", "--radius-md"])
		self.assertEqual(effective_diff.load_accepted("16.52.0"), {})

	def test_the_two_16_32_0_radius_readers_are_covered_explicitly(self):
		"""Before the round the map had no --radius-md and --radius-lg; the committed data covers both."""
		text = (GENERATED / "_frappe_map.scss").read_text(encoding="utf-8")
		before = "\n".join(
			line
			for line in text.splitlines()
			if not line.lstrip().startswith(("--radius-md:", "--radius-lg:"))
		)
		self.assertNotEqual(before, text)
		core = dead_tokens.load_snapshot(dead_tokens.snapshot_path("16.32.0"))
		source = frozenset(source_readers.load_snapshot("16.32.0"))
		accepted = effective_diff.load_accepted("16.32.0")
		# The compiled-CSS-only check could not see the two readers: it said "does not move".
		blind = effective_diff.compare(before, text, core)
		self.assertFalse(blind.moved)
		# With the source readers and no acceptance, both names are reported as added declarations.
		strict = effective_diff.compare(before, text, core, source_reads=source)
		self.assertTrue(strict.moved)
		self.assertEqual({m[1] for m in strict.added}, {"--radius-md", "--radius-lg"})
		# With the committed acceptance they are listed. Moves are grouped by name and value, so the two names make two
		# entries, each naming all five element kinds (round 6: the map is no longer three blocks, so a count of
		# declarations per block, 6 before, no longer says anything; the element kinds do).
		covered = effective_diff.compare(before, text, core, source_reads=source, accepted=accepted)
		self.assertFalse(covered.moved)
		self.assertEqual(len(covered.accepted), 2)
		self.assertEqual({a[2] for a in covered.accepted}, {"--radius-md", "--radius-lg"})
		for accepted_move in covered.accepted:
			self.assertEqual(set(accepted_move[1].split(", ")), set(effective_diff.CONTEXTS))

	def test_16_52_0_is_not_excused(self):
		text = (GENERATED / "_frappe_map.scss").read_text(encoding="utf-8")
		before = "\n".join(
			line
			for line in text.splitlines()
			if not line.lstrip().startswith(("--radius-md:", "--radius-lg:"))
		)
		core = dead_tokens.load_snapshot(dead_tokens.snapshot_path("16.52.0"))
		movement = effective_diff.compare(
			before,
			text,
			core,
			source_reads=frozenset(source_readers.load_snapshot("16.52.0")),
			accepted=effective_diff.load_accepted("16.52.0"),
		)
		self.assertTrue(movement.moved)


class Effective(unittest.TestCase):
	"""Round 6: the map may be written as one shared block plus a dark delta; what it means is compared, not its text."""

	FULL = """html:root[dir],
html[dir] [data-theme="light"] {
	--same: var(--ins-a);
	--differs: var(--ins-light);
}

html:root[dir][data-theme="dark"],
html[dir] [data-theme="dark"] {
	--same: var(--ins-a);
	--differs: var(--ins-dark);
}

@media (prefers-color-scheme: dark) {
	html:root[dir][data-theme="automatic"] {
		--same: var(--ins-a);
		--differs: var(--ins-dark);
	}
}
"""
	DELTA = """html:root[dir],
html[dir] [data-theme="light"],
html[dir] [data-theme="dark"] {
	--same: var(--ins-a);
	--differs: var(--ins-light);
}

html:root[dir][data-theme="dark"],
html[dir] [data-theme="dark"] {
	--differs: var(--ins-dark);
}

@media (prefers-color-scheme: dark) {
	html:root[dir][data-theme="automatic"] {
		--differs: var(--ins-dark);
	}
}
"""
	CORE = dead_tokens.CoreVars(frozenset(), frozenset({"--same", "--differs"}), ())

	def test_three_full_blocks_and_a_shared_block_with_a_delta_mean_the_same(self):
		self.assertEqual(
			effective_diff.effective_declarations(self.FULL),
			effective_diff.effective_declarations(self.DELTA),
		)
		movement = effective_diff.compare(self.FULL, self.DELTA, self.CORE)
		self.assertFalse(movement.moved)
		self.assertEqual(movement.effective_before, movement.effective_after)

	def test_each_element_kind_gets_its_own_value(self):
		found = effective_diff.effective_declarations(self.DELTA)
		light, dark = "var(--ins-light)", "var(--ins-dark)"
		self.assertEqual(found[("root Light", "--differs")], light)
		self.assertEqual(found[("nested light", "--differs")], light)
		self.assertEqual(found[("root Dark", "--differs")], dark)
		self.assertEqual(found[("nested dark", "--differs")], dark)
		self.assertEqual(found[("root Automatic (dark OS)", "--differs")], dark)
		for context in effective_diff.CONTEXTS:
			self.assertEqual(found[(context, "--same")], "var(--ins-a)")

	def test_a_delta_that_forgets_a_dark_value_is_a_movement(self):
		for forgotten in (
			self.DELTA.replace(
				'html:root[dir][data-theme="dark"],\nhtml[dir] [data-theme="dark"] {\n\t--differs: var(--ins-dark);\n}',
				'html:root[dir][data-theme="dark"] {\n\t--differs: var(--ins-dark);\n}',
			),
			self.DELTA.replace("\t\t--differs: var(--ins-dark);\n", ""),
		):
			self.assertNotEqual(forgotten, self.DELTA)
			movement = effective_diff.compare(self.FULL, forgotten, self.CORE)
			self.assertTrue(movement.moved)
			self.assertEqual({m[1] for m in movement.changed}, {"--differs"})

	def test_the_shared_block_may_not_put_the_light_values_on_an_automatic_root_under_a_dark_os(self):
		"""Adding the automatic selector to the shared block would be harmless only if the media block still follows."""
		broken = self.DELTA.replace("\t\t--differs: var(--ins-dark);\n", "\t\t--other: 1px;\n")
		movement = effective_diff.compare(self.FULL, broken, self.CORE)
		self.assertTrue(movement.moved)

	def test_a_moved_group_names_the_element_kinds_together(self):
		after = self.FULL.replace("--differs: var(--ins-dark);", "--differs: var(--ins-other);")
		movement = effective_diff.compare(self.FULL, after, self.CORE)
		self.assertEqual(len(movement.changed), 1)
		self.assertEqual(
			set(movement.changed[0][0].split(", ")),
			{"root Dark", "root Automatic (dark OS)", "nested dark"},
		)


class GeneratedMap(unittest.TestCase):
	def test_the_real_map_has_a_shared_block_with_every_variable_and_a_dark_delta(self):
		text = (GENERATED / "_frappe_map.scss").read_text(encoding="utf-8")
		found = effective_diff.parse_declarations(text)
		selectors = list(dict.fromkeys(selector for selector, _ in found))
		self.assertEqual(len(selectors), 3, "shared, dark and automatic")
		counts = {selector: sum(1 for s, _ in found if s == selector) for selector in selectors}
		automatic = next(n for s, n in counts.items() if s.startswith("@media"))
		shared = max(counts.values())
		dark = next(n for s, n in counts.items() if not s.startswith("@media") and n != shared)
		self.assertEqual(dark, automatic)
		self.assertLess(dark, shared)

	def test_every_element_kind_holds_the_same_variables(self):
		text = (GENERATED / "_frappe_map.scss").read_text(encoding="utf-8")
		effective = effective_diff.effective_declarations(text)
		names = {context: {n for c, n in effective if c == context} for context in effective_diff.CONTEXTS}
		self.assertEqual(len({frozenset(v) for v in names.values()}), 1)
		self.assertGreater(len(names["root Light"]), 400)

	def test_comparing_the_working_map_with_itself_does_not_move_16_32_0(self):
		text = (GENERATED / "_frappe_map.scss").read_text(encoding="utf-8")
		core = dead_tokens.load_snapshot(dead_tokens.snapshot_path("16.32.0"))
		self.assertFalse(effective_diff.compare(text, text, core).moved)


if __name__ == "__main__":
	unittest.main()
