#!/usr/bin/env bash
# Run the new tests against `identity_sync.py` as it was in round 5 (frappe.clear_cache() on identity save),
# then restore the committed file. The whole sequence holds the shared bench lock.
#   negative_control.sh <log-file> [bench-script]     bench-script: b.sh (16.32.0, default) or b52.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../.." && pwd)"
LOG="$(realpath -m "$1")"
BENCH="${2:-b.sh}"
source "${ROOT}/tools/bench/env.sh"
[[ "${BENCH}" == b52.sh ]] && source "${ROOT}/tools/bench/env52.sh"
SUDO=""
[[ "$(id -u)" != "0" ]] && SUDO="sudo -E"
${SUDO} flock -o /tmp/ins-bench.lock bash -c '
	cd "$1"; log="$2"; bench="$3"
	f=institutional_theme/institutional_theme/doctype/institutional_theme_settings/identity_sync.py
	git diff --quiet HEAD -- "$f" || { echo "identity_sync.py has uncommitted changes, refusing" > "$log"; exit 98; }
	git show 786badf:"$f" > "$f"
	echo "identity_sync.py as of 786badf (round 5): $(grep -c "frappe.clear_cache()" "$f") frappe.clear_cache() call(s)" > "$log"
	INS_BENCH_LOCKED=1 "$bench" run-tests --app institutional_theme --module institutional_theme.tests.test_identity_caches >> "$log" 2>&1
	rc=$?
	git checkout --quiet HEAD -- "$f"
	echo "restored the committed file, exit $?; git diff: $(git diff --stat HEAD -- "$f" | wc -l) lines" >> "$log"
	echo "run-tests exit ${rc}" >> "$log"
	exit ${rc}
' _ "${ROOT}" "${LOG}" "${ROOT}/tools/bench/${BENCH}"
