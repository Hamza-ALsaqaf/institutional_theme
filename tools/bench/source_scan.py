"""Scan a bench's frappe and erpnext source for the names of a list: files and kind (declared, read, other)."""

import collections
import os
import re
import sys
from pathlib import Path

names = Path(sys.argv[1]).read_text().split()
roots = sys.argv[2:]
pat = re.compile(
	r"(?<![A-Za-z0-9_-])("
	+ "|".join(re.escape(n) for n in sorted(names, key=len, reverse=True))
	+ r")(?![A-Za-z0-9_-])"
)
exts = {".scss", ".css", ".js", ".vue", ".html", ".py", ".json", ".ts"}
skip = {"node_modules", "dist", ".git", "__pycache__", "locale", "translations"}
hits = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
files = 0
for root in roots:
	for dp, dn, fn in os.walk(root):
		dn[:] = [d for d in dn if d not in skip]
		for f in fn:
			p = Path(dp) / f
			if p.suffix not in exts:
				continue
			text = p.read_text(errors="replace")
			files += 1
			for line in text.splitlines():
				for m in pat.finditer(line):
					kind = (
						"read"
						if line[: m.start()].rstrip().endswith("var(")
						else "declared"
						if line[m.end() :].lstrip().startswith(":")
						else "other"
					)
					hits[m.group(1)][f"{Path(root).name}/{p.relative_to(root)}"][kind] += 1
print(f"files scanned: {files} under {', '.join(roots)}")
print("kind: declared = `--name:`, read = `var(--name`, other = any other mention")
print()
for name in names:
	where = hits.get(name, {})
	if not where:
		print(f"{name}: not mentioned in any source file")
		continue
	print(name)
	for file, kinds in sorted(where.items()):
		print(f"  {file}: " + ", ".join(f"{k} {n}" for k, n in sorted(kinds.items())))
