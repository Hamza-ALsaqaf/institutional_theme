#!/usr/bin/env bash
# A persistent verification site on the newest-tag bench (Frappe v16.52.0, ERPNext v16.50.0), running THIS working copy
# of the theme, mirroring midad.test of the 16.32.0 bench so every check can run on both versions.
#
#   tools/bench/newest_site.sh [stage...]       default: every setup stage in order
#   tools/bench/newest_site.sh start|stop|restart-web|status
#
# Setup stages (each idempotent: it looks for its own result and skips when found):
#   preflight  the newest bench exists (tools/bench/newest_tag.sh bench builds it); PostgreSQL answers
#   config     Redis and port settings in the bench's common_site_config.json (own ports, see env52.sh)
#   redis      own Redis cache and queue servers
#   site       bench new-site midad52.test on the PostgreSQL of midad.test, developer mode, host_name
#   erpnext    install-app erpnext
#   wizard     setup wizard completed with the same fictional data as the 16.32.0 bench
#   app        apps/institutional_theme -> this repository (symlink), uv pip install -e, sites/apps.txt
#   build      bench build --app institutional_theme, then sync_assets.sh (the 16.32.0 bench shares public/dist)
#   install    bench install-app institutional_theme on the site
#   web        the web server in the background on port 8001, hosts entry
#   verify     /login and /app answer 200 and link the ins_desk bundle
#
# Never touches midad.test, its bench, its Redis (13000/11000) or port 8000. Test fixtures: tools/bench/test_fixtures.py
# does not exist in the repository (the rule "test records only through that file" has produced no file), so none apply.
# Every bench command runs as the bench user under flock /tmp/ins-bench.lock; the lock is taken per command, not for the
# whole script. Output: $EVIDENCE_DIR/commands.tsv (stage or command, exit code, seconds). TEST ONLY credentials (env.sh).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env52.sh
source "${HERE}/env52.sh"

EVIDENCE_DIR="${EVIDENCE_DIR:-${REPO_DIR}/docs/team/evidence/round4/newest-site}"
LOGS="${BENCH_DIR}/logs"
BASE="http://127.0.0.1:${WEB_PORT}"
SUDO=""
[[ "$(id -u)" != "0" ]] && SUDO="sudo"
# The uv binary the bench user runs. Override with UV_BIN when the first uv on PATH is not readable by that user
# (root container: /root/.local/bin/uv; build_test_bench.sh installs a copy at /usr/local/bin/uv).
UV_BIN="${UV_BIN:-$(command -v uv || true)}"
mkdir -p "${EVIDENCE_DIR}"
[[ -f "${EVIDENCE_DIR}/commands.tsv" ]] || printf 'name\texit\tseconds\tcommand\n' >"${EVIDENCE_DIR}/commands.tsv"

log() { printf '%s\n' "$*" | tee -a "${EVIDENCE_DIR}/run.log"; }

# As the bench user, under the lock, without the runner's uv cache and sudo variables.
as_frappe() {
	${SUDO} env "PATH=${PATH}" flock -o /tmp/ins-bench.lock runuser -u "${BENCH_USER}" -- env -u UV_CACHE_DIR \
		-u SUDO_USER -u SUDO_UID -u SUDO_GID -u SUDO_COMMAND HOME="${BENCH_HOME}" USER="${BENCH_USER}" \
		PATH="${NODE_HOME}/bin:${BENCH_HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin" "$@"
}

# Run a command, append "name<TAB>exit<TAB>seconds<TAB>command" to commands.tsv, return its exit code.
timed() {
	local name="$1" start end rc=0 shown
	shift
	start=$(date +%s)
	# A subshell with its own "set -e": "cmd || rc=$?" would switch errexit off inside the stage functions.
	set +e
	(
		set -e
		"$@"
	)
	rc=$?
	set -e
	end=$(date +%s)
	shown="$*"
	shown="${shown//$'\t'/ }"
	shown="${shown//$'\n'/ }"
	printf '%s\t%s\t%s\t%s\n' "${name}" "${rc}" "$((end - start))" "${shown}" >>"${EVIDENCE_DIR}/commands.tsv"
	return "${rc}"
}

bench_cmd() { as_frappe bash -c 'cd "$1" && shift && bench "$@"' _ "${BENCH_DIR}" "$@"; }
site_cmd() { bench_cmd --site "${SITE}" "$@"; }
pg_up() { "${PG_BIN}/pg_isready" -q -h 127.0.0.1 -p "${PG_PORT}"; }

stage_preflight() {
	[[ -f "${BENCH_DIR}/sites/assets/assets.json" && -d "${BENCH_DIR}/apps/frappe" ]] || {
		echo "no newest bench at ${BENCH_DIR}: run tools/bench/newest_tag.sh tag clone bench first" >&2
		return 1
	}
	log "frappe $(as_frappe git -C "${BENCH_DIR}/apps/frappe" describe --tags), erpnext $(as_frappe git -C "${BENCH_DIR}/apps/erpnext" describe --tags 2>/dev/null || echo absent)"
	pg_up || {
		echo "PostgreSQL does not answer on ${PG_PORT}: run tools/bench/start_services.sh" >&2
		return 1
	}
	[[ -n "${UV_BIN}" ]] || { echo "uv not found on PATH" >&2; return 1; }
	[[ -n "${REPO_DIR}" && -d "${REPO_DIR}/institutional_theme" ]]
}

stage_config() {
	local cfg="${BENCH_DIR}/sites/common_site_config.json" want
	want="redis://127.0.0.1:${NEWEST_REDIS_CACHE}"
	if grep -q "\"redis_cache\": \"${want}\"" "${cfg}" && grep -q "\"webserver_port\": ${WEB_PORT}" "${cfg}"; then
		log "common_site_config already has the ports of this site"
		return 0
	fi
	bench_cmd set-config -g redis_cache "${want}"
	bench_cmd set-config -g redis_queue "redis://127.0.0.1:${NEWEST_REDIS_QUEUE}"
	bench_cmd set-config -g redis_socketio "${want}"
	bench_cmd set-config -g webserver_port "${WEB_PORT}" --parse
}

start_redis() {
	local kind port
	${SUDO} install -d -o "${BENCH_USER}" -g "${BENCH_USER}" "${LOGS}"
	for kind in cache queue; do
		port="${NEWEST_REDIS_CACHE}"
		[[ "${kind}" == queue ]] && port="${NEWEST_REDIS_QUEUE}"
		redis-cli -p "${port}" ping >/dev/null 2>&1 ||
			as_frappe redis-server --port "${port}" --bind 127.0.0.1 --daemonize yes --save "" --appendonly no \
				--dir "${LOGS}" --pidfile "${LOGS}/redis-${kind}.pid" >/dev/null
		redis-cli -p "${port}" ping >/dev/null
		log "redis ${kind} on ${port}: up"
	done
}

stage_redis() { start_redis; }

stage_site() {
	if [[ -f "${BENCH_DIR}/sites/${SITE}/site_config.json" ]]; then
		log "site ${SITE} already exists"
	else
		bench_cmd new-site "${SITE}" --db-type postgres --db-host 127.0.0.1 --db-port "${PG_PORT}" \
			--db-root-username "${PG_ROOT_USER}" --db-root-password "${PG_ROOT_PASSWORD}" \
			--admin-password "${ADMIN_PASSWORD}"
	fi
	bench_cmd use "${SITE}"
	site_cmd set-config developer_mode 1
	# run-tests refuses to run without it (tools/bench/README.md: test site only).
	site_cmd set-config allow_tests true
	site_cmd set-config host_name "http://${SITE}:${WEB_PORT}"
}

stage_erpnext() {
	if [[ ! -d "${BENCH_DIR}/apps/erpnext" ]]; then
		echo "apps/erpnext missing on the newest bench" >&2
		return 1
	fi
	if ! site_cmd list-apps | grep -q '^erpnext'; then
		site_cmd install-app erpnext
	fi
	site_cmd list-apps
}

stage_wizard() {
	local complete args
	complete="$(site_cmd execute frappe.is_setup_complete 2>/dev/null | tail -1)"
	if [[ "${complete,,}" == "true" ]]; then
		log "setup wizard already complete"
		return 0
	fi
	args="{'language': 'English', 'country': 'Saudi Arabia', 'timezone': 'Asia/Riyadh', 'currency': 'SAR', \
'full_name': 'Test Administrator', 'email': 'admin@example.com', 'password': '${ADMIN_PASSWORD}', \
'company_name': 'Test Institution', 'company_abbr': 'TI', 'fy_start_date': '2026-01-01', \
'fy_end_date': '2026-12-31', 'chart_of_accounts': 'Standard', 'bank_account': 'Main Account'}"
	site_cmd execute frappe.desk.page.setup_wizard.setup_wizard.setup_complete --kwargs "{'args': ${args}}"
	site_cmd execute frappe.is_setup_complete
}

stage_app() {
	local link="${BENCH_DIR}/apps/institutional_theme"
	if [[ -e "${link}" && ! -L "${link}" ]]; then
		echo "${link} exists and is not a symlink (a GitHub clone from newest_tag.sh theme?); refusing to replace it. Remove it first." >&2
		return 1
	fi
	as_frappe ln -sfn "${REPO_DIR}" "${link}"
	# pip first, then apps.txt (docs/research/frappe-16.32-findings.md section 7).
	as_frappe "${UV_BIN}" pip install --python "${BENCH_DIR}/env/bin/python" -e "${link}"
	if ! grep -qx institutional_theme "${BENCH_DIR}/sites/apps.txt"; then
		[[ -n "$(tail -c1 "${BENCH_DIR}/sites/apps.txt")" ]] && as_frappe bash -c "echo >>${BENCH_DIR}/sites/apps.txt"
		as_frappe bash -c "echo institutional_theme >>${BENCH_DIR}/sites/apps.txt"
	fi
	cat "${BENCH_DIR}/sites/apps.txt"
	(cd "${BENCH_DIR}/sites" && as_frappe "${BENCH_DIR}/env/bin/python" -c "import frappe; print(frappe.get_module('institutional_theme').__name__)")
}

stage_build() {
	bench_cmd build --app institutional_theme
	# Both benches share this repository's public/dist: the build deleted the files midad.test's assets.json names.
	"${HERE}/sync_assets.sh"
	ls -l "${BENCH_DIR}/sites/assets/" | grep -E "frappe|erpnext|institutional_theme" || true
}

stage_install() {
	if site_cmd list-apps | grep -q '^institutional_theme'; then
		log "institutional_theme already installed on ${SITE}"
	else
		site_cmd install-app institutional_theme
	fi
	site_cmd list-apps
}

web_up() { curl -fsS -o /dev/null --noproxy '*' "${BASE}/api/method/ping" 2>/dev/null; }

stage_web() {
	grep -qw "${SITE}" /etc/hosts || echo "127.0.0.1 ${SITE}" | ${SUDO} tee -a /etc/hosts >/dev/null
	start_redis
	if ! web_up; then
		as_frappe bash -c 'cd "$1/sites" || exit 1
			nohup ../env/bin/python -m frappe.utils.bench_helper frappe --site "$2" serve \
				--port "$3" --noreload >"$4" 2>&1 </dev/null &
			echo $! >"$5"' _ "${BENCH_DIR}" "${SITE}" "${WEB_PORT}" "${LOGS}/web.log" "${LOGS}/web.pid" </dev/null
	fi
	local _
	for _ in $(seq 1 90); do
		if web_up; then
			log "web: up on port ${WEB_PORT}"
			return 0
		fi
		sleep 1
	done
	echo "web server did not answer; see ${LOGS}/web.log" >&2
	return 1
}

stage_restart_web() {
	stop_web
	sleep 2
	stage_web
}

stop_web() {
	if [[ -f "${LOGS}/web.pid" ]]; then
		${SUDO} kill "$(cat "${LOGS}/web.pid")" 2>/dev/null || true
		${SUDO} rm -f "${LOGS}/web.pid"
	fi
	${SUDO} pkill -f "frappe --site ${SITE} serve --port ${WEB_PORT}" 2>/dev/null || true
}

stage_stop() {
	stop_web
	local port
	for port in "${NEWEST_REDIS_CACHE}" "${NEWEST_REDIS_QUEUE}"; do
		redis-cli -p "${port}" shutdown nosave 2>/dev/null || true
	done
	log "stopped web ${WEB_PORT} and Redis ${NEWEST_REDIS_CACHE}/${NEWEST_REDIS_QUEUE} (PostgreSQL and midad.test left running)"
}

stage_status() {
	local port
	pg_up && echo "postgres ${PG_PORT}: up" || echo "postgres ${PG_PORT}: down"
	for port in "${NEWEST_REDIS_CACHE}" "${NEWEST_REDIS_QUEUE}"; do
		redis-cli -p "${port}" ping >/dev/null 2>&1 && echo "redis ${port}: up" || echo "redis ${port}: down"
	done
	web_up && echo "web ${WEB_PORT}: up" || echo "web ${WEB_PORT}: down"
}

# /login and /app (logged in as Administrator) answer 200 and link the theme's ins_desk bundle.
stage_verify() {
	local jar code ok=1 body
	jar="$(mktemp)"
	body="$(mktemp)"
	for path in /login; do
		code="$(curl -sS --noproxy '*' -o "${body}" -w '%{http_code}' "${BASE}${path}")"
		log "GET ${path} -> ${code}; ins bundles linked: $(grep -o 'institutional_theme/dist/[a-z/_.0-9A-Z-]*\.css\|ins_[a-z_.0-9A-Z-]*\.\(css\|js\)' "${body}" | sort -u | tr '\n' ' ')"
		[[ "${code}" == 200 ]] || ok=0
	done
	curl -sS --noproxy '*' -c "${jar}" -o /dev/null -w 'POST /api/method/login -> %{http_code}\n' \
		-d "usr=Administrator&pwd=${ADMIN_PASSWORD}" "${BASE}/api/method/login" | tee -a "${EVIDENCE_DIR}/run.log"
	code="$(curl -sS --noproxy '*' -L -b "${jar}" -o "${body}" -w '%{http_code}' "${BASE}/app")"
	log "GET /app (logged in, redirects followed) -> ${code}"
	[[ "${code}" == 200 ]] || ok=0
	grep -o '[A-Za-z0-9_./-]*ins_desk[A-Za-z0-9_./-]*' "${body}" | sort -u | tee "${EVIDENCE_DIR}/ins_desk-links.txt" | sed 's/^/ins_desk link: /' | tee -a "${EVIDENCE_DIR}/run.log"
	[[ -s "${EVIDENCE_DIR}/ins_desk-links.txt" ]] || { log "FAIL: no ins_desk link in /app"; ok=0; }
	rm -f "${jar}" "${body}"
	[[ "${ok}" == 1 ]]
}

all_stages=(preflight config redis site erpnext wizard app build install web verify)
case "${1:-}" in
start) stages=(preflight redis web) ;;
stop) stage_stop; exit 0 ;;
restart-web) stages=(restart_web) ;;
status) stage_status; exit 0 ;;
*) stages=("$@") ;;
esac
[[ ${#stages[@]} -gt 0 ]] || stages=("${all_stages[@]}")
total_start=$(date +%s)
for s in "${stages[@]}"; do
	log "STAGE ${s} START $(date -u +%FT%TZ)"
	rc=0
	timed "stage-${s}" "stage_${s}" || rc=$?
	log "STAGE ${s} END exit ${rc}"
	[[ "${rc}" == 0 ]] || exit "${rc}"
done
log "TOTAL $(($(date +%s) - total_start))s"
