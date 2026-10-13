#!/usr/bin/env bash
# Start PostgreSQL, the two bench Redis instances and the web server of the
# test bench, all in the background, then wait until http://localhost:8000
# answers. Safe to run repeatedly: a service that is already up is left alone.
#
#   tools/bench/start_services.sh          start everything
#   tools/bench/start_services.sh restart-web   restart only the web server
#   tools/bench/start_services.sh stop     stop the web server, Redis and PostgreSQL
#
# The site is served for the Host header "midad.test" (also the bench default
# site), so a headless browser can open http://midad.test:8000 or
# http://localhost:8000.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env.sh
source "${HERE}/env.sh"

LOGS="${BENCH_DIR}/logs"
PG_LOG="$(dirname "${PG_DATA}")/midad-postgres.log"

stop_all() {
	if [[ -f "${LOGS}/web.pid" ]]; then
		kill "$(cat "${LOGS}/web.pid")" 2>/dev/null || true
		rm -f "${LOGS}/web.pid"
	fi
	pkill -f "frappe --site ${SITE} serve --port ${WEB_PORT}" 2>/dev/null || true
	for port in 13000 11000; do
		redis-cli -p "${port}" shutdown nosave 2>/dev/null || true
	done
	su postgres -c "${PG_BIN}/pg_ctl -D ${PG_DATA} stop -m fast" 2>/dev/null || true
	echo "stopped"
}

if [[ "${1:-}" == "restart-web" ]]; then
	# A running server does not see apps pip-installed after it started: restart it.
	if [[ -f "${LOGS}/web.pid" ]]; then
		kill "$(cat "${LOGS}/web.pid")" 2>/dev/null || true
		rm -f "${LOGS}/web.pid"
		sleep 2
	fi
elif [[ "${1:-}" == "stop" ]]; then
	stop_all
	exit 0
fi

install -d -o "${BENCH_USER}" -g "${BENCH_USER}" "${LOGS}"

# 1. Name resolution for the test site (the container /etc/hosts is writable).
if ! grep -qw "${SITE}" /etc/hosts; then
	echo "127.0.0.1 ${SITE}" >>/etc/hosts
fi

# 2. PostgreSQL.
if ! "${PG_BIN}/pg_isready" -q -h 127.0.0.1 -p "${PG_PORT}"; then
	su postgres -c "${PG_BIN}/pg_ctl -D ${PG_DATA} -l ${PG_LOG} -w start"
fi
"${PG_BIN}/pg_isready" -h 127.0.0.1 -p "${PG_PORT}"

# 3. Redis cache (13000) and queue (11000), using the files bench generated.
for kind in cache queue; do
	conf="${BENCH_DIR}/config/redis_${kind}.conf"
	port=$([[ "${kind}" == cache ]] && echo 13000 || echo 11000)
	if ! redis-cli -p "${port}" ping >/dev/null 2>&1; then
		(cd "${BENCH_DIR}/config" && as_bench redis-server "${conf}" --daemonize yes >/dev/null)
	fi
	redis-cli -p "${port}" ping >/dev/null
	echo "redis ${kind} on ${port}: up"
done

if [[ ! -d "${BENCH_DIR}/sites/${SITE}" ]]; then
	echo "site ${SITE} does not exist yet; web server not started"
	exit 0
fi

# 4. Web server (werkzeug, no reloader: restart it after changing hooks.py).
if ! curl -fsS -o /dev/null --noproxy '*' "http://127.0.0.1:${WEB_PORT}/api/method/ping" 2>/dev/null; then
	(
		cd "${BENCH_DIR}/sites"
		as_bench bash -c 'cd "$1" || exit 1
			nohup ../env/bin/python -m frappe.utils.bench_helper frappe --site "$2" serve \
				--port "$3" --noreload >"$4" 2>&1 </dev/null &
			echo $! >"$5"' _ \
			"${BENCH_DIR}/sites" "${SITE}" "${WEB_PORT}" "${LOGS}/web.log" "${LOGS}/web.pid" </dev/null
	)
fi
for _ in $(seq 1 60); do
	if curl -fsS -o /dev/null --noproxy '*' "http://127.0.0.1:${WEB_PORT}/api/method/ping" 2>/dev/null; then
		echo "web: up on port ${WEB_PORT}"
		exit 0
	fi
	sleep 1
done
echo "web server did not answer; see ${LOGS}/web.log" >&2
exit 1
