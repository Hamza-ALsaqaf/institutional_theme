# Phase 2 scribe tables: evidence

Run command, from the repository root:

    python3 -I tools/docs/token_tables.py

Standard output (2 lines):

    ramp rows 142, semantic rows 127, frappe rows 376, contrast rows 181, preset rows 6, scale rows 50, not filled 31
    wrote docs/DESIGN_SYSTEM.md

Output line counts (VERIFIED, `wc -l`):

- standard output: 2 lines
- `docs/DESIGN_SYSTEM.md`: 1127 lines

Determinism (VERIFIED, run twice, `sha256sum docs/DESIGN_SYSTEM.md` after each run): both runs gave `2c2f616dbe8c313c5053d98160da771af85ccf1be4da525be91eee60715b4083`.

Lint (VERIFIED):

    uvx ruff format tools/docs/token_tables.py   # 1 file reformatted
    uvx ruff check tools/docs                    # All checks passed!
    uvx ruff format --check tools/docs           # 1 file already formatted, exit 0

Not filled (31 rows, listed at the end of the generated region): 28 ramp steps not emitted in `_tokens.scss`, 1 Frappe variable (`--font-stack`) whose `--ins-font-sans` source is not emitted, and 2 scale tokens (`--ins-font-sans`, `--ins-font-mono`) not declared in `_scale.scss`.

Not committed.
