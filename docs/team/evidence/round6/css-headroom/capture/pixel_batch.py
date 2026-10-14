"""Pixel diff of every screenshot pair of two capture folders, with tools/bench/pixel_diff.py.

    python3 pixel_batch.py BEFORE_DIR AFTER_DIR [--diffs DIR]

One line per pair (differing pixels, largest channel delta, bounding box) and a total; exit status 1 when any pair
differs or is missing. With --diffs, a diff image is written for every differing pair.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[6] / "tools" / "bench"))
from pixel_diff import compare  # noqa: E402


def main(argv: list[str]) -> int:
	if len(argv) < 3:
		print(__doc__)
		return 2
	before, after = Path(argv[1]) / "screens", Path(argv[2]) / "screens"
	diffs = Path(argv[argv.index("--diffs") + 1]) if "--diffs" in argv else None
	if diffs:
		diffs.mkdir(parents=True, exist_ok=True)
	names = sorted(p.name for p in before.glob("*.png"))
	problems = 0
	total_pixels = 0
	for name in names:
		if not (after / name).is_file():
			print(f"MISSING {name}")
			problems += 1
			continue
		out = str(diffs / name) if diffs else None
		result, code = compare(str(before / name), str(after / name), out)
		if code == 0:
			print(f"same {name}")
		else:
			problems += 1
			total_pixels += result.get("differing_pixels", 0)
			print(
				f"DIFF {name}: pixels {result.get('differing_pixels')}, max channel delta {result.get('max_channel_delta')}, "
				f"bbox {result.get('bbox_x0_y0_x1_y1', result.get('reason'))}"
			)
	print(f"{len(names)} pairs, {problems} differ or missing, {total_pixels} differing pixels in total")
	return 1 if problems else 0


if __name__ == "__main__":
	sys.exit(main(sys.argv))
