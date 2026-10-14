"""montage.py DIR VARIANT : side-by-side (en | ar) first page PNGs per format and generator, 80 dpi."""
import glob, os, subprocess, sys
from PIL import Image
d, variant = sys.argv[1:3]
os.makedirs(f"{d}/m", exist_ok=True)
slugs = sorted({os.path.basename(p).split("__")[1] for p in glob.glob(f"{d}/{variant}__*.pdf")})
for s in slugs:
    for gen in ("wkhtmltopdf", "chrome"):
        ims = []
        for lang in ("en", "ar"):
            pdf = f"{d}/{variant}__{s}__{gen}-{lang}.pdf"
            if not os.path.exists(pdf): ims=[]; break
            base = f"/tmp/hp/tmp_{lang}"
            subprocess.run(["pdftoppm", "-png", "-r", "80", "-f", "1", "-l", "1", "-singlefile", pdf, base], check=True)
            ims.append(Image.open(base + ".png").convert("RGB"))
        if not ims: continue
        w = sum(i.width for i in ims) + 10; h = max(i.height for i in ims)
        m = Image.new("RGB", (w, h), (200, 60, 60))
        m.paste(ims[0], (0, 0)); m.paste(ims[1], (ims[0].width + 10, 0))
        m.save(f"{d}/m/{variant}__{s}__{gen}.png", optimize=True)
