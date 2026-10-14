#!/usr/bin/env bash
# usage: pyrun.sh script.py [args]  -- runs under the bench python as the bench user, under the lock
S="$1"; shift
sudo -E flock -o /tmp/ins-bench.lock runuser -u frappe -- bash -c "export PATH=/tmp/wk/x/usr/local/bin:\$PATH; cd /home/user/frappe-bench/sites && /home/user/frappe-bench/env/bin/python $S $*"
