#!/usr/bin/env bash
# Log one command as the round-4 gate did: "$ cmd", the output, "exit N, S s" on the last line, and a tab-separated
# line "cmd, exit, seconds, UTC time" in <log>.cmds.
#   lg.sh <log-file> <command> [args...]
# The log is never overwritten: an existing name is an error (a repeat gets a new name, so every attempt is kept).
set -uo pipefail
LOG="$(realpath -m "$1")"; shift
[[ -e "${LOG}" ]] && { echo "log exists, refusing to overwrite: ${LOG}" >&2; exit 2; }
mkdir -p "$(dirname "${LOG}")"
start=$(date +%s)
{ echo "\$ $*"; "$@"; } >"${LOG}" 2>&1
rc=$?
secs=$(( $(date +%s) - start ))
echo "exit ${rc}, ${secs} s" >>"${LOG}"
printf '%s\t%s\t%s\t%s\n' "$*" "${rc}" "${secs}" "$(date -u +%FT%TZ)" >"${LOG}.cmds"
tail -n 1 "${LOG}"
exit ${rc}
