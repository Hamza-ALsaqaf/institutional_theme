#!/usr/bin/env bash
# Run a python script with the bench interpreter in the sites folder, as the bench user, under the shared lock.
#   run_py.sh SCRIPT ARGS...   (wkhtmltopdf with patched Qt first on PATH)
set -euo pipefail
script="$1"; shift
exec sudo -E flock -o /tmp/ins-bench.lock runuser -u frappe -- env HOME=/home/frappe \
	PATH="/tmp/wk/x/usr/local/bin:/opt/hostedtoolcache/node/24.21.0/x64/bin:/home/frappe/.local/bin:/usr/local/bin:/usr/bin:/bin" \
	bash -c 'cd /home/frappe/frappe-bench/sites && exec ../env/bin/python "$@"' _ "$script" "$@"
