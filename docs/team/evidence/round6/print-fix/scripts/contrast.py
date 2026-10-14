"""Contrast from rendered pixels: locate a word with pdftotext -bbox, rasterise at 400 dpi, take the darkest pixel in its box
as ink and the most frequent colour in a margin around it as background; WCAG 2.x contrast ratio.
    python3 contrast.py FILE.pdf WORD [WORD...]"""
import re
import subprocess
import sys
from collections import Counter

from PIL import Image

DPI = 400


def lum(c):
	def f(v):
		v /= 255
		return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
	return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def ratio(a, b):
	la, lb = sorted((lum(a), lum(b)), reverse=True)
	return (la + 0.05) / (lb + 0.05)


f = sys.argv[1]
xml = subprocess.run(["pdftotext", "-f", "1", "-l", "1", "-bbox", f, "-"], capture_output=True, text=True).stdout
subprocess.run(["pdftoppm", "-png", "-r", str(DPI), "-f", "1", "-l", "1", "-singlefile", f, "/tmp/pf_c"], check=True)
im = Image.open("/tmp/pf_c.png").convert("RGB")
k = DPI / 72
for w in sys.argv[2:]:
	m = re.search(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">%s</word>' % re.escape(w), xml)
	if not m:
		print(w, "not found")
		continue
	x0, y0, x1, y1 = [float(v) * k for v in m.groups()]
	box = im.crop((int(x0), int(y0), int(x1) + 1, int(y1) + 1))
	ink = min(box.getdata(), key=sum)
	pad = im.crop((int(x0) - 6, int(y0) - 4, int(x1) + 7, int(y1) + 5))
	bg = Counter(pad.getdata()).most_common(1)[0][0]
	print(f"{f.split('/')[-1]} {w!r}: ink {ink} on {bg} = {ratio(ink, bg):.2f}:1")
