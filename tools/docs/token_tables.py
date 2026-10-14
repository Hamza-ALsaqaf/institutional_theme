"""Write the generated token tables into docs/DESIGN_SYSTEM.md.

Reads, and never edits: institutional_theme/midad/generated/model.json, the
generated SCSS partials in institutional_theme/public/scss/generated/, and the
audit files in docs/audits/. Writes only the region between the tokens markers
in docs/DESIGN_SYSTEM.md. Standard library only.

Run from the repository root:

	python3 tools/docs/token_tables.py

Running it twice gives identical output. Rows that have no source, or whose
sources disagree, are left out and listed under "Could not fill".
"""

import json
import re
import sys
from pathlib import Path
from typing import Any

BEGIN = "<!-- tokens:begin -->"
END = "<!-- tokens:end -->"
TITLE = "# Midad design system"
NOTE = "The prose of this document is written in Phase 5. The tables between the markers are generated."

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / "docs" / "DESIGN_SYSTEM.md"
MODEL = ROOT / "institutional_theme" / "midad" / "generated" / "model.json"
GENERATED = ROOT / "institutional_theme" / "public" / "scss" / "generated"
TOKENS_SCSS = GENERATED / "_tokens.scss"
FRAPPE_SCSS = GENERATED / "_frappe_map.scss"
SCALE_SCSS = GENERATED / "_scale.scss"
CONTRAST = ROOT / "docs" / "audits" / "contrast.json"
PRESETS = ROOT / "docs" / "audits" / "presets.txt"
PARITY = ROOT / "docs" / "audits" / "parity.txt"
COLOUR_VISION = ROOT / "docs" / "audits" / "colour_vision.txt"

TOKENS_HEADERS = {
	'html [data-theme="light"] {': "light",
	'html [data-theme="dark"] {': "dark",
}
DECL = re.compile(r"^\s*(--[A-Za-z0-9-]+):\s*(.+);$")
VAR_REF = re.compile(r"var\((--ins-[a-z0-9-]+)\)")
PRESET_LINE = re.compile(r"^(\w+): (shipped|DROPPED)\b")
PARITY_TOTAL = re.compile(r"^\d+ checks, \d+ failed$")
VISION_KEEP = re.compile(
	r"^(Distance:|Status check|Chart check|== |\s+closest approach|\s+FAIL|Status failures|Chart gaps)"
)
SCALE_GROUPS = ["Type", "Spacing", "Radius", "Motion", "Component sizes, focus and layers"]

NOT_FILLED: list[str] = []


def rel(path: Path) -> str:
	return path.relative_to(ROOT).as_posix()


def source(*paths: Path) -> str:
	names = ", ".join(f"`{rel(path)}`" for path in paths)
	return f"Generated from {names}."


def read_text(path: Path) -> str:
	if not path.is_file():
		sys.exit(f"missing input: {rel(path)}")
	return path.read_text(encoding="utf-8")


def num(value: Any) -> str:
	return json.dumps(value)


def verdict(passed: bool) -> str:
	return "pass" if passed else "fail"


def table(headers: list[str], rows: list[list[str]]) -> list[str]:
	out = ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
	for row in rows:
		out.append("| " + " | ".join(cell.replace("|", "\\|") for cell in row) + " |")
	return out


def read_blocks(path: Path, headers: dict[str, str]) -> dict[str, dict[str, str]]:
	"""Map each top-level selector block (matched by its header line) to its declarations."""
	blocks: dict[str, dict[str, str]] = {name: {} for name in headers.values()}
	current: str | None = None
	for line in read_text(path).splitlines():
		if current is None:
			current = headers.get(line)
			continue
		if line == "}":
			current = None
			continue
		match = DECL.match(line)
		if match:
			blocks[current][match.group(1)] = match.group(2)
	return blocks


def read_frappe_map(path: Path) -> dict[str, dict[str, str]]:
	"""Light and effective dark declarations of `_frappe_map.scss`.

	The first top-level block declares every variable with its light value; the second holds only the
	variables whose dark value differs, so the effective dark map is the first overlaid with the second.
	"""
	top_level: list[dict[str, str]] = []
	current: dict[str, str] | None = None
	for line in read_text(path).splitlines():
		if current is None:
			if line.endswith(" {") and not line.startswith(("\t", "@")):
				current = {}
			continue
		if line == "}":
			top_level.append(current)
			current = None
			continue
		match = DECL.match(line)
		if match:
			current[match.group(1)] = match.group(2)
	if len(top_level) != 2:
		sys.exit(
			f"expected the shared and the dark block in {rel(path)}, found {len(top_level)} top-level blocks"
		)
	shared, delta = top_level
	if not set(delta) <= set(shared):
		sys.exit(f"the dark block of {rel(path)} declares names the shared block does not")
	return {"light": shared, "dark": {**shared, **delta}}


def declared_values(path: Path) -> dict[str, str]:
	values: dict[str, str] = {}
	for line in read_text(path).splitlines():
		match = DECL.match(line)
		if match:
			values[match.group(1)] = match.group(2)
	return values


def ramps_section(
	model: dict[str, Any], light: dict[str, str], dark: dict[str, str]
) -> tuple[list[str], int]:
	lines = ["## 1. Primitive ramps", "", source(MODEL, TOKENS_SCSS), ""]
	count = 0
	for name, ramp in model["ramps"].items():
		steps = ramp.get("steps", model["steps"])
		pairs: list[tuple[str, str, str]] = []
		for step in steps:
			var = f"--ins-{name}-{step}"
			if var not in light or var not in dark:
				NOT_FILLED.append(f"ramp step `{var}`: not emitted in both blocks of _tokens.scss")
				continue
			pairs.append((step, light[var], dark[var]))
		same = all(light_hex == dark_hex for _, light_hex, dark_hex in pairs)
		if same:
			headers = ["Step", "Light hex"]
			rows = [[step, light_hex] for step, light_hex, _ in pairs]
		else:
			headers = ["Step", "Light hex", "Dark hex"]
			rows = [[step, light_hex, dark_hex] for step, light_hex, dark_hex in pairs]
		count += len(rows)
		lines.append(f"### {name}")
		lines.append("")
		lines.append(f"Dark block equals Light block for every step: {'yes' if same else 'no'}.")
		lines.append("")
		lines.extend(table(headers, rows))
		lines.append("")
	return lines, count


def semantic_section(
	model: dict[str, Any], light: dict[str, str], dark: dict[str, str]
) -> tuple[list[str], int]:
	lines = ["## 2. Semantic tokens", "", source(MODEL, TOKENS_SCSS), ""]
	rows: list[list[str]] = []
	for key, spec in model["semantic"].items():
		var = f"--ins-{key}"
		if var not in light or var not in dark:
			NOT_FILLED.append(f"semantic token `{var}`: not emitted in both blocks of _tokens.scss")
			continue
		rows.append([f"`{var}`", spec["group"], light[var], dark[var]])
	lines.extend(table(["Token", "Group", "Light value", "Dark value"], rows))
	lines.append("")
	return lines, len(rows)


def resolve(raw: str, values: dict[str, str]) -> tuple[str, str] | None:
	"""Return (source, value) for one Frappe declaration in one mode, or None if unresolved."""
	match = VAR_REF.fullmatch(raw)
	if match is None:
		return "literal", raw
	target = match.group(1)
	if target not in values:
		return None
	return f"`{target}`", values[target]


def frappe_section(
	model: dict[str, Any],
	frappe_light: dict[str, str],
	frappe_dark: dict[str, str],
	light: dict[str, str],
	dark: dict[str, str],
) -> tuple[list[str], int]:
	lines = ["## 3. Frappe variable map", "", source(MODEL, FRAPPE_SCSS, TOKENS_SCSS), ""]
	lines.append(
		"Rows follow the emitted light block of `_frappe_map.scss`; every name in model.json `frappe.vars` must appear there."
	)
	lines.append("")
	variables = list(frappe_light)
	for var in model["frappe"]["vars"]:
		if var not in frappe_light or var not in frappe_dark:
			NOT_FILLED.append(
				f"Frappe variable `{var}`: in model.json but not emitted in both blocks of _frappe_map.scss"
			)
	for var in sorted(set(frappe_light) ^ set(frappe_dark)):
		NOT_FILLED.append(f"Frappe variable `{var}`: emitted in only one of the light and dark blocks")
	rows: list[list[str]] = []
	for var in variables:
		if var not in frappe_dark:
			continue
		light_cell = resolve(frappe_light[var], light)
		dark_cell = resolve(frappe_dark[var], dark)
		if light_cell is None or dark_cell is None:
			NOT_FILLED.append(
				f"Frappe variable `{var}`: its --ins-* source is not emitted in _tokens.scss or _scale.scss"
			)
			continue
		rows.append([f"`{var}`", light_cell[0], light_cell[1], dark_cell[0], dark_cell[1]])
	lines.extend(table(["Frappe variable", "Light source", "Light value", "Dark source", "Dark value"], rows))
	lines.append("")
	return lines, len(rows)


def record_key(record: dict[str, Any]) -> tuple[str, str, str]:
	return (record["group"], record["fg"], record["bg"])


def record_consistent(record: dict[str, Any]) -> bool:
	if "min" in record:
		expected = record["ratio"] >= record["min"]
	else:
		expected = record["ratio"] <= record["max"]
	return expected == record["pass"]


def contrast_section(contrast: dict[str, Any]) -> tuple[list[str], int]:
	midad = contrast["presets"]["midad"]
	light_records = midad["modes"]["light"]
	dark_index = {record_key(record): record for record in midad["modes"]["dark"]}
	lines = ["## 4. Contrast", "", "### midad, every pair", "", source(CONTRAST), ""]
	rows: list[list[str]] = []
	for record in light_records:
		dark_record = dark_index.get(record_key(record))
		if dark_record is None:
			NOT_FILLED.append(f"contrast pair {record_key(record)}: no Dark record")
			continue
		if not (record_consistent(record) and record_consistent(dark_record)):
			NOT_FILLED.append(f"contrast pair {record_key(record)}: recorded pass disagrees with the ratio")
			continue
		if "min" in record:
			required = f"min {num(record['min'])}"
		else:
			required = f"max {num(record['max'])}"
		rows.append(
			[
				record["group"],
				f"`{record['fg']}`",
				f"`{record['bg']}`",
				required,
				num(record["ratio"]),
				verdict(record["pass"]),
				num(dark_record["ratio"]),
				verdict(dark_record["pass"]),
			]
		)
	lines.extend(
		table(
			[
				"Group",
				"Foreground",
				"Background",
				"Required ratio",
				"Light ratio",
				"Light",
				"Dark ratio",
				"Dark",
			],
			rows,
		)
	)
	lines.append("")
	return lines, len(rows)


def parse_presets(text: str) -> tuple[list[str], dict[str, str], dict[str, list[str]]]:
	shipped: list[str] = []
	status: dict[str, str] = {}
	reasons: dict[str, list[str]] = {}
	current: str | None = None
	for line in text.splitlines():
		if line.startswith("Shipped:"):
			shipped = [name.strip() for name in line.split(":", 1)[1].split(",") if name.strip()]
			continue
		match = PRESET_LINE.match(line)
		if match:
			current = match.group(1)
			status[current] = match.group(2)
			reasons[current] = []
			continue
		if line.startswith("  - ") and current is not None:
			reasons[current].append(line[4:].strip())
	return shipped, status, reasons


def presets_section(contrast: dict[str, Any]) -> tuple[list[str], int]:
	shipped, status, reasons = parse_presets(read_text(PRESETS))
	lines = ["### Preset summary", "", source(CONTRAST, PRESETS), ""]
	rows: list[list[str]] = []
	for name, preset in contrast["presets"].items():
		json_status = "shipped" if preset["shipped"] else "dropped"
		txt_status = {"shipped": "shipped", "DROPPED": "dropped"}.get(status.get(name, ""), "absent")
		if json_status != txt_status or (name in shipped) != preset["shipped"]:
			NOT_FILLED.append(
				f"preset {name}: contrast.json says {json_status}, presets.txt says {txt_status}"
			)
			continue
		light_count = len(preset["modes"]["light"])
		dark_count = len(preset["modes"]["dark"])
		reason = "; ".join(reasons.get(name, [])) or "-"
		rows.append([name, json_status, f"{light_count} / {dark_count}", num(preset["failures"]), reason])
	lines.extend(
		table(
			["Preset", "Status", "Pairs per mode (Light / Dark)", "Failures (contrast.json)", "Reason"], rows
		)
	)
	lines.append("")
	return lines, len(rows)


def scale_group(key: str) -> str:
	if key.startswith(("font-", "text-", "leading", "weight-")):
		return "Type"
	if key.startswith("space-"):
		return "Spacing"
	if key.startswith("radius-"):
		return "Radius"
	if key.startswith("duration") or key == "ease":
		return "Motion"
	return "Component sizes, focus and layers"


def scale_section(model: dict[str, Any], declared: dict[str, str]) -> tuple[list[str], int]:
	lines = ["## 5. Scale tokens", "", source(MODEL, SCALE_SCSS), ""]
	lines.append("A dash means model.json defines no value for that block.")
	lines.append("")
	groups: dict[str, list[list[str]]] = {group: [] for group in SCALE_GROUPS}
	for key, spec in model["scale"].items():
		var = f"--ins-{key}"
		if var not in declared:
			NOT_FILLED.append(f"scale token `{var}`: not declared in _scale.scss")
			continue
		groups[scale_group(key)].append(
			[f"`{var}`", spec["value"], spec.get("compact", "-"), spec.get("coarse", "-")]
		)
	count = 0
	for group in SCALE_GROUPS:
		lines.append(f"### {group}")
		lines.append("")
		lines.extend(table(["Token", "Value", "Compact", "Coarse"], groups[group]))
		lines.append("")
		count += len(groups[group])
	return lines, count


def vision_section() -> list[str]:
	kept = [line.rstrip() for line in read_text(COLOUR_VISION).splitlines() if VISION_KEEP.match(line)]
	lines = ["## 6. Colour-vision summary", "", source(COLOUR_VISION), "", "```text"]
	lines.extend(kept)
	lines.append("```")
	lines.append("")
	parity_totals = [line for line in read_text(PARITY).splitlines() if PARITY_TOTAL.match(line)]
	if parity_totals:
		lines.append(f"Parity audit, from `{rel(PARITY)}`: {parity_totals[0]}.")
	else:
		NOT_FILLED.append(f"parity total line not found in {rel(PARITY)}")
	lines.append("")
	return lines


def not_filled_section() -> list[str]:
	lines = ["## Could not fill", ""]
	if not NOT_FILLED:
		lines.append("None.")
	for entry in NOT_FILLED:
		lines.append(f"- {entry}")
	lines.append("")
	return lines


def write_region(body: str) -> None:
	region = f"{BEGIN}\n{body}{END}\n"
	if DOC.is_file():
		text = DOC.read_text(encoding="utf-8")
	else:
		text = f"{TITLE}\n\n{NOTE}\n\n"
	if BEGIN in text and END in text:
		start = text.index(BEGIN)
		end = text.index(END) + len(END)
		if text[end : end + 1] == "\n":
			end += 1
		text = text[:start] + region + text[end:]
	else:
		text = text.rstrip("\n") + "\n\n" + region
	DOC.parent.mkdir(parents=True, exist_ok=True)
	DOC.write_text(text, encoding="utf-8")


def main() -> int:
	model = json.loads(read_text(MODEL))
	contrast = json.loads(read_text(CONTRAST))
	tokens = read_blocks(TOKENS_SCSS, TOKENS_HEADERS)
	frappe = read_frappe_map(FRAPPE_SCSS)
	light, dark = tokens["light"], tokens["dark"]
	if not light or not dark:
		sys.exit("no light or dark block parsed from _tokens.scss")
	scale_values = declared_values(SCALE_SCSS)
	light_all = {**scale_values, **light}
	dark_all = {**scale_values, **dark}
	ramp_lines, ramp_rows = ramps_section(model, light, dark)
	semantic_lines, semantic_rows = semantic_section(model, light, dark)
	frappe_lines, frappe_rows = frappe_section(model, frappe["light"], frappe["dark"], light_all, dark_all)
	contrast_lines, contrast_rows = contrast_section(contrast)
	preset_lines, preset_rows = presets_section(contrast)
	scale_lines, scale_rows = scale_section(model, scale_values)
	vision_lines = vision_section()
	body_lines = [
		*ramp_lines,
		*semantic_lines,
		*frappe_lines,
		*contrast_lines,
		*preset_lines,
		*scale_lines,
		*vision_lines,
		*not_filled_section(),
	]
	write_region("\n".join(body_lines) + "\n")
	print(
		f"ramp rows {ramp_rows}, semantic rows {semantic_rows}, frappe rows {frappe_rows}, "
		f"contrast rows {contrast_rows}, preset rows {preset_rows}, scale rows {scale_rows}, "
		f"not filled {len(NOT_FILLED)}"
	)
	print(f"wrote {rel(DOC)}")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
