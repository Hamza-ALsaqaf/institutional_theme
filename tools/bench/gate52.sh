#!/usr/bin/env bash
# The install and uninstall gate (gate_install_uninstall.sh) against the newest-tag site midad52.test on port 8001.
#   tools/bench/gate52.sh [evidence-dir]       default: docs/team/evidence/round4/newest-site/gate
# It re-runs itself as root under /tmp/ins-bench.lock (the gate's as_bench helper only drops to the bench user from
# root), then sources env52.sh so the gate talks to the newest bench. Leaves the app installed.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(id -u)" != "0" ]]; then
	exec sudo -E env "PATH=${PATH}" flock -o /tmp/ins-bench.lock "${BASH_SOURCE[0]}" "$@"
fi
# shellcheck source=env52.sh
source "${HERE}/env52.sh"
exec "${HERE}/gate_install_uninstall.sh" "${1:-${REPO_DIR}/docs/team/evidence/round4/newest-site/gate}"
