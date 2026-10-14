"""Check every Frappe source citation and selector of docs/DEPENDENCY_MANIFEST.md against a Frappe tree.

    python3 -I tools/bench/manifest_selectors.py --manifest docs/DEPENDENCY_MANIFEST.md \
        --old OLD_FRAPPE_REPO --new NEW_FRAPPE_REPO [--old-node DIR --new-node DIR] \
        [--old-label 16.32.0 --new-label 16.51.1] --tsv OUT.tsv --md OUT.md

OLD and NEW are checkouts of the `frappe` repository (the folder that contains the `frappe` package).
The manifest rows read are the tables of section 1 (hooks), 2a to 2h (selectors, items), the
round 2 `!important` table of section 4 and section 6 (behaviours and APIs). For each row:

1. Every citation `path:lines` is resolved in OLD, then the same lines are compared with NEW:
   `present` (identical text on the same lines), `moved` (identical block found on other lines),
   `changed` (the file exists but the cited text differs; the longest cited line is looked up as an
   anchor), `missing` (the file or the text is gone from NEW).
2. Every selector, class, attribute or API name in the first column is searched in the cited files
   of NEW; when absent there, in all of NEW (`moved`), else `missing`.
3. The row verdict is the worst of its parts: present < moved < changed < missing.

Reads files only. Exit code 1 when any row is `missing`, else 0 (moved and changed rows are
reported and need a human reading).
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

RANK = {"present": 0, "unchecked": 0, "moved": 1, "changed": 2, "gone": 2, "missing": 3}
TEXT_EXT = (".scss", ".js", ".html", ".py", ".css", ".json", ".vue", ".md", ".jinja", ".txt")
FILE_RE = re.compile(
	r"^([A-Za-z0-9_./@~-]+\.(?:scss|js|py|html|css|json|vue|md|jinja|txt))((?::\d[\d,\s-]*)?)$"
)
LINES_ONLY_RE = re.compile(r"^:(\d[\d,\s-]*)$")


@dataclass
class Tree:
	"""A Frappe checkout: the `frappe` package folder plus an optional node_modules folder."""

	repo: Path
	node: Path | None
	_index: dict[str, list[str]] | None = None
	_text: dict[str, list[str]] = field(default_factory=dict)

	@property
	def pkg(self) -> Path:
		return self.repo / "frappe"

	def index(self) -> dict[str, list[str]]:
		"""Basename to relative paths (relative to the repo root) of every text file under frappe/."""
		if self._index is None:
			found: dict[str, list[str]] = {}
			for path in sorted(self.pkg.rglob("*")):
				if (
					path.is_file()
					and path.suffix in TEXT_EXT
					and not {"node_modules", "dist"} & set(path.parts)
				):
					found.setdefault(path.name, []).append(str(path.relative_to(self.repo)))
			self._index = found
		return self._index

	def lines(self, rel: str) -> list[str] | None:
		"""Lines of a file by repo-relative path (or `node_modules/...`), trailing space removed."""
		if rel not in self._text:
			path = self._path(rel)
			if path is None or not path.is_file():
				return None
			self._text[rel] = [
				x.rstrip() for x in path.read_text(encoding="utf-8", errors="replace").split("\n")
			]
		return self._text[rel]

	def _path(self, rel: str) -> Path | None:
		if rel.startswith("node_modules/"):
			return None if self.node is None else self.node / rel[len("node_modules/") :]
		return self.repo / rel

	def exists(self, rel: str) -> bool:
		path = self._path(rel)
		return path is not None and path.is_file()


def split_row(line: str) -> list[str]:
	"""Split a markdown table row on `|` outside backticks."""
	cells, cur, in_code = [], [], False
	for ch in line.strip().strip("|"):
		if ch == "`":
			in_code = not in_code
		if ch == "|" and not in_code:
			cells.append("".join(cur).strip())
			cur = []
		else:
			cur.append(ch)
	cells.append("".join(cur).strip())
	return cells


@dataclass
class Row:
	section: str
	index: int
	item: str
	source: str


def read_rows(manifest: Path) -> list[Row]:
	"""Rows of the tables this check covers, with the section id (`1`, `2a`, ... `6`)."""
	rows: list[Row] = []
	section, header, count = "", [], 0
	for line in manifest.read_text(encoding="utf-8").splitlines():
		if line.startswith("## "):
			section = line[3:].split(".")[0].strip()
			header = []
		elif line.startswith("### "):
			section = line[4:].split(".")[0].strip()
			header = []
		if not line.startswith("|"):
			if header and line.strip() == "":
				header = []
			continue
		cells = split_row(line)
		if set("".join(cells)) <= set("-: "):
			continue
		if not header:
			header, count = [c.lower() for c in cells], 0
			continue
		count += 1
		first, second = header[0], header[1] if len(header) > 1 else ""
		if section == "1" and first == "hook":
			rows.append(Row(section, count, cells[0], cells[3]))
		elif section.startswith("2") and first in ("selector", "item"):
			rows.append(Row(section, count, cells[0], cells[2]))
		elif section == "4" and first == "file:line" and second == "declaration":
			rows.append(Row(section, count, cells[1], cells[2]))
		elif section == "6" and first == "behaviour or api":
			rows.append(Row(section, count, cells[0], cells[2]))
	return rows


def parse_lines(spec: str) -> list[tuple[int, int]]:
	ranges = []
	for part in re.split(r"\s*,\s*", spec.strip(" :")):
		if not part:
			continue
		lo, _, hi = part.partition("-")
		ranges.append((int(lo), int(hi or lo)))
	return ranges


def citations(source: str) -> list[tuple[str, list[tuple[int, int]]]]:
	"""`(path, line ranges)` for each backticked citation; a bare `:lines` continues the previous path."""
	found: list[tuple[str, list[tuple[int, int]]]] = []
	last = ""
	for seg in re.findall(r"`([^`]+)`", source):
		seg = seg.strip()
		match = FILE_RE.match(seg)
		if match and "(" not in seg:
			last = match.group(1)
			found.append((last, parse_lines(match.group(2))))
			continue
		match = LINES_ONLY_RE.match(seg)
		if match and last:
			found.append((last, parse_lines(match.group(1))))
	# Merge repeated paths into one citation so a file is reported once.
	merged: dict[str, list[tuple[int, int]]] = {}
	for path, ranges in found:
		merged.setdefault(path, []).extend(ranges)
	return list(merged.items())


def resolve(tree: Tree, cited: str) -> list[str]:
	"""Repo-relative paths a manifest path may mean, best first."""
	if cited.startswith("apps/frappe/node_modules/"):
		return ["node_modules/" + cited[len("apps/frappe/node_modules/") :]]
	if cited.startswith("node_modules/"):
		return [cited]
	candidates = [
		f"frappe/{cited}",
		f"frappe/public/{cited}",
		f"frappe/public/scss/{cited}",
		f"frappe/public/js/{cited}",
		cited,
	]
	hits = [c for c in candidates if tree.exists(c)]
	if hits:
		return hits[:1]
	base = cited.rsplit("/", 1)[-1]
	return [p for p in tree.index().get(base, []) if p.endswith(cited)] or tree.index().get(base, [])


def window_positions(lines: list[str], block: list[str]) -> list[int]:
	"""1-based line numbers where `block` occurs contiguously."""
	if not block:
		return []
	first = block[0]
	return [i + 1 for i, line in enumerate(lines) if line == first and lines[i : i + len(block)] == block]


def anchor_of(block: list[str]) -> str | None:
	"""The longest non-comment line of a block, used when the whole block no longer matches."""
	good = [x for x in block if len(x.strip()) >= 12 and not x.strip().startswith(("//", "/*", "*", "<!--"))]
	return max(good, key=lambda x: len(x.strip())) if good else None


def check_citation(old: Tree, new: Tree, cited: str, ranges: list[tuple[int, int]]) -> tuple[str, str]:
	"""Verdict and a short note for one cited file in NEW."""
	old_paths = resolve(old, cited)
	if not old_paths:
		return "unchecked", f"{cited}: not found in the old tree either (manifest path not resolvable)"
	rel = old_paths[0]
	note_ambig = f" (ambiguous: {len(old_paths)} files named so)" if len(old_paths) > 1 else ""
	old_lines = old.lines(rel)
	new_rel = rel
	if not new.exists(rel):
		base = rel.rsplit("/", 1)[-1]
		moved_to = [p for p in new.index().get(base, []) if p != rel]
		if not moved_to:
			return "gone", f"{rel}: file gone{note_ambig}"
		new_rel = moved_to[0]
	new_lines = new.lines(new_rel) or []
	file_moved = new_rel != rel
	if not ranges:
		status = "moved" if file_moved else "present"
		return status, f"{rel}: file {'now ' + new_rel if file_moved else 'exists'}{note_ambig}"
	results, worst = [], "present"
	for lo, hi in ranges:
		block = (old_lines or [])[lo - 1 : hi]
		if not block or not any(x.strip() for x in block):
			results.append(f"{lo}-{hi}: old text empty or out of range")
			continue
		if new_lines[lo - 1 : hi] == block and not file_moved:
			results.append(f"{lo}-{hi} same")
			continue
		positions = window_positions(new_lines, block)
		if positions:
			pos = min(positions, key=lambda p: abs(p - lo))
			results.append(f"{lo}-{hi} moved to {pos}-{pos + len(block) - 1}")
			worst = max(worst, "moved", key=RANK.get)
			continue
		anchor = anchor_of(block)
		anchors = [i + 1 for i, line in enumerate(new_lines) if anchor is not None and line == anchor]
		if anchors:
			pos = min(anchors, key=lambda p: abs(p - lo))
			results.append(f"{lo}-{hi} changed (anchor line {anchor.strip()[:40]!r} now at {pos})")
		else:
			results.append(f"{lo}-{hi} changed (anchor not found)")
		worst = max(worst, "changed", key=RANK.get)
	if file_moved:
		worst = max(worst, "moved", key=RANK.get)
	prefix = f"{rel} -> {new_rel}: " if file_moved else f"{rel}: "
	return worst, prefix + "; ".join(results) + note_ambig


STYLE_EXT = (".scss", ".css", ".js", ".html", ".vue", ".jinja")


def tokens_of(item: str) -> list[tuple[str, str]]:
	"""`(name, kind)` from the backticked parts of the first column. kind is `sel` (class, id, attribute)
	or `api` (a function, hook, event or setting name written with `_`, `-` or dots)."""
	found: list[tuple[str, str]] = []
	for seg in re.findall(r"`([^`]+)`", item):
		seg = seg.strip()
		if "/" in seg or "ins-" in seg or seg.endswith((".js", ".py", ".scss", ".css", ".html")):
			continue
		selector_like = (
			seg.startswith((".", "#", "["))
			or " " in seg
			or "[" in seg
			or bool(re.match(r"^[a-z]+\.[a-z][a-z-]*$", seg))
		)
		if selector_like and not seg.startswith(("frappe.", "jinja")):
			found += [(t, "sel") for t in re.findall(r"\.([A-Za-z_][\w-]*)", seg)]
			found += [(t, "sel") for t in re.findall(r"#([A-Za-z_][\w-]*)", seg)]
			found += [(t, "sel") for t in re.findall(r"\[((?:data|aria)-[\w-]+)", seg)]
			continue
		for word in seg.split():
			word = re.sub(r"\(.*$", "", word.strip("()'\",")).rsplit(".", 1)[-1]
			if re.match(r"^[A-Za-z][\w]*[_-][\w-]+$", word):
				found.append((word, "api"))
	skip = {"after", "before", "hover", "focus", "active", "not", "root"}
	return list(dict.fromkeys(t for t in found if t[0] not in skip))


def contains(lines: list[str], token: str) -> bool:
	pattern = re.compile(r"(?<![\w-])" + re.escape(token) + r"(?![\w-])")
	return any(pattern.search(line) for line in lines)


def tag_wide(tree: Tree, tokens: set[tuple[str, str]]) -> dict[tuple[str, str], list[str]]:
	"""For each (name, kind), up to three repo-relative files of the tree that contain it. Selector names are
	searched in stylesheets, scripts and templates only; API names in every text file."""
	hits: dict[tuple[str, str], list[str]] = {t: [] for t in tokens}
	for names in tree.index().values():
		for rel in names:
			if not rel.startswith(
				("frappe/public/", "frappe/templates/", "frappe/www/")
			) and not rel.endswith(".py"):
				continue
			lines = tree.lines(rel) or []
			text = "\n".join(lines)
			for token in tokens:
				name, kind = token
				if kind == "sel" and not rel.endswith(STYLE_EXT):
					continue
				if len(hits[token]) < 3 and name in text and contains(lines, name):
					hits[token].append(rel)
	return hits


def main(argv: list[str] | None = None) -> int:
	ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	ap.add_argument("--manifest", required=True, type=Path)
	ap.add_argument("--old", required=True, type=Path)
	ap.add_argument("--new", required=True, type=Path)
	ap.add_argument("--old-node", type=Path)
	ap.add_argument("--new-node", type=Path)
	ap.add_argument("--old-label", default="old")
	ap.add_argument("--new-label", default="new")
	ap.add_argument("--tsv", required=True, type=Path)
	ap.add_argument("--md", required=True, type=Path)
	ap.add_argument("--tokens-tsv", type=Path, help="one line per selector, class or API name")
	args = ap.parse_args(argv)

	old, new = Tree(args.old, args.old_node), Tree(args.new, args.new_node)
	rows = read_rows(args.manifest)
	parsed = []
	pending: set[str] = set()
	for row in rows:
		parts = [check_citation(old, new, path, ranges) for path, ranges in citations(row.source)]
		toks = tokens_of(row.item)
		cited_files = []
		for path, _ in citations(row.source):
			rels = resolve(old, path)
			if rels:
				rel = rels[0]
				if not new.exists(rel):
					rel = next((p for p in new.index().get(rel.rsplit("/", 1)[-1], [])), rel)
				cited_files.append(rel)
		missing_here = [
			t for t in toks if not any(contains(new.lines(rel) or [], t[0]) for rel in cited_files)
		]
		pending.update(missing_here)
		parsed.append((row, parts, toks, missing_here))
	elsewhere = tag_wide(new, pending) if pending else {}
	elsewhere_old = tag_wide(old, pending) if pending else {}

	out_rows, token_rows = [], []
	for row, parts, toks, missing_here in parsed:
		verdicts = [v for v, _ in parts]
		notes = [n for _, n in parts]
		token_notes, token_states = [], []
		for token in toks:
			has_citation = any(v != "unchecked" for v in verdicts)
			if token not in missing_here:
				state, where = "present", "in the cited file"
			elif elsewhere.get(token):
				if has_citation:
					state, where = "moved", "not in the cited file; now in " + elsewhere[token][0]
				else:
					state, where = "present", "no source line cited; found in " + elsewhere[token][0]
			elif elsewhere_old.get(token):
				state, where = "missing", f"gone from {args.new_label} (was in {elsewhere_old[token][0]})"
			else:
				state, where = (
					"unchecked",
					f"not in {args.old_label} source either (this theme's own name, or a description)",
				)
			token_states.append(state)
			token_rows.append((row.section, row.index, token[0], state, where))
			if state != "present":
				token_notes.append(f"{token[0]}: {where}")
		verdict = max(
			[*verdicts, *[s for s in token_states if s != "unchecked"]] or ["unchecked"], key=RANK.get
		)
		if "gone" in verdicts:
			# A cited file that is gone is only "missing" when the names it held are gone too.
			names_survive = bool(toks) and all(s in ("present", "moved") for s in token_states)
			rest = [v for v in verdicts if v != "gone"] + [s for s in token_states if s != "unchecked"]
			base = max(rest or ["unchecked"], key=RANK.get)
			verdict = max(base, "moved" if names_survive else "missing", key=RANK.get)
		if not parts and not toks:
			verdict = "unchecked"
		out_rows.append((row, verdict, notes, token_notes))

	kinds = ("present", "moved", "changed", "missing", "unchecked")
	counts = {k: sum(1 for r in out_rows if r[1] == k) for k in kinds}
	token_counts = {k: sum(1 for r in token_rows if r[3] == k) for k in kinds}
	args.tsv.parent.mkdir(parents=True, exist_ok=True)
	with args.tsv.open("w", encoding="utf-8", newline="\n") as fh:
		fh.write("section\trow\tverdict\titem\tdetail\n")
		for row, verdict, notes, token_notes in out_rows:
			item = re.sub(r"\s+", " ", row.item)[:90]
			detail = " | ".join(notes + token_notes).replace("\t", " ")
			fh.write(f"{row.section}\t{row.index}\t{verdict}\t{item}\t{detail}\n")
	if args.tokens_tsv:
		with args.tokens_tsv.open("w", encoding="utf-8", newline="\n") as fh:
			fh.write("section\trow\tname\tstate\twhere\n")
			for line in token_rows:
				fh.write("\t".join(str(x) for x in line) + "\n")

	def esc(text: str) -> str:
		return text.replace("|", "\\|")

	lines = [
		f"Manifest rows checked: {len(out_rows)}; names (classes, ids, attributes, APIs) checked: {len(token_rows)}. "
		f"Frappe {args.old_label} against {args.new_label}.",
		"",
		"Row verdicts: " + ", ".join(f"{k} {v}" for k, v in counts.items()) + ".",
		"Name verdicts: " + ", ".join(f"{k} {v}" for k, v in token_counts.items()) + ".",
		"",
		"| Section | Row | Verdict | Item | Detail |",
		"|---|---|---|---|---|",
	]
	for row, verdict, notes, token_notes in out_rows:
		item = esc(re.sub(r"\s+", " ", row.item))[:100]
		detail = esc(" ; ".join(notes + token_notes))
		lines.append(f"| {row.section} | {row.index} | {verdict} | {item} | {detail} |")
	args.md.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
	print(lines[0])
	print(lines[2])
	print(lines[3])
	return 1 if counts["missing"] else 0


if __name__ == "__main__":
	sys.exit(main())
