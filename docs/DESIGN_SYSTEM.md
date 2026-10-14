# Midad design system

This document describes the Midad theme as built for Frappe 16.32.0. The prose sections are maintained by hand; the tables between the `tokens:begin` and `tokens:end` markers are generated from `design/tokens.json` and must not be edited.

## Thesis and principles

Midad ("ink") is ink on paper, closed with a seal: a calm, authoritative desk for officers who work in it all day and for officials who must trust what it shows. The approved design is in `design/`; `midad` is the default preset in Light and Dark and its values are frozen (ADR 0001, D3).

Conflicts are settled in the order of `docs/BRIEF.md` section 3: correctness and unmistakable state, accessibility, upgrade-safety, density, aesthetics. Aesthetics never wins against the first three. In practice:

- **One status language**: colour, a text label and a CSS-drawn shape, the same everywhere.
- **Brass is a seal, not a colour**: under 5% of a screen, never text.
- **Dark is its own design**: tonal elevation and hairlines, no pure black, no pure white text.
- **Zero core edits**: everything is CSS custom properties, a few selectors and small idempotent scripts in this app.
- **Customisation without risk**: users choose among audited presets; the site may add one custom brand preset generated on the approved lightness curves (ADR 0001, D4, D5).

## Architecture

**Token pipeline.** `design/tokens.json` is the single source. `python -m institutional_theme.midad.build` resolves it with the dependency-free colour package `institutional_theme/midad/` (ADR 0001 D6, ADR 0004) into `institutional_theme/public/scss/generated/`: `_tokens.scss` (the `--ins-*` colours), `_scale.scss` (type, spacing, density, motion), `_frappe_map.scss` (Frappe variables pointed at `var(--ins-…)`) and one `ins_palette_<name>.bundle.scss` per shipped preset. `--check` fails when any generated file is stale. The same package runs the audits (`python -m institutional_theme.audits`) and validates the custom preset on save.

**Bundles.** `ins_desk.bundle.scss` imports the generated partials, then one hand-written partial per concern under `public/scss/desk/`. `ins_web.bundle.scss` serves login and website pages. Both are wrapped in `rtl:begin:ignore` and use logical properties only, so Frappe's rtlcss pass produces an identical RTL file.

**Palette delivery (ADR 0003).** No script runs before the desk splash paints, so a root attribute cannot select a palette in time. Instead, the server hook `update_website_context` appends the user's palette stylesheet (and the site's font file) to `app_include_css`. The palette files hold only `--ins-*` declarations, so a preset changes values, never selectors. A failed hook or a missing asset falls back to `midad`. Changing preset reloads the page. Preferences live in two user defaults, `ins_palette` and `ins_density`; the User doctype is untouched (ADR 0002).

**Cascade (findings section 2).** Core declares its variables at (0,1,0) and lets dark win by source order. The theme never relies on order. Light blocks sit on `html:root`, dark on `html:root[data-theme="dark"]`, Automatic inside `prefers-color-scheme`, and the Frappe mapping one step higher on `html:root[dir]…`, so a later-installed app at (0,1,1) cannot displace it. Because `html:root` also matches a dark root, every key set in Light is set in Dark and Automatic; the parity audit enforces it. Variables that core re-declares on descendants (dialogs, grid rows, charts) are re-declared in `_scoped_variables.scss`.

## Modes, density, RTL and Arabic typography

- **Modes** stay Frappe's `desk_theme` (Light, Dark, Automatic). Each mode block sets `color-scheme`, so native controls and scrollbars follow it.
- **Light-only pages (platform constraint).** Login, 2FA, forgot-password, update-password, the error pages (403, 404, 500, maintenance) and every website and portal page are Light only. Frappe 16.32 renders `data-theme` only on the desk (`www/desk.html:2`); `templates/base.html:3`, which every website page extends, renders `lang` and `dir` and no `data-theme` (findings section 2). The approved design also has no dark login artboard. `ins_web.bundle.scss` therefore imports only the Light token partials (`generated/tokens_light`, `generated/frappe_map_light`). This is a property of the platform, not a dark-parity defect; a user in Dark sees these pages in Light. Print and email are Light by the brief (section 8, "always light regardless of desk mode").
- **Density** is the `data-ins-density` attribute on `<html>`, set by the shell script before the desk is built. Compact lowers the scale tokens (13px base, 28px controls, 48px page head). Under `pointer: coarse` targets grow to 44px in either density. The datatable keeps core's row height: compact changes only padding and type (findings section 5).
- **RTL** needs no mirrored stylesheet. Direction-implying icons are flipped with a transform under `[dir="rtl"]`.
- **Arabic typography** (`desk/_typography.scss`): letter-spacing is forced to 0 for Arabic and RTL documents at (0,6,1), above core's tracking rules; Arabic body and text containers use `--ins-leading-arabic` (1.65), except datatable cells and fixed-height controls; numeric fields, report cells and `kbd` use lining tabular numerals. `font-synthesis: none` prevents synthetic bold and italic (`desk/_base.scss`). Faces are self-hosted under private names (`Midad Plex Sans Arabic`, `Midad Plex Sans`, `Midad Plex Mono`); Arabic and Latin are split by `unicode-range`, so Latin digits come from the Latin face. Size compensation between Arabic and Latin is not implemented as a separate rule: both scripts render at the same nominal size.

## Accessibility approach and limits

Midad is **designed to meet WCAG 2.2 AA; a formal audit is recommended.** No certification is claimed.

- **Contrast** is computed, not eyeballed: every declared pair in `tokens.json` → `contrast.groups` is checked in both modes for every shipped preset, and the build drops any preset that fails (`umber` was dropped this way, STATUS decision 10). Results: section 4 below and `docs/audits/`.
- **Focus**: one ring, an `outline` of `--ins-focus-width` at `--ins-focus-offset`, on every focusable element. Core's grey focus box-shadows are removed so only one ring shows. Inside clipped scroll containers the ring is drawn inset, except on checkboxes and radios. `scroll-padding-block-start` clears the sticky page head.
- **Motion** collapses under `prefers-reduced-motion`; looping spinners get a static busy cue.
- **Forced colours**: focus, selection, selected rows and status pills fall back to system colours. These rules are ASSUMED: Chromium forced-colours emulation was not run.
- **Charts (ADR 0010)**: the default series order is 1, 5, 3, 2, 6, 4, so every neighbouring pair reaches an OKLab distance of 5.0 in every vision type, mode and preset. Direct labels come from the Dashboard Chart setting `show_values_over_chart`. Line series 2-6 carry distinct dash patterns (`desk/_dashboard.scss`; computed values VERIFIED on a synthetic 7-series chart, `docs/team/evidence/phase4/charts/`); bars are never dashed. **Known gaps:** some non-neighbour pairs under grayscale (as low as 0.3) and protanopia (chart-3/6 at 4.4, Dark); series 7 and 8; bar and pie charts carry labels only; no data-table alternative. The colour-vision audit baselines these gaps and fails on any new one.
- **Field errors** carry three cues besides colour; see "Field errors" below.
- **Known gaps**: calendar events in Light keep the colours the user chose, and some fail 4.5:1 (see "Calendar"); in Light the dot events keep core's `!important` blue (`calendar.scss:99`). Printed ERPNext table headers keep ERPNext's grey (see "Print and PDF").

## Field errors

A field in error (core toggles `.has-error` on the control wrapper, `base_input.js:277` for an empty mandatory field and `:286` for an invalid value) carries three cues that do not depend on colour: a 4px inline-start bar, an inner 1px line, and a 16px circle-with-exclamation icon at the inline end of the box (`desk/_controls.scss`). The icon is an SVG mask painted with `--ins-danger`, so it follows the mode and mirrors in RTL; the input reserves room for it, and on Select it sits just inside core's caret. Under forced colours it is painted in `CanvasText`. Hosts: Data, Int, Float, Currency, Link, Dynamic Link, Date, Datetime, Time, Select, Small Text, Text, Percent, Phone. Check, Attach, Text Editor, table and MultiSelect controls have no text box to host it and keep the bar and label colour only. VERIFIED in four mode and language combinations and under forced-colours emulation (`docs/team/evidence/round2/css/`).

## Calendar

FullCalendar draws the event chips; Frappe computes their colours (`calendar.js:431-449`, `prepare_colors`) and FullCalendar writes them as inline `style`, which no selector outranks. Core also resets every chip border with `.fc-event { border: none !important }` (`calendar.scss:65`).

- **Dark**: a neutral raised chip, `--ins-surface-raised` with `--ins-text-strong` (14.52:1) and a 4px inline-start stripe. This is the only place the desk answers inline style with `!important`: four declarations, scoped to `[data-theme="dark"] .fc .fc-event:not(.fc-daygrid-dot-event)` and its `.fc-event-main`, each listed in `docs/DEPENDENCY_MANIFEST.md`. Because core's `border: none` resets the border colour, the stripe takes the text colour: **the per-event colour is not shown in Dark.** Events stay distinct from the grid by surface and stripe, and are told apart by their text. If `calendar.js` stops writing inline colours, the rules can go.
- **Light**: Frappe's own colours are kept, because they are the user's data. The stock pastel colours reach 6.34:1. A strong colour chosen for an event gets Frappe's computed text colour and can fail 4.5:1: red 2.31:1, green 3.31:1 (COMPUTED from the rendered page, `calendar-computed.json`). **Known gap**, controlled by the administrator: choose light event colours, or leave the colour empty for the stock blue.
- Grid lines re-point core's `--gray-300` inside the calendar instead of fighting its `!important` border colour (`calendar.scss:36-43`).

## Print and PDF

Printing is always Light. The app ships two records, both named "Midad", on install and after each migrate (`print/ship.py`): a **Print Style** (fonts, then `.print-format { font-family }`, then the built `ins_print.bundle.css`) and a **Letter Head** (`print/letter_head.html` and `letter_head_footer.html`, filled from `ins_identity()`). Neither is ever made the default and Print Settings is not changed; the administrator chooses them. A record the administrator has edited, deleted or created under the same name is never overwritten or recreated (checksum in the `ins_print_shipped` global). Uninstall deletes an untouched, unlinked record and keeps any other.

- **Standards**: closing rule under the heading; ruled tables with hairline rows; the table header repeats on each page and rows do not split; a double rule above grand total; status as text plus a border shape (`.ins-status-*`); signature blocks (`.ins-signatures`); a verification box for a QR code or code line (`.ins-verify`); figures at the line end; tabular numerals. The bundle uses no custom properties and no logical properties, because QtWebKit reads neither; RTL is written as physical pairs under `[dir="rtl"]` (manifest row).
- **Watermark**: Draft and Cancelled print the word core already emits (`standard_macros.html:215,220`) as a large framed horizontal word, repeated on every page, with a dashed frame for Cancelled. It is not tilted: the patched wkhtmltopdf build ignores `transform`, and one rendering for both generators was preferred. The frame keeps the meaning on a photocopy.
- **Generators**: wkhtmltopdf must be the **0.12.6.1 build with patched Qt**; the distribution package 0.12.6 overflows the page width and does not support the running header and footer. Chrome (`pdf_generator = chrome`, Print Settings "PDF Generator") is supported. Both were rendered for A4 and Letter, English and Arabic, Draft and Cancelled, with Plex fonts embedded (VERIFIED, `docs/team/evidence/round2/print-web/`, `backend2/`). With "Repeat Header and Footer" on, core's Chrome header page shifts the letter head up 12mm with `!important` (`chrome_pdf_header_footer.html`); the bundle compensates on that page only (`body:not([onload])`, manifest row).
- **ERPNext formats are not restyled where they use `!important` or inline style**: header cells of `.items-table` stay ERPNext's grey `#7c7c7c` (bold and ruled), cell padding stays ERPNext's, and the subtotal block keeps its inline `float: right`, so in Arabic it stays on the right. Changing these would need counter-`!important` or an edited format; neither is upgrade-safe (BRIEF section 3, rule 3).

## Email

`ins_email.bundle.scss` is added through the `email_css` hook after core's and ERPNext's entries, and Premailer inlines it into every message. It holds literal values from the Light tokens only (no custom properties, no `@font-face`, no logical properties, no flex or grid), so mail clients read it. Identity: a 4px brand rule on top of the container, a double rule under the masthead, a ruled footer, underlined links, primary buttons in `--ins-primary`, indicator dots in the solid status colours. Type is a system stack; web fonts are not sent. Core's email template sets no `dir`, so each text block uses `unicode-bidi: plaintext` and takes its direction from its first strong character. Rendered in Chromium only; Gmail, Outlook and Apple Mail were not tested.

## Website, portal, login and error pages

Light only (see "Modes"). `ins_web.bundle.scss` styles login and the error pages through ADR 0009's slots, and website and portal pages through `web/_website.scss`, scoped to `body[data-path]:not(.ins-auth):not(.ins-error)`. One rule there uses `!important`: Bootstrap's `.text-muted { color: #7c7c7c !important }` is compiled into core's website bundle at 4.17:1 on white, and only a more specific `!important` can answer it. The theme sets `--ins-text-muted` (6.28:1). Contrast (rule 2) outranks the no-`!important` convention (rule 3); the scope excludes the desk, the auth and the error pages (manifest row). The bundle is 59.7 KB raw against its 60 KB budget.

## Opt-in behaviours

Two shell behaviours are shipped **disabled** and are switched on in Institutional Theme Settings (BRIEF section 8: behaviour, not skin):

- **Idle warning** ("Warn before the session expires", with "Minutes of warning", default 5): after the chosen idle time, and never later than 60 seconds before the session length, an `alertdialog` says the session may end. Only its button clears it; the button makes one request (`frappe.auth.get_logged_user`) that refreshes the session. Input does not clear it, because input does not refresh the session.
- **Connection banner** ("Show a banner when the connection is lost"): a calm `role="status"` banner at the top of the page when the browser goes offline or the realtime socket drops, and "The connection is back." for four seconds on return. Core's own "Connection lost" toast still appears.

Both are VERIFIED with a fake clock and a stand-in socket, not against a real socket.io server or a real session expiry.

<!-- tokens:begin -->
## 1. Primitive ramps

Generated from `institutional_theme/midad/generated/model.json`, `institutional_theme/public/scss/generated/_tokens.scss`.

### ink

Dark block equals Light block for every step: yes.

| Step | Light hex |
|---|---|

### brass

Dark block equals Light block for every step: yes.

| Step | Light hex |
|---|---|

### slate

Dark block equals Light block for every step: yes.

| Step | Light hex |
|---|---|
| 50 | #f7f9fc |
| 100 | #f1f4f8 |
| 200 | #e8ebf1 |
| 300 | #dadee5 |
| 400 | #b8bec7 |
| 450 | #858d97 |
| 500 | #6a727d |
| 600 | #58616d |
| 700 | #424b57 |
| 800 | #28313c |
| 900 | #141b25 |
| 950 | #091018 |

### night

Dark block equals Light block for every step: yes.

| Step | Light hex |
|---|---|
| 50 | #eceff2 |
| 100 | #dfe3e8 |
| 200 | #d0d5db |
| 300 | #b9bec6 |
| 400 | #9da4ac |
| 500 | #6f7781 |
| 600 | #4b535e |
| 700 | #2e3641 |
| 800 | #1d252f |
| 850 | #171e28 |
| 900 | #111820 |
| 950 | #0b1119 |

### red

Dark block equals Light block for every step: yes.

| Step | Light hex |
|---|---|
| 50 | #fff4f3 |
| 100 | #ffe6e4 |
| 200 | #ffcfca |
| 300 | #ffada6 |
| 400 | #fb7e77 |
| 500 | #e15552 |
| 600 | #be3737 |
| 700 | #992225 |
| 800 | #741417 |
| 900 | #510b0d |
| 950 | #3a0b0b |

### orange

Dark block equals Light block for every step: yes.

| Step | Light hex |
|---|---|
| 50 | #fff4ef |
| 100 | #ffe7db |
| 200 | #ffd1b9 |
| 300 | #fab38b |
| 400 | #eb8f59 |
| 500 | #d06b26 |
| 600 | #ae5000 |
| 700 | #883c00 |
| 800 | #652b00 |
| 900 | #471b00 |
| 950 | #341300 |

### amber

Dark block equals Light block for every step: yes.

| Step | Light hex |
|---|---|
| 50 | #fff7ee |
| 100 | #ffedd8 |
| 200 | #ffddb3 |
| 300 | #ffc781 |
| 400 | #f3ae4f |
| 500 | #dc9322 |
| 600 | #b37400 |
| 700 | #885700 |
| 800 | #643f00 |
| 900 | #452a00 |
| 950 | #301b00 |

### yellow

Dark block equals Light block for every step: yes.

| Step | Light hex |
|---|---|
| 50 | #fdf8ea |
| 100 | #faf0d2 |
| 200 | #f4e2ae |
| 300 | #ebd182 |
| 400 | #dbbb54 |
| 500 | #c3a12a |
| 600 | #9e8002 |
| 700 | #786000 |
| 800 | #584600 |
| 900 | #3c2f00 |

### green

Dark block equals Light block for every step: yes.

| Step | Light hex |
|---|---|
| 50 | #f0f9f4 |
| 100 | #def3e6 |
| 200 | #c0e8cf |
| 300 | #98d6b1 |
| 400 | #68be8f |
| 500 | #37a16d |
| 600 | #0e8352 |
| 700 | #00663e |
| 800 | #004c2c |
| 900 | #00341d |
| 950 | #022514 |

### teal

Dark block equals Light block for every step: yes.

| Step | Light hex |
|---|---|
| 50 | #f0f9f8 |
| 100 | #ddf2ef |
| 200 | #bee6e1 |
| 300 | #94d4ce |
| 400 | #61bbb3 |
| 500 | #2a9e96 |
| 600 | #008079 |
| 700 | #00635d |
| 800 | #004945 |
| 900 | #00322f |

### cyan

Dark block equals Light block for every step: yes.

| Step | Light hex |
|---|---|
| 50 | #eff9fb |
| 100 | #ddf1f7 |
| 200 | #bde4f0 |
| 300 | #92d1e4 |
| 400 | #5eb7d0 |
| 500 | #259ab5 |
| 600 | #007c94 |
| 700 | #006073 |
| 800 | #004656 |
| 900 | #00303b |
| 950 | #00232c |

### blue

Dark block equals Light block for every step: yes.

| Step | Light hex |
|---|---|
| 50 | #f0f8ff |
| 100 | #dfefff |
| 200 | #c1e0ff |
| 300 | #96cbff |
| 400 | #60aff8 |
| 500 | #2d90e0 |
| 600 | #0072be |
| 700 | #005895 |
| 800 | #004170 |
| 900 | #002c4f |
| 950 | #001f3a |

### violet

Dark block equals Light block for every step: yes.

| Step | Light hex |
|---|---|
| 50 | #f6f6ff |
| 100 | #eaebff |
| 200 | #d8d8ff |
| 300 | #bfbeff |
| 400 | #a19ef4 |
| 500 | #837cdb |
| 600 | #6860ba |
| 700 | #504896 |
| 800 | #3a3472 |
| 900 | #272250 |
| 950 | #1c1938 |

### purple

Dark block equals Light block for every step: yes.

| Step | Light hex |
|---|---|
| 50 | #faf4fe |
| 100 | #f4e7fc |
| 200 | #ead2f9 |
| 300 | #dab5f2 |
| 400 | #c392e1 |
| 500 | #a76fc7 |
| 600 | #8954a8 |
| 700 | #6c3d86 |
| 800 | #502b65 |
| 900 | #371c47 |

### pink

Dark block equals Light block for every step: yes.

| Step | Light hex |
|---|---|
| 50 | #fff3f8 |
| 100 | #fee5ef |
| 200 | #fdcde0 |
| 300 | #f5adcc |
| 400 | #e487b1 |
| 500 | #c96393 |
| 600 | #a84877 |
| 700 | #86335c |
| 800 | #652244 |
| 900 | #46152e |
| 950 | #321121 |

## 2. Semantic tokens

Generated from `institutional_theme/midad/generated/model.json`, `institutional_theme/public/scss/generated/_tokens.scss`.

| Token | Group | Light value | Dark value |
|---|---|---|---|
| `--ins-surface-base` | surface | #ffffff | #111820 |
| `--ins-surface-sunken` | surface | #f7f9fc | #0b1119 |
| `--ins-surface-raised` | surface | #ffffff | #171e28 |
| `--ins-surface-overlay` | surface | #ffffff | #1d252f |
| `--ins-surface-hover` | surface | #f1f4f8 | #252c37 |
| `--ins-surface-active` | surface | #e8ebf1 | #2e3641 |
| `--ins-surface-selected` | surface | #f2f7fe | #1a2f46 |
| `--ins-surface-selected-strong` | surface | #e4effd | #1f3c5b |
| `--ins-surface-fill` | surface | #f1f4f8 | #1d252f |
| `--ins-surface-fill-hover` | surface | #e8ebf1 | #252c37 |
| `--ins-surface-field` | surface | #ffffff | #0b1119 |
| `--ins-surface-disabled` | surface | #f1f4f8 | #171e28 |
| `--ins-surface-inverse` | surface | #141b25 | #dfe3e8 |
| `--ins-surface-scrim` | surface | rgba(9, 16, 24, 0.45) | rgba(5, 8, 12, 0.7) |
| `--ins-text-strong` | text | #141b25 | #eceff2 |
| `--ins-text` | text | #28313c | #dfe3e8 |
| `--ins-text-secondary` | text | #424b57 | #b9bec6 |
| `--ins-text-muted` | text | #58616d | #9da4ac |
| `--ins-text-placeholder` | text | #6a727d | #899099 |
| `--ins-text-disabled` | text | #6a727d | #6f7781 |
| `--ins-text-inverse` | text | #ffffff | #0b1119 |
| `--ins-text-link` | text | #005895 | #96cbff |
| `--ins-text-link-hover` | text | #004170 | #c1e0ff |
| `--ins-text-brand` | text | #0f3a65 | #cae0f9 |
| `--ins-border-hairline` | border | #e8ebf1 | #252c37 |
| `--ins-border` | border | #dadee5 | #2e3641 |
| `--ins-border-strong` | border | #b8bec7 | #4b535e |
| `--ins-border-control` | border | #858d97 | #6f7781 |
| `--ins-border-control-hover` | border | #58616d | #9da4ac |
| `--ins-brand` | action | #0f3a65 | #a7c9f0 |
| `--ins-primary` | action | #1b5086 | #a7c9f0 |
| `--ins-primary-hover` | action | #0f3a65 | #cae0f9 |
| `--ins-primary-active` | action | #082644 | #e4effd |
| `--ins-on-primary` | action | #ffffff | #061a30 |
| `--ins-primary-text` | action | #1b5086 | #a7c9f0 |
| `--ins-primary-subtle` | action | #f2f7fe | #1a2f46 |
| `--ins-primary-subtle-border` | action | #cae0f9 | #0f3a65 |
| `--ins-danger` | action | #be3737 | #fb7e77 |
| `--ins-danger-hover` | action | #992225 | #ffada6 |
| `--ins-on-danger` | action | #ffffff | #3a0b0b |
| `--ins-accent` | action | #997324 | #d5ae63 |
| `--ins-accent-text` | action | #573f0c | #f3ddb5 |
| `--ins-accent-subtle` | action | #fcf6eb | #2f2512 |
| `--ins-focus` | action | #2f6aa7 | #a7c9f0 |
| `--ins-status-neutral-bg` | status | #f1f4f8 | #1d252f |
| `--ins-status-neutral-fg` | status | #424b57 | #d0d5db |
| `--ins-status-neutral-border` | status | #b8bec7 | #4b535e |
| `--ins-status-neutral-solid` | status | #6a727d | #9da4ac |
| `--ins-status-muted-bg` | status | #dadee5 | #4b535e |
| `--ins-status-muted-fg` | status | #141b25 | #eceff2 |
| `--ins-status-muted-border` | status | #6a727d | #899099 |
| `--ins-status-muted-solid` | status | #424b57 | #b9bec6 |
| `--ins-status-progress-bg` | status | #dfefff | #002c4f |
| `--ins-status-progress-fg` | status | #004170 | #c1e0ff |
| `--ins-status-progress-border` | status | #96cbff | #005895 |
| `--ins-status-progress-solid` | status | #0072be | #60aff8 |
| `--ins-status-info-bg` | status | #ddf1f7 | #00303b |
| `--ins-status-info-fg` | status | #004656 | #bde4f0 |
| `--ins-status-info-border` | status | #92d1e4 | #006073 |
| `--ins-status-info-solid` | status | #007c94 | #5eb7d0 |
| `--ins-status-teal-bg` | status | #ddf2ef | #00322f |
| `--ins-status-teal-fg` | status | #004945 | #bee6e1 |
| `--ins-status-teal-border` | status | #94d4ce | #00635d |
| `--ins-status-teal-solid` | status | #008079 | #61bbb3 |
| `--ins-status-success-bg` | status | #def3e6 | #00341d |
| `--ins-status-success-fg` | status | #004c2c | #c0e8cf |
| `--ins-status-success-border` | status | #98d6b1 | #00663e |
| `--ins-status-success-solid` | status | #0e8352 | #68be8f |
| `--ins-status-pending-bg` | status | #ffe7db | #471b00 |
| `--ins-status-pending-fg` | status | #652b00 | #ffd1b9 |
| `--ins-status-pending-border` | status | #fab38b | #883c00 |
| `--ins-status-pending-solid` | status | #ae5000 | #eb8f59 |
| `--ins-status-warning-bg` | status | #faf0d2 | #3c2f00 |
| `--ins-status-warning-fg` | status | #584600 | #f4e2ae |
| `--ins-status-warning-border` | status | #dbbb54 | #786000 |
| `--ins-status-warning-solid` | status | #9e8002 | #dbbb54 |
| `--ins-status-danger-bg` | status | #ffe6e4 | #510b0d |
| `--ins-status-danger-fg` | status | #741417 | #ffcfca |
| `--ins-status-danger-border` | status | #ffada6 | #992225 |
| `--ins-status-danger-solid` | status | #be3737 | #fb7e77 |
| `--ins-status-special-bg` | status | #eaebff | #272250 |
| `--ins-status-special-fg` | status | #3a3472 | #d8d8ff |
| `--ins-status-special-border` | status | #bfbeff | #504896 |
| `--ins-status-special-solid` | status | #6860ba | #a19ef4 |
| `--ins-status-plum-bg` | status | #fee5ef | #46152e |
| `--ins-status-plum-fg` | status | #652244 | #fdcde0 |
| `--ins-status-plum-border` | status | #f5adcc | #86335c |
| `--ins-status-plum-solid` | status | #a84877 | #e487b1 |
| `--ins-status-ink-bg` | status | #cae0f9 | #0f3a65 |
| `--ins-status-ink-fg` | status | #082644 | #e4effd |
| `--ins-feedback-info-bg` | feedback | #f0f8ff | #001f3a |
| `--ins-feedback-info-fg` | feedback | #004170 | #c1e0ff |
| `--ins-feedback-success-bg` | feedback | #f0f9f4 | #022514 |
| `--ins-feedback-success-fg` | feedback | #004c2c | #c0e8cf |
| `--ins-feedback-warning-bg` | feedback | #fdf8ea | #291f00 |
| `--ins-feedback-warning-fg` | feedback | #584600 | #f4e2ae |
| `--ins-feedback-pending-bg` | feedback | #fff4ef | #341300 |
| `--ins-feedback-pending-fg` | feedback | #652b00 | #ffd1b9 |
| `--ins-feedback-danger-bg` | feedback | #fff4f3 | #3a0b0b |
| `--ins-feedback-danger-fg` | feedback | #741417 | #ffcfca |
| `--ins-mark-bg` | feedback | #f4e2ae | #584600 |
| `--ins-chart-1` | chart | #1b5086 | #a7c9f0 |
| `--ins-chart-2` | chart | #885700 | #dc9322 |
| `--ins-chart-3` | chart | #008079 | #2a9e96 |
| `--ins-chart-4` | chart | #741417 | #fb7e77 |
| `--ins-chart-5` | chart | #a76fc7 | #c392e1 |
| `--ins-chart-6` | chart | #d06b26 | #ae5000 |
| `--ins-chart-7` | chart | #007c94 | #92d1e4 |
| `--ins-chart-8` | chart | #858d97 | #899099 |
| `--ins-chart-grid` | chart | #e8ebf1 | #252c37 |
| `--ins-chart-axis` | chart | #b8bec7 | #4b535e |
| `--ins-chart-label` | chart | #424b57 | #b9bec6 |
| `--ins-chart-seq-1` | chart | #e4effd | #082644 |
| `--ins-chart-seq-2` | chart | #a7c9f0 | #0f3a65 |
| `--ins-chart-seq-3` | chart | #5088c5 | #2f6aa7 |
| `--ins-chart-seq-4` | chart | #1b5086 | #7baadf |
| `--ins-chart-seq-5` | chart | #082644 | #cae0f9 |
| `--ins-chart-div-neg-2` | chart | #883c00 | #eb8f59 |
| `--ins-chart-div-neg-1` | chart | #fab38b | #883c00 |
| `--ins-chart-div-mid` | chart | #e8ebf1 | #4b535e |
| `--ins-chart-div-pos-1` | chart | #a7c9f0 | #1b5086 |
| `--ins-chart-div-pos-2` | chart | #1b5086 | #a7c9f0 |
| `--ins-elevation-raised` | elevation | 0 1px 2px rgba(9, 16, 24, 0.06), 0 1px 1px rgba(9, 16, 24, 0.04) | none |
| `--ins-elevation-overlay` | elevation | 0 6px 16px rgba(9, 16, 24, 0.1), 0 1px 3px rgba(9, 16, 24, 0.08) | 0 0 0 1px #2e3641 |
| `--ins-elevation-dialog` | elevation | 0 20px 48px rgba(9, 16, 24, 0.18), 0 4px 12px rgba(9, 16, 24, 0.08) | 0 0 0 1px #4b535e |
| `--ins-scroll-shadow-start` | elevation | inset 8px 0 6px -6px rgba(9, 16, 24, 0.14) | inset 1px 0 0 0 #4b535e |
| `--ins-scroll-shadow-end` | elevation | inset -8px 0 6px -6px rgba(9, 16, 24, 0.14) | inset -1px 0 0 0 #4b535e |

## 3. Frappe variable map

Generated from `institutional_theme/midad/generated/model.json`, `institutional_theme/public/scss/generated/_frappe_map.scss`, `institutional_theme/public/scss/generated/_tokens.scss`.

Rows follow the emitted light block of `_frappe_map.scss`; every name in model.json `frappe.vars` must appear there.

| Frappe variable | Light source | Light value | Dark source | Dark value |
|---|---|---|---|---|
| `--gray-50` | `--ins-slate-50` | #f7f9fc | `--ins-night-50` | #eceff2 |
| `--gray-100` | `--ins-slate-100` | #f1f4f8 | `--ins-night-100` | #dfe3e8 |
| `--gray-200` | `--ins-slate-200` | #e8ebf1 | `--ins-night-200` | #d0d5db |
| `--gray-300` | `--ins-slate-300` | #dadee5 | `--ins-night-300` | #b9bec6 |
| `--gray-400` | `--ins-slate-400` | #b8bec7 | `--ins-night-400` | #9da4ac |
| `--gray-500` | `--ins-slate-500` | #6a727d | `--ins-night-500` | #6f7781 |
| `--gray-600` | `--ins-slate-600` | #58616d | `--ins-night-600` | #4b535e |
| `--gray-700` | `--ins-slate-700` | #424b57 | `--ins-night-700` | #2e3641 |
| `--gray-800` | `--ins-slate-800` | #28313c | `--ins-night-800` | #1d252f |
| `--gray-900` | `--ins-slate-900` | #141b25 | `--ins-night-900` | #111820 |
| `--blue-50` | `--ins-blue-50` | #f0f8ff | `--ins-blue-50` | #f0f8ff |
| `--blue-100` | `--ins-blue-100` | #dfefff | `--ins-blue-100` | #dfefff |
| `--blue-200` | `--ins-blue-200` | #c1e0ff | `--ins-blue-200` | #c1e0ff |
| `--blue-300` | `--ins-blue-300` | #96cbff | `--ins-blue-300` | #96cbff |
| `--blue-400` | `--ins-blue-400` | #60aff8 | `--ins-blue-400` | #60aff8 |
| `--blue-500` | `--ins-blue-500` | #2d90e0 | `--ins-blue-500` | #2d90e0 |
| `--blue-600` | `--ins-blue-600` | #0072be | `--ins-blue-600` | #0072be |
| `--blue-700` | `--ins-blue-700` | #005895 | `--ins-blue-700` | #005895 |
| `--blue-800` | `--ins-blue-800` | #004170 | `--ins-blue-800` | #004170 |
| `--blue-900` | `--ins-blue-900` | #002c4f | `--ins-blue-900` | #002c4f |
| `--green-50` | `--ins-green-50` | #f0f9f4 | `--ins-green-50` | #f0f9f4 |
| `--green-100` | `--ins-green-100` | #def3e6 | `--ins-green-100` | #def3e6 |
| `--green-200` | `--ins-green-200` | #c0e8cf | `--ins-green-200` | #c0e8cf |
| `--green-300` | `--ins-green-300` | #98d6b1 | `--ins-green-300` | #98d6b1 |
| `--green-400` | `--ins-green-400` | #68be8f | `--ins-green-400` | #68be8f |
| `--green-500` | `--ins-green-500` | #37a16d | `--ins-green-500` | #37a16d |
| `--green-600` | `--ins-green-600` | #0e8352 | `--ins-green-600` | #0e8352 |
| `--green-700` | `--ins-green-700` | #00663e | `--ins-green-700` | #00663e |
| `--green-800` | `--ins-green-800` | #004c2c | `--ins-green-800` | #004c2c |
| `--green-900` | `--ins-green-900` | #00341d | `--ins-green-900` | #00341d |
| `--red-50` | `--ins-red-50` | #fff4f3 | `--ins-red-50` | #fff4f3 |
| `--red-100` | `--ins-red-100` | #ffe6e4 | `--ins-red-100` | #ffe6e4 |
| `--red-200` | `--ins-red-200` | #ffcfca | `--ins-red-200` | #ffcfca |
| `--red-300` | `--ins-red-300` | #ffada6 | `--ins-red-300` | #ffada6 |
| `--red-400` | `--ins-red-400` | #fb7e77 | `--ins-red-400` | #fb7e77 |
| `--red-500` | `--ins-red-500` | #e15552 | `--ins-red-500` | #e15552 |
| `--red-600` | `--ins-red-600` | #be3737 | `--ins-red-600` | #be3737 |
| `--red-700` | `--ins-red-700` | #992225 | `--ins-red-700` | #992225 |
| `--red-800` | `--ins-red-800` | #741417 | `--ins-red-800` | #741417 |
| `--red-900` | `--ins-red-900` | #510b0d | `--ins-red-900` | #510b0d |
| `--orange-50` | `--ins-orange-50` | #fff4ef | `--ins-orange-50` | #fff4ef |
| `--orange-100` | `--ins-orange-100` | #ffe7db | `--ins-orange-100` | #ffe7db |
| `--orange-200` | `--ins-orange-200` | #ffd1b9 | `--ins-orange-200` | #ffd1b9 |
| `--orange-300` | `--ins-orange-300` | #fab38b | `--ins-orange-300` | #fab38b |
| `--orange-400` | `--ins-orange-400` | #eb8f59 | `--ins-orange-400` | #eb8f59 |
| `--orange-500` | `--ins-orange-500` | #d06b26 | `--ins-orange-500` | #d06b26 |
| `--orange-600` | `--ins-orange-600` | #ae5000 | `--ins-orange-600` | #ae5000 |
| `--orange-700` | `--ins-orange-700` | #883c00 | `--ins-orange-700` | #883c00 |
| `--orange-800` | `--ins-orange-800` | #652b00 | `--ins-orange-800` | #652b00 |
| `--orange-900` | `--ins-orange-900` | #471b00 | `--ins-orange-900` | #471b00 |
| `--amber-50` | `--ins-amber-50` | #fff7ee | `--ins-amber-50` | #fff7ee |
| `--amber-100` | `--ins-amber-100` | #ffedd8 | `--ins-amber-100` | #ffedd8 |
| `--amber-200` | `--ins-amber-200` | #ffddb3 | `--ins-amber-200` | #ffddb3 |
| `--amber-300` | `--ins-amber-300` | #ffc781 | `--ins-amber-300` | #ffc781 |
| `--amber-400` | `--ins-amber-400` | #f3ae4f | `--ins-amber-400` | #f3ae4f |
| `--amber-500` | `--ins-amber-500` | #dc9322 | `--ins-amber-500` | #dc9322 |
| `--amber-600` | `--ins-amber-600` | #b37400 | `--ins-amber-600` | #b37400 |
| `--amber-700` | `--ins-amber-700` | #885700 | `--ins-amber-700` | #885700 |
| `--amber-800` | `--ins-amber-800` | #643f00 | `--ins-amber-800` | #643f00 |
| `--amber-900` | `--ins-amber-900` | #452a00 | `--ins-amber-900` | #452a00 |
| `--yellow-50` | `--ins-yellow-50` | #fdf8ea | `--ins-yellow-50` | #fdf8ea |
| `--yellow-100` | `--ins-yellow-100` | #faf0d2 | `--ins-yellow-100` | #faf0d2 |
| `--yellow-200` | `--ins-yellow-200` | #f4e2ae | `--ins-yellow-200` | #f4e2ae |
| `--yellow-300` | `--ins-yellow-300` | #ebd182 | `--ins-yellow-300` | #ebd182 |
| `--yellow-400` | `--ins-yellow-400` | #dbbb54 | `--ins-yellow-400` | #dbbb54 |
| `--yellow-500` | `--ins-yellow-500` | #c3a12a | `--ins-yellow-500` | #c3a12a |
| `--yellow-600` | `--ins-yellow-600` | #9e8002 | `--ins-yellow-600` | #9e8002 |
| `--yellow-700` | `--ins-yellow-700` | #786000 | `--ins-yellow-700` | #786000 |
| `--yellow-800` | `--ins-yellow-800` | #584600 | `--ins-yellow-800` | #584600 |
| `--yellow-900` | `--ins-yellow-900` | #3c2f00 | `--ins-yellow-900` | #3c2f00 |
| `--cyan-50` | `--ins-cyan-50` | #eff9fb | `--ins-cyan-50` | #eff9fb |
| `--cyan-100` | `--ins-cyan-100` | #ddf1f7 | `--ins-cyan-100` | #ddf1f7 |
| `--cyan-200` | `--ins-cyan-200` | #bde4f0 | `--ins-cyan-200` | #bde4f0 |
| `--cyan-300` | `--ins-cyan-300` | #92d1e4 | `--ins-cyan-300` | #92d1e4 |
| `--cyan-400` | `--ins-cyan-400` | #5eb7d0 | `--ins-cyan-400` | #5eb7d0 |
| `--cyan-500` | `--ins-cyan-500` | #259ab5 | `--ins-cyan-500` | #259ab5 |
| `--cyan-600` | `--ins-cyan-600` | #007c94 | `--ins-cyan-600` | #007c94 |
| `--cyan-700` | `--ins-cyan-700` | #006073 | `--ins-cyan-700` | #006073 |
| `--cyan-800` | `--ins-cyan-800` | #004656 | `--ins-cyan-800` | #004656 |
| `--cyan-900` | `--ins-cyan-900` | #00303b | `--ins-cyan-900` | #00303b |
| `--teal-50` | `--ins-teal-50` | #f0f9f8 | `--ins-teal-50` | #f0f9f8 |
| `--teal-100` | `--ins-teal-100` | #ddf2ef | `--ins-teal-100` | #ddf2ef |
| `--teal-200` | `--ins-teal-200` | #bee6e1 | `--ins-teal-200` | #bee6e1 |
| `--teal-300` | `--ins-teal-300` | #94d4ce | `--ins-teal-300` | #94d4ce |
| `--teal-400` | `--ins-teal-400` | #61bbb3 | `--ins-teal-400` | #61bbb3 |
| `--teal-500` | `--ins-teal-500` | #2a9e96 | `--ins-teal-500` | #2a9e96 |
| `--teal-600` | `--ins-teal-600` | #008079 | `--ins-teal-600` | #008079 |
| `--teal-700` | `--ins-teal-700` | #00635d | `--ins-teal-700` | #00635d |
| `--teal-800` | `--ins-teal-800` | #004945 | `--ins-teal-800` | #004945 |
| `--teal-900` | `--ins-teal-900` | #00322f | `--ins-teal-900` | #00322f |
| `--violet-50` | `--ins-violet-50` | #f6f6ff | `--ins-violet-50` | #f6f6ff |
| `--violet-100` | `--ins-violet-100` | #eaebff | `--ins-violet-100` | #eaebff |
| `--violet-200` | `--ins-violet-200` | #d8d8ff | `--ins-violet-200` | #d8d8ff |
| `--violet-300` | `--ins-violet-300` | #bfbeff | `--ins-violet-300` | #bfbeff |
| `--violet-400` | `--ins-violet-400` | #a19ef4 | `--ins-violet-400` | #a19ef4 |
| `--violet-500` | `--ins-violet-500` | #837cdb | `--ins-violet-500` | #837cdb |
| `--violet-600` | `--ins-violet-600` | #6860ba | `--ins-violet-600` | #6860ba |
| `--violet-700` | `--ins-violet-700` | #504896 | `--ins-violet-700` | #504896 |
| `--violet-800` | `--ins-violet-800` | #3a3472 | `--ins-violet-800` | #3a3472 |
| `--violet-900` | `--ins-violet-900` | #272250 | `--ins-violet-900` | #272250 |
| `--pink-50` | `--ins-pink-50` | #fff3f8 | `--ins-pink-50` | #fff3f8 |
| `--pink-100` | `--ins-pink-100` | #fee5ef | `--ins-pink-100` | #fee5ef |
| `--pink-200` | `--ins-pink-200` | #fdcde0 | `--ins-pink-200` | #fdcde0 |
| `--pink-300` | `--ins-pink-300` | #f5adcc | `--ins-pink-300` | #f5adcc |
| `--pink-400` | `--ins-pink-400` | #e487b1 | `--ins-pink-400` | #e487b1 |
| `--pink-500` | `--ins-pink-500` | #c96393 | `--ins-pink-500` | #c96393 |
| `--pink-600` | `--ins-pink-600` | #a84877 | `--ins-pink-600` | #a84877 |
| `--pink-700` | `--ins-pink-700` | #86335c | `--ins-pink-700` | #86335c |
| `--pink-800` | `--ins-pink-800` | #652244 | `--ins-pink-800` | #652244 |
| `--pink-900` | `--ins-pink-900` | #46152e | `--ins-pink-900` | #46152e |
| `--purple-50` | `--ins-purple-50` | #faf4fe | `--ins-purple-50` | #faf4fe |
| `--purple-100` | `--ins-purple-100` | #f4e7fc | `--ins-purple-100` | #f4e7fc |
| `--purple-200` | `--ins-purple-200` | #ead2f9 | `--ins-purple-200` | #ead2f9 |
| `--purple-300` | `--ins-purple-300` | #dab5f2 | `--ins-purple-300` | #dab5f2 |
| `--purple-400` | `--ins-purple-400` | #c392e1 | `--ins-purple-400` | #c392e1 |
| `--purple-500` | `--ins-purple-500` | #a76fc7 | `--ins-purple-500` | #a76fc7 |
| `--purple-600` | `--ins-purple-600` | #8954a8 | `--ins-purple-600` | #8954a8 |
| `--purple-700` | `--ins-purple-700` | #6c3d86 | `--ins-purple-700` | #6c3d86 |
| `--purple-800` | `--ins-purple-800` | #502b65 | `--ins-purple-800` | #502b65 |
| `--purple-900` | `--ins-purple-900` | #371c47 | `--ins-purple-900` | #371c47 |
| `--neutral` | `--ins-surface-base` | #ffffff | `--ins-surface-base` | #111820 |
| `--invert-neutral` | `--ins-text-strong` | #141b25 | `--ins-text-strong` | #eceff2 |
| `--neutral-black` | `--ins-slate-950` | #091018 | `--ins-slate-950` | #091018 |
| `--surface-white` | `--ins-surface-base` | #ffffff | `--ins-surface-base` | #111820 |
| `--surface-gray-1` | `--ins-surface-sunken` | #f7f9fc | `--ins-surface-raised` | #171e28 |
| `--surface-gray-2` | `--ins-surface-hover` | #f1f4f8 | `--ins-surface-hover` | #252c37 |
| `--surface-gray-3` | `--ins-surface-active` | #e8ebf1 | `--ins-surface-active` | #2e3641 |
| `--surface-gray-4` | `--ins-slate-300` | #dadee5 | `--ins-night-600` | #4b535e |
| `--surface-gray-5` | `--ins-slate-700` | #424b57 | `--ins-night-300` | #b9bec6 |
| `--surface-gray-6` | `--ins-slate-800` | #28313c | `--ins-night-200` | #d0d5db |
| `--surface-gray-7` | `--ins-slate-900` | #141b25 | `--ins-night-50` | #eceff2 |
| `--surface-menu-bar` | `--ins-surface-sunken` | #f7f9fc | `--ins-surface-sunken` | #0b1119 |
| `--surface-modal` | `--ins-surface-overlay` | #ffffff | `--ins-surface-overlay` | #1d252f |
| `--surface-cards` | `--ins-surface-raised` | #ffffff | `--ins-surface-raised` | #171e28 |
| `--surface-selected` | `--ins-surface-active` | #e8ebf1 | `--ins-surface-active` | #2e3641 |
| `--surface-red-1` | `--ins-red-50` | #fff4f3 | `--ins-red-950` | #3a0b0b |
| `--surface-red-2` | `--ins-red-100` | #ffe6e4 | `--ins-red-900` | #510b0d |
| `--surface-red-3` | `--ins-red-200` | #ffcfca | `--ins-red-800` | #741417 |
| `--surface-red-4` | `--ins-red-300` | #ffada6 | `--ins-red-700` | #992225 |
| `--surface-red-5` | `--ins-red-600` | #be3737 | `--ins-red-400` | #fb7e77 |
| `--surface-red-6` | `--ins-red-700` | #992225 | `--ins-red-300` | #ffada6 |
| `--surface-red-7` | `--ins-red-800` | #741417 | `--ins-red-200` | #ffcfca |
| `--surface-green-1` | `--ins-green-50` | #f0f9f4 | `--ins-green-950` | #022514 |
| `--surface-green-2` | `--ins-green-100` | #def3e6 | `--ins-green-900` | #00341d |
| `--surface-green-3` | `--ins-green-600` | #0e8352 | `--ins-green-400` | #68be8f |
| `--surface-amber-1` | `--ins-amber-50` | #fff7ee | `--ins-amber-950` | #301b00 |
| `--surface-amber-2` | `--ins-amber-100` | #ffedd8 | `--ins-amber-900` | #452a00 |
| `--surface-amber-3` | `--ins-amber-600` | #b37400 | `--ins-amber-400` | #f3ae4f |
| `--surface-blue-1` | `--ins-blue-50` | #f0f8ff | `--ins-blue-950` | #001f3a |
| `--surface-blue-2` | `--ins-blue-100` | #dfefff | `--ins-blue-900` | #002c4f |
| `--surface-blue-3` | `--ins-blue-600` | #0072be | `--ins-blue-400` | #60aff8 |
| `--surface-orange-1` | `--ins-orange-50` | #fff4ef | `--ins-orange-950` | #341300 |
| `--surface-violet-1` | `--ins-violet-50` | #f6f6ff | `--ins-violet-950` | #1c1938 |
| `--surface-cyan-1` | `--ins-cyan-50` | #eff9fb | `--ins-cyan-950` | #00232c |
| `--surface-pink-1` | `--ins-pink-50` | #fff3f8 | `--ins-pink-950` | #321121 |
| `--ink-white` | literal | #ffffff | `--ins-night-950` | #0b1119 |
| `--ink-gray-1` | `--ins-slate-200` | #e8ebf1 | `--ins-night-800` | #1d252f |
| `--ink-gray-2` | `--ins-slate-300` | #dadee5 | `--ins-night-700` | #2e3641 |
| `--ink-gray-3` | `--ins-slate-400` | #b8bec7 | `--ins-night-600` | #4b535e |
| `--ink-gray-4` | `--ins-text-placeholder` | #6a727d | `--ins-text-placeholder` | #899099 |
| `--ink-gray-5` | `--ins-text-muted` | #58616d | `--ins-text-muted` | #9da4ac |
| `--ink-gray-6` | `--ins-text-secondary` | #424b57 | `--ins-text-secondary` | #b9bec6 |
| `--ink-gray-7` | `--ins-text-secondary` | #424b57 | `--ins-text-secondary` | #b9bec6 |
| `--ink-gray-8` | `--ins-text` | #28313c | `--ins-text` | #dfe3e8 |
| `--ink-gray-9` | `--ins-text-strong` | #141b25 | `--ins-text-strong` | #eceff2 |
| `--ink-red-1` | `--ins-red-50` | #fff4f3 | `--ins-red-950` | #3a0b0b |
| `--ink-red-2` | `--ins-red-300` | #ffada6 | `--ins-red-700` | #992225 |
| `--ink-red-3` | `--ins-red-600` | #be3737 | `--ins-red-400` | #fb7e77 |
| `--ink-red-4` | `--ins-red-700` | #992225 | `--ins-red-300` | #ffada6 |
| `--ink-green-1` | `--ins-green-50` | #f0f9f4 | `--ins-green-950` | #022514 |
| `--ink-green-2` | `--ins-green-600` | #0e8352 | `--ins-green-400` | #68be8f |
| `--ink-green-3` | `--ins-green-700` | #00663e | `--ins-green-300` | #98d6b1 |
| `--ink-amber-1` | `--ins-amber-50` | #fff7ee | `--ins-amber-950` | #301b00 |
| `--ink-amber-2` | `--ins-amber-600` | #b37400 | `--ins-amber-400` | #f3ae4f |
| `--ink-amber-3` | `--ins-amber-700` | #885700 | `--ins-amber-300` | #ffc781 |
| `--ink-blue-1` | `--ins-blue-50` | #f0f8ff | `--ins-blue-950` | #001f3a |
| `--ink-blue-2` | `--ins-blue-600` | #0072be | `--ins-blue-400` | #60aff8 |
| `--ink-blue-3` | `--ins-blue-700` | #005895 | `--ins-blue-300` | #96cbff |
| `--ink-blue-link` | `--ins-text-link` | #005895 | `--ins-text-link` | #96cbff |
| `--ink-cyan-1` | `--ins-cyan-700` | #006073 | `--ins-cyan-300` | #92d1e4 |
| `--ink-pink-1` | `--ins-pink-700` | #86335c | `--ins-pink-300` | #f5adcc |
| `--ink-violet-1` | `--ins-violet-700` | #504896 | `--ins-violet-300` | #bfbeff |
| `--outline-white` | literal | #ffffff | `--ins-night-850` | #171e28 |
| `--outline-gray-1` | `--ins-border-hairline` | #e8ebf1 | `--ins-border-hairline` | #252c37 |
| `--outline-gray-2` | `--ins-border` | #dadee5 | `--ins-border` | #2e3641 |
| `--outline-gray-3` | `--ins-border-strong` | #b8bec7 | `--ins-border-strong` | #4b535e |
| `--outline-gray-4` | `--ins-border-control` | #858d97 | `--ins-border-control` | #6f7781 |
| `--outline-gray-5` | `--ins-slate-800` | #28313c | `--ins-night-200` | #d0d5db |
| `--outline-gray-modals` | `--ins-border` | #dadee5 | `--ins-border` | #2e3641 |
| `--outline-red-1` | `--ins-red-200` | #ffcfca | `--ins-red-800` | #741417 |
| `--outline-red-2` | `--ins-red-300` | #ffada6 | `--ins-red-700` | #992225 |
| `--outline-red-3` | `--ins-red-600` | #be3737 | `--ins-red-400` | #fb7e77 |
| `--outline-green-1` | `--ins-green-200` | #c0e8cf | `--ins-green-800` | #004c2c |
| `--outline-green-2` | `--ins-green-300` | #98d6b1 | `--ins-green-700` | #00663e |
| `--outline-amber-1` | `--ins-amber-200` | #ffddb3 | `--ins-amber-800` | #643f00 |
| `--outline-amber-2` | `--ins-amber-300` | #ffc781 | `--ins-amber-700` | #885700 |
| `--outline-blue-1` | `--ins-blue-200` | #c1e0ff | `--ins-blue-800` | #004170 |
| `--outline-orange-1` | `--ins-orange-300` | #fab38b | `--ins-orange-700` | #883c00 |
| `--bg-color` | `--ins-surface-base` | #ffffff | `--ins-surface-base` | #111820 |
| `--fg-color` | `--ins-surface-raised` | #ffffff | `--ins-surface-raised` | #171e28 |
| `--subtle-accent` | `--ins-surface-sunken` | #f7f9fc | `--ins-surface-sunken` | #0b1119 |
| `--subtle-fg` | `--ins-surface-hover` | #f1f4f8 | `--ins-surface-hover` | #252c37 |
| `--fg-hover-color` | `--ins-surface-hover` | #f1f4f8 | `--ins-surface-hover` | #252c37 |
| `--highlight-color` | `--ins-surface-hover` | #f1f4f8 | `--ins-surface-hover` | #252c37 |
| `--control-bg` | `--ins-surface-fill` | #f1f4f8 | `--ins-surface-fill` | #1d252f |
| `--control-bg-on-gray` | `--ins-surface-fill-hover` | #e8ebf1 | `--ins-surface-fill-hover` | #252c37 |
| `--disabled-control-bg` | `--ins-surface-disabled` | #f1f4f8 | `--ins-surface-disabled` | #171e28 |
| `--input-disabled-bg` | `--ins-surface-disabled` | #f1f4f8 | `--ins-surface-disabled` | #171e28 |
| `--disabled-text-color` | `--ins-text-secondary` | #424b57 | `--ins-text-secondary` | #b9bec6 |
| `--card-bg` | `--ins-surface-raised` | #ffffff | `--ins-surface-raised` | #171e28 |
| `--modal-bg` | `--ins-surface-overlay` | #ffffff | `--ins-surface-overlay` | #1d252f |
| `--popover-bg` | `--ins-surface-overlay` | #ffffff | `--ins-surface-overlay` | #1d252f |
| `--toast-bg` | `--ins-surface-overlay` | #ffffff | `--ins-surface-overlay` | #1d252f |
| `--navbar-bg` | `--ins-surface-base` | #ffffff | `--ins-surface-base` | #111820 |
| `--awesomplete-hover-bg` | `--ins-surface-hover` | #f1f4f8 | `--ins-surface-hover` | #252c37 |
| `--awesomebar-focus-bg` | `--ins-surface-field` | #ffffff | `--ins-surface-field` | #0b1119 |
| `--skeleton-bg` | `--ins-slate-100` | #f1f4f8 | `--ins-night-800` | #1d252f |
| `--user-mention-bg-color` | `--ins-surface-hover` | #f1f4f8 | `--ins-surface-hover` | #252c37 |
| `--text-color` | `--ins-text` | #28313c | `--ins-text` | #dfe3e8 |
| `--text-muted` | `--ins-text-secondary` | #424b57 | `--ins-text-secondary` | #b9bec6 |
| `--text-light` | `--ins-text-muted` | #58616d | `--ins-text-muted` | #9da4ac |
| `--text-neutral` | `--ins-text-strong` | #141b25 | `--ins-text-strong` | #eceff2 |
| `--heading-color` | `--ins-text-strong` | #141b25 | `--ins-text-strong` | #eceff2 |
| `--text-dark` | `--ins-text-inverse` | #ffffff | `--ins-text-inverse` | #0b1119 |
| `--icon-stroke` | `--ins-text-secondary` | #424b57 | `--ins-text-secondary` | #b9bec6 |
| `--border-color` | `--ins-border-hairline` | #e8ebf1 | `--ins-border-hairline` | #252c37 |
| `--dark-border-color` | `--ins-border-strong` | #b8bec7 | `--ins-border-strong` | #4b535e |
| `--table-border-color` | `--ins-border-hairline` | #e8ebf1 | `--ins-border-hairline` | #252c37 |
| `--border-primary` | `--ins-primary` | #1b5086 | `--ins-primary` | #a7c9f0 |
| `--btn-group-border-color` | `--ins-border` | #dadee5 | `--ins-border` | #2e3641 |
| `--sidebar-border-color` | `--ins-border-hairline` | #e8ebf1 | `--ins-border-hairline` | #252c37 |
| `--divider-color` | `--ins-border-hairline` | #e8ebf1 | `--ins-border-hairline` | #252c37 |
| `--primary` | `--ins-primary` | #1b5086 | `--ins-primary` | #a7c9f0 |
| `--primary-color` | `--ins-primary` | #1b5086 | `--ins-primary` | #a7c9f0 |
| `--btn-primary` | `--ins-primary` | #1b5086 | `--ins-primary` | #a7c9f0 |
| `--brand-color` | `--ins-brand` | #0f3a65 | `--ins-brand` | #a7c9f0 |
| `--danger` | `--ins-danger` | #be3737 | `--ins-danger` | #fb7e77 |
| `--light` | `--ins-slate-100` | #f1f4f8 | `--ins-night-200` | #d0d5db |
| `--btn-default-bg` | `--ins-surface-fill` | #f1f4f8 | `--ins-surface-fill` | #1d252f |
| `--btn-default-hover-bg` | `--ins-surface-fill-hover` | #e8ebf1 | `--ins-surface-fill-hover` | #252c37 |
| `--btn-ghost-hover-bg` | `--ins-surface-hover` | #f1f4f8 | `--ins-surface-hover` | #252c37 |
| `--progress-bar-bg` | `--ins-primary` | #1b5086 | `--ins-primary` | #a7c9f0 |
| `--switch-bg` | `--ins-border-control` | #858d97 | `--ins-border-control` | #6f7781 |
| `--date-active-bg` | `--ins-primary` | #1b5086 | `--ins-primary` | #a7c9f0 |
| `--date-active-text` | `--ins-on-primary` | #ffffff | `--ins-on-primary` | #061a30 |
| `--date-range-bg` | `--ins-surface-selected` | #f2f7fe | `--ins-surface-selected` | #1a2f46 |
| `--frappe-card-button-bg-color` | `--ins-primary-subtle` | #f2f7fe | `--ins-primary-subtle` | #1a2f46 |
| `--frappe-card-button-color` | `--ins-primary-text` | #1b5086 | `--ins-primary-text` | #a7c9f0 |
| `--sidebar-hover-color` | `--ins-surface-hover` | #f1f4f8 | `--ins-surface-hover` | #252c37 |
| `--sidebar-select-color` | `--ins-surface-active` | #e8ebf1 | `--ins-surface-active` | #2e3641 |
| `--sidebar-active-color` | `--ins-surface-base` | #ffffff | `--ins-surface-hover` | #252c37 |
| `--scrollbar-thumb-color` | `--ins-slate-450` | #858d97 | `--ins-night-500` | #6f7781 |
| `--scrollbar-track-color` | `--ins-slate-100` | #f1f4f8 | `--ins-night-900` | #111820 |
| `--alert-bg-danger` | `--ins-feedback-danger-bg` | #fff4f3 | `--ins-feedback-danger-bg` | #3a0b0b |
| `--alert-bg-info` | `--ins-feedback-info-bg` | #f0f8ff | `--ins-feedback-info-bg` | #001f3a |
| `--alert-bg-success` | `--ins-feedback-success-bg` | #f0f9f4 | `--ins-feedback-success-bg` | #022514 |
| `--alert-bg-warning` | `--ins-feedback-warning-bg` | #fdf8ea | `--ins-feedback-warning-bg` | #291f00 |
| `--alert-text-danger` | `--ins-feedback-danger-fg` | #741417 | `--ins-feedback-danger-fg` | #ffcfca |
| `--alert-text-info` | `--ins-feedback-info-fg` | #004170 | `--ins-feedback-info-fg` | #c1e0ff |
| `--alert-text-success` | `--ins-feedback-success-fg` | #004c2c | `--ins-feedback-success-fg` | #c0e8cf |
| `--alert-text-warning` | `--ins-feedback-warning-fg` | #584600 | `--ins-feedback-warning-fg` | #f4e2ae |
| `--error-bg` | `--ins-feedback-danger-bg` | #fff4f3 | `--ins-feedback-danger-bg` | #3a0b0b |
| `--error-border` | `--ins-danger` | #be3737 | `--ins-danger` | #fb7e77 |
| `--yellow-highlight-color` | `--ins-yellow-100` | #faf0d2 | `--ins-yellow-900` | #3c2f00 |
| `--diff-added` | `--ins-green-100` | #def3e6 | `--ins-green-900` | #00341d |
| `--diff-removed` | `--ins-red-100` | #ffe6e4 | `--ins-red-900` | #510b0d |
| `--diff-changed` | `--ins-blue-100` | #dfefff | `--ins-blue-900` | #002c4f |
| `--appreciation-bg` | `--ins-status-success-bg` | #def3e6 | `--ins-status-success-bg` | #00341d |
| `--appreciation-color` | `--ins-status-success-fg` | #004c2c | `--ins-status-success-fg` | #c0e8cf |
| `--criticism-bg` | `--ins-status-danger-bg` | #ffe6e4 | `--ins-status-danger-bg` | #510b0d |
| `--criticism-color` | `--ins-status-danger-fg` | #741417 | `--ins-status-danger-fg` | #ffcfca |
| `--code-block-bg` | `--ins-slate-900` | #141b25 | `--ins-night-950` | #0b1119 |
| `--code-block-text` | `--ins-slate-200` | #e8ebf1 | `--ins-night-200` | #d0d5db |
| `--bg-gray` | `--ins-status-neutral-bg` | #f1f4f8 | `--ins-status-neutral-bg` | #1d252f |
| `--text-on-gray` | `--ins-status-neutral-fg` | #424b57 | `--ins-status-neutral-fg` | #d0d5db |
| `--bg-grey` | `--ins-status-neutral-bg` | #f1f4f8 | `--ins-status-neutral-bg` | #1d252f |
| `--text-on-grey` | `--ins-status-neutral-fg` | #424b57 | `--ins-status-neutral-fg` | #d0d5db |
| `--bg-light-gray` | `--ins-status-neutral-bg` | #f1f4f8 | `--ins-status-neutral-bg` | #1d252f |
| `--text-on-light-gray` | `--ins-status-neutral-fg` | #424b57 | `--ins-status-neutral-fg` | #d0d5db |
| `--bg-darkgrey` | `--ins-status-muted-bg` | #dadee5 | `--ins-status-muted-bg` | #4b535e |
| `--text-on-darkgrey` | `--ins-status-muted-fg` | #141b25 | `--ins-status-muted-fg` | #eceff2 |
| `--bg-dark-gray` | `--ins-status-muted-bg` | #dadee5 | `--ins-status-muted-bg` | #4b535e |
| `--text-on-dark-gray` | `--ins-status-muted-fg` | #141b25 | `--ins-status-muted-fg` | #eceff2 |
| `--bg-blue` | `--ins-status-progress-bg` | #dfefff | `--ins-status-progress-bg` | #002c4f |
| `--text-on-blue` | `--ins-status-progress-fg` | #004170 | `--ins-status-progress-fg` | #c1e0ff |
| `--bg-light-blue` | `--ins-status-info-bg` | #ddf1f7 | `--ins-status-info-bg` | #00303b |
| `--text-on-light-blue` | `--ins-status-info-fg` | #004656 | `--ins-status-info-fg` | #bde4f0 |
| `--bg-dark-blue` | `--ins-status-ink-bg` | #cae0f9 | `--ins-status-ink-bg` | #0f3a65 |
| `--text-on-dark-blue` | `--ins-status-ink-fg` | #082644 | `--ins-status-ink-fg` | #e4effd |
| `--bg-cyan` | `--ins-status-teal-bg` | #ddf2ef | `--ins-status-teal-bg` | #00322f |
| `--text-on-cyan` | `--ins-status-teal-fg` | #004945 | `--ins-status-teal-fg` | #bee6e1 |
| `--bg-green` | `--ins-status-success-bg` | #def3e6 | `--ins-status-success-bg` | #00341d |
| `--text-on-green` | `--ins-status-success-fg` | #004c2c | `--ins-status-success-fg` | #c0e8cf |
| `--bg-orange` | `--ins-status-pending-bg` | #ffe7db | `--ins-status-pending-bg` | #471b00 |
| `--text-on-orange` | `--ins-status-pending-fg` | #652b00 | `--ins-status-pending-fg` | #ffd1b9 |
| `--bg-yellow` | `--ins-status-warning-bg` | #faf0d2 | `--ins-status-warning-bg` | #3c2f00 |
| `--text-on-yellow` | `--ins-status-warning-fg` | #584600 | `--ins-status-warning-fg` | #f4e2ae |
| `--bg-red` | `--ins-status-danger-bg` | #ffe6e4 | `--ins-status-danger-bg` | #510b0d |
| `--text-on-red` | `--ins-status-danger-fg` | #741417 | `--ins-status-danger-fg` | #ffcfca |
| `--bg-purple` | `--ins-status-special-bg` | #eaebff | `--ins-status-special-bg` | #272250 |
| `--text-on-purple` | `--ins-status-special-fg` | #3a3472 | `--ins-status-special-fg` | #d8d8ff |
| `--bg-pink` | `--ins-status-plum-bg` | #fee5ef | `--ins-status-plum-bg` | #46152e |
| `--text-on-pink` | `--ins-status-plum-fg` | #652244 | `--ins-status-plum-fg` | #fdcde0 |
| `--avatar-frame-bg` | `--ins-slate-200` | #e8ebf1 | `--ins-night-700` | #2e3641 |
| `--avatar-frame-border` | `--ins-surface-raised` | #ffffff | `--ins-surface-raised` | #171e28 |
| `--avatar-frame-color` | `--ins-slate-700` | #424b57 | `--ins-night-200` | #d0d5db |
| `--timeline-badge-bg` | `--ins-surface-sunken` | #f7f9fc | `--ins-night-800` | #1d252f |
| `--timeline-badge-color` | `--ins-text-secondary` | #424b57 | `--ins-text-secondary` | #b9bec6 |
| `--kanban-column-bg` | `--ins-surface-sunken` | #f7f9fc | `--ins-surface-sunken` | #0b1119 |
| `--kanban-card-bg` | `--ins-surface-raised` | #ffffff | `--ins-surface-raised` | #171e28 |
| `--kanban-new-card-bg` | `--ins-surface-hover` | #f1f4f8 | `--ins-surface-hover` | #252c37 |
| `--kanban-new-card-hover-bg` | `--ins-surface-base` | #ffffff | `--ins-surface-active` | #2e3641 |
| `--charts-label-color` | `--ins-chart-label` | #424b57 | `--ins-chart-label` | #b9bec6 |
| `--charts-axis-line-color` | `--ins-chart-grid` | #e8ebf1 | `--ins-chart-grid` | #252c37 |
| `--charts-tooltip-title` | `--ins-text-secondary` | #424b57 | `--ins-text-secondary` | #b9bec6 |
| `--charts-tooltip-label` | `--ins-text-secondary` | #424b57 | `--ins-text-secondary` | #b9bec6 |
| `--charts-tooltip-value` | `--ins-text-strong` | #141b25 | `--ins-text-strong` | #eceff2 |
| `--charts-tooltip-bg` | `--ins-surface-overlay` | #ffffff | `--ins-surface-overlay` | #1d252f |
| `--charts-legend-label` | `--ins-chart-label` | #424b57 | `--ins-chart-label` | #b9bec6 |
| `--charts-legend-value` | `--ins-text` | #28313c | `--ins-text` | #dfe3e8 |
| `--charts-dataset-circle-stroke` | `--ins-surface-raised` | #ffffff | `--ins-surface-raised` | #171e28 |
| `--charts-stroke-width` | literal | 2px | literal | 2px |
| `--shadow-xs` | literal | none | literal | none |
| `--shadow-sm` | `--ins-elevation-raised` | 0 1px 2px rgba(9, 16, 24, 0.06), 0 1px 1px rgba(9, 16, 24, 0.04) | `--ins-elevation-raised` | none |
| `--shadow-base` | `--ins-elevation-raised` | 0 1px 2px rgba(9, 16, 24, 0.06), 0 1px 1px rgba(9, 16, 24, 0.04) | `--ins-elevation-raised` | none |
| `--shadow-md` | `--ins-elevation-overlay` | 0 6px 16px rgba(9, 16, 24, 0.1), 0 1px 3px rgba(9, 16, 24, 0.08) | `--ins-elevation-overlay` | 0 0 0 1px #2e3641 |
| `--shadow-lg` | `--ins-elevation-overlay` | 0 6px 16px rgba(9, 16, 24, 0.1), 0 1px 3px rgba(9, 16, 24, 0.08) | `--ins-elevation-overlay` | 0 0 0 1px #2e3641 |
| `--shadow-xl` | `--ins-elevation-dialog` | 0 20px 48px rgba(9, 16, 24, 0.18), 0 4px 12px rgba(9, 16, 24, 0.08) | `--ins-elevation-dialog` | 0 0 0 1px #4b535e |
| `--shadow-2xl` | `--ins-elevation-dialog` | 0 20px 48px rgba(9, 16, 24, 0.18), 0 4px 12px rgba(9, 16, 24, 0.08) | `--ins-elevation-dialog` | 0 0 0 1px #4b535e |
| `--card-shadow` | `--ins-elevation-raised` | 0 1px 2px rgba(9, 16, 24, 0.06), 0 1px 1px rgba(9, 16, 24, 0.04) | `--ins-elevation-raised` | none |
| `--modal-shadow` | `--ins-elevation-dialog` | 0 20px 48px rgba(9, 16, 24, 0.18), 0 4px 12px rgba(9, 16, 24, 0.08) | `--ins-elevation-dialog` | 0 0 0 1px #4b535e |
| `--awesomebar-shadow` | `--ins-elevation-dialog` | 0 20px 48px rgba(9, 16, 24, 0.18), 0 4px 12px rgba(9, 16, 24, 0.08) | `--ins-elevation-dialog` | 0 0 0 1px #4b535e |
| `--shadow-inset` | literal | inset 0 -1px 0 var(--ins-border-hairline) | literal | inset 0 -1px 0 var(--ins-border-hairline) |
| `--highlight-shadow` | literal | 0 0 0 2px var(--ins-focus) | literal | 0 0 0 2px var(--ins-focus) |
| `--focus-default` | literal | none | literal | none |
| `--checkbox-focus-shadow` | literal | none | literal | none |
| `--checkbox-gradient` | literal | linear-gradient(var(--ins-primary), var(--ins-primary)) | literal | linear-gradient(var(--ins-primary), var(--ins-primary)) |
| `--checkbox-disabled-gradient` | literal | linear-gradient(var(--ins-border-control), var(--ins-border-control)) | literal | linear-gradient(var(--ins-border-control), var(--ins-border-control)) |
| `--text-tiny` | `--ins-text-xs` | 12px | `--ins-text-xs` | 12px |
| `--text-2xs` | `--ins-text-xs` | 12px | `--ins-text-xs` | 12px |
| `--text-xs` | `--ins-text-xs` | 12px | `--ins-text-xs` | 12px |
| `--text-sm` | `--ins-text-sm` | 13px | `--ins-text-sm` | 13px |
| `--text-md` | `--ins-text-base` | 13px | `--ins-text-base` | 13px |
| `--text-base` | `--ins-text-base` | 13px | `--ins-text-base` | 13px |
| `--text-lg` | `--ins-text-lg` | 16px | `--ins-text-lg` | 16px |
| `--text-xl` | `--ins-text-xl` | 18px | `--ins-text-xl` | 18px |
| `--text-2xl` | `--ins-text-2xl` | 20px | `--ins-text-2xl` | 20px |
| `--text-3xl` | `--ins-text-3xl` | 24px | `--ins-text-3xl` | 24px |
| `--weight-regular` | `--ins-weight-regular` | 400 | `--ins-weight-regular` | 400 |
| `--weight-medium` | `--ins-weight-medium` | 500 | `--ins-weight-medium` | 500 |
| `--weight-semibold` | `--ins-weight-strong` | 600 | `--ins-weight-strong` | 600 |
| `--weight-bold` | `--ins-weight-strong` | 600 | `--ins-weight-strong` | 600 |
| `--border-radius-tiny` | `--ins-radius-xs` | 2px | `--ins-radius-xs` | 2px |
| `--border-radius-sm` | `--ins-radius-sm` | 4px | `--ins-radius-sm` | 4px |
| `--border-radius` | `--ins-radius-sm` | 4px | `--ins-radius-sm` | 4px |
| `--border-radius-md` | `--ins-radius-md` | 6px | `--ins-radius-md` | 6px |
| `--border-radius-lg` | `--ins-radius-md` | 6px | `--ins-radius-md` | 6px |
| `--border-radius-xl` | `--ins-radius-lg` | 8px | `--ins-radius-lg` | 8px |
| `--padding-xs` | `--ins-space-1` | 4px | `--ins-space-1` | 4px |
| `--padding-sm` | `--ins-space-2` | 8px | `--ins-space-2` | 8px |
| `--padding-md` | `--ins-space-4` | 16px | `--ins-space-4` | 16px |
| `--padding-lg` | `--ins-space-5` | 20px | `--ins-space-5` | 20px |
| `--padding-xl` | `--ins-space-8` | 32px | `--ins-space-8` | 32px |
| `--padding-2xl` | `--ins-space-10` | 40px | `--ins-space-10` | 40px |
| `--margin-xs` | `--ins-space-1` | 4px | `--ins-space-1` | 4px |
| `--margin-sm` | `--ins-space-2` | 8px | `--ins-space-2` | 8px |
| `--margin-md` | `--ins-space-4` | 16px | `--ins-space-4` | 16px |
| `--margin-lg` | `--ins-space-5` | 20px | `--ins-space-5` | 20px |
| `--margin-xl` | `--ins-space-8` | 32px | `--ins-space-8` | 32px |
| `--margin-2xl` | `--ins-space-10` | 40px | `--ins-space-10` | 40px |
| `--input-height` | `--ins-control-height` | 44px | `--ins-control-height` | 44px |
| `--btn-height` | `--ins-control-height` | 44px | `--ins-control-height` | 44px |
| `--input-padding` | literal | 0 var(--ins-control-pad-x) | literal | 0 var(--ins-control-pad-x) |
| `--list-row-height` | `--ins-row-height` | 48px | `--ins-row-height` | 48px |
| `--page-head-height` | `--ins-page-head-height` | 48px | `--ins-page-head-height` | 48px |
| `--checkbox-size` | literal | 16px | literal | 16px |

## 4. Contrast

### midad, every pair

Generated from `docs/audits/contrast.json`.

| Group | Foreground | Background | Required ratio | Light ratio | Light | Dark ratio | Dark |
|---|---|---|---|---|---|---|---|
| Body text and headings | `text-strong` | `surface-base` | min 4.5 | 17.309 | pass | 15.481 | pass |
| Body text and headings | `text-strong` | `surface-sunken` | min 4.5 | 16.411 | pass | 16.415 | pass |
| Body text and headings | `text-strong` | `surface-raised` | min 4.5 | 17.309 | pass | 14.524 | pass |
| Body text and headings | `text-strong` | `surface-overlay` | min 4.5 | 17.309 | pass | 13.399 | pass |
| Body text and headings | `text-strong` | `surface-hover` | min 4.5 | 15.69 | pass | 12.178 | pass |
| Body text and headings | `text-strong` | `surface-active` | min 4.5 | 14.494 | pass | 10.578 | pass |
| Body text and headings | `text-strong` | `surface-selected` | min 4.5 | 16.082 | pass | 11.823 | pass |
| Body text and headings | `text-strong` | `surface-selected-strong` | min 4.5 | 14.889 | pass | 9.805 | pass |
| Body text and headings | `text-strong` | `surface-field` | min 4.5 | 17.309 | pass | 16.415 | pass |
| Body text and headings | `text` | `surface-base` | min 4.5 | 13.168 | pass | 13.86 | pass |
| Body text and headings | `text` | `surface-sunken` | min 4.5 | 12.485 | pass | 14.697 | pass |
| Body text and headings | `text` | `surface-raised` | min 4.5 | 13.168 | pass | 13.003 | pass |
| Body text and headings | `text` | `surface-overlay` | min 4.5 | 13.168 | pass | 11.997 | pass |
| Body text and headings | `text` | `surface-hover` | min 4.5 | 11.936 | pass | 10.903 | pass |
| Body text and headings | `text` | `surface-active` | min 4.5 | 11.026 | pass | 9.47 | pass |
| Body text and headings | `text` | `surface-selected` | min 4.5 | 12.234 | pass | 10.585 | pass |
| Body text and headings | `text` | `surface-selected-strong` | min 4.5 | 11.327 | pass | 8.779 | pass |
| Body text and headings | `text` | `surface-field` | min 4.5 | 13.168 | pass | 14.697 | pass |
| Body text and headings | `text-secondary` | `surface-base` | min 4.5 | 8.839 | pass | 9.566 | pass |
| Body text and headings | `text-secondary` | `surface-sunken` | min 4.5 | 8.381 | pass | 10.144 | pass |
| Body text and headings | `text-secondary` | `surface-raised` | min 4.5 | 8.839 | pass | 8.975 | pass |
| Body text and headings | `text-secondary` | `surface-overlay` | min 4.5 | 8.839 | pass | 8.28 | pass |
| Body text and headings | `text-secondary` | `surface-hover` | min 4.5 | 8.013 | pass | 7.525 | pass |
| Body text and headings | `text-secondary` | `surface-active` | min 4.5 | 7.402 | pass | 6.536 | pass |
| Body text and headings | `text-secondary` | `surface-selected` | min 4.5 | 8.213 | pass | 7.306 | pass |
| Body text and headings | `text-secondary` | `surface-selected-strong` | min 4.5 | 7.604 | pass | 6.059 | pass |
| Body text and headings | `text-secondary` | `surface-field` | min 4.5 | 8.839 | pass | 10.144 | pass |
| Help, caption and placeholder text | `text-muted` | `surface-base` | min 4.5 | 6.277 | pass | 7.095 | pass |
| Help, caption and placeholder text | `text-muted` | `surface-sunken` | min 4.5 | 5.951 | pass | 7.524 | pass |
| Help, caption and placeholder text | `text-muted` | `surface-raised` | min 4.5 | 6.277 | pass | 6.657 | pass |
| Help, caption and placeholder text | `text-muted` | `surface-overlay` | min 4.5 | 6.277 | pass | 6.141 | pass |
| Help, caption and placeholder text | `text-muted` | `surface-field` | min 4.5 | 6.277 | pass | 7.524 | pass |
| Help, caption and placeholder text | `text-placeholder` | `surface-base` | min 4.5 | 4.866 | pass | 5.541 | pass |
| Help, caption and placeholder text | `text-placeholder` | `surface-sunken` | min 4.5 | 4.613 | pass | 5.876 | pass |
| Help, caption and placeholder text | `text-placeholder` | `surface-raised` | min 4.5 | 4.866 | pass | 5.199 | pass |
| Help, caption and placeholder text | `text-placeholder` | `surface-overlay` | min 4.5 | 4.866 | pass | 4.796 | pass |
| Help, caption and placeholder text | `text-placeholder` | `surface-field` | min 4.5 | 4.866 | pass | 5.876 | pass |
| Help text on hover and selected rows | `text-muted` | `surface-hover` | min 4.5 | 5.69 | pass | 5.582 | pass |
| Help text on hover and selected rows | `text-muted` | `surface-selected` | min 4.5 | 5.832 | pass | 5.419 | pass |
| Links | `text-link` | `surface-base` | min 4.5 | 7.421 | pass | 10.451 | pass |
| Links | `text-link` | `surface-sunken` | min 4.5 | 7.036 | pass | 11.081 | pass |
| Links | `text-link` | `surface-raised` | min 4.5 | 7.421 | pass | 9.805 | pass |
| Links | `text-link` | `surface-overlay` | min 4.5 | 7.421 | pass | 9.046 | pass |
| Links | `text-link` | `surface-hover` | min 4.5 | 6.727 | pass | 8.221 | pass |
| Links | `text-link-hover` | `surface-base` | min 4.5 | 10.552 | pass | 13.08 | pass |
| Links | `text-link-hover` | `surface-sunken` | min 4.5 | 10.005 | pass | 13.87 | pass |
| Links | `text-link-hover` | `surface-raised` | min 4.5 | 10.552 | pass | 12.272 | pass |
| Links | `text-link-hover` | `surface-overlay` | min 4.5 | 10.552 | pass | 11.322 | pass |
| Links | `text-link-hover` | `surface-hover` | min 4.5 | 9.565 | pass | 10.29 | pass |
| Primary-coloured text | `primary-text` | `surface-base` | min 4.5 | 8.273 | pass | 10.428 | pass |
| Primary-coloured text | `primary-text` | `surface-sunken` | min 4.5 | 7.844 | pass | 11.057 | pass |
| Primary-coloured text | `primary-text` | `surface-raised` | min 4.5 | 8.273 | pass | 9.783 | pass |
| Primary-coloured text | `primary-text` | `primary-subtle` | min 4.5 | 7.687 | pass | 7.964 | pass |
| Primary-coloured text | `text-brand` | `surface-base` | min 4.5 | 11.58 | pass | 13.223 | pass |
| Primary-coloured text | `text-brand` | `surface-sunken` | min 4.5 | 10.979 | pass | 14.021 | pass |
| Primary-coloured text | `text-brand` | `surface-raised` | min 4.5 | 11.58 | pass | 12.406 | pass |
| Primary-coloured text | `text-brand` | `primary-subtle` | min 4.5 | 10.759 | pass | 10.099 | pass |
| Text on primary action | `on-primary` | `primary` | min 4.5 | 8.273 | pass | 10.229 | pass |
| Text on primary action | `on-primary` | `primary-hover` | min 4.5 | 11.58 | pass | 12.971 | pass |
| Text on primary action | `on-primary` | `primary-active` | min 4.5 | 15.317 | pass | 15.076 | pass |
| Text on destructive action | `on-danger` | `danger` | min 4.5 | 5.539 | pass | 6.776 | pass |
| Text on destructive action | `on-danger` | `danger-hover` | min 4.5 | 8.046 | pass | 9.557 | pass |
| Text on inverse surface (tooltips) | `text-inverse` | `surface-inverse` | min 4.5 | 17.309 | pass | 14.697 | pass |
| Disabled text stays legible | `text-disabled` | `surface-disabled` | min 3 | 4.411 | pass | 3.697 | pass |
| Disabled text stays legible | `text-disabled` | `surface-base` | min 3 | 4.866 | pass | 3.941 | pass |
| Disabled text stays legible | `text-disabled` | `surface-raised` | min 3 | 4.866 | pass | 3.697 | pass |
| Read-only values | `--disabled-text-color` | `surface-base` | min 4.5 | 8.839 | pass | 9.566 | pass |
| Read-only values | `--disabled-text-color` | `surface-raised` | min 4.5 | 8.839 | pass | 8.975 | pass |
| Read-only values | `--disabled-text-color` | `surface-disabled` | min 4.5 | 8.013 | pass | 8.975 | pass |
| Status pill: neutral | `status-neutral-fg` | `status-neutral-bg` | min 4.5 | 8.013 | pass | 10.474 | pass |
| Status pill: muted | `status-muted-fg` | `status-muted-bg` | min 4.5 | 12.826 | pass | 6.744 | pass |
| Status pill: progress | `status-progress-fg` | `status-progress-bg` | min 4.5 | 9.009 | pass | 10.436 | pass |
| Status pill: info | `status-info-fg` | `status-info-bg` | min 4.5 | 8.953 | pass | 10.444 | pass |
| Status pill: teal | `status-teal-fg` | `status-teal-bg` | min 4.5 | 8.839 | pass | 10.416 | pass |
| Status pill: success | `status-success-fg` | `status-success-bg` | min 4.5 | 8.728 | pass | 10.395 | pass |
| Status pill: pending | `status-pending-fg` | `status-pending-bg` | min 4.5 | 9.324 | pass | 10.58 | pass |
| Status pill: warning | `status-warning-fg` | `status-warning-bg` | min 4.5 | 8.057 | pass | 10.218 | pass |
| Status pill: danger | `status-danger-fg` | `status-danger-bg` | min 4.5 | 9.537 | pass | 10.709 | pass |
| Status pill: special | `status-special-fg` | `status-special-bg` | min 4.5 | 9.313 | pass | 10.613 | pass |
| Status pill: plum | `status-plum-fg` | `status-plum-bg` | min 4.5 | 9.47 | pass | 10.65 | pass |
| Status pill: ink | `status-ink-fg` | `status-ink-bg` | min 4.5 | 11.336 | pass | 9.961 | pass |
| Status glyph and dot against the pill and the page | `status-neutral-solid` | `status-neutral-bg` | min 3 | 4.411 | pass | 6.141 | pass |
| Status glyph and dot against the pill and the page | `status-neutral-solid` | `surface-base` | min 3 | 4.866 | pass | 7.095 | pass |
| Status glyph and dot against the pill and the page | `status-neutral-solid` | `surface-raised` | min 3 | 4.866 | pass | 6.657 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-progress-solid` | `surface-base` | min 3 | 5.06 | pass | 7.644 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-progress-solid` | `surface-raised` | min 3 | 5.06 | pass | 7.172 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-progress-solid` | `surface-sunken` | min 3 | 4.797 | pass | 8.106 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-info-solid` | `surface-base` | min 3 | 4.872 | pass | 7.794 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-info-solid` | `surface-raised` | min 3 | 4.872 | pass | 7.312 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-info-solid` | `surface-sunken` | min 3 | 4.619 | pass | 8.264 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-teal-solid` | `surface-base` | min 3 | 4.812 | pass | 7.885 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-teal-solid` | `surface-raised` | min 3 | 4.812 | pass | 7.397 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-teal-solid` | `surface-sunken` | min 3 | 4.563 | pass | 8.361 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-success-solid` | `surface-base` | min 3 | 4.787 | pass | 7.956 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-success-solid` | `surface-raised` | min 3 | 4.787 | pass | 7.464 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-success-solid` | `surface-sunken` | min 3 | 4.539 | pass | 8.436 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-pending-solid` | `surface-base` | min 3 | 5.32 | pass | 7.322 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-pending-solid` | `surface-raised` | min 3 | 5.32 | pass | 6.869 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-pending-solid` | `surface-sunken` | min 3 | 5.044 | pass | 7.764 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-warning-solid` | `surface-base` | min 3 | 3.789 | pass | 9.57 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-warning-solid` | `surface-raised` | min 3 | 3.789 | pass | 8.979 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-warning-solid` | `surface-sunken` | min 3 | 3.592 | pass | 10.148 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-danger-solid` | `surface-base` | min 3 | 5.539 | pass | 7.106 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-danger-solid` | `surface-raised` | min 3 | 5.539 | pass | 6.667 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-danger-solid` | `surface-sunken` | min 3 | 5.252 | pass | 7.535 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-special-solid` | `surface-base` | min 3 | 5.289 | pass | 7.413 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-special-solid` | `surface-raised` | min 3 | 5.289 | pass | 6.955 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-special-solid` | `surface-sunken` | min 3 | 5.014 | pass | 7.86 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-plum-solid` | `surface-base` | min 3 | 5.443 | pass | 7.146 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-plum-solid` | `surface-raised` | min 3 | 5.443 | pass | 6.704 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-plum-solid` | `surface-sunken` | min 3 | 5.161 | pass | 7.577 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-muted-solid` | `surface-base` | min 3 | 8.839 | pass | 9.566 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-muted-solid` | `surface-raised` | min 3 | 8.839 | pass | 8.975 | pass |
| Status solids against surfaces (dots, trend arrows, chart marks) | `status-muted-solid` | `surface-sunken` | min 3 | 8.381 | pass | 10.144 | pass |
| Banner and toast text | `feedback-info-fg` | `feedback-info-bg` | min 4.5 | 9.837 | pass | 12.23 | pass |
| Banner and toast text: success | `feedback-success-fg` | `feedback-success-bg` | min 4.5 | 9.449 | pass | 12.28 | pass |
| Banner and toast text: warning | `feedback-warning-fg` | `feedback-warning-bg` | min 4.5 | 8.639 | pass | 12.661 | pass |
| Banner and toast text: pending | `feedback-pending-fg` | `feedback-pending-bg` | min 4.5 | 10.237 | pass | 12.164 | pass |
| Banner and toast text: danger | `feedback-danger-fg` | `feedback-danger-bg` | min 4.5 | 10.505 | pass | 12.194 | pass |
| Body text on search highlight | `text` | `mark-bg` | min 4.5 | 10.244 | pass | 7.111 | pass |
| Input, checkbox and switch boundary | `border-control` | `surface-base` | min 3 | 3.358 | pass | 3.941 | pass |
| Input, checkbox and switch boundary | `border-control` | `surface-sunken` | min 3 | 3.184 | pass | 4.178 | pass |
| Input, checkbox and switch boundary | `border-control` | `surface-raised` | min 3 | 3.358 | pass | 3.697 | pass |
| Input, checkbox and switch boundary | `border-control` | `surface-overlay` | min 3 | 3.358 | pass | 3.411 | pass |
| Input, checkbox and switch boundary | `border-control` | `surface-field` | min 3 | 3.358 | pass | 4.178 | pass |
| Input, checkbox and switch boundary | `border-control-hover` | `surface-base` | min 3 | 6.277 | pass | 7.095 | pass |
| Input, checkbox and switch boundary | `border-control-hover` | `surface-sunken` | min 3 | 5.951 | pass | 7.524 | pass |
| Input, checkbox and switch boundary | `border-control-hover` | `surface-raised` | min 3 | 6.277 | pass | 6.657 | pass |
| Input, checkbox and switch boundary | `border-control-hover` | `surface-overlay` | min 3 | 6.277 | pass | 6.141 | pass |
| Input, checkbox and switch boundary | `border-control-hover` | `surface-field` | min 3 | 6.277 | pass | 7.524 | pass |
| Focus ring against adjacent colours | `focus` | `surface-base` | min 3 | 5.614 | pass | 10.428 | pass |
| Focus ring against adjacent colours | `focus` | `surface-sunken` | min 3 | 5.323 | pass | 11.057 | pass |
| Focus ring against adjacent colours | `focus` | `surface-raised` | min 3 | 5.614 | pass | 9.783 | pass |
| Focus ring against adjacent colours | `focus` | `surface-overlay` | min 3 | 5.614 | pass | 9.026 | pass |
| Focus ring against adjacent colours | `focus` | `surface-hover` | min 3 | 5.089 | pass | 8.203 | pass |
| Focus ring against adjacent colours | `focus` | `surface-selected` | min 3 | 5.216 | pass | 7.964 | pass |
| Focus ring against adjacent colours | `focus` | `surface-field` | min 3 | 5.614 | pass | 11.057 | pass |
| Focus ring against adjacent colours | `focus` | `surface-fill` | min 3 | 5.089 | pass | 9.026 | pass |
| Primary button boundary against the page | `primary` | `surface-base` | min 3 | 8.273 | pass | 10.428 | pass |
| Primary button boundary against the page | `primary` | `surface-sunken` | min 3 | 7.844 | pass | 11.057 | pass |
| Primary button boundary against the page | `primary` | `surface-raised` | min 3 | 8.273 | pass | 9.783 | pass |
| Primary button boundary against the page | `primary` | `surface-overlay` | min 3 | 8.273 | pass | 9.026 | pass |
| Destructive button boundary against the page | `danger` | `surface-base` | min 3 | 5.539 | pass | 7.106 | pass |
| Destructive button boundary against the page | `danger` | `surface-raised` | min 3 | 5.539 | pass | 6.667 | pass |
| Destructive button boundary against the page | `danger` | `surface-overlay` | min 3 | 5.539 | pass | 6.151 | pass |
| Error border against the page and field | `--error-border` | `surface-base` | min 3 | 5.539 | pass | 7.106 | pass |
| Error border against the page and field | `--error-border` | `surface-raised` | min 3 | 5.539 | pass | 6.667 | pass |
| Error border against the page and field | `--error-border` | `surface-field` | min 3 | 5.539 | pass | 7.535 | pass |
| Accent rule and active marker | `accent` | `surface-base` | min 3 | 4.346 | pass | 8.562 | pass |
| Accent rule and active marker | `accent` | `surface-sunken` | min 3 | 4.12 | pass | 9.079 | pass |
| Accent rule and active marker | `accent` | `surface-raised` | min 3 | 4.346 | pass | 8.033 | pass |
| Accent text | `accent-text` | `surface-base` | min 4.5 | 9.898 | pass | 13.461 | pass |
| Accent text | `accent-text` | `surface-raised` | min 4.5 | 9.898 | pass | 12.629 | pass |
| Accent text | `accent-text` | `accent-subtle` | min 4.5 | 9.201 | pass | 11.347 | pass |
| Icons | `--icon-stroke` | `surface-base` | min 3 | 8.839 | pass | 9.566 | pass |
| Icons | `--icon-stroke` | `surface-sunken` | min 3 | 8.381 | pass | 10.144 | pass |
| Icons | `--icon-stroke` | `surface-raised` | min 3 | 8.839 | pass | 8.975 | pass |
| Icons | `--icon-stroke` | `surface-overlay` | min 3 | 8.839 | pass | 8.28 | pass |
| Icons | `--icon-stroke` | `surface-hover` | min 3 | 8.013 | pass | 7.525 | pass |
| Icons | `--icon-stroke` | `surface-active` | min 3 | 7.402 | pass | 6.536 | pass |
| Chart marks against the plot background | `chart-1` | `surface-base` | min 3 | 8.273 | pass | 10.428 | pass |
| Chart marks against the plot background | `chart-1` | `surface-raised` | min 3 | 8.273 | pass | 9.783 | pass |
| Chart marks against the plot background | `chart-2` | `surface-base` | min 3 | 6.158 | pass | 7.01 | pass |
| Chart marks against the plot background | `chart-2` | `surface-raised` | min 3 | 6.158 | pass | 6.577 | pass |
| Chart marks against the plot background | `chart-3` | `surface-base` | min 3 | 4.812 | pass | 5.47 | pass |
| Chart marks against the plot background | `chart-3` | `surface-raised` | min 3 | 4.812 | pass | 5.132 | pass |
| Chart marks against the plot background | `chart-4` | `surface-base` | min 3 | 11.321 | pass | 7.106 | pass |
| Chart marks against the plot background | `chart-4` | `surface-raised` | min 3 | 11.321 | pass | 6.667 | pass |
| Chart marks against the plot background | `chart-5` | `surface-base` | min 3 | 3.658 | pass | 7.248 | pass |
| Chart marks against the plot background | `chart-5` | `surface-raised` | min 3 | 3.658 | pass | 6.8 | pass |
| Chart marks against the plot background | `chart-6` | `surface-base` | min 3 | 3.613 | pass | 3.358 | pass |
| Chart marks against the plot background | `chart-6` | `surface-raised` | min 3 | 3.613 | pass | 3.151 | pass |
| Chart marks against the plot background | `chart-7` | `surface-base` | min 3 | 4.872 | pass | 10.603 | pass |
| Chart marks against the plot background | `chart-7` | `surface-raised` | min 3 | 4.872 | pass | 9.948 | pass |
| Chart marks against the plot background | `chart-8` | `surface-base` | min 3 | 3.358 | pass | 5.541 | pass |
| Chart marks against the plot background | `chart-8` | `surface-raised` | min 3 | 3.358 | pass | 5.199 | pass |
| Chart labels | `chart-label` | `surface-base` | min 4.5 | 8.839 | pass | 9.566 | pass |
| Chart labels | `chart-label` | `surface-raised` | min 4.5 | 8.839 | pass | 8.975 | pass |
| Scrollbar thumb against its track | `--scrollbar-thumb-color` | `--scrollbar-track-color` | min 3 | 3.044 | pass | 3.941 | pass |
| Chart gridlines stay quiet (at most 10% contrast step) | `chart-grid` | `surface-base` | max 1.35 | 1.194 | pass | 1.271 | pass |
| Chart gridlines stay quiet (at most 10% contrast step) | `chart-grid` | `surface-raised` | max 1.35 | 1.194 | pass | 1.193 | pass |

### Preset summary

Generated from `docs/audits/contrast.json`, `docs/audits/presets.txt`.

| Preset | Status | Pairs per mode (Light / Dark) | Failures (contrast.json) | Reason |
|---|---|---|---|---|
| midad | shipped | 181 / 181 | 0 | - |
| graphite | shipped | 181 / 181 | 0 | - |
| petrol | shipped | 181 / 181 | 0 | - |
| forest | shipped | 181 / 181 | 0 | - |
| plum | shipped | 181 / 181 | 0 | - |
| umber | dropped | 181 / 181 | 0 | FAIL status warning: primary vs status-warning-solid, dark mode, tritanopia: 3.3 (needs 5.0) |

## 5. Scale tokens

Generated from `institutional_theme/midad/generated/model.json`, `institutional_theme/public/scss/generated/_scale.scss`.

A dash means model.json defines no value for that block.

### Type

| Token | Value | Compact | Coarse |
|---|---|---|---|
| `--ins-text-xs` | 12px | - | - |
| `--ins-text-sm` | 13px | - | - |
| `--ins-text-base` | 14px | 13px | - |
| `--ins-text-lg` | 16px | - | - |
| `--ins-text-xl` | 18px | - | - |
| `--ins-text-2xl` | 20px | - | - |
| `--ins-text-3xl` | 24px | - | - |
| `--ins-text-4xl` | 32px | - | - |
| `--ins-leading-tight` | 1.3 | - | - |
| `--ins-leading` | 1.5 | - | - |
| `--ins-leading-arabic` | 1.65 | - | - |
| `--ins-weight-regular` | 400 | - | - |
| `--ins-weight-medium` | 500 | - | - |
| `--ins-weight-strong` | 600 | - | - |

### Spacing

| Token | Value | Compact | Coarse |
|---|---|---|---|
| `--ins-space-05` | 2px | - | - |
| `--ins-space-1` | 4px | - | - |
| `--ins-space-15` | 6px | - | - |
| `--ins-space-2` | 8px | - | - |
| `--ins-space-3` | 12px | - | - |
| `--ins-space-4` | 16px | - | - |
| `--ins-space-5` | 20px | - | - |
| `--ins-space-6` | 24px | - | - |
| `--ins-space-8` | 32px | - | - |
| `--ins-space-10` | 40px | - | - |
| `--ins-space-12` | 48px | - | - |
| `--ins-space-16` | 64px | - | - |

### Radius

| Token | Value | Compact | Coarse |
|---|---|---|---|
| `--ins-radius-xs` | 2px | - | - |
| `--ins-radius-sm` | 4px | - | - |
| `--ins-radius-md` | 6px | - | - |
| `--ins-radius-lg` | 8px | - | - |

### Motion

| Token | Value | Compact | Coarse |
|---|---|---|---|
| `--ins-duration-fast` | 120ms | - | - |
| `--ins-duration` | 160ms | - | - |
| `--ins-duration-slow` | 200ms | - | - |
| `--ins-ease` | cubic-bezier(0.2, 0, 0, 1) | - | - |

### Component sizes, focus and layers

| Token | Value | Compact | Coarse |
|---|---|---|---|
| `--ins-control-height` | 32px | 28px | 44px |
| `--ins-control-height-sm` | 28px | 24px | 44px |
| `--ins-control-pad-x` | 12px | 8px | - |
| `--ins-row-height` | 40px | 32px | 48px |
| `--ins-cell-height` | 36px | 28px | - |
| `--ins-cell-pad-y` | 10px | 6px | - |
| `--ins-section-gap` | 24px | 16px | - |
| `--ins-field-gap` | 16px | 10px | - |
| `--ins-page-head-height` | 56px | 48px | - |
| `--ins-target-min` | 24px | - | 44px |
| `--ins-focus-width` | 2px | - | - |
| `--ins-focus-offset` | 2px | - | - |
| `--ins-z-sticky` | 5 | - | - |
| `--ins-z-page-head` | 6 | - | - |
| `--ins-z-banner` | 1020 | - | - |
| `--ins-z-ribbon` | 1021 | - | - |

## 6. Colour-vision summary

Generated from `docs/audits/colour_vision.txt`.

```text
Distance: OKLab Euclidean x 100 after simulating the deficiency (Machado et al. 2009, severity 1).
Status check (fatal): primary against the solid mark of every chromatic status role within 45 degrees of the primary hue, both modes, four visions, needs 5.0.
Chart check (reported gap, not fatal): closest pair of series, needs 5.0.
== midad (shipped)
Status check, hue-adjacent roles: progress, info, special
  closest approach 7.7; failures 0
== graphite (shipped)
Status check, hue-adjacent roles: progress, info, special
  closest approach 7.1; failures 0
== petrol (shipped)
Status check, hue-adjacent roles: progress, info, teal
  closest approach 8.1; failures 0
== forest (shipped)
Status check, hue-adjacent roles: teal, success
  closest approach 7.4; failures 0
== plum (shipped)
Status check, hue-adjacent roles: special, plum
  closest approach 8.5; failures 0
== umber (not shipped)
Status check, hue-adjacent roles: pending, warning, danger
  closest approach 3.3; failures 1
  FAIL status warning: primary vs status-warning-solid, dark mode, tritanopia: 3.3 (needs 5.0)
Status failures in shipped presets: 0
Chart gaps in shipped presets (not fatal): 67
```

Parity audit, from `docs/audits/parity.txt`: 51 checks, 0 failed.

## Could not fill

- ramp step `--ins-ink-50`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-ink-100`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-ink-200`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-ink-300`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-ink-400`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-ink-500`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-ink-600`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-ink-700`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-ink-800`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-ink-900`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-ink-950`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-brass-50`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-brass-100`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-brass-200`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-brass-300`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-brass-400`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-brass-500`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-brass-600`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-brass-700`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-brass-800`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-brass-900`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-brass-950`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-slate-25`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-night-450`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-night-750`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-yellow-950`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-teal-950`: not emitted in both blocks of _tokens.scss
- ramp step `--ins-purple-950`: not emitted in both blocks of _tokens.scss
- Frappe variable `--font-stack`: its --ins-* source is not emitted in _tokens.scss or _scale.scss
- scale token `--ins-font-sans`: not declared in _scale.scss
- scale token `--ins-font-mono`: not declared in _scale.scss

<!-- tokens:end -->

## Design deviations

Every place where the build differs from the approved design, with the record that decided it. `design/reference/tokens.resolved.json` stays the approved record. `institutional_theme/midad/deviations.py` lists the token-level deviations, and the fixture test asserts the new values for exactly those keys.

| # | Approved design | As built | Reason (BRIEF section 3 rule) | Record |
|---|---|---|---|---|
| 1 | `surface-selected-strong`, Dark: `oklch(0.35 0.065 252)` `#1f3c5b` | `oklch(0.34 0.065 252)` `#1d3958` | Muted text on a selected-and-hovered row was 4.49:1; it is now 4.69:1 (rule 2) | ADR 0010; `deviations.py` |
| 2 | Chart series 1-6 in tokens order | Order 1, 5, 3, 2, 6, 4: `chart-2` purple, `chart-4` amber, `chart-5` orange, `chart-6` red (hex in `deviations.py`) | Neighbouring series were not distinguishable under colour-vision deficiency (rule 2) | ADR 0010; `deviations.py` |
| 3 | `tokens.json` mapped `--control-bg` to `surface-fill` and `--control-bg-on-gray` to `surface-fill-hover` | Both map to `surface-field`, as the artboards draw; buttons and chips keep `surface-fill`; `.form-control` gets a `border-control` border | The old mapping put placeholder text below 4.5:1 and contradicted the artboards (rule 2). No colour value changed | ADR 0010 |
| 4 | System name inside the login card | System name above the card | Uses core's `banner_html` slot instead of replacing the login template (rule 3) | ADR 0009; STATUS decision 8 |
| 5 | One focus ring; the comps do not draw core's inset highlight on a focused `.btn-default` | The inset highlight is gone: core's grey focus box-shadows are removed | Exactly one focus ring (rule 2) | STATUS decision 13 |
| 6 | Weight 600 in every pairing | Tajawal has no 600; its 700 file serves 600-700, only when Tajawal is selected | No synthetic bold (rule 2 over 5) | STATUS decision 14 |
| 7 | Calendar events in theme colours (the Calendar was not drawn; the theme colours were the expectation) | Light: Frappe's inline, user-chosen chip colours are kept; strong choices fail 4.5:1 (red 2.31:1, green 3.31:1); dot events keep core's `rgb(0, 112, 204) !important` (`calendar.scss:99`) | Inline style and core `!important`; the colours are user data (rule 3). Known gap, controlled by the administrator's choice of event colours | STATUS decision 26; round 2 lead decision 2 |
| 8 | Desktop (apps) screen not drawn; theme colours expected | App icons keep core's inline colours, set per icon by JS (`utils.js:1372-1390`, `desktop_icon_style`); CSS cannot override an inline colour without `!important` | Rule 3. No decision record yet: **owner to decide** whether to accept core's icon colours | `docs/team/evidence/phase3/css-shell/evidence.md` |
| 9 | Table rows 36px comfortable, 28px compact | The datatable keeps core's fixed row height; compact changes only padding and type | Overriding datatable height breaks scrolling (rule 1) | ADR 0003; findings section 5 |
| 10 | Light and Dark modes of equal quality (BRIEF section 1) | Login, 2FA, password, error, website and portal pages are Light only | Platform constraint, not a parity defect: Frappe renders no `data-theme` on website pages (`templates/base.html:3`; findings section 2), and no dark login artboard was approved | Round 2 lead decision 1 |
| 11 | Calendar events in theme colours, each event keeping its own colour | Dark: one neutral raised chip (`--ins-surface-raised`, `--ins-text-strong`, 14.52:1) with a 4px inline-start stripe in the text colour; the per-event colour is not shown | Frappe writes chip colours inline (`calendar.js:441-449`) and core resets the border colour (`calendar.scss:65`); legible text wins over per-event colour (rule 2). Four scoped `!important` declarations, manifest rows | Round 2 lead decision 2 |
| 12 | Print table header in strong text, weight 600 (`Print` artboard); totals at the inline end | ERPNext formats: header cells stay ERPNext's grey `#7c7c7c`, bold and ruled; ERPNext's cell padding stays; the subtotal block keeps its inline `float: right`, so it stays on the right in Arabic | ERPNext sets these with `!important` and inline style; changing them needs counter-`!important` or an edited format (rule 3) | `docs/team/evidence/round2/print-web/evidence.md` |
| 13 | Error states: a 3px inline-start bar on an empty mandatory field, a 1px inner line on an invalid one, and a ✕ before the message (`States` artboard) | Both states: a 4px inline-start bar, the 1px inner line, and a circle-with-exclamation icon inside the field at the inline end | A non-colour cue that survives focus and forced colours (rule 2); the bar is a border, so it survives core's focus reset | a11y-phase3 finding 7; `docs/team/evidence/round2/css/evidence.md` item 3 |
| 14 | Avatar initials not drawn on the desk artboards (neutral canvas); core pairs each colour at 500 on 50 | The nine desk `--*-avatar-bg`/`--*-avatar-color` pairs map to the approved status token pairs, as the website bundle already did: tinted, at least 7.89:1 in every shipped preset; red and green avatars look like the Rejected and Approved chips | Core's pairs failed 4.5:1 (6 of 9 in Light, 8 of 9 in Dark) (rule 2) | `docs/team/evidence/round3/axe-fixes-css/`; `audits/avatars.py`; OWNER_REVIEW decision 54 |
| 15 | Breadcrumb home glyph in core's position | The home link is a 24x24 target with an inset focus ring; the glyph sits 4px further inline-end and the next crumb 8px | WCAG 2.5.8 target size and a focus ring never clipped by core's `overflow: hidden` (rule 2) | `docs/team/evidence/round3/fix-final/`; OWNER_REVIEW decision 58 |
| 16 | Danger buttons: core white text on the danger fill | `--ins-on-danger` on `--ins-danger` in every state; in Dark the text is dark (`#3a0b0b` on `#fb7e77`, 6.78:1). The pressed state stays core's neutral `!important` colours | White on the Dark danger fill was 2.51:1 (rule 2) | `docs/team/evidence/round3/fix-css2/` |

The `umber` preset is absent because it failed the status-distinguishability audit. This is not a deviation: the brief makes every non-default preset conditional on passing (STATUS decision 10).

## Decision log

| Record | Decision |
|---|---|
| [0001](adr/0001-owner-decisions.md) | Owner decisions: target versions, navigation model, frozen `midad`, per-user presets, fonts, one colour-maths implementation, opt-in behaviour, autonomous delivery |
| [0002](adr/0002-user-preference-storage.md) | Preset and density stored as user defaults; an accessible Appearance page replaces core's theme dialog |
| [0003](adr/0003-palette-delivery-no-flash.md) | The server links the user's palette stylesheet in `<head>`; deterministic selector shapes and key-set parity |
| [0004](adr/0004-generated-site-css-and-fonts.md) | Custom preset and uploaded fonts are per-site generated CSS files, regenerated after a restore |
| [0005](adr/0005-settings-doctype.md) | The settings doctype: fields, permissions, bilingual validation; environment ribbon from `site_config` |
| [0006](adr/0006-test-bench.md) | The reproducible test bench for cloud sessions |
| [0007](adr/0007-interactive-proof.md) | The interactive proof is built from the real compiled CSS (delivered with seven screens; what is still cut is in `docs/proof/README.md`) |
| [0008](adr/0008-action-and-status-hooks.md) | Consequential-action and status hooks in the shell script |
| [0009](adr/0009-login-and-error-page-content.md) | Login and error-page content through core's template slots |
| [0010](adr/0010-contrast-corrections-phase2.md) | Fields on `surface-field`, one Dark value changed, chart series reordered, remaining chart gaps accepted |
