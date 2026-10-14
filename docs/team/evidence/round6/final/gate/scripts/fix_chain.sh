#!/usr/bin/env bash
# After the test fix: module unloaded on both versions, then the full loaded run on both, one after the other.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HERE}/../../../../../../.." && pwd)"
G="$(cd "${HERE}/.." && pwd)"
cd "${ROOT}"
"${HERE}/lg.sh" "${G}/fix/test-site-files-unloaded-16.32.0.log" tools/bench/b.sh run-tests --app institutional_theme --module institutional_theme.tests.test_site_files
"${HERE}/lg.sh" "${G}/fix/test-site-files-unloaded-v16.52.0.log" tools/bench/b52.sh run-tests --app institutional_theme --module institutional_theme.tests.test_site_files
"${HERE}/loaded_run.sh" "${G}/16.32.0" loaded-2 b.sh http://localhost:8000
"${HERE}/loaded_run.sh" "${G}/v16.52.0" loaded-2 b52.sh http://localhost:8001
echo "FIX CHAIN DONE $(date -u +%FT%TZ)" > "${G}/fix/chain.done"
