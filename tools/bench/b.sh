#!/usr/bin/env bash
# Run one bench command for the test site as the bench user, under the shared build lock.
#   tools/bench/b.sh migrate
#   tools/bench/b.sh run-tests --app institutional_theme
# Works from the CI runner (passwordless sudo) and from the root container.
# "flock -o" keeps the lock file descriptor away from the command, so daemons it starts cannot hold the lock.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${HERE}/env.sh"
args=$(printf '%q ' "$@")
SUDO=""
[[ "$(id -u)" != "0" ]] && SUDO="sudo -E"
${SUDO} flock -o /tmp/ins-bench.lock runuser -u "${BENCH_USER}" -- env HOME="${BENCH_HOME}" \
	PATH="${NODE_HOME}/bin:${BENCH_HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin" \
	bash -c "cd ${BENCH_DIR} && bench --site ${SITE} ${args}"
# A build writes new hashed names into public/dist, which the newest-tag bench (newest_site.sh) shares with this one:
# repoint the other bench's assets.json when it exists. Not run for any other command.
if [[ "${1:-}" == "build" && -z "${INS_NO_SYNC:-}" && -d "${NEWEST_BENCH:-/home/frappe/newest-bench}/sites" ]]; then
	"${HERE}/sync_assets.sh"
fi
