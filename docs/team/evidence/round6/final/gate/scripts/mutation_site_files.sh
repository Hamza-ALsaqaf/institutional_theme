#!/usr/bin/env bash
# Shows that the strengthened test_site_files test fails when the save path writes the file before the commit.
# Temporarily edits institutional_theme/site_files.py (on_settings_update calls ensure(doc) at save time), runs the
# module on 16.32.0, restores the file with `git checkout`, and prints `git diff --stat` of it (must be empty).
#   mutation_site_files.sh <log-dir>
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HERE}/../../../../../../.." && pwd)"
OUT="$(realpath -m "$1")"; mkdir -p "${OUT}"
F="${ROOT}/institutional_theme/site_files.py"
cd "${ROOT}" || exit 1
python3 - "$F" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
old = "\tclear_memo()\n\tfrappe.db.after_commit.add(lambda: _regenerate(doc))\n"
assert s.count(old) == 1
open(p, "w").write(s.replace(old, "\tclear_memo()\n\tensure(doc)  # MUTATION: writes at save time\n\tfrappe.db.after_commit.add(lambda: _regenerate(doc))\n"))
PY
git diff -U1 -- institutional_theme/site_files.py > "${OUT}/mutation.diff"
"${HERE}/lg.sh" "${OUT}/test-site-files-MUTATED.log" tools/bench/b.sh run-tests --app institutional_theme --module institutional_theme.tests.test_site_files
git checkout -- institutional_theme/site_files.py
git diff --stat -- institutional_theme/site_files.py > "${OUT}/restored.diff-stat"
echo "site_files.py diff after restore: $(wc -c < "${OUT}/restored.diff-stat") bytes"
