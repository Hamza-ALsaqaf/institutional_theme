# Source before any script that runs bench commands as the frappe user and keeps the caller's environment:
# the CA variables of this container point at /root/.ccr/ca-bundle.crt, which that user cannot read
# (symptom: "RuntimeError: Environment variable HTTPLIB2_CA_CERTS not a valid file" in setUpClass of the User-creating tests).
CA=/opt/proxy-ca-bundle.crt
for v in SSL_CERT_FILE CURL_CA_BUNDLE GIT_SSL_CAINFO REQUESTS_CA_BUNDLE PIP_CERT NODE_EXTRA_CA_CERTS NIX_SSL_CERT_FILE AWS_CA_BUNDLE HTTPLIB2_CA_CERTS GRPC_DEFAULT_SSL_ROOTS_FILE_PATH DENO_CERT HEX_CACERTS_PATH CLOUDSDK_CORE_CUSTOM_CA_CERTS_FILE; do export "$v=$CA"; done
unset JAVA_TOOL_OPTIONS
export UV_BIN=/usr/local/bin/uv
export PW_NODE_PATH=/opt/pw-node/node_modules PIXDIFF_PYTHON=/opt/pixvenv/bin/python PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
