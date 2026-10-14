#!/usr/bin/env bash
# One bench command for the newest-tag site (midad52.test, Frappe v16.52.0), as the bench user, under the shared lock.
#   tools/bench/b52.sh list-apps
#   tools/bench/b52.sh migrate
#   tools/bench/b52.sh run-tests --app institutional_theme
# Same as tools/bench/b.sh with the environment of env52.sh; it never touches midad.test.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env52.sh
source "${HERE}/env52.sh"
INS_NO_SYNC=1 "${HERE}/b.sh" "$@"
# A build writes new hashed file names into the dist folder that midad.test shares: repoint its assets.json.
if [[ "${1:-}" == "build" ]]; then
	"${HERE}/sync_assets.sh"
fi
