#!/usr/bin/env bash
# The settings test module, test_identity_caches and test_cache_race once per version (unloaded), then the core
# settings values of the site. Usage: run.sh <label> <b.sh|b52.sh> <bench dir> <site>
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../.." && pwd)"
E="${ROOT}/docs/team/evidence/round6/test-isolation"
L="$1"; B="$2"; D="$3"; S="$4"
for m in institutional_theme.institutional_theme.doctype.institutional_theme_settings.test_institutional_theme_settings institutional_theme.tests.test_identity_caches institutional_theme.tests.test_cache_race; do
	echo "== ${m} $(date -u +%FT%TZ) commit $(git -C "${ROOT}" rev-parse --short HEAD) (+ uncommitted test edit if any)"
	"${ROOT}/tools/bench/${B}" run-tests --app institutional_theme --module "${m}" 2>&1 | grep -E "^Ran |^OK|^FAILED|✖"
	echo "exit ${PIPESTATUS[0]}"
done > "${E}/run-${L}.log"
echo "== core settings values after the run" >> "${E}/run-${L}.log"
sudo -u frappe flock -o /tmp/ins-bench.lock "${ROOT}/docs/team/evidence/round6/test-isolation/qall.sh" "${D}" "${S}" >> "${E}/run-${L}.log" 2>&1
