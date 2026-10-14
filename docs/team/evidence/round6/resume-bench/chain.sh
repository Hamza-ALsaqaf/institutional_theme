#!/usr/bin/env bash
# Round-6 resume: bench rebuild chain in the cloud container (lead). Same steps as round6/bench/chain6.sh,
# repository at /home/user/institutional_theme, running as root (no sudo needed). Logs into this folder.
cd /home/user/institutional_theme
EV=docs/team/evidence/round6/resume-bench; mkdir -p $EV
PYSRC=$(dirname $(dirname $(readlink -f $(uv python find 3.14))))
run() { local n=$1; shift; local s=$(date +%s); echo "START $n $(date -u +%FT%TZ)" >>$EV/chain.log; "$@" >$EV/$n.log 2>&1; local rc=$?; echo "$n EXIT $rc $(( $(date +%s)-s ))s" >>$EV/chain.log; return $rc; }
wk() (
	# wkhtmltopdf 0.12.6.1 with patched Qt, official jammy .deb, extracted (as in rounds 2 to 6).
	set -e; mkdir -p /tmp/wkdl && cd /tmp/wkdl
	curl -fsSL -o wk.deb https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-3/wkhtmltox_0.12.6.1-3.jammy_amd64.deb
	sha256sum wk.deb; dpkg-deb -x wk.deb x
	ln -sf /tmp/wkdl/x/usr/local/bin/wkhtmltopdf /usr/local/bin/wkhtmltopdf
	ln -sf /tmp/wkdl/x/usr/local/bin/wkhtmltoimage /usr/local/bin/wkhtmltoimage
	wkhtmltopdf -V
)
[[ -x /usr/local/bin/wkhtmltopdf ]] || run wkhtmltopdf wk
run prereqs env PATH="$PATH" tools/bench/ci_prereqs.sh
run build1632 env PATH="$PATH" SYSTEM_PYTHON_SRC=$PYSRC flock -o /tmp/ins-bench.lock tools/bench/build_test_bench.sh || exit 1
run services1632 env PATH="$PATH" flock -o /tmp/ins-bench.lock tools/bench/start_services.sh || exit 1
run hrms1632 env PATH="$PATH" PW_NODE_PATH=/opt/pw-node/node_modules HRMS_EVIDENCE=$PWD/$EV/hrms1632 flock -o /tmp/ins-bench.lock tools/bench/hrms.sh get install build restart seed verify
run newest_tag env PATH="$PATH" EVIDENCE_DIR=$PWD/$EV/newest-bench tools/bench/newest_tag.sh clone bench || exit 1
run newest_site env PATH="$PATH" EVIDENCE_DIR=$PWD/$EV/newest-site tools/bench/newest_site.sh || exit 1
run hrms52 env PATH="$PATH" PW_NODE_PATH=/opt/pw-node/node_modules HRMS_ENV=tools/bench/env52_hrms.sh HRMS_EVIDENCE=$PWD/$EV/hrms52 tools/bench/hrms.sh site erpnext wizard theme get install build web seed verify
echo "CHAIN DONE $(date -u +%FT%TZ)" >>$EV/chain.log
