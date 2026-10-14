#!/usr/bin/env bash
# Settings for HRMS on the newest-tag bench (Frappe v16.52.0, ERPNext v16.50.0): sourced by tools/bench/hrms.sh through
#   HRMS_ENV=tools/bench/env52_hrms.sh
# It reuses env52.sh (bench /home/frappe/newest-bench) with a SEPARATE site and web server, so midad52.test, which other
# checks use, stays untouched:
#   site  hrms52.test    web server on port 8002 (`frappe --site hrms52.test serve`, pinned to the site)
# The web server of midad52.test (port 8001) is started with `--site midad52.test`, which makes Frappe ignore the Host
# header (frappe/app.py init_request: `_site or header or host`), so a second site needs its own server and port.
#
# HRMS tag: the newest v16 tag is v16.50.0 (tags: ..., v16.49.0, v16.50.0). Its pyproject.toml declares
#   [tool.bench.frappe-dependencies]  frappe = ">=16.50.0,<17.0.0"   erpnext = ">=16.0.0,<17.0.0"
# and hooks.py `required_apps = ["frappe/erpnext"]`: Frappe v16.52.0 and ERPNext v16.50.0 satisfy both.
# Sourced, not executed. Every value can be overridden from the environment.
_H52H="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export NEWEST_SITE="${HRMS52_SITE:-hrms52.test}"
export NEWEST_PORT="${HRMS52_PORT:-8002}"
export HRMS_TAG="${HRMS_TAG:-v16.50.0}"
export HRMS_LOCK=1
export HRMS_EVIDENCE="${HRMS_EVIDENCE:-$(cd "${_H52H}/../.." && pwd)/docs/team/evidence/round5/hrms52}"
# shellcheck source=env52.sh
source "${_H52H}/env52.sh"
