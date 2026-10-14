#!/usr/bin/env bash
# One full `run-tests --app institutional_theme` while load.py hits the same site.
#   loaded_run.sh <label> <bench-script: b.sh|b52.sh> <base-url> <run-number>
# Logs (never overwritten; a name that exists is an error): logs/run-<label>-<n>.log, logs/load-<label>-<n>.log(.summary)
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HERE}/../../../../.." && pwd)"
LABEL="$1"; BENCH="$2"; URL="$3"; N="$4"
RUNLOG="${HERE}/logs/run-${LABEL}-${N}.log"
LOADLOG="${HERE}/logs/load-${LABEL}-${N}.log"
STOP="$(mktemp -u /tmp/ins-load-stop.XXXXXX)"
[[ -e "${RUNLOG}" || -e "${LOADLOG}" ]] && { echo "log exists, refusing to overwrite: ${RUNLOG}" >&2; exit 2; }
python3 "${HERE}/load.py" "${URL}" "${LOADLOG}" "${STOP}" 3 &
LOADPID=$!
sleep 5
{ echo "start $(date -u +%FT%TZ) ${LABEL} run ${N} commit $(git -C "${ROOT}" rev-parse --short HEAD)"; } > "${RUNLOG}"
"${ROOT}/tools/bench/${BENCH}" run-tests --app institutional_theme >> "${RUNLOG}" 2>&1
RC=$?
echo "run-tests exit ${RC} at $(date -u +%FT%TZ)" >> "${RUNLOG}"
touch "${STOP}"
wait "${LOADPID}"
rm -f "${STOP}"
echo "load: $(head -1 "${LOADLOG}.summary"); $(tail -1 "${LOADLOG}.summary")" | tee -a "${RUNLOG}"
exit ${RC}
