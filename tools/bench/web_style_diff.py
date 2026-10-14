"""Compare two captures of tools/bench/web_style_capture.mjs.

    python3 tools/bench/web_style_diff.py BEFORE.json AFTER.json [--out FILE] [--allowed NAMES.json]

Per page: how many elements were compared, which elements differ and in which properties, and how many custom
properties of `html` resolve differently; the names are listed once at the end. Exits 1 when any element of any
page differs, or when a custom property that resolves differently is not in `--allowed` (a JSON list of names,
the variables the build is meant to leave out). Test-bench only.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _props(text: str) -> dict[str, str]:
	return dict(part.split(":", 1) for part in text.split(";") if ":" in part)


def compare(before: dict, after: dict, allowed: set[str] | None = None) -> tuple[list[str], int]:
	"""Report lines and the number of problems: differing elements, and moved custom properties not allowed."""
	lines: list[str] = []
	total = 0
	moved_anywhere: set[str] = set()
	for label in sorted(set(before) | set(after)):
		if label not in before or label not in after:
			lines.append(f"{label}: only in {'before' if label in before else 'after'}")
			total += 1
			continue
		one, two = before[label], after[label]
		keys_one, keys_two = set(one["elements"]), set(two["elements"])
		differing = [
			key for key in sorted(keys_one & keys_two) if one["elements"][key] != two["elements"][key]
		]
		missing = sorted(keys_one ^ keys_two)
		moved = [name for name in sorted(one["custom"]) if one["custom"][name] != two["custom"].get(name)]
		lines.append(
			f"{label} ({one['path']}, status {one['status']}/{two['status']}): {len(keys_one & keys_two)} elements "
			f"compared, {len(differing)} differ, {len(missing)} only on one side, "
			f"{len(moved)} custom properties resolve differently on html"
		)
		for key in differing[:10]:
			a, b = _props(one["elements"][key]), _props(two["elements"][key])
			changes = ", ".join(f"{name}: {a[name]} -> {b.get(name)}" for name in a if a[name] != b.get(name))
			lines.append(f"    DIFF {key}: {changes}"[:400])
		for key in missing[:5]:
			lines.append(f"    ONLY-ONE-SIDE {key}")
		moved_anywhere.update(moved)
		total += len(differing) + len(missing)
	lines.append(
		f"custom properties of html that resolve differently on any page ({len(moved_anywhere)}): "
		+ ", ".join(sorted(moved_anywhere))
	)
	if allowed is not None:
		stray = sorted(moved_anywhere - allowed)
		lines.append(f"  not in the allowed list ({len(stray)}): {', '.join(stray) or 'none'}")
		total += len(stray)
	return lines, total


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("before")
	parser.add_argument("after")
	parser.add_argument("--out")
	parser.add_argument("--allowed", help="JSON list of custom property names allowed to resolve differently")
	args = parser.parse_args(argv)
	before = json.loads(Path(args.before).read_text(encoding="utf-8"))
	after = json.loads(Path(args.after).read_text(encoding="utf-8"))
	allowed = set(json.loads(Path(args.allowed).read_text(encoding="utf-8"))) if args.allowed else None
	lines, total = compare(before, after, allowed)
	lines.append(
		f"RESULT: {total} problem(s) over {len(before)} pages" + (" (identical)" if not total else "")
	)
	text = "\n".join(lines) + "\n"
	print(text, end="")
	if args.out:
		Path(args.out).write_text(text, encoding="utf-8", newline="\n")
	return 1 if total else 0


if __name__ == "__main__":
	sys.exit(main())
