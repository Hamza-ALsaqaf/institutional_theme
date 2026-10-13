# Build plan, Phases 2 to 5

Owner: theme-architect. Written 2026-10-13, at the end of Phase 1. It lists every file to be created, its owning agent (team table in `docs/team/WORKFLOW.md`), its phase, its purpose, and the decision record that governs it. Ownership is exclusive. A file that is not listed here is created only after the lead adds it.

Paths are relative to the repository root. `pkg/` stands for `institutional_theme/`, the Python package. `gen` marks files written by a generator. Each `gen` file carries a "generated, do not edit" header (CSS and SCSS comment, or the JSON key `_generated`) and is never edited by hand.

## Names fixed by this plan

| Kind | Name |
|---|---|
| Desk CSS bundle | `ins_desk.bundle.css` (source `pkg/public/scss/ins_desk.bundle.scss`) |
| Palette bundles | `ins_palette_graphite`, `ins_palette_petrol`, `ins_palette_forest`, `ins_palette_plum`, `ins_palette_umber` (`.bundle.css`). Generated only for presets that pass the Phase 2 audits. |
| Font bundles | `ins_fonts_noto.bundle.css`, `ins_fonts_tajawal.bundle.css`. IBM Plex is inside `ins_desk` and `ins_web`. |
| Shell script bundle | `ins_shell.bundle.js` |
| Web and login bundle | `ins_web.bundle.css` |
| Email bundle | `ins_email.bundle.css`, for the `email_css` hook. Literal values only. |
| Print bundle | `ins_print.bundle.css`. Not hooked; its compiled text is copied into the Print Style. |
| Per-site generated files | `/files/institutional_theme/ins_palette_custom.<h>.css`, `/files/institutional_theme/ins_fonts_uploaded.<h>.css` |
| Audit entry point | `python -m institutional_theme.audits` |
| Pipeline entry point | `python -m institutional_theme.midad.build [--check]` |

## Phase 2: Foundations

| Path | Owner | Purpose | ADR |
|---|---|---|---|
| `pkg/midad/__init__.py` | backend-engineer | Colour package. Never imports Frappe. | 0004 |
| `pkg/midad/colour.py` | backend-engineer | Port of `design/reference/color.mjs`: OKLCH to sRGB with gamut mapping, WCAG contrast, colour-vision simulation, OKLab distance. | D6, 0004 |
| `pkg/midad/model.py` | backend-engineer | Load `generated/model.json`; resolve presets per mode; `custom_preset()`; `custom_palette_css()`. | 0004, 0005 |
| `pkg/midad/emit.py` | backend-engineer | Emit the light, dark and automatic blocks of a family from one key list, using the 0003 selector shapes. | 0003 |
| `pkg/midad/build.py` | backend-engineer | Pipeline: `tokens.json` to `model.json`, generated SCSS and palette bundles. `--check` fails if any output is stale. | 0003, 0004 |
| `pkg/midad/labels.py` | backend-engineer | Translatable human labels for every token in the contrast groups, for modes and for inputs. | 0005 |
| `pkg/midad/generated/model.json` | backend-engineer (gen) | Curves, ramps, semantic and Frappe maps, contrast groups, shipped presets. | 0004 |
| `pkg/midad/tests/__init__.py`, `test_colour.py`, `test_model.py`, `test_emit.py` | backend-engineer | Plain `unittest` with no Frappe: reproduce `design/reference/tokens.resolved.json` exactly; key-set parity for every preset and a sample custom preset; deterministic output. | D6, 0003 |
| `pkg/audits/__init__.py`, `pkg/audits/__main__.py` | backend-engineer | Audit runner: runs every audit, writes `docs/audits/`, exits non-zero on failure. Never imports Frappe. | 0003 |
| `pkg/audits/contrast.py` | backend-engineer | Every pair in `contrast.groups` and `contrast.max`, both modes, every preset. | BRIEF 9.4 |
| `pkg/audits/parity.py` | backend-engineer | Equal key sets per family; `color-scheme` present in light, dark and automatic; palette and custom files hold custom properties only. | 0003 |
| `pkg/audits/colour_vision.py` | backend-engineer | Chart and status distinguishability under colour-vision simulation. `forest` and `umber` must pass or be dropped. | D4 |
| `pkg/audits/dead_tokens.py` | backend-engineer | Every overridden Frappe variable exists in core's compiled CSS or is consumed by the theme. Runs when `--core-css PATH` is given. | BRIEF 9.4 |
| `docs/audits/contrast.txt`, `contrast.json`, `parity.txt`, `colour_vision.txt`, `dead_tokens.txt` | backend-engineer (gen) | Audit output. `contrast.json` feeds the proof panel. | 0007 |
| `pkg/public/scss/generated/_tokens.scss` | backend-engineer (gen) | `midad` `--ins-*` colour tokens at the base shapes, plus `color-scheme` per block. | 0003 |
| `pkg/public/scss/generated/_frappe_map.scss` | backend-engineer (gen) | Frappe variables mapped to `var(--ins-*)` at the palette shapes. | 0003 |
| `pkg/public/scss/generated/_scale.scss` | backend-engineer (gen) | Type, spacing, radius, motion and z tokens; comfortable, compact and coarse-pointer blocks. | 0003 |
| `pkg/public/scss/generated/_literals.scss` | backend-engineer (gen) | Sass variables holding literal light `midad` hex values, for the email and print bundles. | 0004 |
| `pkg/public/scss/generated/ins_palette_<name>.bundle.scss` | backend-engineer (gen) | One file per shipped non-`midad` preset. | 0003 |
| `pkg/public/fonts/plex/*`, `pkg/public/fonts/noto/*`, `pkg/public/fonts/tajawal/*`, each with `OFL.txt` | backend-engineer | WOFF2 subsets for screen and TTF for print; licences kept. | 0004 |
| `pkg/public/scss/fonts/_plex.scss`, `pkg/public/scss/fonts/ins_fonts_noto.bundle.scss`, `pkg/public/scss/fonts/ins_fonts_tajawal.bundle.scss` | backend-engineer (an exception to css-engineer's folder) | `@font-face` with private names, `font-display: swap`, the Arabic `unicode-range`, and font variables. | 0004 |
| `pkg/fonts.py` | backend-engineer | Magic-number check; `uploaded_font_css()`; the Print Style font block. | 0004 |
| `pkg/institutional_theme/doctype/__init__.py`; `pkg/institutional_theme/doctype/institutional_theme_settings/__init__.py`, `.json`, `.py`, `.js`, `test_institutional_theme_settings.py` | backend-engineer | Settings Single: fields, validation, messages. | 0005 |
| `pkg/public/scss/ins_desk.bundle.scss` | css-engineer | Entry, wrapped in `rtl:begin:ignore`: imports the generated partials, `fonts/_plex`, then `desk/*`. | 0003 |
| `pkg/public/scss/desk/_base.scss` | css-engineer | `font-synthesis: none`, focus ring, selection, caret, scrollbars, and every forced-colors rule. | 0003 |
| `tests/browser/cascade.mjs` | css-engineer | Computed-style proof that the theme wins in Light, Dark and Automatic. | 0003 |
| `.github/workflows/ci.yml` (edit) | backend-engineer | Add `python -m unittest discover -s institutional_theme/midad/tests` and `python -m institutional_theme.midad.build --check`. | 0004 |
| `docs/DESIGN_SYSTEM.md` (token tables) | scribe (gen from `model.json`) | Light and Dark tables with computed contrast. | BRIEF 9.2 |

## Phase 3: P0

| Path | Owner | Purpose | ADR |
|---|---|---|---|
| `pkg/hooks.py` (edit) | backend-engineer | Enables `app_include_css`, `app_include_js`, `web_include_css`, `email_css`, `update_website_context`, `extend_bootinfo`, `jinja`, and the install hooks. Each is enabled only with its target file. | 0003 |
| `pkg/preferences.py` | backend-engineer | `get_effective(user)`. | 0002 |
| `pkg/api.py` | backend-engineer | `set_appearance`. | 0002 |
| `pkg/boot.py` | backend-engineer | `extend_bootinfo` → `bootinfo.ins`. | 0002 |
| `pkg/website.py` | backend-engineer | `update_website_context`: guarded, builds new lists, checks the manifest. | 0003 |
| `pkg/site_files.py` | backend-engineer | `ensure()`: atomic writes, content-hash names, pruning. | 0004 |
| `pkg/identity.py` | backend-engineer | Write-through, prior values, uninstall restore, the Jinja `ins_identity()`. | 0005 |
| `pkg/install.py` | backend-engineer | `after_install`, `after_migrate`, `before_uninstall`. | 0002, 0004, 0005 |
| `pkg/institutional_theme/page/__init__.py`; `pkg/institutional_theme/page/ins_appearance/__init__.py`, `ins_appearance.json`, `ins_appearance.js` | backend-engineer | The Appearance page. | 0002 |
| `pkg/public/js/ins_shell.bundle.js` | backend-engineer | Entry; sets density at evaluation. | 0003, 0008 |
| `pkg/public/js/shell/form_status.js`, `actions.js`, `masked_fields.js`, `ribbon.js` | backend-engineer | Attribute hooks. | 0008 |
| `pkg/tests/__init__.py`, `test_preferences.py`, `test_api.py`, `test_website_hook.py`, `test_site_files.py`, `test_identity.py`, `test_install.py` | backend-engineer | Frappe tests (`bench run-tests --app institutional_theme`). | 0002–0005 |
| `tests/browser/first_paint.mjs`, `appearance_keyboard.mjs`, `actions.mjs` | backend-engineer | CDP screencast first paint; keyboard-only Appearance page; action tagging in both languages. | 0002, 0003, 0008 |
| `tools/bench/test_fixtures.py` | backend-engineer | Creates, on the test site only (`bench --site … execute`), a submittable doctype with a two-step workflow and its records. It is not an app `fixtures` hook, so nothing reaches production sites. | 0008 |
| `pkg/public/scss/desk/_shell.scss` | css-engineer | Desktop page, sidebar, search, notifications, account menu. | 0003 |
| `pkg/public/scss/desk/_page_head.scss` | css-engineer | Sticky head, breadcrumbs, title pill. | 0003 |
| `pkg/public/scss/desk/_workspace.scss` | css-engineer | Number Cards, shortcuts, link cards, onboarding. | 0003 |
| `pkg/public/scss/desk/_list.scss` | css-engineer | List, filters, group-by, bulk actions, sticky columns, empty state. | 0003 |
| `pkg/public/scss/desk/_form.scss` | css-engineer | Tabs, sections, timeline, attachments, assignments, banners, connections. | 0003 |
| `pkg/public/scss/desk/_controls.scss` | css-engineer | Every control state, read-only distinct from disabled. | 0003 |
| `pkg/public/scss/desk/_grid.scss` | css-engineer | Child tables. | 0003 |
| `pkg/public/scss/desk/_reports.scss` | css-engineer | Datatable (padding and type only, never height), tree reports, totals. | 0003 |
| `pkg/public/scss/desk/_overlays.scss` | css-engineer | Dialogs, message boxes, toasts, freeze, menus, tooltips, popovers, autocomplete, date pickers. | 0003 |
| `pkg/public/scss/desk/_scoped_variables.scss` | css-engineer | Core's descendant re-declarations (findings section 2). | 0003 |
| `pkg/public/scss/desk/_hardcoded.scss` | css-engineer | Core's hard-coded colours (findings section 2). | 0003 |
| `pkg/public/scss/desk/_status.scss`, `_actions.scss`, `_masked.scss`, `_ribbon.scss` | css-engineer | CSS on `data-ins-*` only. | 0008 |
| `pkg/public/scss/desk/_appearance.scss` | css-engineer | Appearance page swatches. | 0002 |
| `tests/browser/order_independence.mjs`, `tests/browser/screens.mjs` | css-engineer | Palette before `ins_desk` gives equal values; P0 screenshots in both modes, both languages and both densities. | 0003 |
| `pkg/public/scss/ins_web.bundle.scss` | print-web-engineer | Website and login entry: light tokens, Plex, `font-synthesis`, forced-colors. | 0003 |
| `pkg/public/scss/web/_login.scss`, `_website.scss`, `_error_pages.scss` | print-web-engineer | Login, 2FA, forgot-password; `html body[data-path="login"]` out-ranks `login.bundle.css`. | 0003 |
| `pkg/public/images/ins_emblem_placeholder.svg`, `ins_wordmark.svg`, `ins_wordmark_dark.svg`, `ins_wordmark_mono.svg`, `ins_favicon.svg` | print-web-engineer | Neutral placeholder identity. | 0005 |
| Login and error-page content (notice, support contact, version and environment line, reference ID) | print-web-engineer | Mechanism not yet decided. Governed by ADR 0009, which the theme-architect writes before print-web starts this item. | 0009 (pending) |

## Phase 4: P1, P2 and the proof

| Path | Owner | Purpose | ADR |
|---|---|---|---|
| `pkg/public/scss/desk/_dashboard.scss`, `_kanban.scss`, `_calendar.scss`, `_tree.scss`, `_gantt.scss`, `_states.scss`, `_editors.scss`, `_print_preview.scss` | css-engineer | P1 views and global states. | 0003 |
| `tools/proof/build_proof.py`, `tools/proof/proof.js`, `tools/proof/strings.json`, `tools/proof/partials/*.html` | css-engineer | Proof builder. | 0007 |
| `docs/proof/midad-proof.html` (gen), `docs/proof/README.md` | css-engineer | The proof and its measured size. | 0007 |
| `tests/browser/proof_parity.mjs` | css-engineer | Proof matches product. | 0007 |
| `pkg/public/scss/ins_email.bundle.scss` | print-web-engineer | Email header and footer, from `_literals.scss`. | 0004 |
| `pkg/public/scss/ins_print.bundle.scss` | print-web-engineer | Print Style rules without fonts: A4 and Letter, watermark, signature blocks. | 0004 |
| `pkg/print/letter_head.html`, `pkg/print/letter_head_footer.html` | print-web-engineer | Jinja using `ins_identity()`. | 0005 |
| `pkg/print/__init__.py`, `pkg/print/ship.py` | backend-engineer | Idempotent Print Style and Letter Head, checksums in `set_global`, font block. | 0004 |
| `pkg/public/js/shell/idle_warning.js`, `connection_banner.js`; `pkg/public/scss/desk/_banners.scss` (css-engineer) | backend-engineer | Opt-in behaviours (D7). | 0005 |
| `pkg/audits/budgets.py`; `docs/audits/budgets.txt` (gen) | backend-engineer | Size budgets from the built `dist`. | BRIEF 8 |
| `pkg/tests/test_print_ship.py` | backend-engineer | Ships once and never overwrites an administrator's change. | 0004 |

## Phase 5: Documentation

| Path | Owner | Purpose | ADR |
|---|---|---|---|
| `docs/DESIGN_SYSTEM.md` (prose) | theme-architect | Thesis, principles, decision log. | all |
| `docs/DESIGN_SYSTEM.md` (tables), `docs/DEPENDENCY_MANIFEST.md`, `docs/UPGRADE_AND_QA_CHECKLIST.md`, `docs/FONTS.md`, `README.md` | scribe | Built from code and audits. | all |
| `pkg/translations/ar.csv` | scribe (every phase, after each engineer's task) | Arabic entries for every `_()` and `__()` string. | all |
| `docs/team/reviews/*-phaseN.md` | a11y-rtl-reviewer, upgrade-reviewer | Reviews. | — |

## Parallel work in Phase 3

At most three agents run at once (WORKFLOW rule 1). These three run concurrently with disjoint files:

- **css-engineer**: `pkg/public/scss/ins_desk.bundle.scss`, `pkg/public/scss/desk/*`, `tests/browser/order_independence.mjs`, `tests/browser/screens.mjs`.
- **backend-engineer**: `pkg/*.py`, `pkg/hooks.py`, `pkg/institutional_theme/page/*`, `pkg/public/js/*`, `pkg/tests/*`, and its own `tests/browser/*`.
- **print-web-engineer**: `pkg/public/scss/ins_web.bundle.scss`, `pkg/public/scss/web/*`, `pkg/public/images/*`.

The contracts between them are the attribute names in 0008, the class names in 0002 and the generated partials from Phase 2; none of these is edited in Phase 3. `scribe` runs after them, on `ar.csv`. In Phase 4, css-engineer (desk views, then the proof) and print-web-engineer (print and email) run in parallel; backend-engineer's `print/ship.py` waits for `ins_print.bundle.scss`.
