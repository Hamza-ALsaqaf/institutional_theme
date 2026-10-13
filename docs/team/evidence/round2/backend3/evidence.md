# Round 2 wave 3, backend3: light-only generated partials

Files: `midad/emit.py` (`emit_light_family`), `midad/build.py` (`render_tokens_light`, `render_frappe_map_light`, registered in `render_all`, so `--check` covers them), `midad/tests/test_emit.py` (class `LightOnlyPartials`, 5 tests), generated `_tokens_light.scss` (8512 B) and `_frappe_map_light.scss` (15507 B). Existing generated files unchanged (git shows no diff on them). `audits/parity.py` unchanged: it already globs `*.scss`, so the new files get the header and forbidden-syntax checks (parity 51 to 55 checks, 0 failed; docs/audits/parity.txt regenerated).

Commands (VERIFIED, run on this checkout):
- `python -m institutional_theme.midad.build`: 12 files, 2 written.
- `... build --check`: 12 file(s) checked, 0 stale.
- midad unit tests: 130 tests OK. Audits unit tests: 34 OK.
- `python -m institutional_theme.audits`: parity 55 checks, 0 failed; contrast 0 failing; dead-tokens 0 dead; budgets FAIL only on ins_web.bundle.css (175392 B raw), pending print-web-engineer switching the imports.
- ruff check and format --check: clean.
