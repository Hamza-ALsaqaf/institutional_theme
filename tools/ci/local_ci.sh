#!/usr/bin/env bash
# The checks of .github/workflows/ci.yml, run locally before a push from the build job (CI does not
# run by itself on commits pushed from there). Runs on a clean export of HEAD so uncommitted work of
# other agents in the same tree cannot hide or cause a failure.
#   tools/ci/local_ci.sh [log-file]
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG="$(realpath -m "${1:-/dev/stdout}")"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}" "${COMMITTED:-}" "${EMPTY_DIST:-}"' EXIT
git -C "${ROOT}" archive HEAD | tar -x -C "${WORK}"
# The reports as committed, kept aside before the audits rewrite them.
COMMITTED="$(mktemp -d)"
cp -r "${WORK}/docs/audits" "${COMMITTED}/audits"
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
	# CI's last step: the audits write docs/audits, and the committed reports must be current. The export is not a
	# git repository, so the reports are compared with those of HEAD (CI: `git status --porcelain -- docs/audits`).
	# An empty --dist keeps the size budgets from reading this machine's built bench, as on the CI runner.
	EMPTY_DIST="$(mktemp -d)"
	run python3.14 -m institutional_theme.audits --dist "${EMPTY_DIST}"
	run diff -r "${COMMITTED}/audits" "${WORK}/docs/audits"
	[[ ${status} -eq 0 ]] && echo "CI PASSED" || echo "CI FAILED"
} >"${LOG}" 2>&1
[[ ${status} -eq 0 ]] || echo "CI FAILED (see ${LOG})" >&2
exit ${status}
