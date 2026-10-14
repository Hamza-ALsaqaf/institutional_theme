#!/usr/bin/env bash
# Check 6, HRMS part: tools/bench/hrms_print_render.py, themed variant, through the round-6 wrapper (hrms_run.sh).
#   hrms_print.sh <bench> <site> <gate-version-dir> <label>
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HERE}/../../../../../../.." && pwd)"
BENCH="$1"; SITE="$2"; D="$3"
TMP="/tmp/ins-hrms-print-$(basename "${BENCH}")"
sudo rm -rf "${TMP}"; sudo install -d -o frappe -g frappe "${TMP}"
sudo cp "${D}/hrms-print/jobs.txt" "${TMP}/jobs.txt"; sudo chmod 644 "${TMP}/jobs.txt"
"${HERE}/hrms_run.sh" "${BENCH}" "${ROOT}/tools/bench/hrms_print_render.py" "${SITE}" "${TMP}" themed "${TMP}/jobs.txt"
rc=$?
sudo cp "${TMP}"/*.pdf "${D}/hrms-print/" 2>/dev/null
sudo chown -R "$(id -u):$(id -g)" "${D}/hrms-print"
exit ${rc}
