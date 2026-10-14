"""Pipeline: design/tokens.json to model.json, the generated SCSS partials and palette bundles.

    python -m institutional_theme.midad.build           write every generated file
    python -m institutional_theme.midad.build --check   exit 1 if any generated file is stale

The build decides which presets ship. A preset that fails a contrast pair or the status
distinguishability check is left out of `palettes.shipped` and gets no bundle; the reasons are
written to docs/audits/presets.txt. `midad` is never dropped: if it fails, the build stops.

Never imports Frappe.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from institutional_theme.audits import colour_vision

from . import emit
from . import model as model_mod

PACKAGE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = PACKAGE_DIR.parent
TOKENS_PATH = REPO_ROOT / "design" / "tokens.json"
MODEL_PATH = model_mod.MODEL_PATH
SCSS_DIR = PACKAGE_DIR / "public" / "scss" / "generated"
AUDITS_DIR = REPO_ROOT / "docs" / "audits"

GENERATED_KEY = emit.HEADER_TEXT
NEUTRAL_RAMPS = ("slate", "night")

Model = dict[str, Any]


class BuildError(Exception):
	"""The build cannot continue (for example, `midad` fails an audit)."""


# ----------------------------------------------------------------------------------------------
# tokens.json to model.json
# ----------------------------------------------------------------------------------------------


def load_tokens(path: Path = TOKENS_PATH) -> Model:
	with open(path, encoding="utf-8") as handle:
		return json.load(handle)


def _public(mapping: dict[str, Any]) -> dict[str, Any]:
	"""Drop documentation keys (`_comment`)."""
	return {key: value for key, value in mapping.items() if not key.startswith("_")}


def _ramp_input(ramp: dict[str, Any], name: str) -> str | None:
	if ramp.get("brand") in ("primary", "accent"):
		return ramp["brand"]
	if name in NEUTRAL_RAMPS:
		return "neutral"
	return None


def _frappe_vars(frappe: dict[str, Any]) -> dict[str, dict[str, str]]:
	out: dict[str, dict[str, str]] = {}
	for name, entry in _public(frappe["vars"]).items():
		if "both" in entry:
			out[name] = {"light": entry["both"], "dark": entry["both"]}
		else:
			out[name] = {"light": entry["light"], "dark": entry["dark"]}
		if "scope" in entry:
			if entry["scope"] != model_mod.SCOPE_DESK:
				raise BuildError(
					f'{name}: scope must be "{model_mod.SCOPE_DESK}" or absent, not {entry["scope"]!r}'
				)
			out[name]["scope"] = entry["scope"]
	return out


def build_base_model(tokens: Model) -> Model:
	"""The model without the shipped list. Everything the runtime needs, nothing else."""
	ramps: dict[str, Any] = {}
	for name, ramp in _public(tokens["ramps"]).items():
		item = {key: value for key, value in ramp.items() if key not in ("role", "brand")}
		item["input"] = _ramp_input(ramp, name)
		ramps[name] = item

	semantic: dict[str, Any] = {}
	for group, entries in _public(tokens["semantic"]).items():
		for name, entry in _public(entries).items():
			if name in semantic:
				raise BuildError(f"Duplicate semantic token: {name}")
			semantic[name] = {"group": group, "light": entry["light"], "dark": entry["dark"]}

	scale = {
		name: {key: value for key, value in entry.items() if key != "use"}
		for name, entry in _public(tokens["scale"]).items()
	}

	frappe = tokens["frappe"]
	presets: dict[str, Any] = {}
	for name, preset in _public(tokens["palettes"]["presets"]).items():
		presets[name] = {
			"label_ar": preset["label_ar"],
			"label_en": preset["label_en"],
			"params": {
				"primary": dict(preset["primary"]),
				"accent": dict(preset["accent"]),
				"neutral_h": preset["neutral_h"],
			},
		}

	built: Model = {
		"_generated": GENERATED_KEY,
		"steps": tokens["steps"],
		"curves": tokens["curves"],
		"ramps": ramps,
		"semantic": semantic,
		"scale": scale,
		"frappe": {
			"raw_gray_light": frappe["raw_gray_light"],
			"raw_gray_dark": frappe["raw_gray_dark"],
			"raw_hues": frappe["raw_hues"],
			"vars": _frappe_vars(frappe),
		},
		"contrast": {
			"groups": [
				{k: group[k] for k in ("name", "min", "target", "fg", "bg")}
				for group in tokens["contrast"]["groups"]
			],
			"max": [
				{k: group[k] for k in ("name", "max", "fg", "bg")} for group in tokens["contrast"]["max"]
			],
		},
		"palettes": {
			"default": tokens["palettes"]["default"],
			"presets": presets,
			"shipped": [],
			"dropped": {},
		},
		"brand": {
			"primary_hex": tokens["brand"].get("primary_hex"),
			"accent_hex": tokens["brand"].get("accent_hex"),
		},
	}

	brand = built["brand"]
	if brand["primary_hex"] or brand["accent_hex"]:
		# White-label entry point: the default preset takes the supplied hue and chroma.
		default = built["palettes"]["default"]
		built["palettes"]["presets"][default]["params"] = model_mod.custom_params(
			built, brand["primary_hex"], brand["accent_hex"]
		)
	return built


def evaluate_presets(model: Model) -> tuple[list[str], dict[str, list[str]]]:
	"""Which presets ship. Returns `(shipped, dropped)`; `dropped` maps a name to its reasons."""
	shipped: list[str] = []
	dropped: dict[str, list[str]] = {}
	for name in model["palettes"]["presets"]:
		built = model_mod.palette(model, name)
		reasons = []
		for failure in model_mod.palette_failures(model, built):
			reasons.append(
				f"contrast {failure['fg']} on {failure['bg']}, {failure['mode']}: "
				f"{failure['ratio_text']}:1, needs {failure['required']}:1"
			)
		for finding in colour_vision.status_findings(model, built):
			if not finding.passed:
				reasons.append(finding.describe())
		if reasons:
			dropped[name] = reasons
		else:
			shipped.append(name)
	default = model["palettes"]["default"]
	if default in dropped:
		lines = "\n".join(f"  {reason}" for reason in dropped[default])
		raise BuildError(f"The default preset {default} fails its audits; nothing was written.\n{lines}")
	return shipped, dropped


def build_model(tokens: Model) -> Model:
	"""The complete model.json content, including the shipped and dropped presets."""
	built = build_base_model(tokens)
	shipped, dropped = evaluate_presets(built)
	built["palettes"]["shipped"] = shipped
	built["palettes"]["dropped"] = dropped
	return built


# ----------------------------------------------------------------------------------------------
# Rendering
# ----------------------------------------------------------------------------------------------


def render_model_json(model: Model) -> str:
	return json.dumps(model, indent="\t", ensure_ascii=False) + "\n"


def render_tokens(model: Model) -> str:
	fmap = model_mod.frappe_map(model)
	keys = model_mod.base_keys(model, fmap.primitives)
	midad = model_mod.palette(model, model["palettes"]["default"])
	values = model_mod.base_values(midad, fmap.primitives)
	props = [f"{model_mod.INS}{key}" for key in keys]
	light = {f"{model_mod.INS}{key}": values["light"][key] for key in keys}
	dark = {f"{model_mod.INS}{key}": values["dark"][key] for key in keys}
	intro = (
		"// Base --ins-* colour tokens of the default preset (ADR 0003), with color-scheme per block.\n"
		"// Semantic tokens first, then the primitive steps the Frappe map references.\n\n"
	)
	return emit.header() + intro + emit.emit_family("base", props, light, dark, color_scheme=True)


def render_tokens_light(model: Model) -> str:
	"""The light block of `_tokens.scss` alone, for the website bundle (Light only)."""
	fmap = model_mod.frappe_map(model)
	keys = model_mod.base_keys(model, fmap.primitives)
	midad = model_mod.palette(model, model["palettes"]["default"])
	values = model_mod.base_values(midad, fmap.primitives)
	light = {f"{model_mod.INS}{key}": values["light"][key] for key in keys}
	props = [f"{model_mod.INS}{key}" for key in keys]
	intro = (
		"// Light block of _tokens.scss only, for bundles that never render Dark (website, portal).\n"
		"// Same selectors and values as the light block there, color-scheme: light included.\n\n"
	)
	return emit.header() + intro + emit.emit_light_family("base", props, light, color_scheme=True)


def _frappe_map_parts(
	model: Model, scope: str | None = None
) -> tuple[list[str], dict[str, str], dict[str, str]]:
	fmap = model_mod.frappe_map(model, scope)
	names = [name for name, _ in fmap.declarations["light"]]
	if names != [name for name, _ in fmap.declarations["dark"]]:
		raise BuildError("The Frappe map differs between light and dark")
	light = dict(fmap.declarations["light"])
	dark = dict(fmap.declarations["dark"])
	if len(light) != len(names):
		raise BuildError("The Frappe map sets a variable twice")
	return names, light, dark


def render_frappe_map(model: Model) -> str:
	names, light, dark = _frappe_map_parts(model)
	intro = (
		"// Frappe variables re-pointed at --ins-* tokens, at the palette shapes (ADR 0003).\n"
		"// Every name comes from design/tokens.json `frappe`.\n\n"
	)
	return emit.header() + intro + emit.emit_family("palette", names, light, dark)


def render_frappe_map_light(model: Model) -> str:
	"""The light block of `_frappe_map.scss` for the website bundle (Light only), without the desk-only names.

	The variables marked `"scope": "desk"` in tokens.json are left out: no website page of a supported
	version reads one (`audits/web_scope.py` proves it from committed snapshots of what the pages load).
	"""
	names, light, _ = _frappe_map_parts(model, model_mod.WEB)
	omitted = len(model_mod.desk_only(model))
	intro = (
		"// Light block of _frappe_map.scss for bundles that never render Dark (website, portal), without the\n"
		f"// {omitted} variables only desk components read (tokens.json `scope: desk`). Same selectors and values.\n\n"
	)
	return emit.header() + intro + emit.emit_light_family("palette", names, light)


def render_scale(model: Model) -> str:
	blocks = model_mod.scale_tokens(model)
	intro = (
		"// Mode-independent tokens: comfortable, compact and coarse-pointer blocks (ADR 0003).\n"
		"// --ins-font-sans and --ins-font-mono come from the font partials (ADR 0004).\n\n"
	)
	return emit.header() + intro + emit.emit_scale(blocks["comfortable"], blocks["compact"], blocks["coarse"])


def render_literals(model: Model) -> str:
	midad = model_mod.palette(model, model["palettes"]["default"])
	semantic = [(f"ins-{name}", value) for name, value in midad.tokens["light"].items()]
	blocks = model_mod.scale_tokens(model)
	scale = [(prop.removeprefix("--"), value) for prop, value in blocks["comfortable"]]
	intro = (
		"// Literal light values of the default preset, for bundles that cannot use custom properties.\n\n"
	)
	return (
		emit.header()
		+ intro
		+ emit.emit_literals([("Colour and elevation", semantic), ("Scale (comfortable)", scale)])
	)


def render_palette_bundle(model: Model, name: str) -> str:
	built = model_mod.palette(model, name)
	label = model["palettes"]["presets"][name]["label_en"]
	intro = f"// Colour preset {name} ({label}): only the --ins-* values that differ from midad.\n"
	body = model_mod.palette_css(model, built, header="")
	return emit.header() + intro + emit.wrap_rtl_ignore(body)


def render_presets_report(model: Model) -> str:
	palettes = model["palettes"]
	lines = [
		"Colour presets",
		"Generated by institutional_theme.midad.build from design/tokens.json; do not edit.",
		"",
		f"Default: {palettes['default']}",
		f"Shipped: {', '.join(palettes['shipped'])}",
		f"Dropped: {', '.join(palettes['dropped']) or 'none'}",
		"",
	]
	for name in palettes["presets"]:
		if name in palettes["dropped"]:
			lines.append(f"{name}: DROPPED, no bundle is generated")
			lines += [f"  - {reason}" for reason in palettes["dropped"][name]]
		else:
			lines.append(f"{name}: shipped")
	return "\n".join(lines) + "\n"


def render_all(tokens: Model) -> dict[Path, str]:
	"""Every generated file as `{path: text}`."""
	model = build_model(tokens)
	files: dict[Path, str] = {
		MODEL_PATH: render_model_json(model),
		SCSS_DIR / "_tokens.scss": render_tokens(model),
		SCSS_DIR / "_frappe_map.scss": render_frappe_map(model),
		SCSS_DIR / "_tokens_light.scss": render_tokens_light(model),
		SCSS_DIR / "_frappe_map_light.scss": render_frappe_map_light(model),
		SCSS_DIR / "_scale.scss": render_scale(model),
		SCSS_DIR / "_literals.scss": render_literals(model),
		AUDITS_DIR / "presets.txt": render_presets_report(model),
	}
	for name in model["palettes"]["shipped"]:
		if name != model["palettes"]["default"]:
			files[SCSS_DIR / f"ins_palette_{name}.bundle.scss"] = render_palette_bundle(model, name)
	return files


def stale_palette_bundles(files: dict[Path, str]) -> list[Path]:
	"""Existing palette bundles that the build would not generate (a dropped preset's leftover)."""
	if not SCSS_DIR.is_dir():
		return []
	return [path for path in sorted(SCSS_DIR.glob("ins_palette_*.bundle.scss")) if path not in files]


def write_all(files: dict[Path, str]) -> tuple[list[Path], list[Path]]:
	"""Write changed files and remove leftover bundles. Returns `(written, removed)`."""
	written = []
	for path, text in files.items():
		if path.exists() and path.read_text(encoding="utf-8") == text:
			continue
		path.parent.mkdir(parents=True, exist_ok=True)
		path.write_text(text, encoding="utf-8", newline="\n")
		written.append(path)
	removed = stale_palette_bundles(files)
	for path in removed:
		path.unlink()
	return written, removed


def check_all(files: dict[Path, str]) -> list[Path]:
	"""Paths that are missing, differ from the build output, or should not exist."""
	problems = []
	for path, text in files.items():
		if not path.exists() or path.read_text(encoding="utf-8") != text:
			problems.append(path)
	problems += stale_palette_bundles(files)
	return problems


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(prog="python -m institutional_theme.midad.build", description=__doc__)
	parser.add_argument("--check", action="store_true", help="exit 1 if any generated file is stale")
	args = parser.parse_args(argv)
	try:
		files = render_all(load_tokens())
	except BuildError as error:
		print(f"build: {error}", file=sys.stderr)
		return 2
	if args.check:
		problems = check_all(files)
		for path in problems:
			print(f"stale: {path.relative_to(REPO_ROOT)}", file=sys.stderr)
		print(f"build --check: {len(files)} file(s) checked, {len(problems)} stale")
		return 1 if problems else 0
	written, removed = write_all(files)
	for path in written:
		print(f"wrote {path.relative_to(REPO_ROOT)}")
	for path in removed:
		print(f"removed {path.relative_to(REPO_ROOT)}")
	print(f"build: {len(files)} file(s), {len(written)} written, {len(removed)} removed")
	return 0


if __name__ == "__main__":
	sys.exit(main())
