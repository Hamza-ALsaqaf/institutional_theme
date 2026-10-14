Generated from: `docs/DEPENDENCY_MANIFEST.md` (rows, the 16.32.0 and 16.52.0 cells and the Status column), and the tool outputs `manifest-check-16.32.0.tsv`, `manifest-check-16.52.0.tsv`, `manifest-2k-16.32.0.tsv`, `manifest-2k-16.52.0.tsv` in this folder. Counted by a scratch script (not committed); commands below.

Rows in the manifest's checked tables: 225 (sections 1, 2a to 2k, 4 and 6). Of these, 34 are round-4 rows added in section 2k. Section 3, 5 and 7 are not Frappe citation tables and have no row here.

| Status (per version) | 16.32.0 (cell label) | 16.52.0 (cell label) |
|---|---|---|
| VERIFIED | 1 | 2 |
| COMPUTED | 167 | 122 |
| UNVERIFIED | 41 | 78 |
| UNVERIFIED (HRMS not in check) | 3 | 0 |
| absent | 7 | 11 |
| not checked | 0 | 10 |
| not a Frappe citation | 0 | 2 |
| not cited | 6 | 0 |

Status column, as given in round 3 (16.32.0 basis, not changed): VERIFIED 170, COMPUTED 34, UNVERIFIED 17, ASSUMED 3, NOT 1

Tool verdicts (`manifest_selectors.py`, Frappe 16.32.0 self-check on the 191 rows without section 2k, and 16.32.0 against 16.52.0 on the same rows):

| Run | Rows | present | moved | changed | missing | unchecked | exit |
|---|---|---|---|---|---|---|---|
| 16.32.0 against 16.32.0 (no 2k) | 191 | 159 | 17 | 0 | 0 | 15 | 0 |
| 16.32.0 against 16.52.0 (no 2k) | 191 | 41 | 68 | 56 | 11 | 15 | 1 |
| section 2k, 16.32.0 side | 34 | 20 | 5 | 0 | 0 | 9 | 0 |
| section 2k, 16.52.0 side | 34 | 31 | 1 | 0 | 0 | 2 | 0 |

Commands (run from the repository root, `python3 -I`):

    python3 -I tools/bench/manifest_selectors.py --manifest <manifest without section 2k> --old /tmp/src/frappe-16.32.0 --new /tmp/src/frappe-16.32.0 --old-node /home/frappe/frappe-bench/apps/frappe/node_modules --new-node /home/frappe/frappe-bench/apps/frappe/node_modules --old-label 16.32.0 --new-label 16.32.0 --tsv manifest-check-16.32.0.tsv --md manifest-check-16.32.0.md --tokens-tsv manifest-check-16.32.0-tokens.tsv
    python3 -I tools/bench/manifest_selectors.py --manifest <manifest without section 2k> --old /tmp/src/frappe-16.32.0 --new /tmp/src/frappe-16.52.0 --old-node /home/frappe/frappe-bench/apps/frappe/node_modules --new-node /home/newest-bench/apps/frappe/node_modules --old-label 16.32.0 --new-label 16.52.0 --tsv manifest-check-16.52.0.tsv --md manifest-check-16.52.0.md --tokens-tsv manifest-check-16.52.0-tokens.tsv
    (section 2k: the same tool on a copy of the 2k table, with its 16.52.0 column moved into the source position, `--old` and `--new` both `/tmp/src/frappe-16.52.0`, and on its 16.32.0 column; outputs `manifest-2k-16.32.0.*` and `manifest-2k-16.52.0.*`)

Notes on the tool (read from `tools/bench/manifest_selectors.py`): a name is `present` when it is in the cited file, not on the cited lines, so the line check is a text comparison of the cited lines and the name check is file-level. A `changed` citation is located by its longest line only and is labelled UNVERIFIED here. The tool does not read HRMS, ERPNext or repo files (`institutional_theme/...`), so those rows are labelled by hand.

