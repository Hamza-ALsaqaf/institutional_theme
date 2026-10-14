# Round 2, print-web-engineer evidence (2026-10-13, finished 21:55 UTC)

Labels: VERIFIED = I ran it or opened the line. NOT VERIFIED = not run.

## Part A

1. **Arabic strings.** VERIFIED on the real build (`shots.js`, `login-ar.png`, `update-password-ar.png`).
   - "Use strong passwords." was not a source bug: `_("Use strong passwords.")` at `www/update-password.html:20` matches the `ar.csv` row exactly, and `get_all_translations('ar')` returns it. The old screenshot predates the row or a stale merged-translation cache (`frappe.cache` key `MERGED_TRANSLATION_KEY`, cleared by `bench clear-cache`). The page now renders `استخدم كلمات مرور قوية.` (computed `direction: rtl`).
   - "Sign Up" was a real gap: `login.html:151` uses `_('Sign Up')` (capital U) and `:127,143,230` use `_("Sign up")`; neither had a row. Rows added, see Strings. The heading renders `إنشاء حساب` (`curl /login?_lang=ar`, line 180).
   - Full stop: added `unicode-bidi: plaintext; text-align: start` on `h4` and `.page-card-subtitle` in `.page-card-head-text` (`web/_login.scss`, end of file). VERIFIED with an English fallback string forced into the Arabic page (`update-password-ar-english-fallback.png`): the stop stays at the end of the line.
2. **Traceback.** `web/_error_pages.scss:78` is now `direction: ltr; text-align: start`. VERIFIED on a real 500 (`/ins-preview-err`, temporary Web Page with `{{ 1 / 0 }}`, deleted): computed `direction: ltr`, `text-align: start` in en and ar (`errpage.js`, `error-page-en.png`, `error-page-ar.png`). Also fixed: core links `hljs-night-owl.css` on `error.html`, which painted the code element dark navy (`.hljs`, background `#011627`) on the always-light page; now transparent and inherited (nested `.hljs` rule). The traceback is empty outside developer mode (`{{ error }}`), so the block is empty in production; that is core behaviour.

## Part B

3. **`ins_print.bundle.scss`** (6.0 KB, no `var(`, no `!important`, no `@font-face`; VERIFIED by grep on the built file). Rules: closing rule on `.print-heading`; ruled tables (core `.table-bordered` and ERPNext `.items-table`/`.tax-table`); header repeat (`thead { display: table-header-group }`, rows `page-break-inside: avoid`); double rule above `grand_total`/`rounded_total`/`base_grand_total` and `table.highlight-bg`; `.ins-status` (text plus border shape: draft hollow circle, pending half circle, approved filled square, rejected and cancelled dashed, cancelled struck through); `.ins-signatures` (table cells, ruled signing space); `.ins-verify` box; watermark on `[document-status="draft|cancelled"]`; RTL pairs under `[dir="rtl"]`. The fonts are not in the file: `ship.py` prepends the block.
   - **Needed from backend (`ship.py`)**: append `.print-format { font-family: <print_font_families()["sans"]> }` after the font block. My bundle sets `.print-format .page-break { font-family: inherit }` so ERPNext's `.invoice-page { font-family: Inter }` does not win. Without the family rule the PDF falls back to DejaVu (seen in the first, unstyled run). Mono: `.mono` uses `"Midad Print Plex Mono"` directly.
4. **Letter Head** `print/letter_head.html`, `print/letter_head_footer.html`: `ins_identity()` read with `.get()`, every value escaped, placeholder emblem fallback, table layout. VERIFIED: rendered by core in both generators, with the real `ins_identity` (already registered; "Test Institution" / "Frappe") and with an in-process fake (Example Institution / مؤسسة المثال; second-language name shown on its own line). `frappe.lang` is available in the Letter Head Jinja (`utils/safe_exec.py:492`). Emblem `public/images/ins_emblem_placeholder.svg` already existed (placeholder, dashed frame, clear-space and minimum-size comment); unchanged.
5. **`ins_email.bundle.scss`** (2.0 KB, literals only, no `var(`). Hook line for `hooks.py` (the commented line 33 already has it): `email_css = ["ins_email.bundle.css"]`. Core's own entry is `email_css = ["email.bundle.css"]` (`frappe/hooks.py:60`); ERPNext adds its own; hooks lists append, ours loads last. VERIFIED rendered: Premailer output has no `var(`; en and ar PNGs. Hook injected in-process for the render only.
6. **Build.** VERIFIED: `tools/bench/b.sh build --app institutional_theme`; `sites/assets/assets.json` has `ins_print.bundle.css` and `ins_email.bundle.css` (names change on each build, read them from the file). Print Style CSS goes through `ship.py` from the built file; the RTL copy in `css-rtl/` is not needed (the file uses `[dir="rtl"]` and sits in an rtl-ignore wrapper).

## Generators (VERIFIED; files in `pdf/` and `png/`)

- wkhtmltopdf: `apt` gives **0.12.6 without patched Qt** (`wkhtmltopdf -V`). Unpatched, the page content overflowed the right edge and header/footer options are unsupported. I downloaded the official `0.12.6.1-3` jammy `.deb` (works on this noble runner), extracted it to `/tmp/wk` and put it first on PATH: `0.12.6.1 (with patched qt)`. All wkhtmltopdf results below are from the patched build. The runner is not production; production must also have the patched build.
- Chrome: `pdf_generator="chrome"` works in 16.32 (`frappe/hooks.py:109` registers `frappe.utils.pdf.get_chrome_pdf`; Frappe downloaded its own `headless_shell` into the bench). Producer Skia/PDF m133.
- Matrix rendered: wkhtmltopdf and chrome x A4 and Letter x en and ar x Draft and Cancelled (32 PDFs, page sizes confirmed with `pdfinfo`), plus A4 en/ar Draft with Print Settings "repeat header and footer" on (`*-rh`). Document: ERPNext Quotation (draft, and one cancelled after submit); fictional data. Temporary records deleted (`cleanup.py`); Print Settings restored.
- Works in both: Plex fonts embedded (wkhtmltopdf `pdffonts` shows Plex Arabic; Chrome shows Plex), ruled header, hairline rows, double rule over grand total, watermark box repeated per page, letter head with emblem at the line start in RTL, footer, figures at the line end in Arabic, page size A4 and Letter.
- wkhtmltopdf with repeat header/footer: header and footer repeat; page X of Y comes from core (`الصفحة 1 من 1`).
- **Not working or different**
  - Watermark tilt: the patched wkhtmltopdf ignored `transform` in its render (the unpatched build had applied it); I removed the tilt before the Chrome runs, so Chrome with a tilt was not tested. Result: a framed horizontal word, dashed frame for Cancelled.
  - **Chrome with repeat header/footer: the letter head is clipped at the top of the page** (`chrome-A4-en-draft-rh-1.png`). Cause not investigated (header height versus top margin in core's `chrome_pdf_header_footer.html`). NOT FIXED.
  - ERPNext's formats set `color: ... !important` on table header cells (`.items-table thead td`) and `padding: ... !important` on cells, and an inline `float: right` on the subtotal block. Those cannot be changed without `!important` or editing the format. Header cells stay grey (`#7c7c7c`) but are bold and ruled. In Arabic the subtotal block stays on the right of the page.
  - Arabic item text on an English page (or the reverse) follows the page direction (no `unicode-bidi: plaintext` in QtWebKit); mixed strings can reorder (`2U، ... 64`).
  - Some labels print untranslated (Frappe's own Arabic file: "Customer Name", "Sub Total"); not this app's strings.
- NOT VERIFIED: a black-and-white photocopy simulation (grayscale conversion) was not run; Grayscale reading of the PNGs only. A real Sales Invoice (needs accounts, items and a customer with an address) was not rendered; Quotation uses the same ERPNext format family (I did not open the Quotation format source; `sales_invoice_standard.json` has the same classes). Gmail, Outlook and Apple Mail were not tested; the email result is Chromium rendering of Premailer output. Pairings Noto and Tajawal print in Plex (by design in `fonts.py`).

## Selectors depended on (16.32.0 / 16.33.0)

| Selector | Source |
|---|---|
| `.print-format`, `.print-heading`, `.sub-heading`, `.page-break`, `.letter-head`, `.letter-head-footer` | `frappe/templates/styles/standard.css`; `templates/print_formats/standard_macros.html:198-212` |
| `[document-status="draft"]`, `[document-status="cancelled"]` | `standard_macros.html:215,220` |
| `.data-field[data-fieldname=...]` | `standard_macros.html:90-110` (`render_field_with_label`) |
| `.table`, `.table-bordered` (child selectors) | `frappe/public/css/bootstrap.css:1487-1501` |
| `.items-table`, `.tax-table`, `.highlight-bg`, `.invoice-page` | ERPNext print formats, for example `erpnext/accounts/print_format/sales_invoice_standard/sales_invoice_standard.json` |
| `td.text-right`, `td.text-left` (figures) | `standard_macros.html:189-196` |
| `.body-table`, `.email-container`, `.email-masthead`, `.email-title-cell`, `.email-body-cell`, `.email-footer-cell(.filled)`, `.email-footer-container`, `.email-header-title`, `.brand-name`, `.btn`, `.table`, `.callout-warning`, `.verification-code`, `.indicator-*` | `frappe/templates/emails/standard.html`, `email_header.html`, `email_footer.html`; `frappe/public/scss/email.bundle.scss` |
| `.error-page`, `.error-content`, `.hljs`, `.view-error` | `frappe/www/error.html:19-50`; `public/css/hljs-night-owl.css:30` |
| `.page-card-head-text h4`, `.page-card-subtitle` | `frappe/www/update-password.html:17-20`, `login.html:151` |
| `html[dir]` in both PDF generators | `www/printview.html:2`, `templates/print_formats/pdf_header_footer.html:2` |

## Manifest rows (for the scribe)

1. Print bundle uses physical properties (`border-top`, `margin-right`, `border-right-width`, `text-align: left/right`) and `[dir="rtl"]` pairs. Reason: QtWebKit (wkhtmltopdf) supports no logical properties, no `text-align: start`, no flex, no grid, no `inset`; only the vertical axis and symmetric values are used where possible. Email bundle uses `text-align: start` with left as the client fallback and `border-left` in two rules for the same reason (mail clients).
2. Print bundle does not declare fonts and uses no custom properties; Print Style CSS is raw (core appends it after `standard.css`), and wkhtmltopdf does not resolve `var()` reliably (findings section 6).
3. ERPNext format dependence: `.items-table`, `.tax-table`, `.highlight-bg`, `.invoice-page` are ERPNext class names (UNVERIFIED as stable across ERPNext versions); the rules are cosmetic and fail safe.
4. No `!important` is used. Core's `!important` on `td, th` padding and on ERPNext header colour stays in force (listed above).
5. wkhtmltopdf must be the patched-Qt build for repeat header/footer and correct page width; the distribution package (0.12.6) is not enough.

## Strings added to `ar.csv`

`Sign Up,إنشاء حساب` and `Sign up,إنشاء حساب`. The templates in `print/` and the bundles add no source strings.

## Files

Changed: `institutional_theme/public/scss/web/_error_pages.scss`, `web/_login.scss`, `institutional_theme/translations/ar.csv`.
New: `institutional_theme/public/scss/ins_print.bundle.scss`, `ins_email.bundle.scss`, `institutional_theme/print/letter_head.html`, `print/letter_head_footer.html`.
Scripts: `shots.js`, `errpage.js`, `errpage2.js`, `bidi.js`, `preview_setup.py`, `preview_render.py`, `email_render.py`, `emailshot.js`, `cleanup.py`, `pyrun.sh` (runs a script with the bench Python; adds `/tmp/wk/x/usr/local/bin` to PATH for the patched wkhtmltopdf).

## Hook lines for the lead

- `email_css = ["ins_email.bundle.css"]`
- `ship.py`: Print Style CSS = `print_font_css(pairing, uploaded)` + `.print-format { font-family: <print_font_families()["sans"]>; }` + the contents of the built `ins_print.bundle.css` (read the name from `assets.json`).
- Letter Head: `content` = `print/letter_head.html`, `footer` = `print/letter_head_footer.html`, `source` and `footer_source` = `HTML`; create under `frappe.flags.in_migrate = True` (core forces `source = "Image"` otherwise).
