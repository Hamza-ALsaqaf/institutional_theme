#!/usr/bin/env bash
# Re-run the axe scan (themed and core, four language-mode pairs) and the attribute checks on both sites.
# Run it after the last build of the stylesheets; about 15 minutes per site (the two sites can run at once).
#   docs/team/evidence/round4/verify/scripts/axe_both.sh <output-dir>
# Writes <output-dir>/16.32.0 and <output-dir>/v16.52.0.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../../.." && pwd)"
OUT="$(realpath -m "${1:?output directory}")"
cd "${ROOT}/tests/browser" || exit 1
export NODE_PATH=/opt/pw-node/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
run_site() {
	local label="$1" base="$2"
	mkdir -p "${OUT}/${label}"
	INS_BASE="${base}" node axe.mjs --variant=both --out="${OUT}/${label}/axe" >"${OUT}/${label}/axe-run.log" 2>&1
	echo "axe ${label}: exit $?"
	INS_BASE="${base}" node a11y_attrs.mjs --out "${OUT}/${label}/a11y-attrs" >"${OUT}/${label}/a11y-attrs.log" 2>&1
	echo "a11y_attrs ${label}: exit $?"
}
run_site 16.32.0 http://localhost:8000 &
run_site v16.52.0 http://localhost:8001 &
wait
