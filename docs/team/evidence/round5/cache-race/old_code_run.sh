#!/usr/bin/env bash
# One full `run-tests` of the app AS IT WAS BEFORE THE FIX (commit 0881150, exported to /tmp/oldtree and put first on
# PYTHONPATH, so nothing in the shared working tree changes) while load.py hits the same site.
#   old_code_run.sh <label> <run-number>
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HERE}/../../../../.." && pwd)"
source "${ROOT}/tools/bench/env.sh"
LABEL="$1"; N="$2"
OLD=/tmp/oldtree
RUNLOG="${HERE}/logs/run-${LABEL}-${N}.log"
LOADLOG="${HERE}/logs/load-${LABEL}-${N}.log"
STOP="$(mktemp -u /tmp/ins-load-stop.XXXXXX)"
[[ -e "${RUNLOG}" || -e "${LOADLOG}" ]] && { echo "log exists: ${RUNLOG}" >&2; exit 2; }
if [[ ! -f "${OLD}/institutional_theme/site_files.py" ]]; then
	rm -rf "${OLD}"; mkdir -p "${OLD}"
	git -C "${ROOT}" archive 0881150 | tar -x -C "${OLD}"; chmod -R a+rwX "${OLD}"
fi
python3 "${HERE}/load.py" http://midad.test:8000 "${LOADLOG}" "${STOP}" 3 &
LOADPID=$!
sleep 5
SUDO=""; [[ "$(id -u)" != "0" ]] && SUDO="sudo -E"
{
	echo "start $(date -u +%FT%TZ) ${LABEL} run ${N}; app sources: commit 0881150 (before the fix) from ${OLD}"
	${SUDO} flock -o /tmp/ins-bench.lock runuser -u "${BENCH_USER}" -- env HOME="${BENCH_HOME}" \
		PYTHONPATH="${OLD}" PYTHONDONTWRITEBYTECODE=1 \
		PATH="${NODE_HOME}/bin:${BENCH_HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin" \
		bash -c "cd ${BENCH_DIR} && python -c 'import institutional_theme,sys; print(\"module:\", institutional_theme.__file__)' && bench --site ${SITE} run-tests --app institutional_theme"
	echo "run-tests exit $? at $(date -u +%FT%TZ)"
} >> "${RUNLOG}" 2>&1
touch "${STOP}"
wait "${LOADPID}"
rm -f "${STOP}"
echo "load: $(head -1 "${LOADLOG}.summary"); $(tail -1 "${LOADLOG}.summary")" | tee -a "${RUNLOG}"
