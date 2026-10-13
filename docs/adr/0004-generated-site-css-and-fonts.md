# 0004 — Generated site CSS, the colour package, and fonts

Status: accepted, 2026-10-13. Settles ADR 0001 question 3 and places D6's colour maths. Applies upgrade findings 2, 3, 6 and 10, accessibility findings 2 and 11, and the print-web conditions.

## Context

The custom preset and uploaded fonts are per-site data, which bench-wide bundles cannot carry. Delivery must not write `site_config`, block rendering on a Python request, or break after a restore without files. The colour maths runs in the build, the audits and on save (D6).

## Decision

**Colour package.** `institutional_theme/midad/` is dependency-free Python and never imports Frappe. It holds:
- `colour.py`: the port of `color.mjs`;
- `model.py`: preset resolution;
- `emit.py`: the emitter (0003);
- `build.py`: the pipeline, run as `python -m institutional_theme.midad.build [--check]`.

The pipeline writes `midad/generated/model.json` from `design/tokens.json`: curves, ramps, semantic and Frappe maps, contrast groups and the shipped presets, under the key `"_generated": "from design/tokens.json; do not edit"`. The runtime reads only that file. `--check` fails CI if any generated file is stale.

**Files.** In `frappe.get_site_path("public", "files", "institutional_theme")`, served at `/files/institutional_theme/…` by nginx (production) or Werkzeug (development):
- `ins_palette_custom.<h>.css`, only while `custom` is allowed or is the default;
- `ins_fonts_uploaded.<h>.css`, only while the pairing is `Uploaded`.

`<h>` is the first 12 hex digits of the SHA-256 of the actual content. No name is stored in the database.

**`site_files.ensure() -> dict[str, str]`** returns the URLs to link.
1. Read the settings with `frappe.get_cached_doc`.
2. Compute `present`: one flag per uploaded font, true if its file exists on disk.
3. If a per-worker memo holds the key `(site, settings.modified, present)` and its files exist, return that entry.
4. Otherwise:
   - build the content with pure functions;
   - name each file by hash;
   - write any missing file to `<name>.<pid>.tmp`, `fsync` it, and `os.replace` it into place;
   - store the result in the memo.

`ensure()` never writes the database. It runs in the website hook (inside its `try/except`, 0003), in the settings `on_update` and in `after_migrate`.

On save, `on_update` also:
- keeps the current and newest previous file of each kind and deletes the rest;
- calls `frappe.website.utils.clear_cache()`.

**Restore without files.** The settings and `File` rows return; the files do not.
- The next page load regenerates the CSS; the custom preset is data, so it is intact.
- A script with either upload missing loses both its faces and falls back to IBM Plex, and the name changes with the content.
- The settings form names the missing files (0005).

`bench restore` does not migrate, so this lazy path is what makes a restore safe. `bench build` touches only `sites/assets`. `before_uninstall` deletes the folder.

**Bundled pairings.** Private family names (CLAUDE.md):
- IBM Plex, the default: `Midad Plex Sans Arabic`, `Midad Plex Sans`, `Midad Plex Mono`. The faces are in `public/scss/fonts/_plex.scss`, imported by `ins_desk` and `ins_web`; the variables are on `html:root[dir]` (0,2,1).
- `ins_fonts_noto.bundle.css` and `ins_fonts_tajawal.bundle.css`.

Pairing bundles and the uploaded file set the same variables at `html:root[dir][lang]` (0,3,1), independent of load order. Mono is always Plex Mono. Only the selected pairing is linked (D5).

Every face:
- uses `font-display: swap`;
- on Arabic faces, carries `unicode-range: U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F`.

Stacks run Arabic, Latin, the Plex pair, then `system-ui, sans-serif`. `font-synthesis: none` is set on `html:root[dir]` in `ins_desk` and `ins_web`.

Each pairing provides 400, 500 and 600; a missing weight is covered by a range on the nearest file (Tajawal's 700 as `font-weight: 600 700`; UNVERIFIED, check `@fontsource`).

**Uploaded fonts.** Four Attach fields: Arabic and Latin, regular and semibold. All four are mandatory for `Uploaded` (0005).
- Each file must be public and is checked by magic number: `wOF2`, `00 01 00 00` or `true`.
- Faces: `Midad Uploaded Arabic` and `Midad Uploaded Latin`. Regular is `font-weight: 400`; semibold is `font-weight: 500 600`.
- `--weight-medium`, `--weight-semibold`, `--weight-bold`, `--ins-weight-medium` and `--ins-weight-strong` are set to `600`.

**Print.** wkhtmltopdf reads neither WOFF2 nor the screen CSS. `print/ship.py` renders the Print Style's `@font-face` block for the selected pairing, with one TTF `url()` per face and no `format()`:
- uploaded TTF files from `/files/…`;
- bundled TTF files from `/assets/institutional_theme/fonts/…`;
- Plex TTF when the uploads are WOFF2 only.

It runs on save and in `after_migrate`, only if the Print Style is unchanged since the last ship (checksum in `frappe.db.set_global`).

## Alternatives rejected

1. *Rewrite `site_config.app_include_css` on save.* A web request writes a deployment-owned file; per site, cached per worker, absent on website pages (P1, P3).
2. *A cached endpoint.* Render-blocking Python that fails when the server is busy (P1, P3).
3. *Stored file names.* They no longer match the content after a degraded rebuild (upgrade finding 3).

## Consequences

- **backend-engineer**: `midad/*`, `site_files.py`, `fonts.py`, `print/ship.py`, font files and licences, and `public/scss/fonts/*` (an exception: faces follow the font files).
- **print-web-engineer**: `ins_print.bundle.scss`, which has no fonts.
- **scribe**: `docs/FONTS.md`.

## Verification

Unit tests:
- the name is deterministic;
- concurrent `ensure()` calls leave complete files whose hash equals their name;
- a deleted folder is regenerated;
- a missing semibold drops that script's faces and renames the file;
- a read-only folder still gives `/desk` 200 with no link;
- `build --check` is clean.

On the bench: the generated file is served as `text/css`.

## Evidence (Frappe 16.32.0)

- `website/utils.py:381`;
- `utils/jinja_globals.py:151-157`;
- `app.py:532-538`, `middlewares.py:33-40`;
- `commands/site.py:362-374`;
- `utils/backups.py:347-353`;
- `config.py:147-150`;
- `core/doctype/file/file.py:605-620`;
- `boot.py:283-288`;
- `utils/print_format.py:240-241`;
- bench `nginx.conf:89` (upgrade review).
