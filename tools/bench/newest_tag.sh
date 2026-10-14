#!/usr/bin/env bash
# Check this theme against the newest Frappe v16 tag without touching the supported range
# (ADR 0001 D1, round 3 item 3). Everything is built outside the repository:
#
#   tools/bench/newest_tag.sh [stage...]       stages: tag clone bench theme site audit selectors   (default: all)
#
#   tag        highest v16.x.y tag of github.com/frappe/frappe (and of erpnext), by semver
#   clone      shallow clone of that tag into $NEWEST_DIR/frappe-src (default /tmp/frappe-newest)
#   bench      a throw-away bench (default /home/frappe/newest-bench) on that clone, plus the newest
#              ERPNext v16 tag, so the compiled desk CSS (LTR and RTL) can be read; no site is created
#   theme      get-app of this theme from GitHub (APP_BRANCH, default build/midad-v1) into the newest bench and build it
#   site       a fresh Frappe-only site on that bench: install, HTTP checks, screenshots, uninstall, residue diff
#   audit      the dead-token audit on 16.32.0 (committed snapshot and the midad.test bench's live CSS)
#              and on the newest tag's compiled CSS, written to the evidence folder
#   selectors  tools/bench/manifest_selectors.py: every file:line and selector of
#              docs/DEPENDENCY_MANIFEST.md checked against the clone
#
# Output: $EVIDENCE_DIR (default docs/team/evidence/round3/newest-tag). The committed snapshot
# (institutional_theme/audits/data) is never rewritten: audits run with --no-write.
# The bench stage runs as the bench user under /tmp/ins-bench.lock and unsets UV_CACHE_DIR
# (the runner's cache is not readable by that user). Needs passwordless sudo when not root.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env.sh
source "${HERE}/env.sh"

NEWEST_DIR="${NEWEST_DIR:-/tmp/frappe-newest}"
NEWEST_BENCH="${NEWEST_BENCH:-/home/frappe/newest-bench}"
EVIDENCE_DIR="${EVIDENCE_DIR:-${REPO_DIR}/docs/team/evidence/round3/newest-tag}"
OLD_FRAPPE="${OLD_FRAPPE:-${BENCH_REAL_DIR}/apps/frappe}"
OLD_BENCH="${OLD_BENCH:-${BENCH_REAL_DIR}}"
mkdir -p "${EVIDENCE_DIR}"
SUDO=""
[[ "$(id -u)" != "0" ]] && SUDO="sudo"

log() { printf '%s\n' "$*" | tee -a "${EVIDENCE_DIR}/run.log"; }

# Run a command and record "name<TAB>exit<TAB>seconds<TAB>command" in commands.tsv.
timed() {
	local name="$1" start end rc=0
	shift
	start=$(date +%s)
	"$@" || rc=$?
	end=$(date +%s)
	local shown="$*"
	shown="${shown//$'\t'/ }"
	shown="${shown//$'\n'/ }"
	printf '%s\t%s\t%s\t%s\n' "${name}" "${rc}" "$((end - start))" "${shown}" >>"${EVIDENCE_DIR}/commands.tsv"
	return "${rc}"
}

# As the bench user, under the lock, without the runner's uv cache.
as_frappe() {
	${SUDO} env "PATH=${PATH}" flock -o /tmp/ins-bench.lock runuser -u "${BENCH_USER}" -- env -u UV_CACHE_DIR \
		-u SUDO_USER -u SUDO_UID -u SUDO_GID -u SUDO_COMMAND HOME="${BENCH_HOME}" USER="${BENCH_USER}" \
		PATH="${NODE_HOME}/bin:${BENCH_HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin" "$@"
}

highest_tag() { # repo url
	git ls-remote --tags "$1" 'v16.*' | sed 's#.*refs/tags/##' | grep -v '\^{}' |
		grep -E '^v16\.[0-9]+\.[0-9]+$' | sort -V | tail -1
}

stage_tag() {
	# NEWEST_TAG pins a tag (for example to repeat an earlier run); otherwise the highest v16.x.y is used.
	FRAPPE_NEWEST="${NEWEST_TAG:-$(highest_tag https://github.com/frappe/frappe)}"
	ERPNEXT_NEWEST="$(highest_tag https://github.com/frappe/erpnext)"
	printf 'FRAPPE_NEWEST=%s\nERPNEXT_NEWEST=%s\n' "${FRAPPE_NEWEST}" "${ERPNEXT_NEWEST}" >"${EVIDENCE_DIR}/tags.env"
	log "newest frappe v16 tag: ${FRAPPE_NEWEST}; newest erpnext v16 tag: ${ERPNEXT_NEWEST}"
}

load_tags() {
	[[ -f "${EVIDENCE_DIR}/tags.env" ]] || stage_tag
	# shellcheck disable=SC1091
	source "${EVIDENCE_DIR}/tags.env"
}

stage_clone() {
	load_tags
	local src="${NEWEST_DIR}/frappe-src"
	if [[ -d "${src}/.git" && "$(git -C "${src}" describe --tags --exact-match 2>/dev/null)" == "${FRAPPE_NEWEST}" ]]; then
		log "clone exists at ${FRAPPE_NEWEST}"
	else
		rm -rf "${src}"
		mkdir -p "${NEWEST_DIR}"
		timed clone git clone --quiet --depth 1 --branch "${FRAPPE_NEWEST}" https://github.com/frappe/frappe "${src}"
	fi
	chmod -R a+rX "${NEWEST_DIR}"
	log "clone commit: $(git -C "${src}" rev-parse HEAD) ($(git -C "${src}" describe --tags --exact-match))"
	git -C "${src}" rev-parse HEAD >"${EVIDENCE_DIR}/frappe-newest.commit"
}

stage_bench() {
	load_tags
	local src="${NEWEST_DIR}/frappe-src"
	if [[ -f "${NEWEST_BENCH}/sites/assets/assets.json" ]]; then
		log "newest bench exists at ${NEWEST_BENCH}"
	else
		as_frappe rm -rf "${NEWEST_BENCH}"
		timed bench-init as_frappe bash -c "cd '$(dirname "${NEWEST_BENCH}")' && bench init '$(basename "${NEWEST_BENCH}")' \
			--frappe-path '${src}' --frappe-branch '${FRAPPE_NEWEST}' --python '${BENCH_PYTHON}' \
			--no-backups --skip-redis-config-generation" >"${EVIDENCE_DIR}/bench-init.log" 2>&1
	fi
	if [[ ! -d "${NEWEST_BENCH}/apps/erpnext" ]]; then
		timed get-app-erpnext as_frappe bash -c "cd '${NEWEST_BENCH}' && bench get-app erpnext \
			https://github.com/frappe/erpnext --branch '${ERPNEXT_NEWEST}' --skip-assets" \
			>"${EVIDENCE_DIR}/get-app-erpnext.log" 2>&1
		timed build-erpnext as_frappe bash -c "cd '${NEWEST_BENCH}' && bench build --app erpnext" \
			>"${EVIDENCE_DIR}/build-erpnext.log" 2>&1
	fi
	log "newest bench: frappe $(git -C "${NEWEST_BENCH}/apps/frappe" describe --tags), erpnext $(git -C "${NEWEST_BENCH}/apps/erpnext" describe --tags)"
	ls "${NEWEST_BENCH}/sites/assets/frappe/dist/css" "${NEWEST_BENCH}/sites/assets/frappe/dist/css-rtl" >"${EVIDENCE_DIR}/newest-css-files.txt"
}

# The theme itself on the newest bench: get-app (which also builds the app's bundles) from the branch
# under test and build again. Proves the SCSS and JS still compile against the newest core; no site.
stage_theme() {
	local url="${APP_URL:-https://github.com/Hamza-ALsaqaf/institutional_theme}" branch="${APP_BRANCH:-build/midad-v1}"
	as_frappe rm -rf "${NEWEST_BENCH}/apps/institutional_theme"
	timed get-app-theme as_frappe bash -c "cd '${NEWEST_BENCH}' && bench get-app ${url} --branch ${branch}" \
		>"${EVIDENCE_DIR}/get-app-theme.log" 2>&1
	timed build-theme as_frappe bash -c "cd '${NEWEST_BENCH}' && bench build --app institutional_theme" \
		>"${EVIDENCE_DIR}/build-theme.log" 2>&1
	git -C "${NEWEST_BENCH}/apps/institutional_theme" log --oneline -1 >"${EVIDENCE_DIR}/theme-commit.txt"
	log "theme built on frappe $(git -C "${NEWEST_BENCH}/apps/frappe" describe --tags): $(cat "${EVIDENCE_DIR}/theme-commit.txt")"
}

# Install, check and uninstall the theme on a fresh Frappe-only site of the newest bench: the same steps and checks as
# tools/bench/fresh_install.sh (README commands, HTTP checks, screenshots, table-by-table residue diff), web on 8011.
stage_site() {
	local dir="${EVIDENCE_DIR}/site" rc=0
	rm -rf "${dir}"
	mkdir -p "${dir}"
	printf 'step\texit\tseconds\tcommand\n' >"${dir}/commands.tsv"
	FRESH_BENCH="${NEWEST_BENCH}" FRESH_PORT=8011 FRESH_REDIS_CACHE=13002 FRESH_REDIS_QUEUE=11002 \
		SITE_FRAPPE=newest.test EVIDENCE_DIR="${dir}" "${HERE}/fresh_install.sh" site-frappe >"${dir}/run.log" 2>&1 || rc=$?
	log "site install and uninstall on the newest tag: exit ${rc} (${dir}/run.log)"
	return 0
}

# Compiled stylesheets of a bench, one path per line: frappe and erpnext, LTR and RTL, no source maps.
css_files() { # bench-dir
	local d="$1" f
	for f in "${d}"/sites/assets/frappe/dist/css/*.css "${d}"/sites/assets/frappe/dist/css-rtl/*.css \
		"${d}"/sites/assets/erpnext/dist/css/*.css "${d}"/sites/assets/erpnext/dist/css-rtl/*.css; do
		[[ -f "${f}" ]] && printf '%s\n' "${f}"
	done
	return 0
}

run_audit() { # label, then audit args
	local label="$1" rc=0
	shift
	# --no-write: never touch docs/audits or the committed snapshot; --dist is a missing folder so
	# the budgets audit (not part of this check) is skipped.
	(cd "${REPO_DIR}" && python3 -m institutional_theme.audits --no-write --dist /nonexistent-dist "$@") \
		>"${EVIDENCE_DIR}/audit-${label}.txt" 2>&1 || rc=$?
	printf 'audit-%s\t%s\n' "${label}" "${rc}" >>"${EVIDENCE_DIR}/audit-exit-codes.tsv"
	log "audit ${label}: exit ${rc}: $(grep '^dead-tokens' "${EVIDENCE_DIR}/audit-${label}.txt")"
}

stage_audit() {
	load_tags
	: >"${EVIDENCE_DIR}/audit-exit-codes.tsv"
	# a. 16.32.0, committed snapshot (what CI runs).
	run_audit snapshot
	# b. 16.32.0, live CSS of the midad.test bench (frappe and erpnext, LTR and RTL).
	css_files "${OLD_BENCH}" >"${EVIDENCE_DIR}/css-scanned-1632.txt"
	run_audit 1632-live $(sed 's/^/--core-css /' "${EVIDENCE_DIR}/css-scanned-1632.txt")
	# c. newest tag, live CSS of the newest bench (frappe and erpnext, LTR and RTL).
	css_files "${NEWEST_BENCH}" >"${EVIDENCE_DIR}/css-scanned-newest.txt"
	run_audit newest $(sed 's/^/--core-css /' "${EVIDENCE_DIR}/css-scanned-newest.txt")
	python3 -I "${HERE}/dead_token_diff.py" "${REPO_DIR}" "${EVIDENCE_DIR}/css-scanned-1632.txt" \
		"${EVIDENCE_DIR}/css-scanned-newest.txt" >"${EVIDENCE_DIR}/dead-token-diff.txt"
	log "wrote dead-token-diff.txt"
}

stage_selectors() {
	load_tags
	local rc=0
	python3 -I "${HERE}/manifest_selectors.py" --manifest "${REPO_DIR}/docs/DEPENDENCY_MANIFEST.md" \
		--old "${OLD_FRAPPE}" --new "${NEWEST_DIR}/frappe-src" \
		--old-node "${OLD_FRAPPE}/node_modules" --new-node "${NEWEST_BENCH}/apps/frappe/node_modules" \
		--old-label "16.32.0" --new-label "${FRAPPE_NEWEST#v}" \
		--tokens-tsv "${EVIDENCE_DIR}/manifest-names.tsv" --tsv "${EVIDENCE_DIR}/manifest-selectors.tsv" --md "${EVIDENCE_DIR}/manifest-selectors.md" || rc=$?
	printf 'manifest_selectors\t%s\n' "${rc}" >>"${EVIDENCE_DIR}/audit-exit-codes.tsv"
	log "selectors: exit ${rc}"
}

stages=("$@")
if [[ ${#stages[@]} -eq 0 ]]; then
	stages=(tag clone bench theme site audit selectors)
	# A full run starts from nothing: fresh clone, fresh bench, fresh records.
	rm -rf "${NEWEST_DIR}" "${EVIDENCE_DIR}/tags.env"
	as_frappe rm -rf "${NEWEST_BENCH}"
	printf 'step\texit\tseconds\tcommand\n' >"${EVIDENCE_DIR}/commands.tsv"
	: >"${EVIDENCE_DIR}/run.log"
fi
for s in "${stages[@]}"; do
	log "STAGE ${s} START $(date -u +%FT%TZ)"
	timed "stage-${s}" "stage_${s}"
	log "STAGE ${s} END $(date -u +%FT%TZ)"
done
