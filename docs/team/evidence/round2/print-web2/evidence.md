# Round 2 wave 2, print-web-engineer (2026-10-13, 22:40 UTC)

VERIFIED = I ran it. Files in this folder; screenshots in `shots/`, PDFs in `pdf/`, PNGs in `png/`.

## 1. 403 reference (VERIFIED)
- Cause: core merges `frappe.local.response["context"]` (where `NotPermittedPage` stores `indicator_color="red"`) into the page context only after the `update_website_context` hooks ran (`base_template_page.py:30-31, 52-54`). `not_permitted_page.py:23-25` sets nothing else. Fix in `web_content.py` (`_is_error_message`): a `www/message.html` page is an error when status >= 400 or the indicator is red, read from the context or from `frappe.local.response["context"]`.
- Test `test_message_with_red_indicator_is_an_error`; module run: 17 tests OK.
- Bench with `"monitor": 1`: `/me` as Guest, en and ar: footer `<code>` equals `X-Frappe-Request-Id` (`a1_403.txt`, `shots/a1-403-*.png`). `site_config.json` restored: `cmp` byte-identical, sha256 `7c3e5567...f2e1` (`site_config.*`).
- ADR 0009 "Gaps" still says 403 gets support only; now it gets the reference.

## 2. Chrome "repeat header and footer" clipping (VERIFIED, fixed)
- Cause: `templates/print_formats/chrome_pdf_header_footer.html` (header/footer page) sets `.letter-head, .letter-head-footer { margin-top: -12mm !important }`; `utils/pdf_generator/browser.py:301-340` gives the header page `marginTop` = the print format's top margin (0 here; the 15mm default at `:171` applies only without a header) and sizes it from the shifted height. With margin 0 the top 12mm is outside the page. wkhtmltopdf's page (`pdf_header_footer.html`) pads itself 15mm against -15mm, so it was fine.
- Fix in `ins_print.bundle.scss` (end of file, outside the nest): `body:not([onload]) .print-format .wrapper .letter-head .ins-lh { margin-top: 16mm }` and 12mm for the footer. Only the Chrome header page has `.wrapper` without `onload`.
- Result: `png/chrome-A4-{en,ar}-draft-rh-1.png` show the full letter head; wkhtmltopdf `-rh` unchanged. Not re-run: Letter size, Cancelled with rh, a print format with a 15mm top margin (computed only: net 19mm from the edge).

## 3. P2 website and portal (Light only)
Blog: not in 16.32 (`website/doctype` has no Blog Post), skipped. New `web/_website.scss`, imported by `ins_web.bundle.scss`, scoped to `body[data-path]:not(.ins-auth):not(.ins-error)`; no `!important`.
- Pages, ar and en, `shots/p2-before-*` and `p2-final-*`: Web Page (en and ar), Visitor Request web form (new, invalid, focus, success), `/` , `/me`, `/orders`, `/quotations`, `/my-requests` list and new (as a Website User), navbar, footer, error page.
- Defects fixed: web form fields had no border on a white card; links in prose had no underline; `code` purple; default buttons borderless; navbar font 18px; avatar colours 3.4-4.5:1 (core variables remapped to the status pairs); card touching the navbar on list pages; empty states had no closing rule (added with backgrounds so the brass lead shows); Web Page `text_align: Left` inline style parked Arabic pages at the left (`page_values()` in `web_content.py`, test added); mixed-language titles and success text (`unicode-bidi: plaintext`).
- Checks (`p2_checks.mjs`, `p2_checks.json`, `p2_checks.txt`): Arabic letter-spacing is 0 on every text element, all pages (the web form buttons needed five repeated `[data-path]`); keyboard focus: every stop has a 2px solid ring (0 bad); text contrast: every page at least 4.5:1 except items below.
- NOT FIXED: core `.text-muted { color: #7c7c7c !important }` (4.17:1) on the footer "ERPNext" link, "No ToDo found" and a breadcrumb span. Needs one `!important` rule, which I did not add: `body[data-path]:not(.ins-auth):not(.ins-error) .text-muted { color: var(--ins-text-muted) !important }`. Lead decides.
- Core defect found: every standard web form (`/update-profile/<user>`, `/address`, `/issues`, `/request-data`) returns 417 "Value for Condition JSON cannot be a list" (`base_document.py:549` through `document_page.py:56`) even for Administrator. Not this app; non-standard forms work.
- `/contact` returns 404 (no published Contact Us page). Datepicker cells (hidden widget) show up in the contrast scan; not visible.
- NOT RUN: `ruff` (not installed on this runner), Dark website (out of scope by decision), real Sales/Orders data in the portal lists (empty states only).
- Temporary Web Pages, Web Forms, users and ToDos deleted (`p2_cleanup.py`).
- Size: built `ins_web.bundle.css` is 173 KB; budget in BRIEF is about 60 KB. This file adds about 5 KB; the rest was there (fonts and tokens). Lead to review.

## Selectors depended on (16.32.0)
`website/page_renderers/base_template_page.py:30-31, 52-54`; `not_permitted_page.py:23-25`; `frappe/__init__.py:1295-1299`; `utils/pdf_generator/browser.py:171, 301-340`; `templates/print_formats/chrome_pdf_header_footer.html` (`-12mm !important`, `.wrapper`); `pdf_header_footer.html` (`onload`, `-15mm`); `website/doctype/web_page/templates/web_page.html:23`; `public/scss/website/base.scss:19-38` (h1 tracking), `web_form.scss` (`[data-doctype="Web Form"] .page-content-wrapper .container .page_content`, `.web-form-introduction`, `.success-title`, `.success-message`), `website_avatar.scss:5-7` and `--*-avatar-bg/color`, `templates/includes/list/list.html:5-9` (`.empty-apps-state`), `web_form_list.js:258` (`.no-result`), `templates/base.html` (`body[data-path]`), Bootstrap `.text-muted !important`.

## Manifest rows
1. Hook `web_content.page_values` (Web Page `text_align`). 2. Print bundle rule uses `body:not([onload])` to tell core's two header pages apart (UNVERIFIED across Frappe upgrades). 3. Core `.text-muted !important` unresolved (needs lead). 4. Core 417 on standard web forms (not ours).

## Strings
None new.
