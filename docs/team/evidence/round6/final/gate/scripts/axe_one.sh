#!/usr/bin/env bash
# The per-site part of docs/team/evidence/round4/verify/scripts/axe_both.sh (unchanged commands), each logged with exit code
# and seconds by lg.sh. Used to repeat one site alone after a failed login step.
#   axe_one.sh <label> <base-url> <out-dir>
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HERE}/../../../../../../.." && pwd)"
LABEL="$1"; BASE="$2"; OUT="$(realpath -m "$3")"
cd "${ROOT}/tests/browser" || exit 1
export NODE_PATH=/opt/pw-node/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
mkdir -p "${OUT}/${LABEL}"
INS_BASE="${BASE}" "${HERE}/lg.sh" "${OUT}/${LABEL}/axe-run.log" node axe.mjs --variant=both --out="${OUT}/${LABEL}/axe"
INS_BASE="${BASE}" "${HERE}/lg.sh" "${OUT}/${LABEL}/a11y-attrs.log" node a11y_attrs.mjs --out "${OUT}/${LABEL}/a11y-attrs"
