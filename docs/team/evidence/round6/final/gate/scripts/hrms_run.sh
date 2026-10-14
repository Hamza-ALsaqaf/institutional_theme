#!/usr/bin/env bash
set -euo pipefail
BENCH="$1"; shift
args=$(printf '%q ' "$@")
sudo flock -o /tmp/ins-bench.lock runuser -u frappe -- bash -c "export PATH=/usr/local/bin:\$PATH; cd $BENCH/sites && $BENCH/env/bin/python -I $args"
