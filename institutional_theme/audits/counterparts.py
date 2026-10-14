"""Counterpart audit (ADR 0011 R5, finding F2): names that replaced one another between versions.

Frappe 16.32.0 and v16.52.0 read different names for the same role (`--surface-menu-bar` became
`--surface-sidebar`; `--border-radius` became `--radius`). The theme maps both sides, and
`data/counterparts.json` lists each pair with the claim that the two sides take the same value or
a different one, and why. The table is maintained by hand and reviewed with the token map. This audit
fails when:

- F2(i)   the older name is neither declared nor read in the older version's snapshot, or the newer
          name is not read in the newer version's snapshot, so the table cannot go stale;
- F2(ii)  the theme maps one side of a pair and not the other;
- F2(iii) a `same` pair differs in its Light or Dark value for the default preset, or a `differs` pair
          has an empty `why`.

It also reports, for information only, the names one version's core reads that the other does not
and that are neither mapped nor listed in the table (`unmapped_reads`). Never imports Frappe.
"""

from __future__ import annotations

import json
import re
import textwrap
from dataclasses import dataclass
from pathlib import Path

from institutional_theme.midad import model as model_mod
from institutional_theme.midad.model import Model

from .dead_tokens import DATA_DIR, CoreVars, watched_variables

COUNTERPARTS_PATH = DATA_DIR / "counterparts.json"
OLD = "16.32.0"
NEW = "16.52.0"
VALUES = ("same", "differs")

_VAR = re.compile(r"var\(--ins-([a-z0-9-]+)\)")
_STEP = re.compile(r"^([a-z]+)-(\d+)$")


@dataclass(frozen=True)
class Pair:
	"""One row of the table: the name in each version and what the theme gives the two."""

	old: str
	new: str
	value: str
	why: str

	def label(self) -> str:
		return f"{self.old} ({OLD}) / {self.new} ({NEW})"


@dataclass(frozen=True)
class Finding:
	"""A failed check. `rule` is `F2(i)`, `F2(ii)`, `F2(iii)` or `table`."""

	rule: str
	pair: str
	message: str


def load_pairs(path: Path = COUNTERPARTS_PATH) -> list[Pair]:
	"""The table. Raises `ValueError` for a malformed row, so a typo cannot pass silently."""
	data = json.loads(path.read_text(encoding="utf-8"))
	pairs: list[Pair] = []
	seen: set[tuple[str, str]] = set()
	for index, row in enumerate(data["pairs"], start=1):
		missing = [key for key in (OLD, NEW, "value") if not str(row.get(key, "")).strip()]
		if missing:
			raise ValueError(f"counterparts row {index}: missing {', '.join(missing)}")
		if row["value"] not in VALUES:
			raise ValueError(f"counterparts row {index}: value must be one of {', '.join(VALUES)}")
		for key in (OLD, NEW):
			if not row[key].startswith("--"):
				raise ValueError(f"counterparts row {index}: {row[key]!r} is not a custom property")
		key = (row[OLD], row[NEW])
		if key in seen:
			raise ValueError(f"counterparts row {index}: duplicate pair {key[0]} / {key[1]}")
		seen.add(key)
		pairs.append(Pair(row[OLD], row[NEW], row["value"], str(row.get("why", "")).strip()))
	return pairs


def _expand(model: Model, palette: model_mod.Palette, text: str, mode: str) -> str:
	"""A generated declaration with every `var(--ins-x)` replaced by its value for the palette."""

	def value(match: re.Match[str]) -> str:
		name = match.group(1)
		if name in palette.tokens[mode]:
			return palette.tokens[mode][name]
		step = _STEP.match(name)
		if step and step.group(1) in palette.ramps and step.group(2) in palette.ramps[step.group(1)]:
			return palette.ramps[step.group(1)][step.group(2)]
		if name in model["scale"]:
			return model["scale"][name]["value"]
		return match.group(0)

	return " ".join(_VAR.sub(value, text).split())


def values_of(model: Model, name: str) -> dict[str, tuple[str, str]]:
	"""`{mode: (declaration, resolved value)}` of a mapped variable for the default preset."""
	fmap = model_mod.frappe_map(model)
	palette = model_mod.palette(model, model["palettes"]["default"])
	found: dict[str, tuple[str, str]] = {}
	for mode in model_mod.MODES:
		text = dict(fmap.declarations[mode])[name]
		found[mode] = (text, _expand(model, palette, text, mode))
	return found


def check(model: Model, pairs: list[Pair], cores: dict[str, CoreVars]) -> list[Finding]:
	"""Every F2 finding. `cores` maps a version to its core (a snapshot or a live scan)."""
	findings: list[Finding] = []
	mapped = {name for name, _ in model_mod.frappe_map(model).declarations["light"]}
	for version in (OLD, NEW):
		if version not in cores:
			findings.append(
				Finding("table", version, f"no core variables for {version}: cannot check the table")
			)
	for pair in pairs:
		if OLD in cores:
			core = cores[OLD]
			if pair.old not in core.declared and pair.old not in core.read:
				findings.append(
					Finding(
						"F2(i)",
						pair.label(),
						f"{pair.old} is neither declared nor read in the {OLD} snapshot",
					)
				)
		if NEW in cores and pair.new not in cores[NEW].read:
			findings.append(Finding("F2(i)", pair.label(), f"{pair.new} is not read in the {NEW} snapshot"))
		old_mapped, new_mapped = pair.old in mapped, pair.new in mapped
		if old_mapped != new_mapped:
			only, other = (pair.old, pair.new) if old_mapped else (pair.new, pair.old)
			findings.append(
				Finding(
					"F2(ii)",
					pair.label(),
					f"the theme maps {only} but not {other}: one version stays unthemed",
				)
			)
		if pair.value == "differs" and not pair.why:
			findings.append(Finding("F2(iii)", pair.label(), "a differs pair needs a why"))
		if pair.value == "same" and old_mapped and new_mapped:
			old_values, new_values = values_of(model, pair.old), values_of(model, pair.new)
			for mode in model_mod.MODES:
				if old_values[mode][1] != new_values[mode][1]:
					findings.append(
						Finding(
							"F2(iii)",
							pair.label(),
							f"a same pair differs in {mode}: {pair.old} = {old_values[mode][1]}, "
							f"{pair.new} = {new_values[mode][1]}",
						)
					)
	return findings


def stale_differs(model: Model, pairs: list[Pair]) -> list[Pair]:
	"""`differs` pairs whose two sides are in fact equal in both modes (the claim is out of date)."""
	mapped = {name for name, _ in model_mod.frappe_map(model).declarations["light"]}
	stale = []
	for pair in pairs:
		if pair.value != "differs" or pair.old not in mapped or pair.new not in mapped:
			continue
		old_values, new_values = values_of(model, pair.old), values_of(model, pair.new)
		if all(old_values[mode][1] == new_values[mode][1] for mode in model_mod.MODES):
			stale.append(pair)
	return stale


def unmapped_reads(
	model: Model, pairs: list[Pair], cores: dict[str, CoreVars], theme_root: Path
) -> dict[str, list[str]]:
	"""Per version, the names core reads there and in no other audited version that are neither mapped
	nor in the table. Information for the reviewer, never a failure."""
	known = set(watched_variables(model, theme_root))
	for pair in pairs:
		known.update((pair.old, pair.new))
	found: dict[str, list[str]] = {}
	for version, core in cores.items():
		others = [other.read for other_version, other in cores.items() if other_version != version]
		elsewhere = frozenset().union(*others) if others else frozenset()
		found[version] = sorted(core.read - elsewhere - known)
	return dict(sorted(found.items(), key=lambda item: tuple(int(p) for p in re.findall(r"\d+", item[0]))))


def render_text(
	pairs: list[Pair],
	findings: list[Finding],
	unmapped: dict[str, list[str]],
	stale: list[Pair],
) -> str:
	"""The F2 section appended to docs/audits/dead_tokens.txt."""
	same = sum(1 for p in pairs if p.value == "same")
	lines = [
		"",
		"Counterpart table (ADR 0011 R5, finding F2): institutional_theme/audits/data/counterparts.json",
		f"  {len(pairs)} pair(s): {same} same, {len(pairs) - same} differs; {len(findings)} finding(s)",
	]
	for finding in findings:
		lines.append(f"  FAIL {finding.rule} {finding.pair}: {finding.message}")
	for pair in stale:
		lines.append(f"  note: {pair.label()} is marked differs but resolves equal in both modes")
	lines += [
		"",
		"Read by core in one version only, neither mapped nor in the table (information only)",
		"  Each is either resolved through the theme's raw ramps, geometry, or a name no P0 screen needs.",
	]
	for version, names in unmapped.items():
		lines.append(f"  only in {version} ({len(names)}):")
		lines += textwrap.wrap(
			", ".join(names),
			width=104,
			initial_indent="    ",
			subsequent_indent="    ",
			break_on_hyphens=False,
			break_long_words=False,
		)
	return "\n".join(lines) + "\n"
