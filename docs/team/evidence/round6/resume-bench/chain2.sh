#!/usr/bin/env bash
# Round-6 resume, second part of the bench chain. newest_tag.sh, newest_site.sh and hrms.sh run bench commands as the
# frappe user with the caller's environment; in this container the CA variables point at /root/.ccr/ca-bundle.crt,
# which that user cannot read (attempt 1: "No CA certificates were loaded"). Point them at the readable copy that
# build_test_bench.sh made (/opt/proxy-ca-bundle.crt, a public certificate bundle).
cd /home/user/institutional_theme
EV=docs/team/evidence/round6/resume-bench
CA=/opt/proxy-ca-bundle.crt
for v in SSL_CERT_FILE CURL_CA_BUNDLE GIT_SSL_CAINFO REQUESTS_CA_BUNDLE PIP_CERT NODE_EXTRA_CA_CERTS NIX_SSL_CERT_FILE AWS_CA_BUNDLE HTTPLIB2_CA_CERTS GRPC_DEFAULT_SSL_ROOTS_FILE_PATH DENO_CERT HEX_CACERTS_PATH CLOUDSDK_CORE_CUSTOM_CA_CERTS_FILE; do export "$v=$CA"; done
unset JAVA_TOOL_OPTIONS
# newest_tag.sh and newest_site.sh run as frappe with a fixed PATH (node24, ~/.local/bin, /usr/local/bin, /usr/bin, /bin);
# yarn lives in /opt/node22/bin in this container (attempt 2: "No such file or directory: yarn").
ln -sf /opt/node22/bin/yarn /usr/local/bin/yarn
run() { local n=$1; shift; local s=$(date +%s); echo "START $n $(date -u +%FT%TZ)" >>$EV/chain.log; "$@" >$EV/$n.log 2>&1; local rc=$?; echo "$n EXIT $rc $(( $(date +%s)-s ))s" >>$EV/chain.log; return $rc; }
echo "RESTART chain2 attempt 3 (yarn linked) (CA variables -> $CA) $(date -u +%FT%TZ)" >>$EV/chain.log
run newest_tag env PATH="$PATH" EVIDENCE_DIR=$PWD/$EV/newest-bench tools/bench/newest_tag.sh clone bench || exit 1
run newest_site env PATH="$PATH" EVIDENCE_DIR=$PWD/$EV/newest-site tools/bench/newest_site.sh || exit 1
run hrms52 env PATH="$PATH" PW_NODE_PATH=/opt/pw-node/node_modules HRMS_ENV=tools/bench/env52_hrms.sh HRMS_EVIDENCE=$PWD/$EV/hrms52 tools/bench/hrms.sh site erpnext wizard theme get install build web seed verify
echo "CHAIN DONE $(date -u +%FT%TZ)" >>$EV/chain.log
