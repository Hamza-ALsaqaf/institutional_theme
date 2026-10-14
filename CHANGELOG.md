# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-10-14

Summary of build rounds 1 to 6. Each round's gate result is in `docs/team/STATUS.md`; the owner's decisions are in `docs/team/OWNER_REVIEW.md` (Arabic).

Supported versions: verified on Frappe 16.32.0 (ERPNext 16.33.0, HRMS 16.20.1) and Frappe v16.52.0 (ERPNext v16.50.0, HRMS v16.50.0). Install constraint in `pyproject.toml`: `>=16.32.0,<17.0.0`. Tags between and after these two were not tested.

### Added

- Round 1: Midad Light and Dark desk themes, Arabic-first with English parity, built from `design/tokens.json` ([evidence](docs/team/evidence/phase2/)).
- Round 1: five audited colour presets (midad, graphite, petrol, forest, plum) and an optional custom brand preset; users choose among them, the administrator sets the default ([evidence](docs/team/evidence/phase2/)).
- Round 1: 48 P0 desk screenshots in Arabic and English, Light and Dark, comfortable and compact ([evidence](docs/team/evidence/phase3/)).
- Round 1: login, website and error pages in Arabic and English, with the password visibility toggle as a real button ([evidence](docs/team/evidence/phase3/web/)).
- Round 2: Midad Print Style and Letter Head, shipped once and never made default, for wkhtmltopdf 0.12.6.1 and Chrome ([evidence](docs/team/evidence/round2/print-web/)).
- Round 2: email stylesheet inlined by Premailer for mail clients ([evidence](docs/team/evidence/round2/print-web/)).
- Round 2: website, portal and web form pages, light only by platform constraint ([evidence](docs/team/evidence/round2/print-web2/)).
- Round 2: opt-in idle-session warning and connection-lost banner, both off after install ([evidence](docs/team/evidence/round2/backend2/)).
- Round 2: Tree and Gantt views, keyboard shortcuts dialog, code and text editor styling, and the P1 states (bulk actions, date picker, autocomplete, tooltip, skeleton, 403) ([evidence](docs/team/evidence/round2/css2/)).
- Round 2: interactive proof of the design, checked against the product ([evidence](docs/proof/README.md)).
- Round 3: clean install and uninstall gate with a database table comparison on a second bench ([evidence](docs/team/evidence/round3/fresh-install/)).
- Round 3: accessible names for list and grid checkboxes, icon buttons, filters, dialogs and the grid row editor ([evidence](docs/team/evidence/round3/a11y-attrs/)).
- Round 3: HRMS 16.20.1 desk screens, 84 captures with 0 flagged ([evidence](docs/team/evidence/round3/hrms/)).
- Round 3: coexistence test with another brand app that ships its own stylesheet, and the remedies in README Troubleshooting ([evidence](docs/team/evidence/round3/coexistence/)).
- Round 4: one code base for two Frappe v16 versions, with per-version snapshots and the range rule R7 ([evidence](docs/adr/0011-two-frappe-v16-versions.md)).
- Round 4: v16.52.0 support: the new shell, sidebar, toast, badges and buttons drawn with the approved tokens ([evidence](docs/team/evidence/round4/final/)).
- Round 4: dependency manifest with a 16.32.0 and a 16.52.0 line for every row ([evidence](docs/team/evidence/round4/manifest/)).
- Round 5: 12 deterministic race tests for the settings cache, and the cache guard module ([evidence](docs/team/evidence/round5/cache-race/)).
- Round 5: HRMS v16.50.0 on v16.52.0 desk screens, 0 flagged of 84 ([evidence](docs/team/evidence/round5/hrms52/)).
- Round 6: HRMS print formats checked under the Midad Print Style and Letter Head on both versions, with wkhtmltopdf and Chrome; on 16.32.0 the Classic, Detailed and Compact slips do not render (core) ([evidence](docs/team/evidence/round6/hrms-print/)).

### Changed

- Round 2: web bundle reduced from 175 KB to 59.7 KB (budget 60 KB), enforced by the size audit ([evidence](docs/team/evidence/round2/print-web3/)).
- Round 3: `README.md` install steps corrected after a clean install on a fresh bench ([evidence](docs/team/evidence/round3/fresh-install/)).
- Round 4: 26 Frappe colour variables remapped to their v16.52.0 meaning; no approved value moved ([evidence](docs/team/evidence/round4/tokens/)).
- Round 4: control heights follow the theme scale on v16.52.0: 32 px, 28 px compact, 44 px for touch ([evidence](docs/team/evidence/round4/final/)).
- Round 4: Arabic wording corrected for "Collapse" and "Reset your password" desk-wide ([decision 74](docs/team/OWNER_REVIEW.md)).
- Round 5: on Frappe 16.32.0, list titles are cut with an ellipsis below 576 px, and closed side-drawer items leave the tab order below 767.98 px ([evidence](docs/team/evidence/round5/v1652-items/)).
- Round 6: the desk stylesheet is 120.1 KB instead of 146.2 KB (budget 150 KB): the generated Frappe variable map declares every variable once for all modes and repeats only the 79 whose Dark value differs; computed styles and screenshots are unchanged on both versions ([evidence](docs/team/evidence/round6/css-headroom/)).
- Round 6: saving the identity clears only the caches that hold the identity values (every cached copy of the core settings documents it writes, the users' boot payloads and the rendered website pages) instead of the whole site cache, once when it writes and again after the save commits ([evidence](docs/team/evidence/round6/cache-clears/)).

### Fixed

- Round 3: uninstall removes only the logo copies the app made, not an identical file the administrator uploaded ([evidence](docs/team/evidence/round3/fix-uninstall/)).
- Round 3: text contrast fixes for Bootstrap text utilities, the dark extra-muted text and the dark delete button ([evidence](docs/team/evidence/round3/axe-fixes-css/)).
- Round 3: focus ring no longer clipped on the breadcrumb and folder images; the desktop navbar border is restored against another brand app ([evidence](docs/team/evidence/round3/coexistence/)).
- Round 4: invalid and mandatory field errors look the same, and `aria-invalid` is set on both versions ([evidence](docs/team/evidence/round4/fix1-backend/)).
- Round 5: settings cache race: the cache was cleared before the save committed, so a concurrent request could refill it with old values; the clear now runs again after commit or rollback ([evidence](docs/team/evidence/round5/cache-race/)).
- Round 5: Kanban v1 column dot, side-panel Draft and Cancelled colours, and list badges at 400% zoom on v16.52.0 ([evidence](docs/team/evidence/round5/v1652-items/)).
- Round 6: the Draft and Cancelled watermark is placed per generator. Under wkhtmltopdf it sits near the middle of an A4 or Letter page instead of over the title of a short document; on a document with several item rows it can still cross the totals, at 12% ink, and the text under it stays legible (13.5:1). Under Chrome it sits at the top of the page, over the letter head and the title, the only position where Chrome prints the whole frame on both versions ([evidence](docs/team/evidence/round6/hrms-print/), [fix](docs/team/evidence/round6/print-fix/)).
- Round 6: builder salary slips use the Midad font instead of Arial and DejaVu Sans ([evidence](docs/team/evidence/round6/hrms-print/)).
- Round 6: Arabic builder salary slips mirror their sides (labels, amounts, accent bar and separators) ([evidence](docs/team/evidence/round6/hrms-print/)).
- Round 6: builder salary slip captions and amounts in words are readable on their grey bands (4.1:1 raised to 7.9:1), Arabic captions and column headers are no longer letter-spaced, and English and Arabic slips draw their rules in the same colours ([evidence](docs/team/evidence/round6/print-fix/)).

### Known limitations

- The full list, in Arabic, is in section 3 of [`docs/team/OWNER_REVIEW.md`](docs/team/OWNER_REVIEW.md).
- The manual QA matrix and the steps after a Frappe upgrade are in [`docs/UPGRADE_AND_QA_CHECKLIST.md`](docs/UPGRADE_AND_QA_CHECKLIST.md).
- Frappe core's `redis_cache` race and the 500 errors it causes under load are not fixed by this app ([evidence](docs/team/evidence/round5/cache-race/)).
- On a busy site the old system name or logo can stay on screen after an identity save: a request that started before the save can put the old values back into core's cache after the app clears it, and core keeps that entry until the next cache clear. If the old name or logo persists, run `bench --site <site> clear-cache` ([review](docs/team/reviews/upgrade-round6.md), S1; [evidence](docs/team/evidence/round6/cache-clears/)).
- Arabic salary slips print a date that follows an Arabic word with its parts reversed when the site date format uses hyphens (`dd-mm-yyyy`): HRMS prints the dates without direction isolation, which a stylesheet cannot add. A date format with slashes (`dd/mm/yyyy`, System Settings) prints both dates of the period in one order ([review](docs/team/reviews/a11y-round6.md), finding 3; [evidence](docs/team/evidence/round6/print-fix/)).
- On Frappe v16.52.0 the Salary Slip "Standard" format (core's generated format; HRMS v16.50.0 no longer ships its own) cuts the last column of a table at the page edge in Chrome and overprints column headers in wkhtmltopdf, with or without this theme. Use the Classic, Detailed or Compact salary slip formats ([evidence](docs/team/evidence/round6/hrms-print/)).
- On Frappe 16.32.0 Chrome prints the Salary Slip, Leave Application and Expense Claim "Standard" formats without the document title and number (core; wkhtmltopdf prints them) ([evidence](docs/team/evidence/round6/hrms-print/)).
- PDFs carry no tags, headings or document language in either generator (core merges the header and body pages), and the Arabic text layer of a wkhtmltopdf PDF comes out as separate letters when copied or read aloud. Prefer Chrome where the text of an Arabic PDF must be copied or searched ([review](docs/team/reviews/a11y-round6.md), finding 5).
- The wkhtmltopdf watermark is placed for A4 and Letter; on A5 landscape and A6 it falls below the content or is cut ([evidence](docs/team/evidence/round6/print-fix/)).
- Screen readers and Windows High Contrast were not tested; a formal accessibility audit is still required before production.

[1.0.0]: https://github.com/Hamza-ALsaqaf/institutional_theme/releases/tag/v1.0.0
