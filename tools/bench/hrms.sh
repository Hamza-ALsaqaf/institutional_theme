#!/usr/bin/env bash
# Get HRMS into a test bench, install it on a test site and add a few fictional HR records so the
# HRMS desk pages have content. Run as root (like build_test_bench.sh), under the bench lock:
#
#   sudo env "PATH=$PATH" flock -o /tmp/ins-bench.lock tools/bench/hrms.sh [step...]
#
# Default target (unchanged): midad.test on the 16.32.0 bench, HRMS v16.20.1, port 8000.
# Steps, in order: get install build restart seed verify.
#
# Newest-bench target (round 5): HRMS_ENV=tools/bench/env52_hrms.sh selects the Frappe v16.52.0 bench, a separate site
# hrms52.test (own web server on port 8002; midad52.test and its server on 8001 are not touched) and HRMS_TAG=v16.50.0.
# In that mode the script takes /tmp/ins-bench.lock itself for every bench command (do NOT wrap it in flock) and
# has the extra steps site erpnext wizard theme web, so the whole site is built from nothing:
#
#   sudo env "PATH=$PATH" HRMS_ENV=tools/bench/env52_hrms.sh tools/bench/hrms.sh \
#        site erpnext wizard theme get install build web seed verify
#
# PW_NODE_PATH defaults to the root container's; on the GitHub runner use PW_NODE_PATH=/opt/pw-node/node_modules. Each is idempotent. Every command is appended to
# ${HRMS_EVIDENCE}/commands.tsv (step, command, exit code, seconds, log file); logs go to the same directory.
# Fictional data only (tools/bench/hrms_seed.py). Nothing in Frappe, ERPNext or HRMS is edited: the app is a
# stock clone at the tag.
#
# Note: the runner exports UV_CACHE_DIR pointing at a directory the bench user cannot read; as_bench unsets it.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env.sh
source "${HRMS_ENV:-${HERE}/env.sh}"

HRMS_TAG="${HRMS_TAG:-v16.20.1}"
HRMS_EVIDENCE="${HRMS_EVIDENCE:-${REPO_DIR}/docs/team/evidence/round3/hrms}"
HRMS_READY_FILE="${HRMS_READY_FILE:-/tmp/r3/hrms-ready}"
HRMS_LOCK="${HRMS_LOCK:-0}"  # 1: take /tmp/ins-bench.lock for each recorded command (newest-bench mode)
HRMS_SETUP_EVIDENCE="${HRMS_SETUP_EVIDENCE:-${HRMS_EVIDENCE}/setup}"  # newest_site.sh stage logs
ALL_STEPS=(get install build restart seed verify)
mkdir -p "${HRMS_EVIDENCE}"
TSV="${HRMS_EVIDENCE}/commands.tsv"

# rec <step> <log name> <command...>: run, log, append a TSV row, return the exit code.
rec() {
	local step="$1" log="$2" start end rc
	shift 2
	start=$(date +%s)
	if [[ "${HRMS_LOCK}" == "1" ]]; then
		# Own descriptor, closed before the next command, so the lock is held for this command only.
		local lockfd
		exec {lockfd}>/tmp/ins-bench.lock
		flock "${lockfd}"
		"$@" >"${HRMS_EVIDENCE}/${log}" 2>&1
		rc=$?
		exec {lockfd}>&-
	else
		"$@" >"${HRMS_EVIDENCE}/${log}" 2>&1
		rc=$?
	fi
	end=$(date +%s)
	printf '%s\t%s\t%s\t%s\t%s\n' "${step}" "$*" "${rc}" "$((end - start))" "${log}" >>"${TSV}"
	echo "${step}: exit ${rc} in $((end - start))s (${HRMS_EVIDENCE}/${log})"
	return "${rc}"
}

# Like rec, for commands that take the lock themselves (newest_site.sh).
recn() { HRMS_LOCK=0 rec "$@"; }

bench_cmd() { (cd "${BENCH_DIR}" && as_bench bench "$@"); }

# Newest-bench mode: the stages of newest_site.sh, run for this site and port (they take the lock per command).
newest() {
	NEWEST_SITE="${SITE}" NEWEST_PORT="${WEB_PORT}" EVIDENCE_DIR="${HRMS_SETUP_EVIDENCE}" "${HERE}/newest_site.sh" "$@"
}

# A new PostgreSQL site on the bench, without `bench use` (the default site of the bench is left as it is).
step_site() {
	if [[ -f "${BENCH_DIR}/sites/${SITE}/site_config.json" ]]; then
		echo "site ${SITE} already exists"
	else
		rec site_new site_new.log bench_cmd new-site "${SITE}" --db-type postgres --db-host 127.0.0.1 --db-port "${PG_PORT}" \
			--db-root-username "${PG_ROOT_USER}" --db-root-password "${PG_ROOT_PASSWORD}" \
			--admin-password "${ADMIN_PASSWORD}" || return 1
	fi
	rec site_config site_config.log bench_cmd --site "${SITE}" set-config developer_mode 1 || return 1
	rec site_host site_host.log bench_cmd --site "${SITE}" set-config host_name "http://${SITE}:${WEB_PORT}"
}

step_erpnext() { recn erpnext erpnext.log newest erpnext; }
step_wizard() { recn wizard wizard.log newest wizard; }
step_theme() { recn theme theme.log newest install; }
step_web() { recn web web.log newest restart-web; }

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
	if [[ -n "${HRMS_ENV:-}" ]]; then
		step_web
	else
		rec restart restart.log "${HERE}/start_services.sh" restart-web
	fi
}

step_seed() {
	# The seed script runs inside the bench environment, from the sites directory, as the bench user.
	rec seed seed.log as_bench bash -c "cd ${BENCH_DIR}/sites && ${BENCH_DIR}/env/bin/python -I ${HERE}/hrms_seed.py ${SITE}"
}

step_verify() {
	rec list_apps list_apps.log bench_cmd --site "${SITE}" list-apps || return 1
	grep -E '^hrms ' "${HRMS_EVIDENCE}/list_apps.log" || return 1
	rec ping ping.log curl -s --noproxy '*' "http://localhost:${WEB_PORT}/api/method/ping"
	# A logged-in browser opens /app/employee (redirected to /desk/employee) and the HRMS lists, forms and workspaces.
	INS_BASE="http://localhost:${WEB_PORT}" NODE_PATH="${PW_NODE_PATH}" PLAYWRIGHT_BROWSERS_PATH="${PW_BROWSERS_PATH}" \
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
