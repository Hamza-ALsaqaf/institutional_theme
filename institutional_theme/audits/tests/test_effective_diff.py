"""Before and after of the generated declarations that a version's core reads (ADR 0011 R3)."""

import unittest
from pathlib import Path

from institutional_theme.audits import dead_tokens, effective_diff

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


class GeneratedMap(unittest.TestCase):
	def test_the_real_map_parses_into_every_block_with_every_variable(self):
		text = (GENERATED / "_frappe_map.scss").read_text(encoding="utf-8")
		found = effective_diff.parse_declarations(text)
		selectors = {selector for selector, _ in found}
		self.assertEqual(len(selectors), 3)
		per_block = {selector: sum(1 for s, _ in found if s == selector) for selector in selectors}
		self.assertEqual(len(set(per_block.values())), 1, "light, dark and automatic hold the same variables")

	def test_comparing_the_working_map_with_itself_does_not_move_16_32_0(self):
		text = (GENERATED / "_frappe_map.scss").read_text(encoding="utf-8")
		core = dead_tokens.load_snapshot(dead_tokens.snapshot_path("16.32.0"))
		self.assertFalse(effective_diff.compare(text, text, core).moved)


if __name__ == "__main__":
	unittest.main()
