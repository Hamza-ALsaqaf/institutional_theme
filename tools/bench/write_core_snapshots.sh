#!/usr/bin/env bash
# Rewrite the committed dead-token snapshots (institutional_theme/audits/data/core_vars_frappe_<version>.json)
# from the compiled core CSS of the two benches (ADR 0011 R5).
#
# Sources per version: every *.css in sites/assets/{frappe,erpnext}/dist/css and css-rtl, plus the one
# third-party stylesheet that desk loads lazily and that declares custom properties: frappe-gantt
# (gantt_view.js, "assets/frappe/node_modules/frappe-gantt/dist/frappe-gantt.css", 0.6.1 in 16.32.0,
# 1.1.0 in v16.52.0). The --g-* names the theme sets in _gantt.scss are watched through it.
#
#   tools/bench/write_core_snapshots.sh            write both snapshots
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "${HERE}/../.." && pwd)"
OLD_BENCH="${OLD_BENCH:-/home/frappe/frappe-bench}"
NEW_BENCH="${NEW_BENCH:-/home/frappe/newest-bench}"

args=()
for pair in "16.32.0=${OLD_BENCH}" "16.52.0=${NEW_BENCH}"; do
	version="${pair%%=*}"
	bench="${pair#*=}"
	assets="${bench}/sites/assets"
	for dir in "${assets}/frappe/dist/css" "${assets}/frappe/dist/css-rtl" "${assets}/erpnext/dist/css" "${assets}/erpnext/dist/css-rtl"; do
		[[ -d "${dir}" ]] || { echo "missing ${dir}" >&2; exit 1; }
		args+=(--core-css "${version}=${dir}")
	done
	gantt="${assets}/frappe/node_modules/frappe-gantt/dist/frappe-gantt.css"
	[[ -f "${gantt}" ]] || { echo "missing ${gantt}" >&2; exit 1; }
	args+=(--core-css "${version}=${gantt}")
done
cd "${REPO}"
python3 -m institutional_theme.audits --write-core-snapshot --no-write "${args[@]}"
