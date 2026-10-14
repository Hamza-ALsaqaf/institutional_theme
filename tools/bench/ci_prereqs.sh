#!/usr/bin/env bash
# Extra prerequisites for the gate captures on a machine that has no /opt/node22 Playwright and no
# system Pillow (the GitHub Actions runner). Installs playwright-core (browsers are already in
# /opt/pw-browsers; never run "playwright install") and a venv with Pillow and numpy.
# Safe to re-run. Afterwards export what it prints:
#   PW_NODE_PATH=/opt/pw-node/node_modules  PIXDIFF_PYTHON=/opt/pixvenv/bin/python
set -euo pipefail
PW_DIR="${PW_DIR:-/opt/pw-node}"
PIX_VENV="${PIX_VENV:-/opt/pixvenv}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PW_VERSION="$(sed -n 's/.*"playwright-core": "\([0-9.]*\)".*/\1/p' "${HERE}/../../tests/browser/package.json")"
if [[ ! -d "${PW_DIR}/node_modules/playwright-core" ]]; then
	mkdir -p "${PW_DIR}"
	(cd "${PW_DIR}" && npm install --no-audit --no-fund --prefix "${PW_DIR}" "playwright-core@${PW_VERSION:-1.56.1}")
fi
if [[ ! -x "${PIX_VENV}/bin/python" ]]; then
	uv venv --python 3.14 "${PIX_VENV}"
	uv pip install --python "${PIX_VENV}/bin/python" pillow numpy
fi
chmod -R a+rX "${PW_DIR}" "${PIX_VENV}"
echo "PW_NODE_PATH=${PW_DIR}/node_modules"
echo "PIXDIFF_PYTHON=${PIX_VENV}/bin/python"
