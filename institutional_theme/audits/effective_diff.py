"""Before and after of the generated declarations that one Frappe version's core actually reads.

ADR 0011 R3 says a change of the Frappe map must not move 16.32.0 (rule 3, upgrade safety). This
compares two texts of a generated map (`_frappe_map.scss`) and keeps only the declarations whose
variable the version's core reads (its snapshot, `read`). A changed, removed or added declaration of
such a variable moves that version; the report lists them and the command exits 1 when any exists.
It also checks that every `--ins-*` value of `_tokens.scss` that existed before is unchanged, because
the map points at those values.

    python -m institutional_theme.audits.effective_diff [--ref HEAD] [--version 16.32.0] [--out FILE]

`--ref` is the git revision of the "before" files. Never imports Frappe.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

from .dead_tokens import DEFAULT_VERSION, CoreVars, load_snapshot, snapshot_path

REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED = Path("institutional_theme/public/scss/generated")
MAP_FILE = GENERATED / "_frappe_map.scss"
TOKENS_FILE = GENERATED / "_tokens.scss"

Declarations = dict[tuple[str, str], str]

_MEDIA = re.compile(r"(@media[^{]*)\{\s*([^{}]+)\{([^{}]*)\}\s*\}")
_BLOCK = re.compile(r"([^{}]+)\{([^{}]*)\}")
_PROPERTY = re.compile(r"(--[A-Za-z0-9_-]+)\s*:\s*([^;]+?)\s*;")


def parse_declarations(text: str) -> Declarations:
	"""`{(selector, property): value}` for every custom property of a generated SCSS file.

	A selector inside `@media` is prefixed with the query. Selector lists are kept whole, whitespace
	collapsed, so the same block in two files gets the same key.
	"""
	found: Declarations = {}
	text = re.sub(r"^\s*//.*$", "", text, flags=re.MULTILINE)

	def add(head: str, body: str) -> None:
		selector = " ".join(head.split())
		for name, value in _PROPERTY.findall(body):
			found[(selector, name)] = value

	for media, head, body in _MEDIA.findall(text):
		add(f"{' '.join(media.split())} {head}", body)
	for head, body in _BLOCK.findall(_MEDIA.sub("", text)):
		add(head, body)
	return found


@dataclass
class Movement:
	"""What changed between two maps, for the declarations a core reads."""

	changed: list[tuple[str, str, str, str]] = field(default_factory=list)
	removed: list[tuple[str, str, str]] = field(default_factory=list)
	added: list[tuple[str, str, str]] = field(default_factory=list)
	effective_before: int = 0
	effective_after: int = 0
	added_unread: int = 0
	changed_unread: int = 0
	token_changes: list[tuple[str, str, str, str]] = field(default_factory=list)

	@property
	def moved(self) -> bool:
		return bool(self.changed or self.removed or self.added or self.token_changes)


def compare(
	before_map: str, after_map: str, core: CoreVars, before_tokens: str = "", after_tokens: str = ""
) -> Movement:
	"""Compare two map texts for the variables `core` reads, and two token texts for kept names."""
	before, after = parse_declarations(before_map), parse_declarations(after_map)
	reads = core.read
	movement = Movement()
	movement.effective_before = sum(1 for (_, name) in before if name in reads)
	movement.effective_after = sum(1 for (_, name) in after if name in reads)
	for key, value in before.items():
		selector, name = key
		if key not in after:
			if name in reads:
				movement.removed.append((selector, name, value))
		elif after[key] != value:
			if name in reads:
				movement.changed.append((selector, name, value, after[key]))
			else:
				movement.changed_unread += 1
	for key, value in after.items():
		selector, name = key
		if key not in before:
			if name in reads:
				movement.added.append((selector, name, value))
			else:
				movement.added_unread += 1
	old_tokens, new_tokens = parse_declarations(before_tokens), parse_declarations(after_tokens)
	for key, value in old_tokens.items():
		if key in new_tokens and new_tokens[key] != value:
			movement.token_changes.append((key[0], key[1], value, new_tokens[key]))
		elif key not in new_tokens:
			movement.token_changes.append((key[0], key[1], value, "(removed)"))
	return movement


def render(movement: Movement, version: str, ref: str) -> str:
	"""A text report: counts, then every moved declaration."""
	lines = [
		f"Frappe {version}: generated declarations of variables core reads, {ref} against the working tree",
		f"  effective declarations before: {movement.effective_before}",
		f"  effective declarations after:  {movement.effective_after}",
		f"  changed: {len(movement.changed)}   removed: {len(movement.removed)}   added: {len(movement.added)}",
		f"  declarations the version does not read: {movement.changed_unread} changed, "
		f"{movement.added_unread} added (inert here)",
		f"  --ins-* values that existed before and changed: {len(movement.token_changes)}",
	]
	for selector, name, old, new in movement.changed:
		lines.append(f"  CHANGED {name} in {selector}: {old} -> {new}")
	for selector, name, old in movement.removed:
		lines.append(f"  REMOVED {name} in {selector}: {old}")
	for selector, name, new in movement.added:
		lines.append(f"  ADDED {name} in {selector}: {new}")
	for selector, name, old, new in movement.token_changes:
		lines.append(f"  TOKEN {name} in {selector}: {old} -> {new}")
	lines.append("  RESULT: moved" if movement.moved else f"  RESULT: Frappe {version} does not move")
	return "\n".join(lines) + "\n"


def _git_show(ref: str, path: Path) -> str:
	return subprocess.run(
		["git", "show", f"{ref}:{path.as_posix()}"],
		cwd=REPO_ROOT,
		check=True,
		capture_output=True,
		text=True,
	).stdout


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(
		prog="python -m institutional_theme.audits.effective_diff", description=__doc__
	)
	parser.add_argument("--ref", default="HEAD", help="git revision of the before files (default HEAD)")
	parser.add_argument(
		"--version", default=DEFAULT_VERSION, help="Frappe version whose snapshot decides what is read"
	)
	parser.add_argument("--out", help="also write the report to this file")
	args = parser.parse_args(argv)
	core = load_snapshot(snapshot_path(args.version))
	movement = compare(
		_git_show(args.ref, MAP_FILE),
		(REPO_ROOT / MAP_FILE).read_text(encoding="utf-8"),
		core,
		_git_show(args.ref, TOKENS_FILE),
		(REPO_ROOT / TOKENS_FILE).read_text(encoding="utf-8"),
	)
	text = render(movement, args.version, args.ref)
	print(text, end="")
	if args.out:
		Path(args.out).write_text(text, encoding="utf-8", newline="\n")
	return 1 if movement.moved else 0


if __name__ == "__main__":
	sys.exit(main())
