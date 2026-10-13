# Phase 2 evidence: fonts

Author: backend-engineer. Run from `/home/user/institutional_theme`; `$PY` is Python 3.14. Nothing committed by
this task (the lead's snapshot commit `de691cb` already contains an earlier state of these files).
Labels: VERIFIED = run in this session; NOT VERIFIED = not run.

## Files

- Fonts: `institutional_theme/public/fonts/{plex,noto,tajawal}/` (WOFF2, Plex TTF, one `OFL.txt` each)
- SCSS (hand-written): `institutional_theme/public/scss/fonts/{_ranges,_plex}.scss`,
  `ins_fonts_noto.bundle.scss`, `ins_fonts_tajawal.bundle.scss`
- `institutional_theme/fonts.py`; tests `institutional_theme/midad/tests/test_fonts.py` (41 tests)
- `docs/FONTS.md` (licence record, a table per file with SHA-256)

## Sources (VERIFIED, downloaded this session)

- WOFF2: npm `@fontsource/{ibm-plex-sans,ibm-plex-sans-arabic,ibm-plex-mono,noto-sans,noto-sans-arabic,tajawal}`
  5.3.0, all `OFL-1.1`; each tarball unpacked in its own empty directory. Archive hashes are in `docs/FONTS.md`.
- Print TTF: IBM's own repository at the release tags `@ibm/plex-sans@1.1.0`, `@ibm/plex-sans-arabic@1.1.0`,
  `@ibm/plex-mono@2.5.0` (commits `1da12f02...`, `1da12f02...`, `2f9ba1b2...`), via
  `https://raw.githubusercontent.com/IBM/plex/<tag>/packages/<pkg>/fonts/complete/ttf/<file>`.
  The npm `@ibm/plex-*` packages contain no TTF, so GitHub was used. The TTF files report versions Sans 3.005,
  Arabic 1.005, Mono 2.005. They come from IBM's release, the WOFF2 from the Google Fonts build that Fontsource
  repackages; the designs are the same but the builds are not byte-related (print only).
- Tajawal: `@fontsource/tajawal` 5.3.0 ships weights 200, 300, 400, 500, 700, 800, 900. There is no 600, so
  `font-weight: 600 700` is declared on the 700 file (the ADR 0004 "UNVERIFIED" is now verified). The matched
  Latin face is Tajawal's own Latin subset (`Midad Tajawal Latin`).

## Sizes (bytes, VERIFIED)

| Set | WOFF2 | Budget |
|---|---|---|
| Plex default: Sans 400/500/600 (71,024), Arabic 400/500/600 (133,832), Mono 400/500 (29,596) | 234,452 (229 KB) | 350 KB |
| Noto: Sans 400/500/600 (40,112), Sans Arabic 400/500/600 (155,220) | 195,332 | loaded only when selected |
| Tajawal: Latin 400/500/700 (30,152), Arabic 400/500/700 (26,896) | 57,048 | loaded only when selected |
| Plex TTF for print (8 files) | 1,677,932 | not served to screens; fetched only by the PDF generator |

Compiled `ins_desk.bundle.scss` (css-engineer's entry, with my `_plex.scss` imported): 81,500 bytes, 8 `@font-face`.

## Compile check (VERIFIED, no `bench build`)

Standalone sass 1.69.5 from `/home/frappe/frappe-bench/apps/frappe/node_modules/sass`, modern API, logger silent:

```
_plex.scss                    3344 bytes; font-faces: 8
ins_fonts_noto.bundle.scss    2486 bytes; font-faces: 6; rtl comments: 2
ins_fonts_tajawal.bundle.scss 2450 bytes; font-faces: 6; rtl comments: 2
ins_desk.bundle.scss          81500 bytes; font-faces: 8; no "IBM Plex Sans Arabic"
```

Output carries `font-display: swap`, absolute `/assets/institutional_theme/fonts/...` urls and
`unicode-range` on every face; `--font-stack: var(--ins-font-sans)` is in the compiled desk CSS.

## Core variable names (VERIFIED in source)

`/home/user/src/frappe-16.32.0/frappe/public/scss/espresso/_typography.scss`: `--font-stack`,
`--weight-regular: 420`, `--weight-medium`, `--weight-semibold`, `--weight-bold`. The generated
Frappe map already sets `--font-stack: var(--ins-font-sans)`, `--weight-regular: var(--ins-weight-regular)` (400),
`--weight-medium`, `--weight-semibold` and `--weight-bold` (500 and 600); the font partials only define the
`--ins-font-*` variables. The tests assert these lines.

## Design points

- Variables: `--ins-font-sans` (Arabic face, Latin face, system), `--ins-font-arabic` (Arabic face, system),
  `--ins-font-mono` (Plex Mono, system monospace). Plex on `html:root[dir]` (0,2,1); Noto, Tajawal and the
  uploaded-font file on `html:root[dir][lang]` (0,3,1), independent of load order. The Plex pair stays in every
  other pairing's stack as fallback. `font-synthesis: none` is also set by `_plex.scss`.
- Arabic range `U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F` (ADR 0004);
  Latin range is Fontsource's Latin subset. Latin digits are not in the Arabic range, so they always come from
  the Latin face; Arabic-Indic digits come from the Arabic face.
- `fonts.py`: `font_kind`/`file_kind` (magic numbers `wOF2`, `00 01 00 00`, `true`), `UploadedFont` (rejects any
  url that could leave the `url()` token or point off-site), `uploaded_font_css()` (regular 400, semibold
  `500 600`, medium and strong weights 600; a script missing either file loses both faces; `""` when no script
  is usable), `print_font_css()` (one TTF `url()` per face, no `format()`; uploaded TTF per script, else Plex TTF;
  Noto and Tajawal print in Plex), `print_font_families()`.

## Tests (VERIFIED)

```
$ $PY -m unittest discover -s institutional_theme/midad/tests -t .
Ran 122 tests ... OK      (16 colour, 32 emit, 41 fonts, 33 model; 1.6 s)
$ $PY -m institutional_theme.midad.build --check      0 stale, exit 0
$ $PY -m institutional_theme.audits                   passed, exit 0
$ uvx ruff check / format --check  (fonts.py, midad, audits)   clean
```

`test_fonts` covers: every WOFF2/TTF has the right magic number; each folder has an OFL text; the Plex WOFF2 total
is under 350 KB; `docs/FONTS.md` lists exactly the files on disk with matching SHA-256; every SCSS face
points at a bundled file; family names start with `Midad ` and never `IBM Plex Sans Arabic` in code; Arabic faces
use the Arabic range; weights are 400/500/600 (Tajawal 600 uses the 700 file); the Python table matches the SCSS;
the Frappe map lines above; hostile upload urls are rejected; uploaded, partial and empty uploads; every print
case above.

## Not verified

- A browser rendering of any pairing (no headless run); wkhtmltopdf loading the TTF; `unicode-range` support in
  wkhtmltopdf's WebKit (the print Arabic faces carry the range, harmless if ignored).
- `bench build` of the bundles (not run, the bench is in use). `ins_fonts_*.bundle.scss` need a hooks or
  `website.py` link step (Phase 3).
- Latin-extended and Cyrillic glyphs: not bundled, they use the system fallback.
