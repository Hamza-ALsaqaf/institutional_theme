#!/usr/bin/env bash
# usage: run_print_check.sh <bench-dir> <site> <outdir>
# Runs print_check.py with the bench Python as the bench user, under the shared lock, with the patched wkhtmltopdf first on PATH.
set -euo pipefail
BENCH="$1"; SITE="$2"; OUT="$3"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="/tmp/ins-print-$(basename "$BENCH")"
sudo rm -rf "$TMP"; sudo install -d -o frappe -g frappe "$TMP"
sudo -E flock -o /tmp/ins-bench.lock runuser -u frappe -- bash -c "export PATH=/tmp/wk/x/usr/local/bin:\$PATH; wkhtmltopdf -V; cd $BENCH/sites && $BENCH/env/bin/python $HERE/${SCRIPT:-print_check.py} $SITE $TMP"
mkdir -p "$OUT"; sudo cp -r "$TMP"/. "$OUT"/; sudo chown -R "$(id -u):$(id -g)" "$OUT"
