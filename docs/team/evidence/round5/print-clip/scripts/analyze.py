"""python analyze.py PDFDIR PNGDIR > table: per PDF page size, pages, rightmost non-white column of page 1 (fraction of width), words found."""
import glob, os, re, subprocess, sys, json
pdfdir, pngdir = sys.argv[1:3]
os.makedirs(pngdir, exist_ok=True)
out = {}
for f in sorted(glob.glob(f"{pdfdir}/*.pdf")):
	b = os.path.basename(f)[:-4]
	info = subprocess.run(["pdfinfo", f], capture_output=True, text=True).stdout
	size = re.search(r"Page size:\s+(.*)", info).group(1)
	pages = int(re.search(r"Pages:\s+(\d+)", info).group(1))
	pre = f"{pngdir}/{b}"
	subprocess.run(["pdftoppm", "-png", "-r", "50", "-f", "1", "-l", "1", "-singlefile", f, pre], check=True)
	subprocess.run(["pdftoppm", "-gray", "-r", "50", "-f", "1", "-l", "1", "-singlefile", f, pre + "_g"], check=True)
	data = open(pre + "_g.pgm", "rb").read()
	os.remove(pre + "_g.pgm")
	m = re.match(rb"P5\s+(\d+)\s+(\d+)\s+255\s", data)
	w, h = int(m.group(1)), int(m.group(2)); px = data[m.end():]
	right = left = None
	for x in range(w - 1, -1, -1):
		if any(px[y * w + x] < 200 for y in range(h)):
			right = x; break
	for x in range(w):
		if any(px[y * w + x] < 200 for y in range(h)):
			left = x; break
	txt = subprocess.run(["pdftotext", "-f", "1", "-l", "1", "-layout", f, "-"], capture_output=True, text=True).stdout
	allt = subprocess.run(["pdftotext", "-layout", f, "-"], capture_output=True, text=True).stdout
	words = {k: (k in allt) for k in ("Posting Date", "Valid Till", "Amount", "Rate", "Qty", "Grand Total", "تاريخ", "الصلاحية", "المبلغ", "الإجمالي")}
	out[b] = {"page_size": size, "pages": pages, "width_px": w, "left_frac": round(left / w, 3), "right_frac": round((right + 1) / w, 3), "words": words}
	print(b, size, pages, "left", round(left / w, 3), "right", round((right + 1) / w, 3), {k: v for k, v in words.items() if v})
json.dump(out, open(f"{pdfdir}/analysis.json", "w"), indent=1, ensure_ascii=False)
