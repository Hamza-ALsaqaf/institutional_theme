#!/usr/bin/env bash
# A series of loaded runs (every one is kept; the loop never stops on a failure).
#   run_series.sh <label> <bench-script: b.sh|b52.sh> <base-url> <count>
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="$1"; BENCH="$2"; URL="$3"; COUNT="$4"
SERIES="${HERE}/logs/series-${LABEL}.log"
for n in $(seq 1 "${COUNT}"); do
	"${HERE}/loaded_run.sh" "${LABEL}" "${BENCH}" "${URL}" "${n}"
	echo "run ${n} exit $?" >> "${SERIES}"
done
echo "done" >> "${SERIES}"
