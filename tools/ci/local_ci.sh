#!/usr/bin/env bash
# The checks of .github/workflows/ci.yml, run locally before a push from the build job (CI does not
# run by itself on commits pushed from there). Runs on a clean export of HEAD so uncommitted work of
# other agents in the same tree cannot hide or cause a failure.
#   tools/ci/local_ci.sh [log-file]
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG="${1:-/dev/stdout}"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT
git -C "${ROOT}" archive HEAD | tar -x -C "${WORK}"
cd "${WORK}"
status=0
run() {
	echo "\$ $*"
	"$@"
	local rc=$?
	echo "exit ${rc}"
	[[ ${rc} -ne 0 ]] && status=1
}
{
	echo "commit $(git -C "${ROOT}" rev-parse --short HEAD) at $(date -u +%FT%TZ)"
	run uvx --quiet ruff@0.16.8 check .
	run uvx --quiet ruff@0.16.8 format --check .
	run python3.14 -m unittest discover -s institutional_theme/midad/tests -t .
	run python3.14 -m unittest discover -s institutional_theme/audits/tests -t .
	run python3.14 -m institutional_theme.midad.build --check
	run python3.14 -m institutional_theme.audits
	[[ ${status} -eq 0 ]] && echo "CI PASSED" || echo "CI FAILED"
} >"${LOG}" 2>&1
[[ ${status} -eq 0 ]] || echo "CI FAILED (see ${LOG})" >&2
exit ${status}
