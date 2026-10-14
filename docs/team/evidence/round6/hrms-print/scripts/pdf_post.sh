#!/usr/bin/env bash
# After print_check.py: fonts, page info and PNGs of every PDF in a folder (poppler-utils), as the round-4 gate kept them.
#   pdf_post.sh <print-dir>
set -uo pipefail
D="$(realpath "$1")"; cd "${D}" || exit 1
mkdir -p png
: > pdffonts.txt; : > pdfinfo.txt
for f in *.pdf; do
	{ echo "== ${f}"; pdffonts "${f}"; echo; } >> pdffonts.txt
	{ echo "== ${f}"; pdfinfo "${f}" | grep -E "^(Pages|Page size|Producer)"; echo; } >> pdfinfo.txt
	pdftoppm -png -r 60 -f 1 -l 1 -singlefile "${f}" "png/${f%.pdf}"
done
