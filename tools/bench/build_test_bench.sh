#!/usr/bin/env bash
# Build the Midad test bench from scratch: Frappe v16.32.0, ERPNext v16.33.0
# (optional), PostgreSQL 16, one site, and this repository registered as an app.
#
#   tools/bench/build_test_bench.sh            run every step
#   tools/bench/build_test_bench.sh <step>...  run only the named steps
#
# Steps, in order: preflight user cli postgres bench services site erpnext app build
# Each step is idempotent: it checks for its own result and skips when found.
# Each step prints "STEP <name> START/END <seconds>s" so durations can be read from the log.
#
# The app is NOT installed on the site here. That is the Phase 0 gate and is done by
# tools/bench/gate_install_uninstall.sh.
#
# TEST ONLY: the PostgreSQL superuser password and the site administrator password
# (see env.sh) are throw-away values for a disposable container.
#
# Environment overrides are listed in env.sh (BENCH_DIR, SITE, WITH_ERPNEXT, FRAPPE_SRC, ...).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env.sh
source "${HERE}/env.sh"

ALL_STEPS=(preflight user cli postgres bench services site erpnext app build)
BENCH="${BENCH:-bench}"

run_step() {
	local name="$1" start end
	start=$(date +%s)
	echo "STEP ${name} START $(date -u +%FT%TZ)"
	"step_${name}"
	end=$(date +%s)
	echo "STEP ${name} END $((end - start))s"
}

bench_cmd() { (cd "${BENCH_DIR}" && as_bench "${BENCH}" "$@"); }
bgit() { as_bench git -C "$@"; }

step_preflight() {
	test -x "${SYSTEM_PYTHON_SRC}/bin/python3.14" || test -x "${BENCH_PYTHON}" || {
		echo "missing Python 3.14 (looked in ${SYSTEM_PYTHON_SRC} and ${BENCH_PYTHON})" >&2
		exit 1
	}
	test "$(id -u)" == "0" || { echo "run as root (the scripts drop to ${BENCH_USER} themselves)" >&2; exit 1; }
	node --version
	yarn --version
	"${PG_BIN}/postgres" --version
	redis-server --version
	git --version
	uv --version
	id postgres >/dev/null
	test -d "${REPO_DIR}/institutional_theme" || { echo "repo not found at ${REPO_DIR}" >&2; exit 1; }
}

step_user() {
	# bench exits with "You should not run this command as root", so all bench work runs as an
	# unprivileged user. It needs its own interpreter and uv because /root is not readable.
	id "${BENCH_USER}" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "${BENCH_USER}"
	if [[ ! -x "${BENCH_PYTHON}" ]]; then
		cp -a --dereference "${SYSTEM_PYTHON_SRC}" "${BENCH_PYTHON_HOME}"
	fi
	if [[ ! -x /usr/local/bin/uv ]]; then
		install -m 755 "$(command -v uv)" /usr/local/bin/uv
	fi
	as_bench "${BENCH_PYTHON}" --version
	# Local clones are owned by root; allow git to read them (test container only).
	as_bench git config --global --add safe.directory '*'
	install -d -o "${BENCH_USER}" -g "${BENCH_USER}" "${BENCH_DIR}"
	# The app is edited as root but built (public/dist, __pycache__) as the bench user.
	chgrp -R "${BENCH_USER}" "${REPO_DIR}/institutional_theme"
	chmod -R g+rwX "${REPO_DIR}/institutional_theme"
	find "${REPO_DIR}/institutional_theme" -type d -exec chmod g+s {} +
}

step_cli() {
	if ! as_bench bash -c 'command -v bench' >/dev/null; then
		as_bench uv tool install frappe-bench --python "${BENCH_PYTHON}"
	fi
	as_bench bench --version
}

step_postgres() {
	if [[ ! -f "${PG_DATA}/PG_VERSION" ]]; then
		install -d -o postgres -g postgres "$(dirname "${PG_DATA}")"
		pwfile="$(mktemp)"
		echo "${PG_ROOT_PASSWORD}" >"${pwfile}"
		chmod 644 "${pwfile}"
		su postgres -c "${PG_BIN}/initdb -D ${PG_DATA} -E UTF8 --locale=C.UTF-8 \
			--auth-local=trust --auth-host=scram-sha-256 -U postgres --pwfile=${pwfile}"
		rm -f "${pwfile}"
		# Frappe opens many connections; keep the defaults but listen on loopback only.
		cat >>"${PG_DATA}/postgresql.conf" <<EOF
listen_addresses = '127.0.0.1'
port = ${PG_PORT}
unix_socket_directories = '/tmp'
fsync = off
synchronous_commit = off
full_page_writes = off
EOF
		chown postgres:postgres "${PG_DATA}/postgresql.conf"
	fi
	if ! "${PG_BIN}/pg_isready" -q -h 127.0.0.1 -p "${PG_PORT}"; then
		su postgres -c "${PG_BIN}/pg_ctl -D ${PG_DATA} -l $(dirname "${PG_DATA}")/midad-postgres.log -w start"
	fi
	"${PG_BIN}/pg_isready" -h 127.0.0.1 -p "${PG_PORT}"
}

step_bench() {
	if [[ -x "${BENCH_DIR}/env/bin/python" && -d "${BENCH_DIR}/apps/frappe" ]]; then
		echo "bench already initialised at ${BENCH_DIR}"
	else
		local frappe_path="https://github.com/frappe/frappe"
		if [[ -d "${FRAPPE_SRC}/.git" ]]; then
			frappe_path="${FRAPPE_SRC}"
		fi
		(
			cd "$(dirname "${BENCH_DIR}")"
			as_bench "${BENCH}" init "$(basename "${BENCH_DIR}")" \
				--frappe-path "${frappe_path}" --frappe-branch "${FRAPPE_TAG}" \
				--python "${BENCH_PYTHON}"
		)
	fi
	bgit "${BENCH_DIR}/apps/frappe" describe --tags
	test -z "$(bgit "${BENCH_DIR}/apps/frappe" status --porcelain)" && echo "apps/frappe is pristine"
	# A local clone has no upstream URL; point origin at GitHub so later updates behave.
	bgit "${BENCH_DIR}/apps/frappe" remote set-url origin https://github.com/frappe/frappe
}

step_services() {
	"${HERE}/start_services.sh"
}

step_site() {
	if [[ -f "${BENCH_DIR}/sites/${SITE}/site_config.json" ]]; then
		echo "site ${SITE} already exists"
	else
		bench_cmd new-site "${SITE}" --db-type postgres --db-host 127.0.0.1 --db-port "${PG_PORT}" \
			--db-root-username "${PG_ROOT_USER}" --db-root-password "${PG_ROOT_PASSWORD}" \
			--admin-password "${ADMIN_PASSWORD}"
	fi
	bench_cmd use "${SITE}"
	bench_cmd --site "${SITE}" set-config developer_mode 1
	bench_cmd --site "${SITE}" set-config host_name "http://${SITE}:${WEB_PORT}"
}

step_erpnext() {
	if [[ "${WITH_ERPNEXT}" != "1" ]]; then
		echo "WITH_ERPNEXT=${WITH_ERPNEXT}: skipping ERPNext (Frappe only)"
		return 0
	fi
	if [[ ! -d "${BENCH_DIR}/apps/erpnext" ]]; then
		bench_cmd get-app erpnext --branch "${ERPNEXT_TAG}"
	fi
	bgit "${BENCH_DIR}/apps/erpnext" describe --tags
	if ! bench_cmd --site "${SITE}" list-apps | grep -qx erpnext; then
		bench_cmd --site "${SITE}" install-app erpnext
	fi
	bench_cmd --site "${SITE}" list-apps
}

step_app() {
	local link="${BENCH_DIR}/apps/institutional_theme"
	if [[ -e "${link}" && ! -L "${link}" ]]; then
		echo "${link} exists and is not a symlink; refusing to replace it" >&2
		exit 1
	fi
	as_bench ln -sfn "${REPO_DIR}" "${link}"
	# pip first, then apps.txt (docs/research/frappe-16.32-findings.md section 7).
	as_bench uv pip install --python "${BENCH_DIR}/env/bin/python" -e "${link}"
	if ! grep -qx institutional_theme "${BENCH_DIR}/sites/apps.txt"; then
		# apps.txt may lack a trailing newline.
		[[ -n "$(tail -c1 "${BENCH_DIR}/sites/apps.txt")" ]] && as_bench bash -c "echo >>${BENCH_DIR}/sites/apps.txt"
		as_bench bash -c "echo institutional_theme >>${BENCH_DIR}/sites/apps.txt"
	fi
	cat "${BENCH_DIR}/sites/apps.txt"
	(cd "${BENCH_DIR}/sites" && as_bench ../env/bin/python -c "import frappe; print(frappe.get_module('institutional_theme').__name__)")
}

step_build() {
	# Links sites/assets/institutional_theme -> app public folder and builds every bundle.
	bench_cmd build
	ls -l "${BENCH_DIR}/sites/assets/" | grep -E "frappe|erpnext|institutional_theme" || true
}

if [[ $# -gt 0 ]]; then
	steps=("$@")
else
	steps=("${ALL_STEPS[@]}")
fi
total_start=$(date +%s)
for s in "${steps[@]}"; do
	run_step "${s}"
done
echo "TOTAL $(($(date +%s) - total_start))s"
