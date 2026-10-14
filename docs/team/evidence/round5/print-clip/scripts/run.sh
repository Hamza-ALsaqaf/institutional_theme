#!/usr/bin/env bash
# run.sh BENCH SITE OUTDIR VARIANT [FORMAT]
set -euo pipefail
BENCH="$1"; SITE="$2"; OUT="$3"; V="$4"; F="${5:-}"
install -d -m 777 "$OUT"
sudo flock -o /tmp/ins-bench.lock runuser -u frappe -- bash -c "export PATH=/usr/local/bin:\$PATH; cd $BENCH/sites && $BENCH/env/bin/python /tmp/pw/render.py $SITE $OUT $V ${F:+\"$F\"}"
