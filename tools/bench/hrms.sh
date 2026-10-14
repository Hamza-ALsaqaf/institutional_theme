#!/usr/bin/env bash
# Get HRMS v16.20.1 into the test bench, install it on the test site and add a few fictional HR records so the
# HRMS desk pages have content. Run as root (like build_test_bench.sh), under the bench lock:
#
#   sudo env "PATH=$PATH" flock -o /tmp/ins-bench.lock tools/bench/hrms.sh [step...]
#
# Steps, in order: get install build restart seed verify.
# PW_NODE_PATH defaults to the root container's; on the GitHub runner use PW_NODE_PATH=/opt/pw-node/node_modules. Each is idempotent. Every command is appended to
# ${HRMS_EVIDENCE}/commands.tsv (step, command, exit code, seconds, log file); logs go to the same directory.
# Fictional data only (tools/bench/hrms_seed.py). Nothing in Frappe, ERPNext or HRMS is edited: the app is a
# stock clone at the tag.
#
# Note: the runner exports UV_CACHE_DIR pointing at a directory the bench user cannot read; as_bench unsets it.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env.sh
source "${HERE}/env.sh"

HRMS_TAG="${HRMS_TAG:-v16.20.1}"
HRMS_EVIDENCE="${HRMS_EVIDENCE:-${REPO_DIR}/docs/team/evidence/round3/hrms}"
HRMS_READY_FILE="${HRMS_READY_FILE:-/tmp/r3/hrms-ready}"
ALL_STEPS=(get install build restart seed verify)
mkdir -p "${HRMS_EVIDENCE}"
TSV="${HRMS_EVIDENCE}/commands.tsv"

# rec <step> <log name> <command...>: run, log, append a TSV row, return the exit code.
rec() {
	local step="$1" log="$2" start end rc
	shift 2
	start=$(date +%s)
	"$@" >"${HRMS_EVIDENCE}/${log}" 2>&1
	rc=$?
	end=$(date +%s)
	printf '%s\t%s\t%s\t%s\t%s\n' "${step}" "$*" "${rc}" "$((end - start))" "${log}" >>"${TSV}"
	echo "${step}: exit ${rc} in $((end - start))s (${HRMS_EVIDENCE}/${log})"
	return "${rc}"
}

bench_cmd() { (cd "${BENCH_DIR}" && as_bench bench "$@"); }

step_get() {
	if [[ -d "${BENCH_DIR}/apps/hrms/.git" ]]; then
		local have
		have="$(as_bench git -C "${BENCH_DIR}/apps/hrms" describe --tags 2>/dev/null || true)"
		if [[ "${have}" == "${HRMS_TAG}" ]]; then
			echo "apps/hrms already at ${HRMS_TAG}"
			return 0
		fi
		echo "apps/hrms exists at '${have}', not ${HRMS_TAG}: refusing to touch it" >&2
		return 1
	fi
	rec get get.log bench_cmd get-app https://github.com/frappe/hrms --branch "${HRMS_TAG}" --skip-assets || return 1
	rec get_describe get_describe.log as_bench git -C "${BENCH_DIR}/apps/hrms" describe --tags
}

step_install() {
	# Not `bench install-app`: HRMS v16.20.1 has a post-install patch that PostgreSQL rejects (hrms_install.py).
	rec install install.log as_bench bash -c "cd ${BENCH_DIR}/sites && ${BENCH_DIR}/env/bin/python -I ${HERE}/hrms_install.py ${SITE}"
}

step_build() {
	rec build build.log bench_cmd build --app hrms
}

step_restart() {
	rec restart restart.log "${HERE}/start_services.sh" restart-web
}

step_seed() {
	# The seed script runs inside the bench environment, from the sites directory, as the bench user.
	rec seed seed.log as_bench bash -c "cd ${BENCH_DIR}/sites && ${BENCH_DIR}/env/bin/python -I ${HERE}/hrms_seed.py ${SITE}"
}

step_verify() {
	rec list_apps list_apps.log bench_cmd --site "${SITE}" list-apps || return 1
	grep -E '^hrms ' "${HRMS_EVIDENCE}/list_apps.log" || return 1
	rec ping ping.log curl -s "http://localhost:${WEB_PORT}/api/method/ping"
	# A logged-in browser opens /app/employee (redirected to /desk/employee) and the HRMS lists, forms and workspaces.
	NODE_PATH="${PW_NODE_PATH}" PLAYWRIGHT_BROWSERS_PATH="${PW_BROWSERS_PATH}" \
		rec check check.log node "${HERE}/hrms_check.mjs"
}

steps=("$@")
[[ ${#steps[@]} -eq 0 ]] && steps=("${ALL_STEPS[@]}")
if [[ "$(id -u)" != "0" ]]; then
	echo "run as root: sudo env \"PATH=\$PATH\" flock -o /tmp/ins-bench.lock $0" >&2
	exit 1
fi
for s in "${steps[@]}"; do
	echo "STEP ${s} START $(date -u +%FT%TZ)"
	"step_${s}" || { echo "STEP ${s} FAILED" >&2; exit 1; }
	echo "STEP ${s} END"
done
