#!/usr/bin/env bash
# Shared settings for the test-bench scripts. Sourced, not executed.
# Every value can be overridden from the environment.

export BENCH_DIR="${BENCH_DIR:-/home/user/frappe-bench}"
export REPO_DIR="${REPO_DIR:-/home/user/institutional_theme}"
export SITE="${SITE:-midad.test}"

# Pinned versions (docs/research/frappe-16.32-findings.md, CLAUDE.md).
export FRAPPE_TAG="${FRAPPE_TAG:-v16.32.0}"
export ERPNEXT_TAG="${ERPNEXT_TAG:-v16.33.0}"
# Frappe requires Python >=3.14,<3.15. SYSTEM_PYTHON_SRC is the uv-managed interpreter that is
# copied to BENCH_PYTHON_HOME so the unprivileged bench user can use it (/root is not readable).
export SYSTEM_PYTHON_SRC="${SYSTEM_PYTHON_SRC:-/root/.local/share/uv/python/cpython-3.14-linux-x86_64-gnu}"
export BENCH_PYTHON_HOME="${BENCH_PYTHON_HOME:-/opt/python3.14}"
export BENCH_PYTHON="${BENCH_PYTHON_HOME}/bin/python3.14"
# bench refuses to run as root, so everything bench-related runs as this unprivileged user.
export BENCH_USER="${BENCH_USER:-frappe}"
export BENCH_HOME="/home/${BENCH_USER}"
# Optional local clone of Frappe at FRAPPE_TAG; when it does not exist, GitHub is used.
export FRAPPE_SRC="${FRAPPE_SRC:-/home/user/src/frappe-16.32.0}"
# 1 = install ERPNext on the site, 0 = Frappe only.
export WITH_ERPNEXT="${WITH_ERPNEXT:-1}"

# PostgreSQL 16 cluster owned by the "postgres" OS user.
export PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
export PG_DATA="${PG_DATA:-/var/lib/postgresql/16/midad}"
export PG_PORT="${PG_PORT:-5432}"
# TEST ONLY credentials. Never reuse outside a disposable container.
export PG_ROOT_USER="postgres"
export PG_ROOT_PASSWORD="${PG_ROOT_PASSWORD:-postgres}"
# TEST ONLY: administrator password of the test site.
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"

export WEB_PORT="${WEB_PORT:-8000}"
export PATH="/root/.local/bin:${PATH}"

# Run a command as the unprivileged bench user, keeping the proxy and CA variables of the caller.
as_bench() {
	if [[ "$(id -u)" == "0" ]]; then
		runuser -u "${BENCH_USER}" -p -- env HOME="${BENCH_HOME}" USER="${BENCH_USER}" \
			LOGNAME="${BENCH_USER}" PATH="${BENCH_HOME}/.local/bin:/usr/local/bin:${PATH}" "$@"
	else
		"$@"
	fi
}
