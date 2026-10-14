#!/usr/bin/env bash
# After `bench build --app institutional_theme` on either bench, make the other bench's assets.json point at the
# files that now exist (both benches share this repository's public/dist; see sync_assets.py), then clear the cache
# of both sites. Safe to run at any time; a no-op when both are consistent.
#   tools/bench/sync_assets.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env.sh
source "${HERE}/env.sh"
# Callers may have sourced env52.sh, which points BENCH_REAL_DIR and SITE at the newest bench: use own names.
OLD_BENCH="${OLD_BENCH:-/home/frappe/frappe-bench}"
OLD_SITE="${OLD_SITE:-midad.test}"
NEWEST_BENCH="${NEWEST_BENCH:-/home/frappe/newest-bench}"
NEWEST_SITE="${NEWEST_SITE:-midad52.test}"
SUDO=""
[[ "$(id -u)" != "0" ]] && SUDO="sudo"
# Under the lock, as the bench user.
${SUDO} env "PATH=${PATH}" flock -o /tmp/ins-bench.lock runuser -u "${BENCH_USER}" -- env HOME="${BENCH_HOME}" \
	PATH="${NODE_HOME}/bin:${BENCH_HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin" \
	python3 -I "${HERE}/sync_assets.py" "${OLD_BENCH}" "${NEWEST_BENCH}"
for pair in "${OLD_BENCH} ${OLD_SITE}" "${NEWEST_BENCH} ${NEWEST_SITE}"; do
	set -- ${pair}
	[[ -d "$1/sites/$2" ]] || continue
	${SUDO} env "PATH=${PATH}" flock -o /tmp/ins-bench.lock runuser -u "${BENCH_USER}" -- env HOME="${BENCH_HOME}" \
		PATH="${NODE_HOME}/bin:${BENCH_HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin" \
		bash -c 'cd "$1" && bench --site "$2" clear-cache' _ "$1" "$2" >/dev/null
	echo "cache cleared: $2"
done
