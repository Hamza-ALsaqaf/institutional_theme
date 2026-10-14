"""Compare two capture folders (before and after, or two runs of the same state) dump by dump.

    python3 compare_dumps.py BEFORE_DIR AFTER_DIR [--show N]

For every dump id present in both folders: the 424 mapped variables on `html` and on each nested `[data-theme]`
element, the root attributes, and the computed style of every element (matched by its path). Prints one line per
dump and a total; exit status 1 when any value differs or a dump is missing on one side.
"""

from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path


def load(path: Path) -> dict:
	with gzip.open(path, "rt", encoding="utf-8") as handle:
		return json.load(handle)


def element_styles(dump: dict) -> dict[str, str]:
	styles = dump["styles"]
	found: dict[str, str] = {}
	for path, index in zip(dump["paths"], dump["index"], strict=True):
		found[path] = styles[index]
	return found


def compare(before: dict, after: dict) -> dict:
	result: dict = {"variables": [], "nested": [], "attrs": [], "elements_changed": [], "only_before": [], "only_after": []}
	for name, value in before["root"]["variables"].items():
		if after["root"]["variables"].get(name) != value:
			result["variables"].append((name, value, after["root"]["variables"].get(name)))
	if before["root"]["attrs"] != after["root"]["attrs"]:
		result["attrs"].append((before["root"]["attrs"], after["root"]["attrs"]))
	if len(before["nested"]) != len(after["nested"]):
		result["nested"].append(("count", len(before["nested"]), len(after["nested"])))
	for left, right in zip(before["nested"], after["nested"], strict=False):
		if left["attrs"] != right["attrs"] or left["path"] != right["path"]:
			result["nested"].append(("element", left["path"], right["path"]))
		for name, value in left["variables"].items():
			if right["variables"].get(name) != value:
				result["nested"].append((left["path"], name, value, right["variables"].get(name)))
	old, new = element_styles(before), element_styles(after)
	properties = before["properties"]
	for path, text in old.items():
		if path not in new:
			result["only_before"].append(path)
		elif new[path] != text:
			changed = [
				(prop, a, b)
				for prop, a, b in zip(properties, text.split("|"), new[path].split("|"), strict=False)
				if a != b
			]
			result["elements_changed"].append((path, changed))
	result["only_after"] = [path for path in new if path not in old]
	return result


def main(argv: list[str]) -> int:
	if len(argv) < 3:
		print(__doc__)
		return 2
	before_dir, after_dir = Path(argv[1]) / "dumps", Path(argv[2]) / "dumps"
	show = int(argv[argv.index("--show") + 1]) if "--show" in argv else 3
	before_ids = {p.name.removesuffix(".json.gz") for p in before_dir.glob("*.json.gz")}
	after_ids = {p.name.removesuffix(".json.gz") for p in after_dir.glob("*.json.gz")}
	failed = 0
	for missing in sorted(before_ids ^ after_ids):
		print(f"MISSING {missing}: only in {'before' if missing in before_ids else 'after'}")
		failed += 1
	for dump_id in sorted(before_ids & after_ids):
		outcome = compare(load(before_dir / f"{dump_id}.json.gz"), load(after_dir / f"{dump_id}.json.gz"))
		differences = sum(len(outcome[key]) for key in outcome)
		print(
			f"{'same' if not differences else 'DIFF'} {dump_id}: variables {len(outcome['variables'])}, nested {len(outcome['nested'])}, "
			f"attrs {len(outcome['attrs'])}, elements changed {len(outcome['elements_changed'])}, "
			f"only before {len(outcome['only_before'])}, only after {len(outcome['only_after'])}"
		)
		if differences:
			failed += 1
			for key in ("variables", "nested", "attrs"):
				for row in outcome[key][:show]:
					print(f"    {key}: {row}")
			for path, changed in outcome["elements_changed"][:show]:
				print(f"    element {path[-110:]}: {changed[:3]}")
			for path in outcome["only_before"][:show]:
				print(f"    only before: {path[-110:]}")
			for path in outcome["only_after"][:show]:
				print(f"    only after: {path[-110:]}")
	print(f"{len(before_ids & after_ids)} dumps compared, {failed} with differences or missing")
	return 1 if failed else 0


if __name__ == "__main__":
	sys.exit(main(sys.argv))
