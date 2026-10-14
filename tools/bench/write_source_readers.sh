#!/usr/bin/env bash
# Write the committed snapshots of the readers outside the compiled CSS (audits/source_readers.py) and the
# readers of the website pages (audits/web_scope.py), one each per supported Frappe version, from source trees
# and from the built bundles of the bench (the website pages' stylesheets and scripts).
#   tools/bench/write_source_readers.sh
# Trees (override the variables to point elsewhere): the Frappe tag, the ERPNext checkout of that bench, HRMS
# v16.20.1 and the libraries that style themselves. The standalone single-page apps are left out: the ERPNext
# banking app and the HRMS PWA ship their own stylesheet and declare their own variables, `ui` is shared Vue
# source for other apps, `cypress` and `playwright` are test code.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "${HERE}/../.." && pwd)"
FRAPPE_1632="${FRAPPE_1632:-/tmp/src/frappe-16.32.0}"
FRAPPE_1652="${FRAPPE_1652:-/tmp/src/frappe-16.52.0}"
BENCH_1632="${BENCH_1632:-/home/frappe/frappe-bench}"
BENCH_1652="${BENCH_1652:-/home/frappe/newest-bench}"
HRMS="${HRMS:-/tmp/r4src/hrms-16.20.1}"
cd "${REPO}"
for pair in "16.32.0 ${FRAPPE_1632} ${BENCH_1632}" "16.52.0 ${FRAPPE_1652} ${BENCH_1652}"; do
	set -- ${pair}
	version="$1"; frappe="$2"; bench="$3"
	python3 -m institutional_theme.audits.source_readers --version "${version}" --write \
		--tree "frappe=${frappe}" --exclude frappe=ui --exclude frappe=cypress --exclude frappe=playwright \
		--tree "erpnext=${bench}/apps/erpnext" --exclude erpnext=banking --exclude erpnext=erpnext/public/banking \
		--tree "hrms=${HRMS}" --exclude hrms=frontend --exclude hrms=frappe-ui \
		--tree "frappe-gantt=${bench}/apps/frappe/node_modules/frappe-gantt/src" \
		--tree "fullcalendar=${bench}/apps/frappe/node_modules/@fullcalendar/core/internal-common.js"
	python3 -m institutional_theme.audits.web_scope --version "${version}" --write --assets "${bench}/sites/assets" \
		--tree "frappe-templates=${frappe}/frappe/templates" --tree "frappe-www=${frappe}/frappe/www" \
		--tree "frappe-website=${frappe}/frappe/website" \
		--tree "erpnext-templates=${bench}/apps/erpnext/erpnext/templates" \
		--tree "erpnext-www=${bench}/apps/erpnext/erpnext/www" \
		--tree "hrms-www=${HRMS}/hrms/www" --tree "hrms-templates=${HRMS}/hrms/templates"
done
