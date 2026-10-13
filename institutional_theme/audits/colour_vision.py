"""Colour-vision audit: status distinguishability (fatal) and chart series separation (reported).

Distance is the Euclidean distance in OKLab scaled by 100 (`colour.delta_e`), measured after
simulating each deficiency (Machado, Oliveira and Fernandes 2009, severity 1.0) on the sRGB hex.

Two checks, both with one threshold of 5.0:

* Status distinguishability (fatal; a preset that fails is dropped by the build). The primary
  action colour must stay apart from the solid mark (dot, icon) of every chromatic status role
  whose hue lies within 45 degrees of the preset's primary hue, in Light and Dark, under normal
  vision, protanopia, deuteranopia and tritanopia. That is the "primary button against the
  success (or pending) pill" check of tokens.json, written as a rule. The achromatic roles
  (neutral, muted) are excluded: a near-neutral primary such as graphite sits beside them by
  design.
* Chart series (reported; a failure is a known gap, not an error). The minimum distance between
  any two series, for series 1 to 6 (the default chart palette) and 1 to 8, under the four
  visions above and under grayscale. BRIEF 8 requires secondary encodings (direct labels, dash
  and marker patterns), which is the mitigation for a gap.

Never imports Frappe.
"""

from __future__ import annotations

import itertools
import re
from dataclasses import dataclass
from typing import Any

from institutional_theme.midad import colour
from institutional_theme.midad.model import MODES, Model, Palette

STATUS_MIN = 5.0
CHART_MIN = 5.0
HUE_WINDOW = 45.0
STATUS_VISIONS = ("normal", *colour.CVD_TYPES)
CHART_VISIONS = (*STATUS_VISIONS, "grayscale")
CHART_SETS = {"series 1-6": 6, "series 1-8": 8}

_SOLID = re.compile(r"^status-([a-z]+)-solid$")
_RAMP = re.compile(r"^([a-z]+)\.\d+$")


@dataclass(frozen=True)
class Finding:
	"""The closest pair found for one check, mode and vision."""

	check: str  # "status" or "chart"
	preset: str
	scope: str  # the status role, or the chart series set
	mode: str
	vision: str
	a: str
	b: str
	distance: float
	threshold: float
	passed: bool

	@property
	def fatal(self) -> bool:
		"""Only status findings are errors; chart findings are reported gaps."""
		return self.check == "status"

	def describe(self) -> str:
		verdict = "pass" if self.passed else ("FAIL" if self.fatal else "GAP")
		return (
			f"{verdict} {self.check} {self.scope}: {self.a} vs {self.b}, {self.mode} mode, "
			f"{self.vision}: {self.distance:.1f} (needs {self.threshold:.1f})"
		)


def _as_seen(value: str, vision: str) -> str:
	return value if vision == "normal" else colour.simulate(value, vision)


def _hue_distance(a: float, b: float) -> float:
	d = abs(a - b) % 360
	return min(d, 360 - d)


def status_roles(model: Model) -> dict[str, str]:
	"""Chromatic status roles as `{role: ramp}`, read from the `status-<role>-solid` tokens."""
	roles: dict[str, str] = {}
	for name, entry in model["semantic"].items():
		match = _SOLID.match(name)
		ramp = _RAMP.match(entry["light"])
		if match and ramp and model["ramps"][ramp.group(1)].get("input") != "neutral":
			roles[match.group(1)] = ramp.group(1)
	return roles


def adjacent_roles(model: Model, params: dict[str, Any]) -> list[str]:
	"""Status roles within `HUE_WINDOW` degrees of the preset's primary hue."""
	hue = params["primary"]["h"]
	return [
		role
		for role, ramp in status_roles(model).items()
		if _hue_distance(hue, model["ramps"][ramp]["h"]) <= HUE_WINDOW
	]


def status_findings(model: Model, palette: Palette) -> list[Finding]:
	"""Primary against each hue-adjacent status solid, per mode and vision (closest of each)."""
	findings = []
	for role in adjacent_roles(model, palette.params):
		solid = f"status-{role}-solid"
		for mode in MODES:
			tokens = palette.tokens[mode]
			for vision in STATUS_VISIONS:
				distance = colour.delta_e(
					_as_seen(tokens["primary"], vision), _as_seen(tokens[solid], vision)
				)
				findings.append(
					Finding(
						"status",
						palette.name,
						role,
						mode,
						vision,
						"primary",
						solid,
						distance,
						STATUS_MIN,
						distance >= STATUS_MIN,
					)
				)
	return findings


def chart_findings(model: Model, palette: Palette) -> list[Finding]:
	"""Closest pair of chart series for each series set, mode and vision."""
	findings = []
	for scope, count in CHART_SETS.items():
		names = [f"chart-{i}" for i in range(1, count + 1)]
		for mode in MODES:
			tokens = palette.tokens[mode]
			for vision in CHART_VISIONS:
				seen = {name: _as_seen(tokens[name], vision) for name in names}
				distance, a, b = min(
					(colour.delta_e(seen[x], seen[y]), x, y) for x, y in itertools.combinations(names, 2)
				)
				findings.append(
					Finding(
						"chart",
						palette.name,
						scope,
						mode,
						vision,
						a,
						b,
						distance,
						CHART_MIN,
						distance >= CHART_MIN,
					)
				)
	return findings


def worst(findings: list[Finding]) -> dict[tuple[str, str, str], Finding]:
	"""The closest finding per (scope, mode, vision), for compact reports."""
	closest: dict[tuple[str, str, str], Finding] = {}
	for finding in findings:
		key = (finding.scope, finding.mode, finding.vision)
		if key not in closest or finding.distance < closest[key].distance:
			closest[key] = finding
	return closest


def report(model: Model, palettes: dict[str, Palette]) -> tuple[list[str], int, int]:
	"""Text report for every preset. Returns `(lines, status_failures, chart_gaps)`.

	Status failures are counted for shipped presets only; a dropped preset is listed as such.
	"""
	shipped = set(model["palettes"]["shipped"])
	lines = [
		"Colour-vision audit",
		"Generated by python -m institutional_theme.audits; do not edit.",
		"",
		"Distance: OKLab Euclidean x 100 after simulating the deficiency (Machado et al. 2009, severity 1).",
		f"Status check (fatal): primary against the solid mark of every chromatic status role within "
		f"{HUE_WINDOW:.0f} degrees of the primary hue, both modes, four visions, needs {STATUS_MIN:.1f}.",
		f"Chart check (reported gap, not fatal): closest pair of series, needs {CHART_MIN:.1f}.",
		"",
	]
	status_failures = 0
	chart_gaps = 0
	for name, built in palettes.items():
		state = "shipped" if name in shipped else "not shipped"
		lines.append(f"== {name} ({state})")
		status = status_findings(model, built)
		roles = ", ".join(adjacent_roles(model, built.params)) or "none"
		lines.append(f"Status check, hue-adjacent roles: {roles}")
		failed = [f for f in status if not f.passed]
		low = min((f.distance for f in status), default=float("nan"))
		lines.append(f"  closest approach {low:.1f}; failures {len(failed)}")
		lines += [f"  {f.describe()}" for f in failed]
		if name in shipped:
			status_failures += len(failed)
		charts = chart_findings(model, built)
		lines.append("Chart series, closest pair per mode and vision:")
		for finding in worst(charts).values():
			lines.append(f"  {finding.describe()}")
			if name in shipped and not finding.passed:
				chart_gaps += 1
		lines.append("")
	lines.append(f"Status failures in shipped presets: {status_failures}")
	lines.append(f"Chart gaps in shipped presets (not fatal): {chart_gaps}")
	return lines, status_failures, chart_gaps
