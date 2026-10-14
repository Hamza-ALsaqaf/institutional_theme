#!/usr/bin/env bash
# Settings of the newest-tag verification site (Frappe v16.52.0, ERPNext v16.50.0, site midad52.test).
# Sourced, not executed. It points the variables that env.sh, b.sh and gate_install_uninstall.sh already read
# at the newest bench, then sources env.sh, so every script of this folder can run against it:
#
#   source tools/bench/env52.sh && tools/bench/b.sh list-apps         (same as tools/bench/b52.sh list-apps)
#
# Never sourced by the 16.32.0 scripts: their defaults (midad.test, port 8000) are unchanged.
# Every value can be overridden from the environment (NEWEST_BENCH, NEWEST_SITE, NEWEST_PORT, ...).
_H52="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export NEWEST_BENCH="${NEWEST_BENCH:-/home/frappe/newest-bench}"
export NEWEST_SITE="${NEWEST_SITE:-midad52.test}"
# Ports in use elsewhere: 8000 and 13000/11000 (midad.test), 8010 and 13001/11001 (fresh_install.sh),
# 8011 and 13002/11002 (newest_tag.sh stage site). This site: 8001 and 13003/11003.
export NEWEST_PORT="${NEWEST_PORT:-8001}"
export NEWEST_REDIS_CACHE="${NEWEST_REDIS_CACHE:-13003}"
export NEWEST_REDIS_QUEUE="${NEWEST_REDIS_QUEUE:-11003}"
export BENCH_DIR="${NEWEST_BENCH}"
export BENCH_REAL_DIR="${NEWEST_BENCH}"
export SITE="${NEWEST_SITE}"
export WEB_PORT="${NEWEST_PORT}"
# The browser tools of the gate: the folders ci_prereqs.sh creates, when present.
[[ -z "${PW_NODE_PATH:-}" && -d /opt/pw-node/node_modules ]] && export PW_NODE_PATH=/opt/pw-node/node_modules
[[ -z "${PIXDIFF_PYTHON:-}" && -x /opt/pixvenv/bin/python ]] && export PIXDIFF_PYTHON=/opt/pixvenv/bin/python
# shellcheck source=env.sh
source "${_H52}/env.sh"
