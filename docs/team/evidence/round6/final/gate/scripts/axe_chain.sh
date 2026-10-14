#!/usr/bin/env bash
# Check 5: axe (themed and theme-blocked), a11y_attrs, axe summary, grid_names; 16.32.0 then v16.52.0, one at a time.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HERE}/../../../../../../.." && pwd)"
G="$(cd "${HERE}/.." && pwd)"
export NODE_PATH=/opt/pw-node/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
cd "${ROOT}/tests/browser" || exit 1
for pair in "16.32.0 http://localhost:8000" "v16.52.0 http://localhost:8001"; do
	set -- ${pair}
	"${HERE}/axe_one.sh" "$1" "$2" "${G}" 
	"${HERE}/lg.sh" "${G}/$1/axe-summarize.log" node axe.mjs --summarize --out="${G}/$1/axe"
	INS_BASE="$2" "${HERE}/lg.sh" "${G}/$1/grid-names.log" node grid_names.mjs --base "$2" --out "${G}/$1/grid-names"
done
echo "AXE CHAIN DONE $(date -u +%FT%TZ)" > "${G}/axe-chain.done"
