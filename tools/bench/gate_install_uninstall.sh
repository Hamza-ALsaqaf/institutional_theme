#!/usr/bin/env bash
# Phase 0 gate: the app installs and uninstalls cleanly and the stock look is unchanged.
#
#   tools/bench/gate_install_uninstall.sh [evidence-dir]
#
# Sequence (each command is timed and its exit code recorded in gate-commands.tsv):
#   1. capture "before"           assets + screenshots with the app not installed
#   2. bench install-app          -> install.log,   capture "installed"
#   3. bench uninstall-app        -> uninstall.log, capture "after-uninstall"
#   4. diff the three asset lists and pixel-diff the screenshots
#   5. bench install-app again    so the app is left INSTALLED (also proves reinstall works)
# Needs the services from start_services.sh. Run as root; bench commands drop to the bench user.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env.sh
source "${HERE}/env.sh"

EVIDENCE="${1:-${REPO_DIR}/docs/team/evidence/phase0}"
BASE_URL="http://${SITE}:${WEB_PORT}"
APP=institutional_theme
TSV="${EVIDENCE}/gate-commands.tsv"
mkdir -p "${EVIDENCE}"
printf 'label\tcommand\texit_code\tseconds\n' >"${TSV}"

# timed LABEL LOGFILE COMMAND... : run, tee to LOGFILE, record exit code and duration.
timed() {
	local label="$1" log="$2"
	shift 2
	local start end code
	start=$(date +%s.%N)
	{
		echo "\$ $*"
		"$@"
	} >"${log}" 2>&1
	code=$?
	end=$(date +%s.%N)
	printf '%s\t%s\t%s\t%.1f\n' "${label}" "$*" "${code}" "$(echo "${end} - ${start}" | bc)" >>"${TSV}"
	echo "[${label}] exit=${code}"
	return 0
}

capture() {
	timed "capture-$1" "${EVIDENCE}/capture-$1.log" \
		env NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
		node "${HERE}/capture.mjs" "$1" "${EVIDENCE}" "${BASE_URL}"
}

bench_site() { as_bench bash -c 'cd "$1" && shift && bench "$@"' _ "${BENCH_DIR}" "$@"; }

# The "before" state needs the app absent. Uninstall it first when a previous run left it installed.
if bench_site --site "${SITE}" list-apps 2>/dev/null | grep -q "^${APP}"; then
	timed preclean-uninstall "${EVIDENCE}/preclean-uninstall.log" \
		bench_site --site "${SITE}" uninstall-app "${APP}" --yes --no-backup
fi
timed list-apps-before "${EVIDENCE}/list-apps-before.log" bench_site --site "${SITE}" list-apps

capture before

doctype_exists() { bench_site --site "${SITE}" execute frappe.db.exists --args "['DocType', 'Institutional Theme Settings']"; }

timed install "${EVIDENCE}/install.log" bench_site --site "${SITE}" install-app "${APP}"
timed doctype-after-install "${EVIDENCE}/doctype-after-install.log" doctype_exists
capture installed

timed uninstall "${EVIDENCE}/uninstall.log" bench_site --site "${SITE}" uninstall-app "${APP}" --yes --no-backup
timed doctype-after-uninstall "${EVIDENCE}/doctype-after-uninstall.log" doctype_exists
capture after-uninstall

# The first line of each list is its own label, so it is excluded from the comparison.
{
	for pair in "before installed" "before after-uninstall" "installed after-uninstall"; do
		set -- ${pair}
		echo "### diff assets-$1.txt assets-$2.txt"
		diff -u <(tail -n +2 "${EVIDENCE}/assets-$1.txt") <(tail -n +2 "${EVIDENCE}/assets-$2.txt") && echo "(identical)"
		echo
	done
} >"${EVIDENCE}/assets-diff.txt" 2>&1

: >"${EVIDENCE}/pixel-diff.txt"
for shot in login todo; do
	for pair in "before installed" "before after-uninstall"; do
		set -- ${pair}
		python3 "${HERE}/pixel_diff.py" "${EVIDENCE}/$1-${shot}.png" "${EVIDENCE}/$2-${shot}.png" \
			--out "${EVIDENCE}/diff-$1-vs-$2-${shot}.png" >>"${EVIDENCE}/pixel-diff.txt"
	done
done
cat "${EVIDENCE}/pixel-diff.txt"

# Leave the app installed for the later phases.
timed reinstall "${EVIDENCE}/reinstall.log" bench_site --site "${SITE}" install-app "${APP}"
timed list-apps "${EVIDENCE}/list-apps-final.log" bench_site --site "${SITE}" list-apps
cat "${TSV}"
