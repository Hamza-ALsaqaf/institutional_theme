"""Audit runner.

    python -m institutional_theme.audits [--core-css PATH ...] [--no-write] [--strict]

Runs the contrast, parity, colour-vision and (with `--core-css`) dead-token audits against the
generated model and stylesheets, writes the reports to docs/audits/, and exits 1 when a SHIPPED
preset fails a contrast pair or the status check, when a generated file breaks parity, or when a
core variable the theme overrides does not exist. Chart-series gaps are reported and only fatal
with `--strict`. Never imports Frappe.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from institutional_theme.midad import model as model_mod

from . import colour_vision, contrast, dead_tokens, parity

PACKAGE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = PACKAGE_DIR.parent
SCSS_DIR = PACKAGE_DIR / "public" / "scss" / "generated"
AUDITS_DIR = REPO_ROOT / "docs" / "audits"


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(prog="python -m institutional_theme.audits", description=__doc__)
	parser.add_argument(
		"--core-css",
		action="append",
		default=[],
		metavar="PATH",
		help="compiled core CSS file or folder; enables the dead-token audit (repeatable)",
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

	# Parity
	checks = parity.audit_model(model) + parity.audit_files(model, SCSS_DIR)
	outputs["parity.txt"] = parity.render_text(checks)
	failed_checks = [c for c in checks if not c.passed]
	for check in failed_checks:
		print(f"parity FAIL {check.name}: {'; '.join(check.problems)[:200]}")
	print(f"parity: {len(checks)} checks, {len(failed_checks)} failed")
	failures += len(failed_checks)

	# Colour vision
	lines, status_failures, chart_gaps = colour_vision.report(model, palettes)
	outputs["colour_vision.txt"] = "\n".join(lines) + "\n"
	print(f"colour-vision: {status_failures} status failure(s), {chart_gaps} chart gap(s) in shipped presets")
	failures += status_failures
	if args.strict:
		failures += chart_gaps

	# Dead tokens
	if args.core_css:
		core_paths = [Path(p) for p in args.core_css]
		results = dead_tokens.audit(model, core_paths, PACKAGE_DIR / "public")
		outputs["dead_tokens.txt"] = dead_tokens.render_text(results, core_paths)
		dead = [r for r in results if r.where == "dead"]
		print(f"dead-tokens: {len(results)} variables checked, {len(dead)} dead")
		failures += len(dead)
	else:
		print("dead-tokens: not run (no --core-css PATH given)")

	if not args.no_write:
		AUDITS_DIR.mkdir(parents=True, exist_ok=True)
		for name, text in outputs.items():
			(AUDITS_DIR / name).write_text(text, encoding="utf-8", newline="\n")
		print(f"wrote {', '.join(outputs)} to docs/audits")
	print("audits: FAILED" if failures else "audits: passed")
	return 1 if failures else 0


if __name__ == "__main__":
	sys.exit(main())
