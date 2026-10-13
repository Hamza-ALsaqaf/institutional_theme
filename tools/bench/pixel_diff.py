"""Compare two screenshots pixel by pixel.

Usage: python3 pixel_diff.py A.png B.png [--out diff.png]

Prints one line of JSON: sizes, count and share of differing pixels, the largest channel
difference and the bounding box of the difference. Exit code 0 when identical, 1 when they
differ, 2 when the sizes differ. Needs Pillow and numpy.
"""

import argparse
import json
import sys

import numpy as np
from PIL import Image


def compare(path_a: str, path_b: str, out: str | None = None) -> tuple[dict, int]:
	a = Image.open(path_a).convert("RGB")
	b = Image.open(path_b).convert("RGB")
	if a.size != b.size:
		return {
			"a": path_a,
			"b": path_b,
			"identical": False,
			"reason": "size differs",
			"size_a": a.size,
			"size_b": b.size,
		}, 2

	pa = np.asarray(a, dtype=np.int16)
	pb = np.asarray(b, dtype=np.int16)
	delta = np.abs(pa - pb).max(axis=2)
	changed = delta > 0
	count = int(changed.sum())
	result: dict = {
		"a": path_a,
		"b": path_b,
		"size": a.size,
		"differing_pixels": count,
		"differing_share": round(count / changed.size, 6),
		"max_channel_delta": int(delta.max()),
		"identical": count == 0,
	}
	if count:
		ys, xs = np.nonzero(changed)
		result["bbox_x0_y0_x1_y1"] = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
		if out:
			mask = np.zeros((*changed.shape, 3), dtype=np.uint8)
			mask[changed] = (255, 0, 0)
			Image.fromarray(mask).save(out)
			result["diff_image"] = out
	return result, 0 if count == 0 else 1


def main() -> int:
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("a")
	parser.add_argument("b")
	parser.add_argument("--out", default=None, help="write a red-on-black mask of the changed pixels")
	args = parser.parse_args()
	result, code = compare(args.a, args.b, args.out)
	print(json.dumps(result))
	return code


if __name__ == "__main__":
	sys.exit(main())
