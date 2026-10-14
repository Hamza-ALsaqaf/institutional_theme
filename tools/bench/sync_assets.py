"""Make two benches that share this repository's institutional_theme/public/dist agree on its bundle names.

Both benches symlink apps/institutional_theme to the same working copy, so they share one dist folder. Every
`bench build --app institutional_theme` writes new content-hashed file names there and deletes the old ones, which leaves
the other bench's sites/assets/assets.json (and assets-rtl.json) pointing at files that are gone (404 on the desk
stylesheet). The theme's bundles import no Frappe SCSS, so their content does not depend on the Frappe version
and the entries of the bench that was built last can be copied into the other.

    python sync_assets.py [--check] BENCH_A BENCH_B

Whichever bench's ins_desk entry points at an existing file is the source; both existing is a no-op. Only keys that
belong to the theme (`ins_*`, `rtl_ins_*`) are written. Run it as the bench user (the files belong to it).
"""

import json
import sys
from pathlib import Path

FILES = ("assets.json", "assets-rtl.json")


def is_theme_key(key: str) -> bool:
	return key.startswith(("ins_", "rtl_ins_"))


def load(bench: Path, name: str) -> dict:
	return json.loads((bench / "sites" / "assets" / name).read_text())


def target(bench: Path, url: str) -> Path:
	"""Disk path of an /assets/institutional_theme/... URL in a bench (the assets folder holds a symlink)."""
	return bench / "sites" / url.removeprefix("/")


def missing(bench: Path) -> list[str]:
	"""Theme entries of a bench whose file does not exist."""
	lost = []
	for name in FILES:
		for key, url in load(bench, name).items():
			if is_theme_key(key) and not target(bench, url).exists():
				lost.append(f"{name}:{key}")
	return lost


def sync(src: Path, dst: Path) -> int:
	changed = 0
	for name in FILES:
		have = load(src, name)
		path = dst / "sites" / "assets" / name
		current = json.loads(path.read_text())
		for key, url in have.items():
			if is_theme_key(key) and current.get(key) != url:
				current[key] = url
				changed += 1
		path.write_text(json.dumps(current, indent=1) + "\n")
	return changed


def main(argv: list[str]) -> int:
	check = "--check" in argv
	paths = [Path(a) for a in argv if not a.startswith("--")]
	if len(paths) != 2:
		print(__doc__)
		return 2
	lost = {str(p): missing(p) for p in paths}
	for bench, items in lost.items():
		print(
			f"{bench}: {len(items)} theme entries point at missing files"
			+ (f" ({', '.join(items[:3])}...)" if items else "")
		)
	good = [p for p in paths if not lost[str(p)]]
	if len(good) == 2:
		print("both benches are consistent: nothing to do")
		return 0
	if not good:
		print(
			"neither bench is consistent: run `bench build --app institutional_theme` on one of them first",
			file=sys.stderr,
		)
		return 1
	if check:
		return 1
	src = good[0]
	dst = paths[1] if src == paths[0] else paths[0]
	print(f"copied {sync(src, dst)} entries from {src} to {dst}")
	return 0


if __name__ == "__main__":
	sys.exit(main(sys.argv[1:]))
