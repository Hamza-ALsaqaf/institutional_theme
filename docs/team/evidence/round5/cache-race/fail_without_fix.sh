#!/usr/bin/env bash
# Run the cache-race tests against the app sources as they were before the fix (HEAD), then restore the fix.
#   fail_without_fix.sh <log-file> [bench-script]     bench-script: b.sh (16.32.0, default) or b52.sh
# Only the app sources that the fix changed are stashed (never tests, never other agents' files). The whole
# stash/run/restore sequence holds the shared bench lock, so no other bench command sees the old sources.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../.." && pwd)"
LOG="$(realpath -m "$1")"
BENCH="${2:-b.sh}"
source "${ROOT}/tools/bench/env.sh"
[[ "${BENCH}" == b52.sh ]] && source "${ROOT}/tools/bench/env52.sh"
FILES=(
	institutional_theme/api.py
	institutional_theme/identity.py
	institutional_theme/install.py
	institutional_theme/preferences.py
	institutional_theme/site_files.py
	institutional_theme/web_content.py
	institutional_theme/print/ship.py
	institutional_theme/institutional_theme/doctype/institutional_theme_settings/identity_sync.py
)
SUDO=""
[[ "$(id -u)" != "0" ]] && SUDO="sudo -E"
INNER="${ROOT}/tools/bench/${BENCH}"
${SUDO} flock -o /tmp/ins-bench.lock bash -c '
	cd "$1"; shift; log="$1"; shift; bench="$1"; shift
	git stash push --quiet -m cache-race-fix -- "$@" || exit 99
	echo "stashed: $(git stash list | head -1)" > "$log"
	git diff --stat HEAD -- "$@" >> "$log"
	# the bench scripts take the same lock; the flag below makes them skip it (see tools/bench/b.sh)
	INS_BENCH_LOCKED=1 "$bench" run-tests --app institutional_theme --module institutional_theme.tests.test_cache_race >> "$log" 2>&1
	rc=$?
	git stash pop --quiet; echo "restored fix, pop exit $?" >> "$log"
	echo "run-tests exit ${rc}" >> "$log"
	exit ${rc}
' _ "${ROOT}" "${LOG}" "${INNER}" "${FILES[@]}"
