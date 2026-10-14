#!/usr/bin/env bash
# Round-6 bench rebuild chain (lead). Logs into docs/team/evidence/round6/bench.
cd /home/runner/work/institutional_theme/institutional_theme
EV=docs/team/evidence/round6/bench; mkdir -p $EV
PYSRC=$(dirname $(dirname $(readlink -f $(uv python find 3.14))))
run() { local n=$1; shift; local s=$(date +%s); echo "START $n $(date -u +%FT%TZ)" >>$EV/chain.log; "$@" >$EV/$n.log 2>&1; local rc=$?; echo "$n EXIT $rc $(( $(date +%s)-s ))s" >>$EV/chain.log; return $rc; }
run prereqs sudo env PATH="$PATH" tools/bench/ci_prereqs.sh
run build1632 sudo env PATH="$PATH" SYSTEM_PYTHON_SRC=$PYSRC flock -o /tmp/ins-bench.lock tools/bench/build_test_bench.sh || exit 1
run services1632 sudo env PATH="$PATH" flock -o /tmp/ins-bench.lock tools/bench/start_services.sh || exit 1
run hrms1632 sudo env PATH="$PATH" PW_NODE_PATH=/opt/pw-node/node_modules HRMS_EVIDENCE=$PWD/$EV/hrms1632 flock -o /tmp/ins-bench.lock tools/bench/hrms.sh get install build restart seed verify
run newest_tag sudo env PATH="$PATH" EVIDENCE_DIR=$PWD/$EV/newest-bench tools/bench/newest_tag.sh clone bench || exit 1
run newest_site sudo env PATH="$PATH" EVIDENCE_DIR=$PWD/$EV/newest-site tools/bench/newest_site.sh || exit 1
run hrms52 sudo env PATH="$PATH" PW_NODE_PATH=/opt/pw-node/node_modules HRMS_ENV=tools/bench/env52_hrms.sh HRMS_EVIDENCE=$PWD/$EV/hrms52 tools/bench/hrms.sh site erpnext wizard theme get install build web seed verify
echo "CHAIN DONE $(date -u +%FT%TZ)" >>$EV/chain.log
