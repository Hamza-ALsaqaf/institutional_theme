"""python overflow.py PDF...  -> for page 1: page width, max word xMax from `pdftotext -bbox`, words whose xMax exceeds the page width,
and the expected English labels that are absent. Clipped = any word past the page width, or a label absent."""
import re, subprocess, sys
LABELS = ("Date", "Till", "Amount", "Rate", "154,000.00", "208,500.00")  # Arabic runs: only the two figures are checked in the table
for f in sys.argv[1:]:
	html = subprocess.run(["pdftotext", "-f", "1", "-l", "1", "-bbox", f, "-"], capture_output=True, text=True).stdout
	pw = float(re.search(r'<page width="([\d.]+)"', html).group(1))
	words = [(float(m.group(2)), m.group(3)) for m in re.finditer(r'<word xMin="([\d.]+)" yMin="[\d.]+" xMax="([\d.]+)" yMax="[\d.]+">(.*?)</word>', html)]
	over = [w for x, w in words if x > pw + 0.5]
	have = {w for _, w in words}
	missing = [l for l in LABELS if l not in have]
	print(f, f"page_w={pw}", f"max_x={max(x for x,_ in words):.1f}", "over=", over[:6], "missing=", missing)
