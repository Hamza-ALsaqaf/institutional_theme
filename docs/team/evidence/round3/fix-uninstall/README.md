# Uninstall residue and ownership of File copies (round 3 fix F1)

Findings of `docs/team/reviews/upgrade-round3.md`: should-fix 1 (Website Settings copies stay after uninstall), should-fix 2 (an administrator's own file with the emblem's bytes could be deleted), should-fix 3 (README overclaim), and the second half of blocking 2 (`manifest_selectors.py` and sections 2i and 2j). Run 2026-10-14 on the GitHub runner, PostgreSQL 16, Frappe 16.32.0.

## What changed

| File | Change |
|---|---|
| `institutional_theme/institutional_theme/doctype/institutional_theme_settings/identity_sync.py` | New global `ins_identity_files`. `apply()` records, for every identity value it writes, the target, the value, the time of the write and, for Navbar Settings, the names of the File rows that the write's own `save()` created. `delete_attachments()` deletes the files attached to the settings doctype and the rows it owns (below), and forgets the record. The hash-based deletion is gone. |
| `.../test_institutional_theme_settings.py` | `_image()` helper, 4 new tests, 1 rewritten, `_reset` and `tearDownClass` clean up the copies (the module left rows on the bench before). |
| `tools/bench/gate_state.py` | `seed` saves Website Settings and attaches an administrator's file with the emblem's bytes (`GATE_ADMIN_TARGET`); `residue` reports stray File rows on Navbar/Website Settings, stray `gate-emblem*` files and the loss of the administrator's file. |
| `tools/bench/uninstall_residue.sh` (new) | The sequence below on a throw-away site, with an optional negative control. |
| `tools/bench/manifest_selectors.py`, `institutional_theme/audits/tests/test_manifest_selectors.py` | See "Blocking 2". |
| `README.md` ("Uninstall"), `tools/bench/README.md` | What uninstall removes and keeps; the new script. |

## Design: why ownership is recorded, not derived from the hash

- **Facts read in 16.32.0 (VERIFIED):** core's `doc_events["*"]["on_update"]` runs `attach_files_to_document` (`frappe/hooks.py:176`, `core/doctype/file/utils.py:312-372`). It makes a File row for an Attach field whose value is a `/files/...` URL when no row with that `file_url`, document and field exists. `File.insert` then re-reads the file through `get_content` (`file.py:691-725`) and `save_file` (`:780`), which de-duplicates by `content_hash`. Navbar Settings is saved by the theme's sync, so its copy appears at sync time. Website Settings is written with `set_single_value`, so a copy appears only when somebody saves that document later.
- **Why the hash is not an identity (VERIFIED on the bench):** an administrator's earlier upload of the same image has the same `content_hash` and `file_url` as the emblem (core de-duplication). The previous `delete_attachments` deleted every Navbar row with the emblem's hash that was not showing, including that one. Reproduced on a live site, see "Negative control".
- **A second finding (VERIFIED):** core re-reads a file with `FILE_ENCODING_OPTIONS = ("utf-8-sig", "utf-8", "windows-1250", "windows-1252")` (`file.py:45`). A file whose bytes decode as text (a small or synthetic file) is re-encoded, so its copy gets another `content_hash` and a new file name with the hash tail (`ins-dbgbf9d2d.png`). A real image has bytes that no encoding accepts (for example 0x81) and the copy is byte-identical. The old tests used all-zero filler, which is text-decodable, so they exercised a path that real images do not take. The new tests use `_image()`, bytes with `\x81\x90`. Consequence for the design: a row cannot be tied to the theme by `content_hash` or `file_url` in every case.
- **Chosen: one more global, no schema.** `ins_identity_files` is a `frappe.db.set_global` row like `ins_identity_prior` and `ins_identity_written`. It adds no field to a core doctype or to the settings doctype (nothing to migrate, nothing for a core upgrade to conflict with), it starts with the prefix `ins_identity_` that `install.clear_globals` already deletes, and `delete_attachments()` also clears it. Shape: `{"Navbar Settings.app_logo": [{"url": ..., "since": "<datetime with microseconds>", "names": [File names]}], "Website Settings.app_logo": [...], ...}`.
- **Ownership rules:**
  - Navbar Settings: the rows attached to `app_logo` with `creation` at or after the start of the sync save, recorded by name at sync time. A row that existed before (the administrator's, even with the same bytes) is never recorded. Later uploads of the same bytes by an administrator are not recorded either (they are not created by the sync).
  - Website Settings (`app_logo`, `splash_image`, `favicon`): rows attached to the field, with `file_url` equal to a value the theme wrote, created at or after that write. They are looked up at uninstall, because core creates them later.
  - In both cases a row whose `file_url` is what the target shows now is kept (the site displays it).
- **Known limits (labelled):** (1) a file uploaded to the same Website Settings logo field, with the same bytes as the emblem, after the theme wrote the emblem is indistinguishable from core's copy and is removed unless it is the logo shown; the README says so. (2) A Website Settings copy whose content was re-encoded by core (text-decodable files) has another URL and is not matched; real images are not affected. (3) A site that wrote an emblem with an earlier build has no `ins_identity_files`, so uninstall leaves the copies of that earlier write (previously it deleted Navbar copies by hash). The product has not shipped; the README says so.

## Tests, VERIFIED

| Command | Result |
|---|---|
| `tools/bench/b.sh run-tests --app institutional_theme --module institutional_theme.institutional_theme.doctype.institutional_theme_settings.test_institutional_theme_settings` | 49 tests, OK (twice; 45 before this change, 4 added: the administrator's file with the same bytes survives; the theme's copies go while the administrator's same-bytes row stays; Website Settings copies of a later save are removed; a Website copy that is still shown stays. The Navbar "keeps a copy that is showing" test was rewritten for the new rule). |
| `tools/bench/b.sh run-tests --app institutional_theme` (`app-tests.log`) | 148 integration tests OK in 185 s, 178 unit tests OK. After the run the bench has no `ins-test*` File row, no `ins_identity_*` global and no `ins-test*` file in `public/files`. |
| `python3.14 -m unittest institutional_theme.audits.tests.test_manifest_selectors` | 2 tests OK. |
| The new same-bytes test against the previous `identity_sync.py` | Fails (`AssertionError: None is not true`, the administrator's row was deleted). The Website Settings test also fails against it. (An earlier single run of the same-bytes test against the old file passed; I could not explain it and the repeat failed as expected. It is not relied on.) |

## Live proof on a throw-away site, VERIFIED

`tools/bench/uninstall_residue.sh <label>`: `bench new-site r3fix.test --db-type postgres` (Frappe only, 22 to 25 s), table counts, `install-app institutional_theme`, `gate_state.py seed` (settings saved with name and emblem, so Navbar Settings is saved by the sync; Website Settings saved, so core copies the emblem; an administrator's file with the emblem's bytes attached before), `uninstall-app institutional_theme --yes --no-backup`, `gate_state.py residue`, table counts after and their diff, `drop-site`. Each step is under `/tmp/ins-bench.lock`, as `frappe`, with `UV_CACHE_DIR` unset. Output per step: `<label>/logs/`, exit codes and seconds: `<label>/commands.tsv`. `midad.test` was not touched by these runs; the site was dropped after each (`ls sites` shows only `midad.test`).

| Label | Administrator's file attached to | Code | File rows after the seed's Website save | Result |
|---|---|---|---|---|
| `new-code` | Navbar Settings `app_logo` | this change | administrator's row, 2 Website copies (`app_logo`, `splash_image`); core makes no Navbar copy because the administrator's row exists | `RESIDUE: none`; administrator's row and file on disk kept; table diff `RESIDUE: none`; `public/files` empty |
| `new-code-favicon` | Website Settings `favicon` | this change | administrator's row, a Navbar copy made by the sync, 2 Website copies | `RESIDUE: none`; administrator's row and file kept; table diff `none`; `public/files` empty |
| `old-code` (negative control) | Navbar Settings `app_logo` | previous `identity_sync.py`, swapped in for the uninstall command only | as `new-code` | `RESIDUE`: 2 Website Settings copies left, `administrator's file with the emblem's bytes: was deleted` (should-fix 1 and 2 reproduced); table diff `tabFile: before 2, after 4` |
| `old-code-favicon` (negative control) | Website Settings `favicon` | previous file | as `new-code-favicon` | `RESIDUE`: 2 Website Settings copies left (the Navbar copy was removed by the old hash rule); table diff `tabFile: before 2, after 4` |

The only table differences on the passing runs are activity tables (`tabComment`, `tabDeleted Document`, `tabPermission Log`, `tabVersion`), the same as in `fresh-install`.

## Blocking 2, second half

`tools/bench/manifest_selectors.py` already collected every table whose section id starts with `2` and whose first header is `Selector` or `Item` (the review read its docstring, which said "2a to 2h"). The code reads 2i and 2j: 11 and 32 rows. Changes: the docstring says every `### 2x` section; a `2x` table with any other header is now reported on stderr and makes the exit code 1, so a table cannot be skipped quietly; `test_manifest_selectors.py` (in the CI audit tests) counts the table rows of every `### 2x.` heading independently and requires the parser to read them all, and tests a made-up section 2k and a 2m table with an unknown header. 2j was in the manifest when I read it at 03:05 UTC.

Runs (`manifest-selectors/`, `rows-*.tsv`, `rows-*.md`, `names-*.tsv`):

| Against | Rows (all sections) | 2i | 2j | Exit |
|---|---|---|---|---|
| 16.32.0 itself (sanity) | present 144, moved 17, changed 0, missing 0, unchecked 13 | present 7, moved 1, unchecked 3 | present 24, moved 8 | 0 |
| v16.52.0 (`/home/frappe/newest-bench/apps/frappe`) | present 39, moved 62, changed 49, missing 11, unchecked 13 | changed 2, moved 4, present 2, unchecked 3 | changed 10, missing 3, moved 13, present 6 | 1 |

"moved" against 16.32.0 itself means a name that is not in the cited file but is in another file of the same tree (an existing property of the checker, not a regression). The three 2j rows missing in 16.52.0: `.onb-header-actions ...` (row 8) and `.onb-progress-badge ...` (row 4), both the OnboardingPanel that the upgrade review already noted, and **row 1 of the proof-only table: the toast markup `.alert.desk-alert` and `#alert-container` (`ui/messages.js:430-456` in 16.32.0) is gone from 16.52.0**. That row is a proof selector, not shipped CSS, but the toast test of the proof will not find its markup on 16.52.0; it is not in the manifest's notes yet.

## Selectors depended on (16.32.0)

`frappe/hooks.py:176` (`doc_events["*"]["on_update"]` includes `attach_files_to_document`); `frappe/core/doctype/file/utils.py:312-372`; `frappe/core/doctype/file/file.py:45` (`FILE_ENCODING_OPTIONS`), `:477-503` (`validate_duplicate_entry`), `:605-618` (`_delete_file_on_disk`: the file stays on disk while another row shares the hash), `:691-725` (`get_content`), `:780-860` (`save_file`). These are read, and observed on the bench as described. They are core behaviours the manifest section 6 should list (the scribe owns that file; not edited by me).

## Strings

None. No user-visible string was added.

## Not verified, not done

- The previous code was shown to fail on a live site only through the swap of one file for the uninstall command (the file was compared with a copy afterwards and is identical). The web server of `midad.test` was restarted at the end (`start_services.sh restart-web`, `ping` answers `pong`) so it runs the new code; the identity write-through through the browser was not exercised.
- Real browser upload of the emblem through the desk form, and real PNG/SVG/ICO files: the tests and the gate use synthetic bytes that no text encoding accepts. A real upload goes through the same `File` code.
- HRMS installed: not exercised.
- `gate_install_uninstall.sh` itself was not re-run (it uninstalls the app from `midad.test`); its `gate_state.py` helper was exercised through `uninstall_residue.sh`.
- A site that wrote its emblem with an earlier build (limit 3 above).
