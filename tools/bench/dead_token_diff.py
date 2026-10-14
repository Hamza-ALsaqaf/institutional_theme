"""Difference between two dead-token audits: which overridden Frappe variables change category.

    python3 -I tools/bench/dead_token_diff.py REPO_DIR OLD_CSS_LIST NEW_CSS_LIST

OLD_CSS_LIST and NEW_CSS_LIST are text files with one compiled core stylesheet path per line (the
files `tools/bench/newest_tag.sh` scanned). Uses the audit's own functions, so the categories are
exactly those of `python -m institutional_theme.audits`. Reads files only; never imports Frappe.
"""

from __future__ import annotations

import sys
from pathlib import Path


def main(argv: list[str]) -> int:
	if len(argv) != 4:
		print(__doc__)
		return 2
	repo = Path(argv[1])
	sys.path.insert(0, str(repo))
	from institutional_theme.audits import dead_tokens
	from institutional_theme.midad import model as model_mod

	def scan(list_file: str) -> dead_tokens.CoreVars:
		paths = [Path(line.strip()) for line in Path(list_file).read_text().splitlines() if line.strip()]
		return dead_tokens.scan_core(paths)

	old, new = scan(argv[2]), scan(argv[3])
	model = model_mod.load_model()
	theme_root = repo / "institutional_theme" / "public"
	old_results = {r.name: r.where for r in dead_tokens.audit(model, old, theme_root)}
	new_results = {r.name: r.where for r in dead_tokens.audit(model, new, theme_root)}

	print(f"core variables declared: old {len(old.declared)}, new {len(new.declared)}")
	print(f"core variables read:     old {len(old.read)}, new {len(new.read)}")
	print(
		f"declared only in old: {len(old.declared - new.declared)}; only in new: {len(new.declared - old.declared)}"
	)
	print(f"read only in old:     {len(old.read - new.read)}; only in new: {len(new.read - old.read)}")
	print()
	for label, results in (("old", old_results), ("new", new_results)):
		counts = dead_tokens.counts([dead_tokens.Result(n, w) for n, w in results.items()])
		print(f"{label}: " + ", ".join(f"{k} {v}" for k, v in counts.items()))
	print()
	changed = [(n, old_results[n], new_results[n]) for n in old_results if old_results[n] != new_results[n]]
	print(f"overridden variables whose category changed: {len(changed)}")
	for name, before, after in changed:
		print(f"  {name}: {before} -> {after}")
	print()
	dead = [n for n, w in new_results.items() if w == "dead"]
	print(f"dead in the newest tag: {len(dead)}")
	for name in dead:
		print(f"  {name}")
	return 0


if __name__ == "__main__":
	sys.exit(main(sys.argv))
