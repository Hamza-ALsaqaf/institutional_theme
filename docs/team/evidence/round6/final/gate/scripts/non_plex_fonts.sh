#!/usr/bin/env bash
# Lists, per PDF, every embedded font that is not IBM Plex (reads a pdffonts.txt written by pdf_post.sh). No output = Plex only.
#   non_plex_fonts.sh <pdffonts.txt>
awk '/^== /{f=$2} /^[A-Za-z0-9+-]+ +(Type|CID)/{n=$1; sub(/^[A-Z]{6}\+/,"",n); if (n !~ /^IBMPlex/) c[f" "n]++} END{for(k in c) print c[k], k}' "$1" | sort -k2
