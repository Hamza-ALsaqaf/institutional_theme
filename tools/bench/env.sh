#!/usr/bin/env bash
# Shared settings for the test-bench scripts. Sourced, not executed.
# Every value can be overridden from the environment.

# BENCH_DIR is the path used everywhere. It is a symlink to the real bench inside the bench
# user's home, because bench init must create its own directory and /home/user belongs to root.
export BENCH_DIR="${BENCH_DIR:-/home/user/frappe-bench}"
export BENCH_REAL_DIR="${BENCH_REAL_DIR:-/home/frappe/frappe-bench}"
# The repository is the parent of tools/bench, wherever it is checked out (cloud container or CI runner).
_ENV_HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export REPO_DIR="${REPO_DIR:-$(cd "${_ENV_HERE}/../.." && pwd)}"
export SITE="${SITE:-midad.test}"

# Pinned versions (docs/research/frappe-16.32-findings.md, CLAUDE.md).
export FRAPPE_TAG="${FRAPPE_TAG:-v16.32.0}"
export ERPNEXT_TAG="${ERPNEXT_TAG:-v16.33.0}"
# Frappe requires Python >=3.14,<3.15. SYSTEM_PYTHON_SRC is the uv-managed interpreter that is
# copied to BENCH_PYTHON_HOME so the unprivileged bench user can use it (/root is not readable).
# Default: the root container's uv install; otherwise whatever `uv python find 3.14` reports (CI runner).
if [[ -z "${SYSTEM_PYTHON_SRC:-}" ]]; then
	SYSTEM_PYTHON_SRC="/root/.local/share/uv/python/cpython-3.14-linux-x86_64-gnu"
	if [[ ! -x "${SYSTEM_PYTHON_SRC}/bin/python3.14" ]] && command -v uv >/dev/null 2>&1; then
		_found="$(uv python find 3.14 2>/dev/null || true)"
		[[ -n "${_found}" ]] && SYSTEM_PYTHON_SRC="$(dirname "$(dirname "$(readlink -f "${_found}")")")"
	fi
fi
export SYSTEM_PYTHON_SRC
export BENCH_PYTHON_HOME="${BENCH_PYTHON_HOME:-/opt/python3.14}"
export BENCH_PYTHON="${BENCH_PYTHON_HOME}/bin/python3.14"
# bench refuses to run as root, so everything bench-related runs as this unprivileged user.
export BENCH_USER="${BENCH_USER:-frappe}"
export BENCH_HOME="/home/${BENCH_USER}"
# Frappe 16.32.0 declares "engines": {"node": ">=24"} (package.json); the image has Node 22 only,
# so Node 24 is unpacked here and put first on the bench user's PATH.
export NODE_VERSION="${NODE_VERSION:-24.21.0}"
# Default /opt/node24 (downloaded by step_user); when the caller already has Node 24 on PATH, use that.
if [[ -z "${NODE_HOME:-}" ]]; then
	NODE_HOME="/opt/node24"
	if [[ ! -x "${NODE_HOME}/bin/node" ]] && command -v node >/dev/null 2>&1 \
		&& [[ "$(node --version 2>/dev/null)" == v24.* ]]; then
		NODE_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v node)")")")"
	fi
fi
export NODE_HOME
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
# Playwright for the gate captures: a node_modules folder holding playwright or playwright-core, and the
# Python interpreter (with Pillow and numpy) for pixel_diff.py. Defaults are the root container's.
export PW_NODE_PATH="${PW_NODE_PATH:-/opt/node22/lib/node_modules}"
export PW_BROWSERS_PATH="${PW_BROWSERS_PATH:-/opt/pw-browsers}"
export PIXDIFF_PYTHON="${PIXDIFF_PYTHON:-python3}"
export PATH="/root/.local/bin:${PATH}"

# The sandbox proxy CA lives under /root, which the bench user cannot read. step_user copies
# it (a public certificate bundle) here and as_bench points every CA variable at the copy.
export CA_BUNDLE_COPY="${CA_BUNDLE_COPY:-/opt/proxy-ca-bundle.crt}"

# Run a command as the unprivileged bench user, keeping the proxy variables of the caller.
as_bench() {
	if [[ "$(id -u)" != "0" ]]; then
		"$@"
		return
	fi
	local -a remap=()
	local line name value
	while IFS= read -r line; do
		name="${line%%=*}"
		value="${line#*=}"
		if [[ "${value}" == /root/.ccr/* && -f "${CA_BUNDLE_COPY}" ]]; then
			remap+=("${name}=${CA_BUNDLE_COPY}")
		fi
	done < <(env)
	runuser -u "${BENCH_USER}" -p -- env -u PIP_CONFIG_FILE -u NPM_CONFIG_USERCONFIG -u RUSTUP_HOME \
		-u BUN_INSTALL -u XDG_CONFIG_HOME -u XDG_CACHE_HOME -u XDG_DATA_HOME -u XDG_STATE_HOME -u XDG_RUNTIME_DIR \
		-u UV_CACHE_DIR -u NVM_DIR -u PIPX_HOME -u PIPX_BIN_DIR -u GITHUB_ENV -u GITHUB_PATH HOME="${BENCH_HOME}" USER="${BENCH_USER}" \
		LOGNAME="${BENCH_USER}" PATH="${NODE_HOME}/bin:${BENCH_HOME}/.local/bin:/usr/local/bin:${PATH}" \
		"${remap[@]}" "$@"
}
