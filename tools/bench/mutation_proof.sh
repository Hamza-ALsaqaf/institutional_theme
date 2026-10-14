#!/usr/bin/env bash
# Mutation proof: apply one regression to a scratch copy of the repository and run both unit suites; each case
# must report failing tests. Round 4 fix 1 (audit holes N3a to N3d, website scope F6).
#   tools/bench/mutation_proof.sh
# The scratch copy has no docs/ folder, so three tests that read it (test_manifest_selectors,
# test_the_brief_still_says_so, test_the_licence_record_matches_the_files) error in every case: subtract 3.
set -u
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRATCH="$(mktemp -d)"
trap 'rm -rf "${SCRATCH}"' EXIT
run() { # name file python-replace-old python-replace-new
  rm -rf "${SCRATCH}/repo"; mkdir -p "${SCRATCH}/repo"
  (cd $SRC && tar --exclude=.git --exclude=node_modules --exclude=__pycache__ --exclude=public/dist -cf - institutional_theme design tests pyproject.toml docs/audits 2>/dev/null) | tar -xf - -C "${SCRATCH}/repo"
  python3 - "${SCRATCH}/repo/$2" "$3" "$4" <<'PY'
import sys
p,old,new=sys.argv[1:4]
s=open(p).read()
assert old in s,("pattern not found",old)
open(p,"w").write(s.replace(old,new,1))
PY
  out=$(cd "${SCRATCH}/repo" && python3 -m unittest discover -s institutional_theme/audits/tests -t . 2>&1; python3 -m unittest discover -s institutional_theme/midad/tests -t . 2>&1)
  fails=$(echo "$out" | grep -c "^FAIL:\|^ERROR:")
  echo "MUTATION $1: $fails failing test(s)"; echo "$out" | grep "^FAIL:\|^ERROR:" | sed 's/ (.*//' | sort -u | head -6 | sed 's/^/    /'
}
run "scan_theme keeps comments (N3a)" institutional_theme/audits/dead_tokens.py 'used.update(_READ.findall(strip_comments(text, line_comments=path.suffix != ".css")))' 'used.update(_READ.findall(text))'
run "declared scan keeps comments (N3a)" institutional_theme/audits/dead_tokens.py 'text = strip_comments(path.read_text(encoding="utf-8", errors="replace"))' 'text = path.read_text(encoding="utf-8", errors="replace")'
run "unread check passes everything (N3b)" institutional_theme/audits/dead_tokens.py 'unread = unread_everywhere(combined)
	watched' 'return []
	unread = unread_everywhere(combined)
	watched'
run "unread check ignores source readers (N3b)" institutional_theme/audits/dead_tokens.py 'reads = core.read | source_reads' 'reads = core.read'
run "old merge order (N3c)" institutional_theme/audits/dead_tokens.py '_MERGE_ORDER = ("declared-read", "read-only", "theme", "declared-only", "dead")' '_MERGE_ORDER = ("declared-read", "declared-only", "read-only", "theme", "dead")'
run "effective diff ignores source readers (N3d)" institutional_theme/audits/effective_diff.py 'reads = core.read | source_reads' 'reads = core.read'
run "effective diff accepts anything (N3d)" institutional_theme/audits/effective_diff.py 'acceptable = {name: reason for name, reason in accepted.items() if name in source_reads - core.read}' 'acceptable = dict(accepted)'
run "web check ignores the marks (F6)" institutional_theme/audits/web_scope.py 'marked = model_mod.desk_only(model)' 'marked = []'
run "web map ignores the scope (F6)" institutional_theme/midad/model.py 'if scope == WEB and entry.get("scope") == SCOPE_DESK:' 'if False:'
