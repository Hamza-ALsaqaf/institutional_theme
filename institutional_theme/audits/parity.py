"""Parity audit of the generated stylesheets (ADR 0003).

Checks, on the files the build wrote:

* every generated file starts with the "generated, do not edit" header;
* each family has light, dark and automatic blocks at the exact selector shapes;
* the three blocks hold the same keys in the same order;
* `color-scheme` is `light`, `dark` and `light dark` in the base tokens, and absent elsewhere;
* palette files hold custom properties only (no `color-scheme`, no `forced-color-adjust`);
* no `!important`, `color-mix()` or relative-colour syntax;
* every `var(--ins-*)` the Frappe map uses is defined by a generated file or a font partial;
* the Frappe map sets exactly the variables of tokens.json, and the scale blocks nest.

It also checks the model: Light and Dark define the same semantic keys in every preset.
Never imports Frappe.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from institutional_theme.midad import emit
from institutional_theme.midad import model as model_mod
from institutional_theme.midad.model import FONT_TOKENS, MODES, Model


@dataclass
class Check:
	"""One named check with its outcome and, when it failed, the reasons."""

	name: str
	problems: list[str] = field(default_factory=list)

	@property
	def passed(self) -> bool:
		return not self.problems


@dataclass
class Block:
	"""A parsed CSS rule: selectors, declarations and the media query it sits in (if any)."""

	selectors: tuple[str, ...]
	declarations: list[tuple[str, str]]
	media: str | None


_COMMENT = re.compile(r"/\*.*?\*/|//[^\n]*", re.DOTALL)
_FORBIDDEN = (
	(re.compile(r"!important"), "uses !important"),
	(re.compile(r"color-mix\("), "uses color-mix()"),
	(re.compile(r"\boklch\("), "uses oklch()"),
	(re.compile(r"\bfrom\s+(?:#|rgb|hsl|var)"), "uses relative colour syntax"),
)
_VAR_INS = re.compile(r"var\(\s*(--ins-[a-z0-9-]+)")


def strip_comments(text: str) -> str:
	return _COMMENT.sub("", text)


def parse_blocks(text: str) -> list[Block]:
	"""Parse generated SCSS (rules and one level of `@media`) into blocks."""
	source = strip_comments(text)
	blocks: list[Block] = []

	def parse(start: int, end: int, media: str | None) -> None:
		position = start
		while position < end:
			brace = source.find("{", position, end)
			if brace == -1:
				if source[position:end].strip():
					raise ValueError(f"Unparsed text: {source[position:end].strip()[:60]}")
				return
			prelude = source[position:brace].strip()
			depth = 1
			cursor = brace + 1
			while depth:
				nxt = min(
					(i for i in (source.find("{", cursor, end), source.find("}", cursor, end)) if i != -1),
					default=-1,
				)
				if nxt == -1:
					raise ValueError(f"Unbalanced braces after: {prelude[:60]}")
				depth += 1 if source[nxt] == "{" else -1
				cursor = nxt + 1
			inner_end = cursor - 1
			if prelude.startswith("@media"):
				parse(brace + 1, inner_end, prelude.removeprefix("@media").strip())
			else:
				declarations = []
				for part in source[brace + 1 : inner_end].split(";"):
					if part.strip():
						prop, _, value = part.partition(":")
						declarations.append((prop.strip(), value.strip()))
				selectors = tuple(s.strip() for s in prelude.split(","))
				blocks.append(Block(selectors, declarations, media))
			position = cursor

	parse(0, len(source), None)
	return blocks


def _keys(block: Block) -> list[str]:
	return [prop for prop, _ in block.declarations if prop != "color-scheme"]


def _scheme(block: Block) -> list[str]:
	return [value for prop, value in block.declarations if prop == "color-scheme"]


def check_family(
	name: str, text: str, family: str, *, color_scheme: bool, props: str = "--ins-"
) -> list[Check]:
	"""Selector shapes, parity and `color-scheme` of one file made by `emit.emit_family`."""
	shape = emit.SHAPES[family]
	prefix = f"{name}"
	checks = [
		Check(f"{prefix}: selector shapes"),
		Check(f"{prefix}: key-set parity"),
		Check(f"{prefix}: color-scheme"),
	]
	try:
		blocks = parse_blocks(text)
	except ValueError as error:
		checks[0].problems.append(f"cannot parse: {error}")
		return checks
	expected = 4 if color_scheme else 3
	if len(blocks) != expected:
		checks[0].problems.append(f"expected {expected} blocks, found {len(blocks)}")
		return checks
	light, dark, automatic = blocks[0], blocks[1], blocks[2]
	for label, block, selectors, media in (
		("light", light, shape["light"], None),
		("dark", dark, shape["dark"], None),
		("automatic", automatic, shape["automatic"], emit.AUTOMATIC_MEDIA),
	):
		if block.selectors != selectors:
			checks[0].problems.append(f"{label} selectors {block.selectors} != {selectors}")
		if block.media != media:
			checks[0].problems.append(f"{label} media {block.media!r} != {media!r}")
	if _keys(light) != _keys(dark):
		only_light = sorted(set(_keys(light)) - set(_keys(dark)))
		only_dark = sorted(set(_keys(dark)) - set(_keys(light)))
		checks[1].problems.append(
			f"light/dark differ; only light: {only_light[:5]}, only dark: {only_dark[:5]}"
		)
	if _keys(automatic) != _keys(dark):
		checks[1].problems.append("automatic block keys differ from dark")
	if [v for p, v in automatic.declarations] != [v for p, v in dark.declarations if p != "color-scheme"]:
		checks[1].problems.append("automatic block values differ from dark")
	if len(set(_keys(light))) != len(_keys(light)):
		checks[1].problems.append("a key is declared twice")
	bad = [k for k in _keys(light) if not k.startswith("--")]
	if bad:
		checks[1].problems.append(f"non-custom properties: {bad[:5]}")
	if color_scheme:
		tail = blocks[3]
		if _scheme(light) != ["light"]:
			checks[2].problems.append(f"light block color-scheme {_scheme(light)}")
		if _scheme(dark) != ["dark"]:
			checks[2].problems.append(f"dark block color-scheme {_scheme(dark)}")
		if (
			tail.selectors != shape["automatic"]
			or tail.media is not None
			or tail.declarations != [("color-scheme", "light dark")]
		):
			checks[2].problems.append("automatic color-scheme block missing or malformed")
	else:
		for label, block in (("light", light), ("dark", dark), ("automatic", automatic)):
			if _scheme(block):
				checks[2].problems.append(f"{label} block sets color-scheme")
	return checks


def check_forbidden(name: str, text: str) -> Check:
	check = Check(f"{name}: no !important, color-mix, oklch or relative colour")
	code = strip_comments(text)
	for pattern, message in _FORBIDDEN:
		if pattern.search(code):
			check.problems.append(message)
	return check


def check_header(name: str, text: str) -> Check:
	check = Check(f"{name}: generated header")
	first = text.splitlines()[0] if text else ""
	if emit.HEADER_TEXT not in first:
		check.problems.append(f"first line is {first[:80]!r}")
	return check


def check_scale(name: str, text: str) -> list[Check]:
	checks = [
		Check(f"{name}: selector shapes"),
		Check(f"{name}: compact and coarse keys nest in comfortable"),
	]
	blocks = parse_blocks(text)
	if len(blocks) != 3:
		checks[0].problems.append(f"expected 3 blocks, found {len(blocks)}")
		return checks
	comfortable, compact, coarse = blocks
	if comfortable.selectors != (emit.SCALE_COMFORTABLE,) or comfortable.media is not None:
		checks[0].problems.append("comfortable block selector")
	if compact.selectors != (emit.SCALE_COMPACT,) or compact.media is not None:
		checks[0].problems.append("compact block selector")
	if coarse.selectors != emit.SCALE_COARSE or coarse.media != emit.SCALE_COARSE_MEDIA:
		checks[0].problems.append("coarse block selector or media")
	base = set(_keys(comfortable))
	for label, block in (("compact", compact), ("coarse", coarse)):
		extra = sorted(set(_keys(block)) - base)
		if extra:
			checks[1].problems.append(f"{label} sets keys absent from comfortable: {extra[:5]}")
	return checks


def check_palette_file(name: str, text: str, base_keys: set[str]) -> list[Check]:
	"""A palette bundle: family checks plus custom properties only, inside the rtl ignore pair."""
	checks = check_family(name, text, "palette", color_scheme=False)
	only = Check(f"{name}: custom properties only, all defined by the base tokens")
	if emit.RTL_BEGIN not in text or emit.RTL_END not in text:
		only.problems.append("rtl:begin:ignore / rtl:end:ignore pair missing")
	for block in parse_blocks(text):
		for prop, value in block.declarations:
			if not prop.startswith("--ins-"):
				only.problems.append(f"non --ins- property {prop}")
			elif prop not in base_keys:
				only.problems.append(f"{prop} is not a base token")
			if "var(" in value:
				only.problems.append(f"{prop} is not a precomputed value")
	checks.append(only)
	return checks


def audit_model(model: Model) -> list[Check]:
	"""Light and Dark define the same semantic keys in every preset."""
	checks = []
	for name in model["palettes"]["presets"]:
		check = Check(f"model preset {name}: light and dark define the same keys")
		built = model_mod.palette(model, name)
		light, dark = set(built.tokens["light"]), set(built.tokens["dark"])
		if light != dark:
			check.problems.append(f"differ: {sorted(light ^ dark)[:5]}")
		for mode in MODES:
			if set(built.tokens[mode]) != set(model["semantic"]):
				check.problems.append(f"{mode} keys differ from the semantic list")
		checks.append(check)
	frappe = Check("model: every Frappe variable defines light and dark")
	for var, entry in model["frappe"]["vars"].items():
		if not {"light", "dark"} <= set(entry) or set(entry) - {"light", "dark", "scope"}:
			frappe.problems.append(f"{var}: {sorted(entry)}")
	checks.append(frappe)
	return checks


def audit_files(model: Model, scss_dir: Path) -> list[Check]:
	"""Audit the generated partials and every palette bundle in a directory."""
	checks: list[Check] = []
	paths = {p.name: p for p in sorted(scss_dir.glob("*.scss"))}
	required = [
		"_tokens.scss",
		"_frappe_map.scss",
		"_frappe_map_light.scss",
		"_scale.scss",
		"_literals.scss",
	]
	missing = Check("generated files present")
	for name in required:
		if name not in paths:
			missing.problems.append(f"{name} is missing")
	for name in model["palettes"]["shipped"]:
		if name != model["palettes"]["default"] and f"ins_palette_{name}.bundle.scss" not in paths:
			missing.problems.append(f"ins_palette_{name}.bundle.scss is missing")
	for name in paths:
		if name.startswith("ins_palette_"):
			preset = name.removeprefix("ins_palette_").removesuffix(".bundle.scss")
			if preset not in model["palettes"]["shipped"] or preset == model["palettes"]["default"]:
				missing.problems.append(f"{name} exists for a preset that is not shipped (or is the default)")
	checks.append(missing)
	if missing.problems:
		return checks

	texts = {name: path.read_text(encoding="utf-8") for name, path in paths.items()}
	for name, text in texts.items():
		checks.append(check_header(name, text))
		checks.append(check_forbidden(name, text))

	checks += check_family("_tokens.scss", texts["_tokens.scss"], "base", color_scheme=True)
	checks += check_family("_frappe_map.scss", texts["_frappe_map.scss"], "palette", color_scheme=False)
	checks += check_scale("_scale.scss", texts["_scale.scss"])

	base_keys = {prop for block in parse_blocks(texts["_tokens.scss"])[:1] for prop in _keys(block)}
	scale_keys = {prop for block in parse_blocks(texts["_scale.scss"])[:1] for prop in _keys(block)}
	provided = base_keys | scale_keys | {f"--ins-{token}" for token in FONT_TOKENS}

	refs = Check("_frappe_map.scss: every var(--ins-*) is defined")
	for block in parse_blocks(texts["_frappe_map.scss"])[:1]:
		for prop, value in block.declarations:
			for ref in _VAR_INS.findall(value):
				if ref not in provided:
					refs.problems.append(f"{prop} -> {ref}")
	checks.append(refs)

	names = Check("_frappe_map.scss: sets the variables of tokens.json and nothing else")
	expected = {name for name, _ in model_mod.frappe_map(model).declarations["light"]}
	found = {prop for block in parse_blocks(texts["_frappe_map.scss"])[:1] for prop in _keys(block)}
	if found != expected:
		names.problems.append(f"missing {sorted(expected - found)[:5]}, extra {sorted(found - expected)[:5]}")
	checks.append(names)

	website = Check("_frappe_map_light.scss: the light map without the desk-only names, nothing else")
	expected_web = [name for name, _ in model_mod.frappe_map(model, model_mod.WEB).declarations["light"]]
	blocks = parse_blocks(texts["_frappe_map_light.scss"])
	found_web = [prop for block in blocks[:1] for prop, _ in block.declarations]
	if len(blocks) != 1:
		website.problems.append(f"{len(blocks)} blocks, expected the light block only")
	if found_web != expected_web:
		website.problems.append(
			f"missing {sorted(set(expected_web) - set(found_web))[:5]}, extra {sorted(set(found_web) - set(expected_web))[:5]}"
		)
	desk_read = [name for name in model_mod.desk_only(model) if name in found_web]
	if desk_read:
		website.problems.append(f"desk-only names present: {desk_read[:5]}")
	checks.append(website)

	collisions = Check("--ins-* names are unique across colour and scale tokens")
	overlap = base_keys & scale_keys
	if overlap:
		collisions.problems.append(f"defined as colour and scale: {sorted(overlap)[:5]}")
	checks.append(collisions)

	for name in sorted(paths):
		if name.startswith("ins_palette_"):
			checks += check_palette_file(name, texts[name], base_keys)
	return checks


def render_text(checks: list[Check]) -> str:
	failed = [c for c in checks if not c.passed]
	lines = [
		"Parity audit",
		"Generated by python -m institutional_theme.audits; do not edit.",
		"",
		"Key-set parity between light, dark and automatic blocks; selector shapes; color-scheme;",
		"custom-property-only palette files; resolvable references (ADR 0003).",
		"",
	]
	for check in checks:
		lines.append(f"{'ok  ' if check.passed else 'FAIL'} {check.name}")
		lines += [f"       {problem}" for problem in check.problems]
	lines += ["", f"{len(checks)} checks, {len(failed)} failed"]
	return "\n".join(lines) + "\n"
