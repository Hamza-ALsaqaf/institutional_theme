#!/usr/bin/env bash
# Install, configure, save the core settings, upload an administrator's file with the emblem's bytes,
# uninstall, and list what is left, on a THROW-AWAY site of the test bench (default r3fix.test).
#
#   tools/bench/uninstall_residue.sh [LABEL]
#
# Steps (each logged with its exit code to $EVIDENCE/$LABEL/commands.tsv, output in $EVIDENCE/$LABEL/logs/):
#   new-site (Frappe only, PostgreSQL)  ->  table counts "before"  ->  install-app  ->  gate_state.py seed
#   (emblem written through, Website Settings saved so core copies it, an administrator's file with the same
#   bytes attached to Navbar Settings)  ->  uninstall-app --yes --no-backup  ->  gate_state.py residue
#   (exit 1 when anything is left)  ->  table counts "after" and their diff  ->  drop-site.
# GATE_ADMIN_TARGET="Website Settings.favicon" attaches the administrator's file there instead (then the
# sync makes a Navbar Settings copy of its own, which must go while the administrator's row stays).
# Runs as the bench user under /tmp/ins-bench.lock, without the runner's uv cache. midad.test is never touched.
# TEST ONLY credentials, as in env.sh.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env.sh
source "${HERE}/env.sh"

LABEL="${1:-run}"
TMP_SITE="${TMP_SITE:-r3fix.test}"
EVIDENCE="${EVIDENCE_DIR:-${REPO_DIR}/docs/team/evidence/round3/fix-uninstall}/${LABEL}"
LOGS="${EVIDENCE}/logs"
STATE="/tmp/ins-residue-${TMP_SITE}.json"
mkdir -p "${LOGS}"
: >"${EVIDENCE}/commands.tsv"
SUDO=""
[[ "$(id -u)" != "0" ]] && SUDO="sudo"
FAILED=0

as_frappe() {
	${SUDO} env "PATH=${PATH}" flock -o /tmp/ins-bench.lock runuser -u "${BENCH_USER}" -- env -u UV_CACHE_DIR \
		-u SUDO_USER -u SUDO_UID -u SUDO_GID -u SUDO_COMMAND HOME="${BENCH_HOME}" USER="${BENCH_USER}" \
		PATH="${NODE_HOME}/bin:${BENCH_HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin" "$@"
}
bench_cmd() { as_frappe bash -c "cd '${BENCH_REAL_DIR}' && bench $*"; }
in_sites() { as_frappe bash -c "cd '${BENCH_REAL_DIR}/sites' && ../env/bin/python $*"; }

step() {
	local name="$1" start end rc=0
	shift
	start=$(date +%s)
	printf '=== %s  %s\n$ %s\n' "${name}" "$(date -u +%FT%TZ)" "$*" >"${LOGS}/${name}.log"
	"$@" >>"${LOGS}/${name}.log" 2>&1 || rc=$?
	end=$(date +%s)
	printf '%s\t%s\t%s\t%s\n' "${name}" "${rc}" "$((end - start))" "${*//$'\n'/ }" >>"${EVIDENCE}/commands.tsv"
	printf 'exit %s\n' "${rc}" >>"${LOGS}/${name}.log"
	printf '%-22s exit %-3s %4ss\n' "${name}" "${rc}" "$((end - start))"
	[[ "${rc}" != 0 ]] && FAILED=$((FAILED + 1))
	return 0
}

if [[ -d "${BENCH_REAL_DIR}/sites/${TMP_SITE}" ]]; then
	step drop-stale bench_cmd drop-site "${TMP_SITE}" --force --no-backup --db-root-username "${PG_ROOT_USER}" --db-root-password "${PG_ROOT_PASSWORD}"
fi
step new-site bench_cmd new-site "${TMP_SITE}" --db-type postgres --db-host 127.0.0.1 --db-port "${PG_PORT}" \
	--db-root-username "${PG_ROOT_USER}" --db-root-password "${PG_ROOT_PASSWORD}" --admin-password "${ADMIN_PASSWORD}"
step snapshot-before in_sites "'${HERE}/fresh_check.py' snapshot '${TMP_SITE}' '/tmp/ins-residue-before.json'"
step install-app bench_cmd --site "${TMP_SITE}" install-app institutional_theme
step seed as_frappe bash -c "cd '${BENCH_REAL_DIR}/sites' && GATE_ADMIN_TARGET='${GATE_ADMIN_TARGET:-Navbar Settings.app_logo}' ../env/bin/python '${HERE}/gate_state.py' seed '${TMP_SITE}' '${STATE}'"
if [[ -n "${OLD_IDENTITY_SYNC:-}" ]]; then
	# Negative control: uninstall with the previous identity_sync.py (a copy of `git show <old commit>:...`),
	# swapped in for this one locked command only and put back afterwards.
	IS="${REPO_DIR}/institutional_theme/institutional_theme/doctype/institutional_theme_settings/identity_sync.py"
	cp "${IS}" /tmp/identity_sync.current.py
	step uninstall-app as_frappe bash -c "cp '${OLD_IDENTITY_SYNC}' '${IS}' && cd '${BENCH_REAL_DIR}' && bench --site '${TMP_SITE}' uninstall-app institutional_theme --yes --no-backup; rc=\$?; cp /tmp/identity_sync.current.py '${IS}'; exit \$rc"
else
	step uninstall-app bench_cmd --site "${TMP_SITE}" uninstall-app institutional_theme --yes --no-backup
fi
step residue in_sites "'${HERE}/gate_state.py' residue '${TMP_SITE}' '${STATE}'"
step files-on-disk as_frappe bash -c "ls -la '${BENCH_REAL_DIR}/sites/${TMP_SITE}/public/files' || true"
step snapshot-after in_sites "'${HERE}/fresh_check.py' snapshot '${TMP_SITE}' '/tmp/ins-residue-after.json'"
step table-diff in_sites "'${HERE}/fresh_check.py' diff /tmp/ins-residue-before.json /tmp/ins-residue-after.json"
step drop-site bench_cmd drop-site "${TMP_SITE}" --force --no-backup --db-root-username "${PG_ROOT_USER}" --db-root-password "${PG_ROOT_PASSWORD}"
echo "failed steps: ${FAILED} (residue and table-diff exit 1 when something is left)"
