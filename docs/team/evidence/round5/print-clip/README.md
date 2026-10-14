# Round 5, item 2: why wkhtmltopdf clips "Quotation Modern with Images" on v16.52.0

Result: **core alone causes it. The theme neither causes nor worsens it. No app file was changed.**
A second finding changes what the clipped file means: core never sends this format through wkhtmltopdf when the format is named (below).

## Setup (VERIFIED unless marked)

- wkhtmltopdf 0.12.6.1 (with patched qt) from the official `0.12.6.1-3` jammy `.deb`, extracted to `/tmp/wk/x`, linked in `/usr/local/bin` (`wkhtmltopdf-version.txt`). Chrome: core's own `headless_shell` (Skia/PDF m133). `pdftoppm`/`pdfinfo` from poppler-utils.
- Sites: `midad.test` (Frappe 16.32.0, ERPNext 16.33.0) and `midad52.test` (Frappe 16.52.0, ERPNext 16.50.0), both with the app installed. Nothing site-wide was changed (no Print Settings edits; generator and paper are per-call arguments `pdf_generator=`, `pdf_options={"page-size": ...}`).
- Document: one fictional draft Quotation (SAR, two items, "Clip5 Temp Customer"), created and deleted by `scripts/render.py` (`LEFT None 0` in each run).
- Three variants per version, each rendered in wkhtmltopdf and Chrome, A4 and Letter, en and ar (72 PDFs in total):
  - `themed`: Print Style "Midad" + Letter Head "Midad".
  - `core`: Print Style "Standard", no letter head, theme installed.
  - `noapp`: as `core`, and the app removed from the rendering process: `frappe.get_installed_apps` patched before any hook is read, hook cache cleared, asserted that the `ins_identity` Jinja method is gone. The site is not changed and was never without the app. This is a process-level removal, not a site without the app (ASSUMED equivalent: the theme reaches print only through the Print Style and Letter Head records, the `jinja` method and the translations, all three absent here; I did not build a throw-away site for a literal never-installed render).
- Two ways to name the format on 16.52.0:
  - `implicit`: no `print_format` argument, so core resolves the Quotation default itself. This is how the round-4 script produced the clipped file.
  - `explicit`: `print_format="Quotation Modern with Images"`.
  On 16.32.0 the Quotation has no default format, so both are "Standard" (one run, `v16.32.0/`).
- How "clipped" is judged: the PNG (visual, the deciding evidence) plus `pdftotext -bbox` (`*/overflow.txt`: max word xMax and expected tokens missing, COMPUTED; text cut by the page edge disappears from the PDF, e.g. the whole "Amount" header on A4). The rightmost-non-white-column figure in `*/analysis.txt` is not a clip test (rules end at the printable edge either way); `*/analysis.json` has the page sizes.

## Finding 1: the clipped file is not what core produces for this format

`frappe/utils/print_utils.py` `get_print`: when `print_format` names a format that `uses_beta_renderer` (a builder format; this one has `print_format_builder_beta = 1`, `pdf_generator = "chrome"` in `erpnext/selling/print_format/quotation_modern_with_images/*.json`), `resolve_pdf_generator` returns `"chrome"` whatever `pdf_generator` was asked for. The `explicit` wkhtmltopdf PDFs are therefore Chrome output (Producer `Skia/PDF`, page size from Chrome, Letter request ignored: A4 comes back). wkhtmltopdf renders this format only when `get_print` gets no `print_format` (the `implicit` case), which is not a path a user reaches by choosing the format in the print view. (VERIFIED by source and by the outputs; which real callers omit the print format, for example an Email attachment without a format, was not enumerated: ASSUMED.)

## Matrix (clipped = yes means the right edge, or the left edge in Arabic, cuts content)

| Version | Format passed | Generator actually used | Paper | Theme | English | Arabic | Files |
|---|---|---|---|---|---|---|---|
| 16.32.0 | Standard (default) | wkhtmltopdf | A4, Letter | themed | no | no | `v16.32.0/themed-wkhtmltopdf-*`, `png/` |
| 16.32.0 | Standard | wkhtmltopdf | A4, Letter | core style, no letter head | no | no | `v16.32.0/core-wkhtmltopdf-*` |
| 16.32.0 | Standard | wkhtmltopdf | A4, Letter | app removed from process | no | no | `v16.32.0/noapp-wkhtmltopdf-*` |
| 16.32.0 | Standard | Chrome | A4, Letter | all three | no | no | `v16.32.0/*-chrome-*` |
| 16.52.0 | implicit (default, Modern with Images) | wkhtmltopdf | A4 | themed | **yes** (Amount header gone, Posting Date and Valid Till cut) | **yes** (left cut) | `v16.52.0-implicit/themed-wkhtmltopdf-A4-*` |
| 16.52.0 | implicit | wkhtmltopdf | Letter | themed | **yes** (Amount, Posting Date, Status cut) | **yes** | `.../themed-wkhtmltopdf-Letter-*` |
| 16.52.0 | implicit | wkhtmltopdf | A4, Letter | core style, no letter head | **yes**, same layout as themed | **yes** | `.../core-wkhtmltopdf-*` |
| 16.52.0 | implicit | wkhtmltopdf | A4, Letter | app removed from process | **yes**, same layout as themed | **yes** | `.../noapp-wkhtmltopdf-*` |
| 16.52.0 | implicit | Chrome | A4, Letter | all three | no | no | `.../*-chrome-*` |
| 16.52.0 | explicit | Chrome (pinned, finding 1) | A4 (Letter request ignored) | all three | no | no | `v16.52.0-explicit/*` |

Viewed one by one: `noapp` A4 en, `noapp` Letter en, `noapp` A4 ar, `core` A4 ar, `themed` A4 en, `themed` Letter en, `themed` Letter ar (all clipped), 16.32.0 `themed` and `noapp` A4 en (fit), 16.52.0 explicit `themed` Chrome (fits). The other cells follow from identical `overflow.txt` figures with the viewed ones (A4 en: max x 584.1 of 595 with "Amount" missing in all three variants; Letter en: 585.3 of 612; COMPUTED) and were not each opened.

Theme effect: with the letter head the same cut happens (themed A4 en max x 583.9 vs 584.1 without it). The letter head only adds the header and footer and moves the content down. On 16.52.0 the table is wider than the printable area under wkhtmltopdf: the format is built for Chrome, with percentage and flex widths wkhtmltopdf's old WebKit does not honour. I did not isolate which construct of the format's markup is responsible; that is not needed to place the cause (core, not the theme).

## Observation, not in scope, not changed

16.52.0, Chrome, themed, short documents: the Midad draft watermark box sits in the middle of the page and overlaps the totals of a short quotation (`v16.52.0-explicit/png/themed-chrome-A4-en.png`). I did not compare the placement with 16.32.0 (the 16.32.0 Standard PNG shows it over the totals area too). Needs a decision from the lead; I did not touch it.

## Fix

None: the theme is not the cause, so there is nothing to fix in `Print Style` or `Letter Head`. Both stay idempotent and were not modified.

## Proposed checklist wording ("Known on v16.52.0", replaces the NOT VERIFIED sentence)

> **wkhtmltopdf and "Quotation Modern with Images".** This default format of ERPNext v16.50.0 is a builder format pinned to Chrome by core (`pdf_generator = "chrome"`): requesting it by name always renders with Chrome, which fits the page on A4 and Letter, with or without the theme. Rendered with wkhtmltopdf 0.12.6.1 (patched Qt), which only happens when a caller omits the print format, core's own output is clipped at the right edge (the left edge in Arabic) with the Standard style and no letter head, and with the theme's app removed from the render: Posting Date, Valid Till and the Amount column are cut. The theme does not cause or worsen it (VERIFIED, round 5, `docs/team/evidence/round5/print-clip/`). Chrome without the format named (the site default format, as the round-5 gate's print check renders it) clips the Arabic page at the left edge (the totals column), also with the app removed from the render: core as well (`docs/team/evidence/round5/print-clip/v16.52.0-implicit/png/noapp-chrome-A4-ar.png`, `docs/team/evidence/round5/final/gate/v16.52.0/print/png/chrome-A4-ar.png`); the named format in Chrome fits in English and Arabic (`v16.52.0-explicit/png/themed-chrome-A4-ar.png`). Keep Chrome as the generator for this format; use the "Standard" format where wkhtmltopdf must be used.

## Not done

- No throw-away site without the app: the `noapp` variant is a process-level removal (above).
- Which markup construct makes wkhtmltopdf overflow was not isolated.
- Which real callers reach the implicit (wkhtmltopdf) path was not enumerated.
- Arabic clipping was judged visually only; Arabic text extraction (`pdftotext`) is unreliable for the shaped glyphs, so the token check there is weak.

Scripts: `scripts/render.py` (variants, `IMPLICIT` as the fifth argument), `scripts/run.sh`, `scripts/analyze.py`, `scripts/overflow.py`.
