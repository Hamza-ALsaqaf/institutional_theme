"""Size budgets for the built bundles and the bundled fonts (docs/BRIEF.md section 8, "Budgets").

The brief states three figures, and those are used as written (1 KB = 1024 bytes):

- desk theme CSS, about 150 KB unminified: `ins_desk.bundle.css`, raw 150 KB;
- login and website CSS, about 60 KB: `ins_web.bundle.css`, raw 60 KB;
- fonts, about 350 KB of WOFF2 for the default subsets: the WOFF2 files of one pairing, raw 350 KB
  (the pairings other than the default load only when selected, so each is measured on its own; the
  TTF files are for print only, are never sent to a screen, and are listed without a budget).

The brief gives no gzip figure and no figure for the other bundles. These were chosen, each at roughly
twice what the bundle weighed when the budget was written, so a regression shows before it matters:

- gzip of the desk and web CSS: 30 KB and 12 KB (the same ratio as the raw budgets);
- palette CSS 16 KB raw, 4 KB gzip (one palette, both modes, about 110 variables each);
- font-pairing CSS 6 KB raw, 2 KB gzip (the `@font-face` blocks of one pairing);
- email CSS 12 KB raw, 4 KB gzip (it is inlined into every mail, and mail clients clip large messages);
- print CSS 24 KB raw, 6 KB gzip (it is stored in the Print Style and sent to the PDF engine each time);
- shell script 24 KB raw, 8 KB gzip, website script 4 KB raw, 2 KB gzip ("small, defensive" JavaScript).

An `ins_*` bundle with no entry here fails the audit: a new bundle must come with a budget.
The measured file is the one Frappe built, which is minified; the brief's desk figure is "unminified",
so the desk limit is lenient by the minification factor. The unminified size is NOT checked here.

A bundle may exceed its budget only with an entry in `JUSTIFIED` (limit and reason). It is empty.

The built files come from `--dist DIR` (a folder holding `css/`, `css-rtl/` and `js/`, such as
`institutional_theme/public/dist` or `sites/assets/institutional_theme/dist`) or, without it, from a
bench: `sites/assets/assets.json` under `$BENCH_DIR` (default `/home/user/frappe-bench`). With no built
files the audit says "not built" and passes, so CI (which builds nothing) is not blocked.
Where a folder holds several hashed builds of one bundle, the newest is measured.
Never imports Frappe.
"""

from __future__ import annotations

import gzip
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

KB = 1024
PACKAGE_DIR = Path(__file__).resolve().parents[1]
FONTS_DIR = PACKAGE_DIR / "public" / "fonts"
DEFAULT_BENCH = "/home/user/frappe-bench"
ASSET_PREFIX = "/assets/institutional_theme/dist/"

# Reasons for an accepted excess: {"ins_web.bundle.css": (limit_in_bytes, "why")}. Empty on purpose.
JUSTIFIED: dict[str, tuple[int, str]] = {}


@dataclass(frozen=True)
class Budget:
	raw: int
	gzip: int
	origin: str  # "brief" for the raw figure of a stated budget, "chosen" otherwise


BUDGETS: dict[str, Budget] = {
	"ins_desk.bundle.css": Budget(150 * KB, 30 * KB, "brief"),
	"ins_web.bundle.css": Budget(60 * KB, 12 * KB, "brief"),
	"ins_palette_*.bundle.css": Budget(16 * KB, 4 * KB, "chosen"),
	"ins_fonts_*.bundle.css": Budget(6 * KB, 2 * KB, "chosen"),
	"ins_email.bundle.css": Budget(12 * KB, 4 * KB, "chosen"),
	"ins_print.bundle.css": Budget(24 * KB, 6 * KB, "chosen"),
	"ins_shell.bundle.js": Budget(24 * KB, 8 * KB, "chosen"),
	"ins_web.bundle.js": Budget(4 * KB, 2 * KB, "chosen"),
}
FONT_PAIRING_BUDGET = 350 * KB

_HASHED = re.compile(r"^(?P<name>ins_[A-Za-z0-9_]+\.bundle)\.(?P<hash>[A-Z0-9]{8})\.(?P<ext>css|js)$")


@dataclass(frozen=True)
class Measure:
	label: str  # "ltr" or "rtl" (CSS), "js", or "fonts"
	name: str  # logical name, `ins_desk.bundle.css`
	file: str
	raw: int
	gz: int
	budget: Budget | None
	limit_raw: int | None
	limit_gz: int | None
	problems: tuple[str, ...]


def gzip_size(data: bytes) -> int:
	return len(gzip.compress(data, 9, mtime=0))


def logical_name(filename: str) -> str | None:
	"""`ins_desk.bundle.KBBUYUPB.css` -> `ins_desk.bundle.css`; `None` when it is not a hashed ins bundle."""
	match = _HASHED.match(filename)
	return f"{match['name']}.{match['ext']}" if match else None


def budget_for(name: str) -> Budget | None:
	if name in BUDGETS:
		return BUDGETS[name]
	for pattern, budget in BUDGETS.items():
		if "*" in pattern and re.fullmatch(re.escape(pattern).replace(r"\*", ".+"), name):
			return budget
	return None


def check(label: str, name: str, file: str, data: bytes) -> Measure:
	"""Measure one built file against its budget."""
	raw, gz = len(data), gzip_size(data)
	budget = budget_for(name)
	if budget is None:
		return Measure(label, name, file, raw, gz, None, None, None, ("no budget declared for this bundle",))
	limit_raw, limit_gz = budget.raw, budget.gzip
	problems: list[str] = []
	if name in JUSTIFIED:
		limit_raw = max(limit_raw, JUSTIFIED[name][0])
	if raw > limit_raw:
		problems.append(f"raw {raw} B exceeds {limit_raw} B ({limit_raw / KB:g} KB)")
	if gz > limit_gz:
		problems.append(f"gzip {gz} B exceeds {limit_gz} B ({limit_gz / KB:g} KB)")
	return Measure(label, name, file, raw, gz, budget, limit_raw, limit_gz, tuple(problems))


# ----------------------------------------------------------------------------------------------
# Finding the built files
# ----------------------------------------------------------------------------------------------


def _newest(paths: list[Path]) -> Path:
	return max(paths, key=lambda p: (p.stat().st_mtime, p.name))


def scan_dist(dist: Path) -> list[tuple[str, str, Path]]:
	"""`(label, logical name, path)` for the newest build of each bundle in `css/`, `css-rtl/`, `js/`."""
	found: list[tuple[str, str, Path]] = []
	for folder, label in (("css", "ltr"), ("css-rtl", "rtl"), ("js", "js")):
		groups: dict[str, list[Path]] = {}
		base = dist / folder
		if not base.is_dir():
			continue
		for path in base.iterdir():
			name = logical_name(path.name)
			if name:
				groups.setdefault(name, []).append(path)
		for name in sorted(groups):
			found.append((label, name, _newest(groups[name])))
	return found


def bench_dist(bench: Path) -> Path | None:
	"""The built dist folder of a bench, checked against `assets.json`; `None` when it is not built."""
	assets = bench / "sites" / "assets"
	manifest = assets / "assets.json"
	if not manifest.is_file():
		return None
	try:
		entries = json.loads(manifest.read_text(encoding="utf-8"))
	except Exception:  # an unreadable or malformed manifest means "not built"
		return None
	if not any(
		isinstance(url, str) and url.startswith(ASSET_PREFIX) and (assets / url[len("/assets/") :]).is_file()
		for key, url in entries.items()
		if key.startswith("ins_")
	):
		return None
	return assets / "institutional_theme" / "dist"


def locate(dist_arg: str | None, environ: dict[str, str] | None = None) -> tuple[Path | None, str]:
	"""`(dist folder or None, description of where it came from)`."""
	environ = os.environ if environ is None else environ
	if dist_arg:
		path = Path(dist_arg)
		return (path if path.is_dir() else None), f"--dist {dist_arg}"
	bench = Path(environ.get("BENCH_DIR") or DEFAULT_BENCH)
	return bench_dist(bench), f"bench {bench}"


# ----------------------------------------------------------------------------------------------
# Fonts
# ----------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class FontPairing:
	name: str
	woff2: tuple[tuple[str, int, int], ...]  # file, raw, gzip
	ttf: tuple[tuple[str, int], ...]

	@property
	def woff2_total(self) -> int:
		return sum(raw for _, raw, _ in self.woff2)


def scan_fonts(fonts_dir: Path = FONTS_DIR) -> list[FontPairing]:
	pairings = []
	if not fonts_dir.is_dir():
		return pairings
	for folder in sorted(p for p in fonts_dir.iterdir() if p.is_dir()):
		woff2 = tuple(
			(p.name, p.stat().st_size, gzip_size(p.read_bytes())) for p in sorted(folder.glob("*.woff2"))
		)
		ttf = tuple((p.name, p.stat().st_size) for p in sorted(folder.glob("*.ttf")))
		pairings.append(FontPairing(folder.name, woff2, ttf))
	return pairings


def font_problems(pairings: list[FontPairing], limit: int = FONT_PAIRING_BUDGET) -> list[str]:
	return [
		f"fonts/{p.name}: WOFF2 total {p.woff2_total} B exceeds {limit} B ({limit / KB:g} KB)"
		for p in pairings
		if p.woff2_total > limit
	]


# ----------------------------------------------------------------------------------------------
# Report
# ----------------------------------------------------------------------------------------------


def _kb(value: int | None) -> str:
	return "-" if value is None else f"{value / KB:.1f}"


def render_text(
	measures: list[Measure], pairings: list[FontPairing], source: str, problems: list[str]
) -> str:
	lines = [
		"Size budgets (docs/BRIEF.md section 8). Generated by python -m institutional_theme.audits; do not edit.",
		f"Source: {source}. 1 KB = 1024 bytes. Measured files are minified, as built.",
		"",
		f"{'bundle':<32}{'dir':<5}{'raw KB':>8}{'limit':>8}{'gzip KB':>9}{'limit':>8}  {'budget':<7}status",
	]
	for m in measures:
		status = "ok" if not m.problems else "FAIL: " + "; ".join(m.problems)
		origin = m.budget.origin if m.budget else "none"
		lines.append(
			f"{m.name:<32}{m.label:<5}{_kb(m.raw):>8}{_kb(m.limit_raw):>8}{_kb(m.gz):>9}{_kb(m.limit_gz):>8}  "
			f"{origin:<7}{status}"
		)
	lines += ["", f"Fonts, WOFF2 per pairing (budget {FONT_PAIRING_BUDGET // KB} KB raw, from the brief):"]
	for pairing in pairings:
		total = pairing.woff2_total
		status = "ok" if total <= FONT_PAIRING_BUDGET else "FAIL"
		gz = sum(g for _, _, g in pairing.woff2)
		lines.append(
			f"  {pairing.name:<10}{len(pairing.woff2)} files  raw {_kb(total):>7} KB  gzip {_kb(gz):>7} KB  {status}"
		)
		for name, raw, g in pairing.woff2:
			lines.append(f"      {name:<48}{_kb(raw):>7} KB  gzip {_kb(g):>7} KB")
		if pairing.ttf:
			ttf_total = sum(size for _, size in pairing.ttf)
			lines.append(
				f"      {len(pairing.ttf)} TTF files for print only, {_kb(ttf_total)} KB (never sent to a screen; no budget)"
			)
	lines += ["", "RESULT: " + (f"{len(problems)} problem(s)" if problems else "within budget")]
	lines += [f"  {p}" for p in problems]
	return "\n".join(lines) + "\n"


@dataclass(frozen=True)
class Outcome:
	ran: bool
	problems: tuple[str, ...]
	text: str


def run(
	dist_arg: str | None = None, fonts_dir: Path = FONTS_DIR, environ: dict[str, str] | None = None
) -> Outcome:
	dist, source = locate(dist_arg, environ)
	if dist is None:
		return Outcome(False, (), f"budgets: not built ({source} has no ins_* bundles); skipped")
	files = scan_dist(dist)
	if not files:
		return Outcome(False, (), f"budgets: not built ({dist} holds no ins_* bundles); skipped")
	measures = [check(label, name, path.name, path.read_bytes()) for label, name, path in files]
	pairings = scan_fonts(fonts_dir)
	problems = [f"{m.name} ({m.label}): {p}" for m in measures for p in m.problems] + font_problems(pairings)
	return Outcome(
		True, tuple(problems), render_text(measures, pairings, f"{source}, folder {dist}", problems)
	)


def main(argv: list[str] | None = None) -> int:
	import argparse
	import sys

	parser = argparse.ArgumentParser(prog="python -m institutional_theme.audits.budgets", description=__doc__)
	parser.add_argument("--dist", metavar="DIR", help="built dist folder (css/, css-rtl/, js/)")
	args = parser.parse_args(argv)
	outcome = run(args.dist)
	sys.stdout.write(outcome.text + ("\n" if not outcome.text.endswith("\n") else ""))
	return 1 if outcome.problems else 0


if __name__ == "__main__":
	raise SystemExit(main())
