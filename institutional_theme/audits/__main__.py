"""Audit runner.

    python -m institutional_theme.audits [--core-css [VERSION=]PATH ...] [--write-core-snapshot]
                                         [--dist DIR] [--no-write] [--strict]

Runs the contrast, avatar, parity, colour-vision and dead-token audits against the generated model and
stylesheets, writes the reports to docs/audits/, and exits 1 when a SHIPPED preset fails a contrast
pair (or one of the nine desk avatar pairs, `avatars.py`) or the status check, when a built bundle or the fonts exceed a size budget (`budgets.py`;
skipped with a message when nothing is built, so CI is not blocked), when a generated file breaks parity, or when a variable the theme
overrides is neither in core nor used by the theme of ANY supported Frappe version. Core is read
from one committed snapshot per version (`audits/data/core_vars_frappe_<version>.json`); `--core-css`
names compiled stylesheets of a version (`16.52.0=PATH`; a bare PATH stands for 16.32.0) and replaces that
version's snapshot for the run, so several builds can be scanned at once. `--write-core-snapshot` (with
`--core-css`) writes the snapshot of each version named. Chart-series gaps are reported and only fatal
with `--strict`. Never imports Frappe.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from institutional_theme.midad import model as model_mod

from . import avatars, budgets, colour_vision, contrast, dead_tokens, parity

PACKAGE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = PACKAGE_DIR.parent
SCSS_DIR = PACKAGE_DIR / "public" / "scss" / "generated"
AUDITS_DIR = REPO_ROOT / "docs" / "audits"


def _shown(path: Path) -> Path:
	"""The path relative to the repository when it is inside it."""
	return path.relative_to(REPO_ROOT) if path.is_relative_to(REPO_ROOT) else path


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(prog="python -m institutional_theme.audits", description=__doc__)
	parser.add_argument(
		"--core-css",
		action="append",
		default=[],
		metavar="PATH",
		help="compiled core CSS file or folder to scan instead of the committed snapshot (repeatable)",
	)
	parser.add_argument(
		"--write-core-snapshot",
		action="store_true",
		help="with --core-css, write the committed snapshot of each version named (core_vars_frappe_<version>.json)",
	)
	parser.add_argument(
		"--dist",
		metavar="DIR",
		help="built dist folder (css/, css-rtl/, js/) for the size budgets; default: the bench's assets",
	)
	parser.add_argument("--no-write", action="store_true", help="print results without writing docs/audits")
	parser.add_argument("--strict", action="store_true", help="treat chart-series gaps as failures")
	args = parser.parse_args(argv)

	model = model_mod.load_model()
	palettes = {name: model_mod.palette(model, name) for name in model["palettes"]["presets"]}
	shipped = model["palettes"]["shipped"]
	failures = 0
	outputs: dict[str, str] = {}

	print(f"Presets: {', '.join(model['palettes']['presets'])}; shipped: {', '.join(shipped)}")

	# Contrast
	presets = contrast.run(model, palettes)
	outputs["contrast.txt"] = contrast.render_text(model, presets)
	outputs["contrast.json"] = contrast.render_json(model, presets)
	for preset in presets:
		for mode in model_mod.MODES:
			failed = [r for r in preset.failures if r.mode == mode]
			status = "pass" if not failed else "FAIL"
			note = "" if preset.shipped else " (not shipped)"
			print(f"contrast  {preset.name:9} {mode:5} {status} ({len(failed)} failing){note}")
	count = contrast.fatal_count(presets)
	failures += count
	print(f"contrast: {count} failing pair(s) in shipped presets")

	# Avatar pairs (desk and website remaps of core's nine avatar colours)
	avatar_audit = avatars.run(model, palettes, PACKAGE_DIR / "public")
	outputs["avatar_contrast.txt"] = avatars.render_text(avatar_audit, palettes)
	for problem in avatar_audit.problems:
		print(f"avatars FAIL {problem[:200]}")
	for result in avatar_audit.failures:
		print(
			f"avatars FAIL {result.preset} {result.mode} {result.colour}: "
			f"{result.ratio:.2f}:1, required {avatars.MINIMUM}:1"
		)
	print(
		f"avatars: {len(avatar_audit.results)} pair measurements, "
		f"{len(avatar_audit.failures)} failing in shipped presets, {len(avatar_audit.problems)} problem(s)"
	)
	failures += avatar_audit.fatal

	# Parity
	checks = parity.audit_model(model) + parity.audit_files(model, SCSS_DIR)
	outputs["parity.txt"] = parity.render_text(checks)
	failed_checks = [c for c in checks if not c.passed]
	for check in failed_checks:
		print(f"parity FAIL {check.name}: {'; '.join(check.problems)[:200]}")
	print(f"parity: {len(checks)} checks, {len(failed_checks)} failed")
	failures += len(failed_checks)

	# Colour vision
	lines, vision_failures, chart_gaps = colour_vision.report(model, palettes)
	outputs["colour_vision.txt"] = "\n".join(lines) + "\n"
	print(
		f"colour-vision: {vision_failures} failure(s) (status, neighbouring series, gap not in the "
		f"baseline), {chart_gaps} baselined chart gap(s) in shipped presets"
	)
	failures += vision_failures
	if args.strict:
		failures += chart_gaps

	# Dead tokens: one core per supported version, combined verdict
	groups = dead_tokens.parse_core_css(args.core_css)
	if args.write_core_snapshot and not groups:
		parser.error("--write-core-snapshot needs --core-css")
	cores: dict[str, tuple[dead_tokens.CoreVars, str]] = {}
	for version in dead_tokens.snapshot_versions():
		path = dead_tokens.snapshot_path(version)
		cores[version] = (dead_tokens.load_snapshot(path), f"committed snapshot {_shown(path)}")
	for version, paths in groups.items():
		core = dead_tokens.scan_core(paths)
		origin = "live stylesheets"
		if args.write_core_snapshot:
			target = dead_tokens.snapshot_path(version)
			dead_tokens.write_snapshot(core, target, dead_tokens.snapshot_versions_for(version))
			print(f"wrote {_shown(target)}")
			origin = "live stylesheets (snapshot written)"
		cores[version] = (core, origin)
	if not cores:
		parser.error("no committed core snapshot and no --core-css")
	combined = dead_tokens.audit_versions(model, cores, PACKAGE_DIR / "public")
	outputs["dead_tokens.txt"] = dead_tokens.render_text(combined)
	for entry in combined.versions:
		total = dead_tokens.counts(entry.results)
		print(
			f"dead-tokens {entry.version}: {len(entry.results)} variables: {total['declared-read']} declared and "
			f"read by core, {total['declared-only']} declared only, {total['read-only']} read only, "
			f"{total['theme']} consumed by the theme, {total['dead']} dead in this version"
		)
	specific = dead_tokens.version_specific(combined)
	for version, names in specific.items():
		if len(combined.versions) > 1:
			print(f"dead-tokens {version}: {len(names)} variable(s) read by core only in this version")
	total = dead_tokens.counts(combined.results)
	print(
		f"dead-tokens: combined over {', '.join(v.version for v in combined.versions)}: "
		f"{len(combined.results)} variables: {total['declared-read']} declared and read by core, "
		f"{total['declared-only']} declared only, {total['read-only']} read only, "
		f"{total['theme']} consumed by the theme, {total['dead']} dead in every version"
	)
	for name in combined.dead:
		print(f"dead-tokens FAIL {name}: in no supported version's core and not used by the theme")
	failures += total["dead"]

	# Size budgets: only when a build exists; the committed report is kept otherwise.
	sizes = budgets.run(args.dist)
	if sizes.ran:
		outputs["budgets.txt"] = sizes.text
		print(f"budgets: {len(sizes.problems)} problem(s)")
		for problem in sizes.problems:
			print(f"budgets FAIL {problem}")
	else:
		print(sizes.text)
	failures += len(sizes.problems)

	if not args.no_write:
		AUDITS_DIR.mkdir(parents=True, exist_ok=True)
		for name, text in outputs.items():
			(AUDITS_DIR / name).write_text(text, encoding="utf-8", newline="\n")
		print(f"wrote {', '.join(outputs)} to docs/audits")
	print("audits: FAILED" if failures else "audits: passed")
	return 1 if failures else 0


if __name__ == "__main__":
	sys.exit(main())
