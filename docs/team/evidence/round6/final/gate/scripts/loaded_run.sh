#!/usr/bin/env bash
# Copy of docs/team/evidence/round5/cache-race/loaded_run.sh with the logs written to a folder given by the caller
# (the cache-race folder is not part of this gate). One full `run-tests --app institutional_theme` while load.py
# (same file as the cache-race one, used unchanged) hits the same site.
#   loaded_run.sh <logdir> <label> <bench-script: b.sh|b52.sh> <base-url>
# Logs (never overwritten): <logdir>/run-<label>.log, <logdir>/load-<label>.log(.summary)
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HERE}/../../../../../../.." && pwd)"
LOADPY="${ROOT}/docs/team/evidence/round5/cache-race/load.py"
DIR="$(realpath -m "$1")"; LABEL="$2"; BENCH="$3"; URL="$4"
mkdir -p "${DIR}"
RUNLOG="${DIR}/run-${LABEL}.log"
LOADLOG="${DIR}/load-${LABEL}.log"
STOP="$(mktemp -u /tmp/ins-load-stop.XXXXXX)"
[[ -e "${RUNLOG}" || -e "${LOADLOG}" ]] && { echo "log exists, refusing to overwrite: ${RUNLOG}" >&2; exit 2; }
python3 "${LOADPY}" "${URL}" "${LOADLOG}" "${STOP}" 3 &
LOADPID=$!
sleep 5
{ echo "start $(date -u +%FT%TZ) ${LABEL} commit $(git -C "${ROOT}" rev-parse --short HEAD)"; } > "${RUNLOG}"
s=$(date +%s)
"${ROOT}/tools/bench/${BENCH}" run-tests --app institutional_theme >> "${RUNLOG}" 2>&1
RC=$?
echo "run-tests exit ${RC} at $(date -u +%FT%TZ), $(( $(date +%s) - s )) s" >> "${RUNLOG}"
touch "${STOP}"
wait "${LOADPID}"
rm -f "${STOP}"
echo "load: $(head -1 "${LOADLOG}.summary"); $(tail -1 "${LOADLOG}.summary")" | tee -a "${RUNLOG}"
exit ${RC}
