#!/usr/bin/env bash
# Clean install from scratch, as an administrator would (round 3, item 1).
#
#   tools/bench/fresh_install.sh [all|clean|bench|site-frappe|site-erpnext|idempotency|remove-app|stop]
#
# Builds a SECOND, fresh bench (Frappe v16.32.0, PostgreSQL 16, web on port 8010, its own Redis on
# 13001 and 11001), so `bench get-app` really fetches the app from GitHub as README.md says, then
# installs and uninstalls it on two fresh sites of that bench:
#
#   fresh.test     Frappe only          the minimum README.md promises: the app has no `required_apps`
#   fresherp.test  Frappe and ERPNext   the stack the institution runs (ERPNext v16.33.0)
#   idem.test      Frappe only          install twice and migrate twice: table counts and print records unchanged
#
# The README "Install" and "Uninstall" commands are run literally (APP_URL with no branch gives the
# repository's default branch; set APP_BRANCH to test a branch instead). Every command is recorded in
# $EVIDENCE/commands.tsv (step, exit code, seconds, command) with its output in $EVIDENCE/logs/.
# Each bench command takes /tmp/ins-bench.lock for its own duration only, as the bench user, with the
# runner's uv cache variable removed. midad.test is never touched. The web server of the fresh bench
# is stopped at the end.
#
# Test-only credentials (same as env.sh): PostgreSQL superuser and Administrator password.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env.sh
source "${HERE}/env.sh"

FRESH_BENCH="${FRESH_BENCH:-${BENCH_HOME}/fresh-bench}"
FRESH_PORT="${FRESH_PORT:-8010}"
FRESH_REDIS_CACHE="${FRESH_REDIS_CACHE:-13001}"
FRESH_REDIS_QUEUE="${FRESH_REDIS_QUEUE:-11001}"
APP_URL="${APP_URL:-https://github.com/Hamza-ALsaqaf/institutional_theme}"
APP_BRANCH="${APP_BRANCH:-}"
APP="institutional_theme"
# Playwright for the screenshots (GitHub runner layout from tools/bench/ci_prereqs.sh; env.sh has the container's).
[[ -d /opt/pw-node/node_modules ]] && PW_NODE_PATH="/opt/pw-node/node_modules"
[[ -x /opt/pixvenv/bin/python ]] && PIXDIFF_PYTHON="/opt/pixvenv/bin/python"
SITE_FRAPPE="${SITE_FRAPPE:-fresh.test}"
SITE_ERPNEXT="${SITE_ERPNEXT:-fresherp.test}"
EVIDENCE="${EVIDENCE_DIR:-${REPO_DIR}/docs/team/evidence/round3/fresh-install}"
LOGS="${EVIDENCE}/logs"
mkdir -p "${LOGS}"
SUDO=""
[[ "$(id -u)" != "0" ]] && SUDO="sudo"
FAILED=0

# Run a command as the bench user, under the lock, without the runner's uv cache.
as_frappe() {
	${SUDO} env "PATH=${PATH}" flock -o /tmp/ins-bench.lock runuser -u "${BENCH_USER}" -- env -u UV_CACHE_DIR \
		-u SUDO_USER -u SUDO_UID -u SUDO_GID -u SUDO_COMMAND HOME="${BENCH_HOME}" USER="${BENCH_USER}" \
		PATH="${NODE_HOME}/bin:${BENCH_HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin" "$@"
}
# A shell command line in the fresh bench directory.
fb() { as_frappe bash -c "cd '${FRESH_BENCH}' && $*"; }

# step NAME COMMAND...   run, log, time, record. Returns the exit code; a failure is counted.
step() {
	local name="$1" start end rc=0 shown
	shift
	start=$(date +%s)
	printf '=== %s  %s\n$ %s\n' "${name}" "$(date -u +%FT%TZ)" "$*" >"${LOGS}/${name}.log"
	"$@" >>"${LOGS}/${name}.log" 2>&1 || rc=$?
	end=$(date +%s)
	shown="${*//$'\t'/ }"
	shown="${shown//$'\n'/ }"
	printf '%s\t%s\t%s\t%s\n' "${name}" "${rc}" "$((end - start))" "${shown}" >>"${EVIDENCE}/commands.tsv"
	printf 'exit %s\n' "${rc}" >>"${LOGS}/${name}.log"
	printf '%-34s exit %-3s %4ss\n' "${name}" "${rc}" "$((end - start))"
	[[ "${rc}" != 0 ]] && FAILED=$((FAILED + 1))
	return "${rc}"
}
# Same, but a failure ends the run: nothing after it would mean anything.
must() { step "$@" || { echo "FATAL: $1 failed, see ${LOGS}/$1.log" >&2; exit 1; }; }

fresh_python() { echo "${FRESH_BENCH}/env/bin/python"; }

# ---------------------------------------------------------------------------------------------
stage_clean() {
	if [[ -d "${FRESH_BENCH}" ]]; then
		stage_stop
		for site in "${SITE_FRAPPE}" "${SITE_ERPNEXT}" "${SITE_IDEM:-idem.test}"; do
			[[ -d "${FRESH_BENCH}/sites/${site}" ]] &&
				step "clean-drop-${site}" fb "bench drop-site ${site} --force --no-backup --db-root-username ${PG_ROOT_USER} --db-root-password ${PG_ROOT_PASSWORD}"
		done
		step clean-rm as_frappe rm -rf "${FRESH_BENCH}"
	fi
}

stage_bench() {
	# bench init clones Frappe at the pinned tag and builds core's assets. Redis config generation is skipped:
	# the machine's first bench already owns the default Redis ports (13000, 11000).
	must bench-init as_frappe bash -c "cd '${BENCH_HOME}' && bench init '$(basename "${FRESH_BENCH}")' \
		--frappe-branch '${FRAPPE_TAG}' --python '${BENCH_PYTHON}' --no-backups --skip-redis-config-generation"
	must set-config-redis-cache fb "bench set-config -g redis_cache redis://127.0.0.1:${FRESH_REDIS_CACHE}"
	must set-config-redis-queue fb "bench set-config -g redis_queue redis://127.0.0.1:${FRESH_REDIS_QUEUE}"
	must set-config-redis-socketio fb "bench set-config -g redis_socketio redis://127.0.0.1:${FRESH_REDIS_CACHE}"
	step frappe-version fb "git -C apps/frappe describe --tags && ls apps && cat sites/apps.txt"
	start_redis
}

# A bench made with --skip-redis-config-generation (the fresh bench, the newest-tag bench) has no Redis settings yet.
ensure_redis_config() {
	grep -q '"redis_cache"' "${FRESH_BENCH}/sites/common_site_config.json" && return 0
	step set-config-redis-cache fb "bench set-config -g redis_cache redis://127.0.0.1:${FRESH_REDIS_CACHE}"
	step set-config-redis-queue fb "bench set-config -g redis_queue redis://127.0.0.1:${FRESH_REDIS_QUEUE}"
	step set-config-redis-socketio fb "bench set-config -g redis_socketio redis://127.0.0.1:${FRESH_REDIS_CACHE}"
}

start_redis() {
	local kind port
	for kind in cache queue; do
		port="${FRESH_REDIS_CACHE}"
		[[ "${kind}" == queue ]] && port="${FRESH_REDIS_QUEUE}"
		redis-cli -p "${port}" ping >/dev/null 2>&1 ||
			step "redis-${kind}" as_frappe redis-server --port "${port}" --bind 127.0.0.1 --daemonize yes \
				--save "" --appendonly no --dir "${FRESH_BENCH}/logs" --pidfile "${FRESH_BENCH}/logs/redis-${kind}.pid"
	done
	"${PG_BIN}/pg_isready" -h 127.0.0.1 -p "${PG_PORT}" >/dev/null || echo "PostgreSQL is not running: tools/bench/start_services.sh" >&2
}

web_start() { # site
	web_stop
	as_frappe bash -c "cd '${FRESH_BENCH}/sites' && nohup ../env/bin/python -m frappe.utils.bench_helper frappe --site '$1' \
		serve --port '${FRESH_PORT}' --noreload >'${FRESH_BENCH}/logs/web.log' 2>&1 </dev/null & echo \$! >'${FRESH_BENCH}/logs/web.pid'" </dev/null
	for _ in $(seq 1 90); do
		curl -fsS -o /dev/null --noproxy '*' "http://127.0.0.1:${FRESH_PORT}/api/method/ping" 2>/dev/null && return 0
		sleep 1
	done
	return 1
}
web_stop() {
	if [[ -f "${FRESH_BENCH}/logs/web.pid" ]]; then
		${SUDO} kill "$(cat "${FRESH_BENCH}/logs/web.pid")" 2>/dev/null || true
		${SUDO} rm -f "${FRESH_BENCH}/logs/web.pid"
	fi
	${SUDO} pkill -f "frappe --site .* serve --port ${FRESH_PORT}" 2>/dev/null || true
	sleep 1
	return 0
}

# Desk and login check by HTTP: the page links this app's bundles (expect=yes) or none (expect=no), and
# every linked asset downloads. Output in $EVIDENCE/verify-LABEL.txt; the last line is PASS or FAIL.
verify() { # site label expect
	local site="$1" label="$2" expect="$3" out="${EVIDENCE}/verify-$2.txt" jar
	local base="http://127.0.0.1:${FRESH_PORT}" ok=1 n
	jar="$(mktemp)"
	{
		echo "site ${site}, label ${label}, expecting this app's bundles: ${expect}"
		echo "ping: $(curl -sS --noproxy '*' "${base}/api/method/ping" -H "Host: ${site}")"
		curl -sS --noproxy '*' -H "Host: ${site}" "${base}/login" -o "${LOGS}/${label}-login.html" -w 'GET /login -> %{http_code}\n'
		curl -sS --noproxy '*' -H "Host: ${site}" -c "${jar}" -X POST "${base}/api/method/login" \
			-d "usr=Administrator&pwd=${ADMIN_PASSWORD}" -w '\nPOST /api/method/login -> %{http_code}\n'
		curl -sS --noproxy '*' -H "Host: ${site}" -b "${jar}" -L "${base}/app" -o "${LOGS}/${label}-app.html" -w 'GET /app (after redirects: %{url_effective}) -> %{http_code}\n'
		for page in login app; do
			n=$(grep -oE '(href|src)="[^"]*ins_[a-z_]*\.bundle[^"]*"' "${LOGS}/${label}-${page}.html" | sort -u | tee "${LOGS}/${label}-${page}.links" | wc -l)
			echo "${page} page: ${n} link(s) to ins_ bundles"
			cat "${LOGS}/${label}-${page}.links"
			if [[ "${expect}" == yes && "${n}" -eq 0 ]]; then ok=0; echo "FAIL: ${page} page links no ins_ bundle"; fi
			if [[ "${expect}" == no && "${n}" -gt 0 ]]; then ok=0; echo "FAIL: ${page} page still links ins_ bundles"; fi
			while IFS= read -r link; do
				url="${link#*=\"}"
				url="${url%\"}"
				code=$(curl -sS --noproxy '*' -o /dev/null -w '%{http_code} %{size_download}' -H "Host: ${site}" "${base}${url}")
				echo "  ${code} ${url}"
				[[ "${code}" == 200* ]] || { ok=0; echo "FAIL: asset not served"; }
			done <"${LOGS}/${label}-${page}.links"
		done
		if [[ "${expect}" == yes ]]; then
			grep -q 'ins_desk\.bundle' "${LOGS}/${label}-app.html" || { ok=0; echo "FAIL: /app has no ins_desk bundle"; }
			grep -q 'ins_shell\.bundle' "${LOGS}/${label}-app.html" || { ok=0; echo "FAIL: /app has no ins_shell bundle"; }
		fi
		[[ "${ok}" == 1 ]] && echo PASS || echo FAIL
	} >"${out}" 2>&1
	rm -f "${jar}"
	tail -1 "${out}" | grep -q PASS
}

snapshot() { # site name. The bench user cannot write the repository, so it writes /tmp and the runner copies.
	local tmp="/tmp/fresh-snapshot-$1-$2.json"
	as_frappe bash -c "cd '${FRESH_BENCH}/sites' && '${FRESH_BENCH}/env/bin/python' '${HERE}/fresh_check.py' snapshot '$1' '${tmp}'" &&
		cp "${tmp}" "${EVIDENCE}/snapshot-$1-$2.json"
}

# Setup wizard, non-interactive, fictional data (the same call as build_test_bench.sh): without it /app only shows the wizard.
wizard() { # site erpnext(0|1)
	local args="{'language': 'English', 'country': 'Saudi Arabia', 'timezone': 'Asia/Riyadh', 'currency': 'SAR', \
'full_name': 'Test Administrator', 'email': 'admin@example.com', 'password': '${ADMIN_PASSWORD}'}"
	if [[ "$2" == 1 ]]; then
		args="{'language': 'English', 'country': 'Saudi Arabia', 'timezone': 'Asia/Riyadh', 'currency': 'SAR', \
'full_name': 'Test Administrator', 'email': 'admin@example.com', 'password': '${ADMIN_PASSWORD}', \
'company_name': 'Test Institution', 'company_abbr': 'TI', 'fy_start_date': '2026-01-01', \
'fy_end_date': '2026-12-31', 'chart_of_accounts': 'Standard', 'bank_account': 'Main Account'}"
	fi
	printf "{'args': %s}" "${args}" >"/tmp/fresh-wizard-$1.txt"
	chmod a+r "/tmp/fresh-wizard-$1.txt"
	fb "bench --site '$1' execute frappe.desk.page.setup_wizard.setup_wizard.setup_complete --kwargs \"\$(cat /tmp/fresh-wizard-$1.txt)\"" || return $?
	fb "bench --site '$1' execute frappe.is_setup_complete"
}

# Screenshots and asset lists of the running site (tools/bench/capture.mjs), into $EVIDENCE/shots-SITE.
capture() { # site label
	mkdir -p "${EVIDENCE}/shots-$1"
	env NODE_PATH="${PW_NODE_PATH}" PLAYWRIGHT_BROWSERS_PATH="${PW_BROWSERS_PATH}" \
		node "${HERE}/capture.mjs" "$2" "${EVIDENCE}/shots-$1" "http://127.0.0.1:${FRESH_PORT}"
}

pixel_compare() { # site: stock vs installed (expected to differ), stock vs after uninstall (expected identical)
	local dir="${EVIDENCE}/shots-$1" rc=0 pair shot
	: >"${dir}/pixel-diff.txt"
	for shot in login todo; do
		for pair in "before installed" "before after-uninstall"; do
			set -- ${pair}
			"${PIXDIFF_PYTHON}" "${HERE}/pixel_diff.py" "${dir}/$1-${shot}.png" "${dir}/$2-${shot}.png" >>"${dir}/pixel-diff.txt" || true
		done
	done
	cat "${dir}/pixel-diff.txt"
	return "${rc}"
}

# One site end to end. $1 site, $2 erpnext (0 or 1)
run_site() {
	local site="$1" erp="$2" tag="$1"
	echo "---- site ${site} (ERPNext ${erp}) ----"
	must "${tag}-new-site" fb "bench new-site ${site} --db-type postgres --db-host 127.0.0.1 --db-port ${PG_PORT} \
		--db-root-username ${PG_ROOT_USER} --db-root-password ${PG_ROOT_PASSWORD} --admin-password ${ADMIN_PASSWORD}"
	if [[ "${erp}" == 1 ]]; then
		[[ -d "${FRESH_BENCH}/apps/erpnext" ]] ||
			must "${tag}-get-app-erpnext" fb "bench get-app erpnext https://github.com/frappe/erpnext --branch ${ERPNEXT_TAG}"
		must "${tag}-install-erpnext" fb "bench --site ${site} install-app erpnext"
	fi
	step "${tag}-setup-wizard" wizard "${site}" "${erp}"
	step "${tag}-list-apps-before" fb "bench --site ${site} list-apps"
	# Core's own migrate normalises standard rows (Desktop Icon, Navbar Item). Run it once on the stock site, so
	# the "before" snapshot is what the site looks like after any migrate and only this app can make a difference.
	step "${tag}-migrate-stock" fb "bench --site ${site} migrate"
	must "${tag}-snapshot-before" snapshot "${site}" before
	step "${tag}-web-start-stock" web_start "${site}"
	step "${tag}-capture-before" capture "${site}" before

	# README "Install", as written. get-app is bench-wide, so it runs on the first site only.
	if [[ ! -d "${FRESH_BENCH}/apps/${APP}" ]]; then
		local branch=""
		[[ -n "${APP_BRANCH}" ]] && branch=" --branch ${APP_BRANCH}"
		must "${tag}-readme-1-get-app" fb "bench get-app ${APP_URL}${branch}"
		step "${tag}-app-version" fb "git -C apps/${APP} log --oneline -1 && git -C apps/${APP} branch --show-current && cat sites/apps.txt"
	fi
	must "${tag}-readme-2-install-app" fb "bench --site ${site} install-app ${APP}"
	must "${tag}-readme-3-build" fb "bench build --app ${APP}"
	step "${tag}-readme-4-restart" fb "bench restart"
	step "${tag}-readme-5-list-apps" fb "bench --site ${site} list-apps"
	step "${tag}-web-start" web_start "${site}"
	step "${tag}-verify-installed" verify "${site}" "${tag}-installed" yes
	step "${tag}-capture-installed" capture "${site}" installed

	# Idempotency: install again, migrate twice. Nothing may change or fail.
	step "${tag}-install-again" fb "bench --site ${site} install-app ${APP}"
	step "${tag}-migrate-1" fb "bench --site ${site} migrate"
	step "${tag}-migrate-2" fb "bench --site ${site} migrate"
	step "${tag}-snapshot-installed" snapshot "${site}" installed
	step "${tag}-verify-after-migrate" verify "${site}" "${tag}-after-migrate" yes

	# State the app must clean up (identity, File, per-user defaults, site files), as the Phase 0 gate does.
	step "${tag}-seed-state" as_frappe bash -c "cd '${FRESH_BENCH}/sites' && '${FRESH_BENCH}/env/bin/python' '${HERE}/gate_state.py' seed '${site}' '/tmp/fresh-state-${site}.json'"

	# README "Uninstall". The command has no --yes, so an administrator answers the prompt: "y" on stdin.
	step "${tag}-readme-6-uninstall" fb "printf 'y\n' | bench --site ${site} uninstall-app ${APP}"
	step "${tag}-list-apps-after" fb "bench --site ${site} list-apps"
	step "${tag}-residue-gate-state" as_frappe bash -c "cd '${FRESH_BENCH}/sites' && '${FRESH_BENCH}/env/bin/python' '${HERE}/gate_state.py' residue '${site}' '/tmp/fresh-state-${site}.json'"
	step "${tag}-snapshot-after" snapshot "${site}" after
	step "${tag}-residue-table-diff" bash -c "python3 -I '${HERE}/fresh_check.py' diff '${EVIDENCE}/snapshot-${site}-before.json' '${EVIDENCE}/snapshot-${site}-after.json'"
	step "${tag}-capture-after-uninstall" capture "${site}" after-uninstall
	step "${tag}-pixel-compare" pixel_compare "${site}"
	step "${tag}-verify-after-uninstall" verify "${site}" "${tag}-after-uninstall-no-restart" no ||
		{
			step "${tag}-web-restart" web_start "${site}"
			step "${tag}-verify-after-uninstall-restart" verify "${site}" "${tag}-after-uninstall-restart" no
		}
	step "${tag}-site-files" fb "ls -la sites/${site}/public/files 2>&1; test ! -e sites/${site}/public/files/institutional_theme && echo 'no institutional_theme folder'"
	web_stop
}

stage_site_frappe() { run_site "${SITE_FRAPPE}" 0; }
stage_site_erpnext() { run_site "${SITE_ERPNEXT}" 1; }

# Idempotency on a third fresh site (Frappe only): install twice, migrate twice, table counts unchanged, an
# administrator's setting and the shipped print records untouched.
stage_idempotency() {
	local site="${SITE_IDEM:-idem.test}" tag="idem"
	[[ -d "${FRESH_BENCH}/sites/${site}" ]] &&
		step "${tag}-drop-old-site" fb "bench drop-site ${site} --force --no-backup --db-root-username ${PG_ROOT_USER} --db-root-password ${PG_ROOT_PASSWORD}"
	must "${tag}-new-site" fb "bench new-site ${site} --db-type postgres --db-host 127.0.0.1 --db-port ${PG_PORT} \
		--db-root-username ${PG_ROOT_USER} --db-root-password ${PG_ROOT_PASSWORD} --admin-password ${ADMIN_PASSWORD}"
	# Core's first migrate normalises standard rows (Desktop Icon): do it before the app is installed.
	step "${tag}-migrate-stock" fb "bench --site ${site} migrate"
	[[ -d "${FRESH_BENCH}/apps/${APP}" ]] || {
		local branch=""
		[[ -n "${APP_BRANCH}" ]] && branch=" --branch ${APP_BRANCH}"
		must "${tag}-get-app" fb "bench get-app ${APP_URL}${branch}"
	}
	must "${tag}-install-app" fb "bench --site ${site} install-app ${APP}"
	local stamps="bench --site ${site} execute frappe.db.get_value --args \"['Letter Head', 'Midad', 'modified']\"; bench --site ${site} execute frappe.db.get_value --args \"['Print Style', 'Midad', 'modified']\""
	step "${tag}-stamps-1" fb "${stamps}"
	step "${tag}-snapshot-1" snapshot "${site}" 1
	step "${tag}-set-admin-value" fb "bench --site ${site} execute frappe.db.set_single_value --args \"['Institutional Theme Settings', 'default_density', 'Compact']\" && bench --site ${site} execute frappe.db.commit"
	step "${tag}-install-again" fb "bench --site ${site} install-app ${APP}"
	step "${tag}-snapshot-2" snapshot "${site}" 2
	step "${tag}-diff-1-2" bash -c "python3 -I '${HERE}/fresh_check.py' diff '${EVIDENCE}/snapshot-${site}-1.json' '${EVIDENCE}/snapshot-${site}-2.json'"
	step "${tag}-migrate-1" fb "bench --site ${site} migrate"
	step "${tag}-snapshot-3" snapshot "${site}" 3
	# Core's install-app step re-creates the "Frappe Framework" Desktop Icon (app frappe, not ours) and the next
	# migrate removes it again (observed, desktop-icons-after-install-app.txt and desktop-icons-after-migrate.txt), so that table is named as accepted here.
	step "${tag}-diff-2-3" bash -c "python3 -I '${HERE}/fresh_check.py' diff '${EVIDENCE}/snapshot-${site}-2.json' '${EVIDENCE}/snapshot-${site}-3.json' 'tabDesktop Icon'"
	step "${tag}-migrate-2" fb "bench --site ${site} migrate"
	step "${tag}-snapshot-4" snapshot "${site}" 4
	step "${tag}-diff-3-4" bash -c "python3 -I '${HERE}/fresh_check.py' diff '${EVIDENCE}/snapshot-${site}-3.json' '${EVIDENCE}/snapshot-${site}-4.json'"
	step "${tag}-stamps-2" fb "${stamps}"
	step "${tag}-admin-value-kept" fb "bench --site ${site} execute frappe.db.get_single_value --args \"['Institutional Theme Settings', 'default_density']\""
	step "${tag}-uninstall" fb "bench --site ${site} uninstall-app ${APP} --yes --no-backup"
}

# Last, bench-wide: take the app out of the bench (README "Uninstall", optional second command).
stage_remove_app() {
	step remove-app fb "bench remove-app ${APP} --no-backup"
	step remove-app-apps-txt fb "cat sites/apps.txt; echo; ls apps; ${FRESH_BENCH}/env/bin/pip list 2>/dev/null | grep -i institutional || echo 'package not installed'"
	local check="echo \"ins_ entries in assets.json: \$(grep -c 'ins_' sites/assets/assets.json)\"; ls -l sites/assets | grep institutional_theme || echo 'no sites/assets/institutional_theme'"
	step remove-app-assets-before-build fb "${check}"
	step remove-app-build fb "bench build"
	step remove-app-assets-after-build fb "${check}"
	step remove-app-web-start web_start "${SITE_FRAPPE}"
	step remove-app-verify-frappe-site verify "${SITE_FRAPPE}" remove-app-frappe-site no
	step remove-app-list-apps-frappe-site fb "bench --site ${SITE_FRAPPE} list-apps"
	step remove-app-list-apps-erpnext-site fb "bench --site ${SITE_ERPNEXT} list-apps"
	web_stop
}

stage_stop() {
	web_stop
	local port
	for port in "${FRESH_REDIS_CACHE}" "${FRESH_REDIS_QUEUE}"; do
		redis-cli -p "${port}" shutdown nosave 2>/dev/null || true
	done
	return 0
}

run_all() {
	: >"${EVIDENCE}/commands.tsv"
	printf 'step\texit\tseconds\tcommand\n' >"${EVIDENCE}/commands.tsv"
	date -u +%FT%TZ >"${EVIDENCE}/started.txt"
	stage_clean
	stage_bench
	stage_site_frappe
	stage_site_erpnext
	stage_idempotency
	stage_remove_app
	stage_stop
	date -u +%FT%TZ >"${EVIDENCE}/finished.txt"
	echo "steps failed: ${FAILED}"
}

case "${1:-all}" in
all) run_all ;;
clean) stage_clean ;;
bench) stage_bench ;;
site-frappe) ensure_redis_config; start_redis && stage_site_frappe; stage_stop ;;
site-erpnext) ensure_redis_config; start_redis && stage_site_erpnext; stage_stop ;;
idempotency) start_redis && stage_idempotency && stage_stop ;;
remove-app) start_redis && stage_remove_app && stage_stop ;;
stop) stage_stop ;;
*) echo "usage: $0 [all|clean|bench|site-frappe|site-erpnext|idempotency|remove-app|stop]" >&2; exit 2 ;;
esac
exit $((FAILED > 0))
