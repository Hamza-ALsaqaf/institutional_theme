#!/usr/bin/env bash
# Check 3: run-tests --app institutional_theme, loaded and unloaded, 16.32.0 then v16.52.0, strictly one after the other.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HERE}/../../../../../../.." && pwd)"
G="$(cd "${HERE}/.." && pwd)"
cd "${ROOT}"
"${HERE}/loaded_run.sh" "${G}/16.32.0" loaded-1 b.sh http://localhost:8000
"${HERE}/lg.sh" "${G}/16.32.0/run-tests-unloaded.log" tools/bench/b.sh run-tests --app institutional_theme
"${HERE}/loaded_run.sh" "${G}/v16.52.0" loaded-1 b52.sh http://localhost:8001
"${HERE}/lg.sh" "${G}/v16.52.0/run-tests-unloaded.log" tools/bench/b52.sh run-tests --app institutional_theme
echo "TESTS CHAIN DONE $(date -u +%FT%TZ)" > "${G}/tests-chain.done"
