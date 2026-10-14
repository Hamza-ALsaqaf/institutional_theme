#!/usr/bin/env bash
# The final loaded runs on the final code: five on 16.32.0, one on v16.52.0 (all kept).
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${HERE}/run_series.sh" 16.32.0-d b.sh http://midad.test:8000 5
"${HERE}/loaded_run.sh" v16.52.0-d b52.sh http://midad52.test:8001 1
echo "run v16.52.0-d-1 exit $?" >> "${HERE}/logs/series-v16.52.0-d.log"
