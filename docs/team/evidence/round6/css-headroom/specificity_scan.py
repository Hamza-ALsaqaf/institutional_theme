"""Static scan for the round-6 Frappe-map shape change (docs/team/evidence/round6/css-headroom/README.md).

Lists every rule outside the generated map that declares a variable of the map, with its specificity and
whether its subject (the last compound selector) could match the root element, and lists the selector stack of
every declaration of a mapped name in a source tree (core, an app). Reads files only; no network.

    python3 -I specificity_scan.py css  EXPANDED_CSS      # compiled ins_desk.bundle (sass --style=expanded)
    python3 -I specificity_scan.py tree SOURCE_DIR        # .scss and .css below a core or app checkout

Run from the repository root (the mapped names come from `design/tokens.json` through the midad model).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[5]))

from institutional_theme.midad import build  # noqa: E402
from institutional_theme.midad import model as model_mod  # noqa: E402

Spec = tuple[int, int, int]
_IDENT = re.compile(r"[A-Za-z0-9_-]+")
_FUNCTIONAL = {"is", "not", "has", "matches", "-webkit-any", "-moz-any"}


def mapped_names() -> set[str]:
	model = build.build_model(build.load_tokens())
	return {name for name, _ in model_mod.frappe_map(model).declarations["light"]}


def _matching_paren(text: str, start: int) -> int:
	depth = 0
	for index in range(start, len(text)):
		depth += text[index] == "("
		depth -= text[index] == ")"
		if depth == 0:
			return index
	raise ValueError(f"unbalanced parenthesis in {text!r}")


def _split_top(text: str, separators: str) -> list[str]:
	parts, depth, current = [], 0, ""
	for char in text:
		depth += char in "(["
		depth -= char in ")]"
		if depth == 0 and char in separators:
			parts.append(current)
			current = ""
		else:
			current += char
	parts.append(current)
	return [part for part in parts if part.strip()]


def specificity(selector: str) -> Spec:
	"""(ids, classes, elements) of one complex selector; :is/:not/:has take their most specific argument, :where none."""
	ids = classes = elements = 0
	index = 0
	while index < len(selector):
		char = selector[index]
		if char == "#":
			ids += 1
			index += 1 + len(_IDENT.match(selector, index + 1).group(0))
		elif char == ".":
			classes += 1
			index += 1 + len(_IDENT.match(selector, index + 1).group(0))
		elif char == "[":
			classes += 1
			index = selector.index("]", index) + 1
		elif char == ":":
			if selector[index + 1] == ":":
				elements += 1
				index += 2 + len(_IDENT.match(selector, index + 2).group(0))
				continue
			name = _IDENT.match(selector, index + 1).group(0)
			index += 1 + len(name)
			if index < len(selector) and selector[index] == "(":
				end = _matching_paren(selector, index)
				if name in _FUNCTIONAL:
					best = max((specificity(arg) for arg in _split_top(selector[index + 1 : end], ",")), default=(0, 0, 0))
					ids, classes, elements = ids + best[0], classes + best[1], elements + best[2]
				elif name != "where":
					classes += 1
				index = end + 1
			else:
				classes += 1
		elif char.isalpha():
			elements += 1
			index += len(_IDENT.match(selector, index).group(0))
		else:
			index += 1
	return ids, classes, elements


def subject(selector: str) -> str:
	"""The last compound selector of a complex selector."""
	return _split_top(selector.strip(), " >+~")[-1]


def root_capable(compound: str) -> bool:
	"""True when nothing in the compound needs a class, id or another element type (so `html` itself could match)."""
	bare = re.sub(r":(?:not|where)\([^()]*(?:\([^()]*\)[^()]*)*\)", "", compound)
	return not re.search(r"[.#]|:is\(|^(?!html\b)[A-Za-z]", bare)


def scan_css(path: Path, names: set[str]) -> list[str]:
	text = re.sub(r"/\*.*?\*/", "", path.read_text(encoding="utf-8"), flags=re.S)
	stack: list[str] = []
	buffer = ""
	hits: dict[tuple[str, str], list[str]] = {}
	for char in text:
		if char == "{":
			stack.append(" ".join(buffer.split()))
			buffer = ""
		elif char == "}":
			stack.pop()
			buffer = ""
		elif char == ";":
			match = re.match(r"\s*(--[\w-]+)\s*:", buffer)
			if match and match.group(1) in names and stack and not stack[-1].startswith("@"):
				context = stack[-2] if len(stack) > 1 else ""
				hits.setdefault((context, stack[-1]), []).append(match.group(1))
			buffer = ""
		else:
			buffer += char
	lines = []
	for (context, selectors), declared in hits.items():
		for selector in _split_top(selectors, ","):
			spec = specificity(selector)
			compound = subject(selector)
			kind = "ROOT-CAPABLE" if root_capable(compound) else "needs a class/type html does not have"
			lines.append(
				f"{context or '-':34} {str(spec):10} {kind:38} {len(declared):3} var(s) e.g. {declared[0]:22} {selector.strip()[:90]}"
			)
	return lines


def scan_tree(root: Path, names: set[str]) -> list[str]:
	hits: dict[tuple[str, str], list[str]] = {}
	for path in sorted(root.rglob("*")):
		if path.suffix not in {".scss", ".css"} or "node_modules" in path.parts or "dist" in path.parts:
			continue
		text = path.read_text(encoding="utf-8", errors="replace")
		text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
		text = re.sub(r"(?m)^\s*//.*$", "", text)
		stack: list[str] = []
		buffer = ""
		for char in text:
			if char == "{":
				stack.append(" ".join(buffer.split()))
				buffer = ""
			elif char == "}":
				if stack:
					stack.pop()
				buffer = ""
			elif char == ";":
				match = re.match(r"\s*(--[\w-]+)\s*:", buffer)
				if match and match.group(1) in names:
					hits.setdefault((str(path.relative_to(root)), " >> ".join(stack)), []).append(match.group(1))
				buffer = ""
			else:
				buffer += char
	return [f"{file} | {stack[:140]} | {len(declared)} var(s) e.g. {declared[0]}" for (file, stack), declared in hits.items()]


def main(argv: list[str]) -> int:
	if len(argv) != 3 or argv[1] not in {"css", "tree"}:
		print(__doc__)
		return 2
	names = mapped_names()
	print(f"{len(names)} mapped variable names")
	lines = scan_css(Path(argv[2]), names) if argv[1] == "css" else scan_tree(Path(argv[2]), names)
	print("\n".join(lines))
	return 0


if __name__ == "__main__":
	sys.exit(main(sys.argv))
