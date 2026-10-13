"""Preset resolution on top of `generated/model.json`.

The build pipeline writes `generated/model.json` from `design/tokens.json`; this module reads only
that file, so the runtime never touches the design folder. It resolves a preset (the approved
`midad` identity, a shipped alternative, or the per-site custom preset) into ramps and semantic
tokens for Light and Dark, measures every contrast pair, and renders the CSS of a palette.

Dependency-free; never imports Frappe. English source strings for the translation layer come from
`labels.py`, and are returned untranslated: the caller translates them with `frappe._()`.
"""

from __future__ import annotations

import functools
import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, NamedTuple

from . import colour, emit
from .labels import input_label, mode_label, token_label

Model = dict[str, Any]
Params = dict[str, Any]

MODEL_PATH = Path(__file__).with_name("generated") / "model.json"
MODES = ("light", "dark")
BASE_PRESET = "midad"
# Tokens the font partials define (ADR 0004); tokens.json spells their stacks with public names.
FONT_TOKENS = ("font-sans", "font-mono")
INS = "--ins-"

_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
_RAMP = re.compile(r"^([a-z]+)\.(\d+)$")
_OKLCH = re.compile(r"^oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)$")
_ALPHA = re.compile(r"^alpha\(\s*(.+?)\s*,\s*([0-9.]+)\s*\)$")
_AT_REF = re.compile(r"@([a-z0-9]+(?:-[a-z0-9]+)*)")
_DOLLAR_REF = re.compile(r"\$([a-z][a-z0-9]*(?:-[a-z0-9]+)*)")


@functools.cache
def _read(path: str) -> Model:
	with open(path, encoding="utf-8") as handle:
		return json.load(handle)


def load_model(path: Path | str | None = None) -> Model:
	"""The generated model. The result is cached and shared: treat it as read-only."""
	return _read(str(path or MODEL_PATH))


# ----------------------------------------------------------------------------------------------
# Presets and palettes
# ----------------------------------------------------------------------------------------------


def preset_params(model: Model, name: str) -> Params:
	"""Parameters of a named preset: primary and accent hue and chroma multiplier, neutral hue."""
	return model["palettes"]["presets"][name]["params"]


def resolve_ramps(model: Model, params: Params) -> dict[str, dict[str, str]]:
	"""Every ramp as `{ramp: {step: hex}}` for a set of preset parameters.

	`ink` takes the primary hue and chroma multiplier, `brass` the accent ones and the neutral
	ramps (`slate`, `night`) the neutral hue. Lightness always follows the approved curves.
	"""
	ramps: dict[str, dict[str, str]] = {}
	for name, ramp in model["ramps"].items():
		steps = ramp.get("steps") or model["steps"]
		hue = ramp["h"]
		kind = ramp.get("input")
		multiplier = 1
		if kind == "primary":
			hue, multiplier = params["primary"]["h"], params["primary"]["chroma"]
		elif kind == "accent":
			hue, multiplier = params["accent"]["h"], params["accent"]["chroma"]
		elif kind == "neutral":
			hue = params["neutral_h"]
		if "curve" in ramp:
			curve = model["curves"][ramp["curve"]]
			lightness = curve["l"]
			chroma = [ramp["cmax"] * k for k in curve["k"]]
		else:
			lightness = ramp["l"]
			chroma = [c * multiplier for c in ramp["c"]]
		ramps[name] = {
			step: colour.oklch_to_hex(lightness[i], chroma[i], hue).hex for i, step in enumerate(steps)
		}
	return ramps


class _Resolver:
	"""Resolves token value syntax (tokens.json `meta.value_syntax`) for one palette."""

	def __init__(self, model: Model, params: Params, ramps: dict[str, dict[str, str]]):
		self.model = model
		self.params = params
		self.ramps = ramps
		self._cache: dict[tuple[str, str], str] = {}

	def token(self, name: str, mode: str, stack: tuple[str, ...] = ()) -> str:
		key = (name, mode)
		if key in self._cache:
			return self._cache[key]
		if name in stack:
			raise ValueError(f"Circular token reference: {' -> '.join((*stack, name))}")
		entry = self.model["semantic"].get(name)
		if entry is None:
			raise KeyError(f"Unknown semantic token: {name}")
		resolved = self.value(entry[mode], mode, (*stack, name))
		self._cache[key] = resolved
		return resolved

	def value(self, text: str, mode: str, stack: tuple[str, ...] = ()) -> str:
		text = text.strip()
		if _HEX.match(text):
			return text.lower()
		ramp = _RAMP.match(text)
		if ramp:
			return self.ramps[ramp.group(1)][ramp.group(2)]
		literal = _OKLCH.match(text)
		if literal:
			return self._oklch(float(literal.group(1)), float(literal.group(2)), float(literal.group(3)))
		alpha = _ALPHA.match(text)
		if alpha:
			return colour.rgba(self.value(alpha.group(1), mode, stack), float(alpha.group(2)))
		return _AT_REF.sub(lambda m: self.token(m.group(1), mode, stack), text)

	def _oklch(self, lightness: float, chroma: float, hue: float) -> str:
		# A literal written on the ink (or brass) hue follows the preset's primary (or accent).
		ramps = self.model["ramps"]
		if hue == ramps["ink"]["h"]:
			hue, chroma = self.params["primary"]["h"], chroma * self.params["primary"]["chroma"]
		elif hue == ramps["brass"]["h"]:
			hue, chroma = self.params["accent"]["h"], chroma * self.params["accent"]["chroma"]
		return colour.oklch_to_hex(lightness, chroma, hue).hex


@dataclass
class Palette:
	"""A resolved preset: ramps and semantic tokens (CSS text) for Light and Dark."""

	name: str
	params: Params
	ramps: dict[str, dict[str, str]]
	tokens: dict[str, dict[str, str]]
	model: Model = field(repr=False, compare=False)
	_resolver: _Resolver = field(repr=False, compare=False)

	def colour(self, name: str, mode: str) -> str:
		"""Hex of a semantic token or of a Frappe variable (`--name`) in a mode."""
		if name.startswith("--"):
			entry = self.model["frappe"]["vars"][name]
			resolved = self._resolver.value(entry[mode], mode)
		else:
			resolved = self.tokens[mode][name]
		if not _HEX.match(resolved):
			raise ValueError(f"{name} does not resolve to a hex colour in {mode} mode: {resolved}")
		return resolved


def build_palette(model: Model, params: Params, name: str = "custom") -> Palette:
	"""Resolve ramps and every semantic token for a set of preset parameters."""
	ramps = resolve_ramps(model, params)
	resolver = _Resolver(model, params, ramps)
	tokens = {mode: {key: resolver.token(key, mode) for key in model["semantic"]} for mode in MODES}
	return Palette(name, params, ramps, tokens, model, resolver)


def palette(model: Model, name: str) -> Palette:
	"""The named preset of the model (shipped or not)."""
	return build_palette(model, preset_params(model, name), name)


# ----------------------------------------------------------------------------------------------
# Frappe variable mapping and scale tokens
# ----------------------------------------------------------------------------------------------


class FrappeMap(NamedTuple):
	"""Frappe variables per mode as `(variable, css value)`, plus the primitives they reference."""

	declarations: dict[str, list[tuple[str, str]]]
	primitives: list[tuple[str, str]]


def frappe_map(model: Model) -> FrappeMap:
	"""Translate tokens.json `frappe` into CSS declarations that reference `--ins-*` only.

	`@name` becomes `var(--ins-name)`, `$name` becomes `var(--ins-name)` and `ramp.step` becomes
	`var(--ins-ramp-step)`; anything else is emitted verbatim. Only variables listed in
	tokens.json are produced.
	"""
	frappe = model["frappe"]
	semantic = model["semantic"]
	scale = model["scale"]
	used: set[tuple[str, str]] = set()

	def check_ramp(ramp: str, step: str) -> None:
		steps = model["ramps"].get(ramp, {}).get("steps") or model["steps"]
		if ramp not in model["ramps"] or step not in steps:
			raise ValueError(f"Unknown ramp step: {ramp}.{step}")

	def css(text: str) -> str:
		text = text.strip()
		ramp = _RAMP.match(text)
		if ramp:
			check_ramp(ramp.group(1), ramp.group(2))
			used.add((ramp.group(1), ramp.group(2)))
			return f"var({INS}{ramp.group(1)}-{ramp.group(2)})"

		def at(m: re.Match[str]) -> str:
			if m.group(1) not in semantic:
				raise ValueError(f"Unknown semantic token in the Frappe map: @{m.group(1)}")
			return f"var({INS}{m.group(1)})"

		def dollar(m: re.Match[str]) -> str:
			if m.group(1) not in scale:
				raise ValueError(f"Unknown scale token in the Frappe map: ${m.group(1)}")
			return f"var({INS}{m.group(1)})"

		return _DOLLAR_REF.sub(dollar, _AT_REF.sub(at, text))

	declarations: dict[str, list[tuple[str, str]]] = {mode: [] for mode in MODES}
	raw_steps = list(frappe["raw_gray_light"])
	for mode, key in (("light", "raw_gray_light"), ("dark", "raw_gray_dark")):
		for step in raw_steps:
			declarations[mode].append((f"--gray-{step}", css(frappe[key][step])))
	for hue, ramp in frappe["raw_hues"].items():
		for step in raw_steps:
			for mode in MODES:
				declarations[mode].append((f"--{hue}-{step}", css(f"{ramp}.{step}")))
	for name, entry in frappe["vars"].items():
		for mode in MODES:
			declarations[mode].append((name, css(entry[mode])))

	order = {ramp: index for index, ramp in enumerate(model["ramps"])}
	primitives = sorted(
		used,
		key=lambda item: (
			order[item[0]],
			(model["ramps"][item[0]].get("steps") or model["steps"]).index(item[1]),
		),
	)
	return FrappeMap(declarations, primitives)


def base_keys(model: Model, primitives: list[tuple[str, str]] | None = None) -> list[str]:
	"""The one key list of the base family: semantic tokens, then the primitives the map uses.

	Keys are bare names (`primary`, `slate-300`); the property is `--ins-<key>`.
	"""
	if primitives is None:
		primitives = frappe_map(model).primitives
	keys = [*model["semantic"], *(f"{ramp}-{step}" for ramp, step in primitives)]
	if len(set(keys)) != len(keys):
		raise ValueError("A primitive token name collides with a semantic token name")
	return keys


def base_values(palette_: Palette, primitives: list[tuple[str, str]]) -> dict[str, dict[str, str]]:
	"""Values for every base key in both modes."""
	values: dict[str, dict[str, str]] = {}
	for mode in MODES:
		mode_values = dict(palette_.tokens[mode])
		for ramp, step in primitives:
			mode_values[f"{ramp}-{step}"] = palette_.ramps[ramp][step]
		values[mode] = mode_values
	return values


def scale_tokens(model: Model) -> dict[str, list[tuple[str, str]]]:
	"""Mode-independent tokens as `(--ins-name, value)` for comfortable, compact and coarse.

	The font stacks are left to the font partials (ADR 0004): they name private families.
	"""
	blocks: dict[str, list[tuple[str, str]]] = {"comfortable": [], "compact": [], "coarse": []}
	for name, entry in model["scale"].items():
		if name in FONT_TOKENS:
			continue
		blocks["comfortable"].append((f"{INS}{name}", entry["value"]))
		if "compact" in entry:
			blocks["compact"].append((f"{INS}{name}", entry["compact"]))
		if "coarse" in entry:
			blocks["coarse"].append((f"{INS}{name}", entry["coarse"]))
	return blocks


# ----------------------------------------------------------------------------------------------
# Contrast
# ----------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class PairResult:
	"""One measured pair. `kind` is `min` (ratio must reach `limit`) or `max` (must not exceed it)."""

	group: str
	fg: str
	bg: str
	mode: str
	ratio: float
	limit: float
	target: float | None
	kind: str
	passed: bool


def contrast_results(model: Model, palette_: Palette) -> list[PairResult]:
	"""Every pair of `contrast.groups` and `contrast.max`, in both modes."""
	results: list[PairResult] = []
	rules = [("min", group) for group in model["contrast"]["groups"]]
	rules += [("max", group) for group in model["contrast"]["max"]]
	for kind, group in rules:
		for mode in MODES:
			for fg in group["fg"]:
				for bg in group["bg"]:
					ratio = colour.contrast(palette_.colour(fg, mode), palette_.colour(bg, mode))
					if kind == "min":
						limit, target = group["min"], group.get("target")
						passed = ratio >= limit
					else:
						limit, target = group["max"], None
						passed = ratio <= limit
					results.append(
						PairResult(group["name"], fg, bg, mode, ratio, limit, target, kind, passed)
					)
	return results


def failed_pairs(results: list[PairResult]) -> list[PairResult]:
	"""Failing pairs, one per (fg, bg, mode, kind): the strictest requirement wins."""
	strictest: dict[tuple[str, str, str, str], PairResult] = {}
	for result in results:
		if result.passed:
			continue
		key = (result.fg, result.bg, result.mode, result.kind)
		current = strictest.get(key)
		if current is None or (
			result.limit > current.limit if result.kind == "min" else result.limit < current.limit
		):
			strictest[key] = result
	return list(strictest.values())


def ratio_text(ratio: float, kind: str = "min") -> str:
	"""A ratio to two decimals, rounded towards the failing side so `4.499` never reads `4.50`."""
	scaled = ratio * 100
	value = math.floor(scaled) if kind == "min" else math.ceil(scaled)
	return f"{value / 100:.2f}"


def token_inputs(model: Model, name: str, mode: str, _stack: tuple[str, ...] = ()) -> set[str]:
	"""Which administrator inputs (`primary`, `accent`) feed a token in a mode."""
	if name in _stack:
		return set()
	if name.startswith("--"):
		text = model["frappe"]["vars"][name][mode]
	else:
		text = model["semantic"][name][mode]
	return _text_inputs(model, text, mode, (*_stack, name))


def _text_inputs(model: Model, text: str, mode: str, stack: tuple[str, ...]) -> set[str]:
	found: set[str] = set()
	ramp = _RAMP.match(text.strip())
	if ramp:
		kind = model["ramps"][ramp.group(1)].get("input")
		return {kind} if kind in ("primary", "accent") else set()
	literal = _OKLCH.match(text.strip())
	if literal:
		hue = float(literal.group(3))
		if hue == model["ramps"]["ink"]["h"]:
			return {"primary"}
		if hue == model["ramps"]["brass"]["h"]:
			return {"accent"}
		return set()
	alpha = _ALPHA.match(text.strip())
	if alpha:
		return _text_inputs(model, alpha.group(1), mode, stack)
	for ref in _AT_REF.findall(text):
		found |= token_inputs(model, ref, mode, stack)
	return found


def describe_failures(model: Model, results: list[PairResult]) -> list[dict[str, Any]]:
	"""Failing pairs with human labels (English source strings, to be translated by the caller).

	Keys: `group`, `fg`, `bg`, `fg_label`, `bg_label`, `mode`, `mode_label`, `ratio`,
	`ratio_text`, `required`, `kind`, `adjust` (`primary`, `accent` or `None`) and `adjust_label`.
	"""
	described = []
	for result in failed_pairs(results):
		inputs = token_inputs(model, result.fg, result.mode) | token_inputs(model, result.bg, result.mode)
		adjust = next((kind for kind in ("primary", "accent") if kind in inputs), None)
		described.append(
			{
				"group": result.group,
				"fg": result.fg,
				"bg": result.bg,
				"fg_label": token_label(result.fg),
				"bg_label": token_label(result.bg),
				"mode": result.mode,
				"mode_label": mode_label(result.mode),
				"ratio": result.ratio,
				"ratio_text": ratio_text(result.ratio, result.kind),
				"required": result.limit,
				"kind": result.kind,
				"adjust": adjust,
				"adjust_label": input_label(adjust),
			}
		)
	return described


def palette_failures(model: Model, palette_: Palette) -> list[dict[str, Any]]:
	"""Failing contrast pairs of a palette with human labels. Empty when the palette passes."""
	return describe_failures(model, contrast_results(model, palette_))


# ----------------------------------------------------------------------------------------------
# Custom preset (ADR 0005)
# ----------------------------------------------------------------------------------------------


class CustomPreset(NamedTuple):
	"""The result of `custom_preset`: parameters, the palette, and the failing pairs (if any)."""

	params: Params
	palette: Palette
	failures: list[dict[str, Any]]


class PaletteRejected(ValueError):
	"""Raised when a palette is requested as CSS but fails its contrast pairs."""

	def __init__(self, failures: list[dict[str, Any]]):
		super().__init__(f"{len(failures)} contrast pair(s) below their minimum")
		self.failures = failures


def _input_params(model: Model, ramp_name: str, value: str | None, default: Params) -> Params:
	"""Hue of the supplied colour and a chroma multiplier, per ADR 0005.

	The multiplier is `min(1, C_input / C_ramp[step])`, where `step` is the ramp step nearest in
	lightness to the input. Without an input the default (the `midad` value) is kept.
	"""
	if value is None or not str(value).strip():
		return dict(default)
	oklch = colour.hex_to_oklch(value)
	ramp = model["ramps"][ramp_name]
	nearest = min(range(len(ramp["l"])), key=lambda i: abs(ramp["l"][i] - oklch.lightness))
	multiplier = min(1.0, oklch.c / ramp["c"][nearest])
	return {"h": round(oklch.h, 3), "chroma": round(multiplier, 4)}


def custom_params(model: Model, primary_hex: str | None, accent_hex: str | None) -> Params:
	"""Preset parameters of the custom preset. Raises `ValueError` for a value that is not a hex."""
	base = preset_params(model, BASE_PRESET)
	return {
		"primary": _input_params(model, "ink", primary_hex, base["primary"]),
		"accent": _input_params(model, "brass", accent_hex, base["accent"]),
		"neutral_h": base["neutral_h"],
	}


def custom_preset(
	primary_hex: str | None, accent_hex: str | None, model: Model | None = None
) -> CustomPreset:
	"""Generate the custom preset on the approved curves and audit it.

	Keeps the hue of each input, scales chroma by `min(1, C_input / C_ramp[nearest step])`, takes
	lightness from the approved curves and uses the `midad` neutral hue. Returns the palette and
	the failing pairs with human labels; an empty list means the palette passed. Never store or
	serve a palette whose `failures` is not empty.
	"""
	model = model or load_model()
	params = custom_params(model, primary_hex, accent_hex)
	built = build_palette(model, params, "custom")
	return CustomPreset(params, built, palette_failures(model, built))


# ----------------------------------------------------------------------------------------------
# CSS of a palette
# ----------------------------------------------------------------------------------------------


def changed_keys(
	base: Palette, other: Palette, keys: list[str], primitives: list[tuple[str, str]]
) -> list[str]:
	"""Keys whose value differs from `base` in either mode, in key-list order."""
	base_v = base_values(base, primitives)
	other_v = base_values(other, primitives)
	return [key for key in keys if any(base_v[mode][key] != other_v[mode][key] for mode in MODES)]


def palette_css(model: Model, palette_: Palette, *, header: str) -> str:
	"""The `--ins-*` declarations in which a palette differs from `midad`, at the palette shapes.

	Light, dark and automatic blocks come from one key list, so each holds the same keys. A key
	that differs in only one mode is written in both.
	"""
	fmap = frappe_map(model)
	keys = base_keys(model, fmap.primitives)
	baseline = palette(model, BASE_PRESET)
	changed = changed_keys(baseline, palette_, keys, fmap.primitives)
	values = base_values(palette_, fmap.primitives)
	props = [f"{INS}{key}" for key in changed]
	light = {f"{INS}{key}": values["light"][key] for key in changed}
	dark = {f"{INS}{key}": values["dark"][key] for key in changed}
	return header + emit.emit_family("palette", props, light, dark)


def custom_palette_css(primary_hex: str | None, accent_hex: str | None, model: Model | None = None) -> str:
	"""CSS text of the site's custom preset. Raises `PaletteRejected` unless every pair passes."""
	model = model or load_model()
	result = custom_preset(primary_hex, accent_hex, model)
	if result.failures:
		raise PaletteRejected(result.failures)
	return palette_css(model, result.palette, header=emit.header("/*"))
