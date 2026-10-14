"""Count the horizontal frame bands (top and bottom borders) of the Draft watermark in Chrome PDFs.
    python3 wm_measure.py FILE.pdf ...   -> prints name, bands as (first_row,last_row) at 100 dpi, vertical-edge columns
A whole frame has 2 horizontal bands (6 px border = about 8 rows at 100 dpi) and 2 vertical bands.
"""
import subprocess
import sys

import numpy as np
from PIL import Image

for f in sys.argv[1:]:
	subprocess.run(["pdftoppm", "-png", "-r", "100", "-f", "1", "-l", "1", "-singlefile", f, "/tmp/pf_wm"], check=True)
	a = np.asarray(Image.open("/tmp/pf_wm.png").convert("RGB")).astype(int)
	h, w, _ = a.shape
	m = (abs(a[:, :, 0] - 226) <= 8) & (abs(a[:, :, 1] - 227) <= 8) & (abs(a[:, :, 2] - 228) <= 8)
	lo, hi = int(0.17 * w), int(0.83 * w)
	rows = np.where(m[:, lo:hi].mean(axis=1) > 0.9)[0]

	def bands(ix):
		out = []
		for i in ix:
			if out and i - out[-1][1] <= 1:
				out[-1][1] = i
			else:
				out.append([i, i])
		return [tuple(b) for b in out]

	hb = bands(rows)
	cols = np.where(m.mean(axis=0) > 0.12)[0]
	vb = bands(cols)
	print(f.split("/")[-1], "hbands", [(int(a), int(b)) for a, b in hb], "vcols", [(int(a), int(b)) for a, b in vb])
