# Upgrade review, round 4 (`11a3a36..origin/build/midad-v1`, 5c00b56)

Scope: product code first. That is `design/tokens.json`, the regenerated files, the 14 changed SCSS partials, `_dock.scss`, `ins_email.bundle.scss`, `field_errors.js` and `a11y_rules.js` (one comment). Then the audit package (`dead_tokens.py`, `counterparts.py`, `effective_diff.py`, `counterparts.json`, both snapshots) and the bench helpers (`newest_site.sh`, `sync_assets.sh/.py`, `b.sh`, `b52.sh`, `env52.sh`, `gate52.sh`). Last, the manifest section 2k, the checklist diff, ADR 0011 and the evidence where a claim depends on it.

Sources I read:
- Frappe `/tmp/src/frappe-16.32.0` (`v16.32.0`) and `/tmp/src/frappe-16.52.0` (`v16.52.0`).
- frappe-gantt from both benches' `node_modules`: 0.6.1 and 1.1.0.
- ERPNext 16.33.0 from `/home/frappe/frappe-bench/apps/erpnext`.
- HRMS **v16.20.1**, cloned fresh into `/tmp/r4src/hrms-16.20.1`, because neither bench has HRMS.

I changed nothing on either bench.

## What I ran (VERIFIED)

| Check | Command | Result |
|---|---|---|
| ruff check | `uvx ruff@0.16.8 check .` | All checks passed |
| ruff format | `uvx ruff@0.16.8 format --check .` | 131 files already formatted |
| Unit tests, midad | `python3 -m unittest discover -s institutional_theme/midad/tests -t .` | 145 tests OK |
| Unit tests, audits | `python3 -m unittest discover -s institutional_theme/audits/tests -t .` | 110 tests OK |
| Generated files | `python3 -m institutional_theme.midad.build --check` | 12 checked, 0 stale |
| Audits | `python3 -m institutional_theme.audits` | passed. F1 combined dead 0, counterparts 30 pairs and 0 findings, contrast 0 failing, budgets 0 problems |
| 16.32.0 map movement over the whole round | `python3 -m institutional_theme.audits.effective_diff --ref 11a3a36 --version 16.32.0` | 798 effective declarations before and after, 0 changed, 0 `--ins-*` values changed |

I ran on Python 3.12.3; CI uses 3.14. The audit run rewrote `docs/audits/dead_tokens.txt` and `budgets.txt` in my working tree. I did not commit them (see N4).

## What holds

- **No core edit, no monkey-patching, no DOM restructuring.** Round 4 changes no Python in the app: `hooks.py`, `install.py` and `patches.txt` are not in the diff. The only JS changes are:
  - `field_errors.js`: it now reads two more class names and still writes only `aria-invalid`;
  - a comment in `a11y_rules.js`.
- **No version sniffing.** `frappe.boot`, `version` and `__version__` do not occur in any added product line. The only version read in the diff is in test tooling (`cascade.mjs`, which reads the bench's `__version__`). No bundle is specific to a version.
- **No new `!important`.** The diff adds no `!important` declaration; the one hit is a comment in `ins_email.bundle.scss`. The SCSS still has 14 declarations once comment lines are removed, which matches the manifest section 4 count from round 3.
- **No datatable row or cell height.** The only added line that mentions a datatable is the `_base.scss:34` focus-offset list. It sets `outline-offset` and nothing else.
- **Logical properties and rtl wrappers.**
  - `_dock.scss` is imported inside the desk bundle's ignore wrapper (`ins_desk.bundle.scss:3,13,38`). The login additions sit inside `ins_web`'s wrapper.
  - New desk and web rules use `inset-inline-*`, `margin-inline` and `padding-inline-*` only.
  - `ins_email` uses `border-left` (`:183`), which falls under the ADR 0004 email exception stated at the top of that file.
  - `[dir="rtl"] .gantt-container { direction: ltr }` is direction-specific on purpose, as in round 3.
- **`tokens.json` keeps the approved values; only the mappings moved.** Every hunk against 11a3a36 is inside the `frappe` block. It adds `frappe.vars` keys, remaps `frappe.vars` keys and adds step 950 to `raw_gray_*`. The layer-1 ramps, the semantic tokens and the scale are unchanged. `night.450` and the 950 steps already existed in 11a3a36 (`tokens.json:30,61,68`). The regenerated `_tokens*.scss` adds only ramp steps that are now referenced (for example `--ins-night-450`), and `effective_diff` reports 0 changed `--ins-*` values.
- **R3(a), names that have an effect in 16.32.0.** Not one of them moved: effective diff, above.
- **R3(b), the 25 remapped names that 16.32.0 "never reads".** I confirmed this three ways. Each search found no reader:
  - `var(--name)`, `"--name"` and `'--name'` in Frappe 16.32.0 `frappe/**/*.{js,vue,html,scss,css,py,jinja,json}`;
  - the built 16.32.0 `sites/assets/{frappe,erpnext}/dist` (CSS and JS);
  - HRMS 16.20.1 `hrms/**` (desk source).

  The names are `--surface-gray-5/6/10`, `--surface-red-5/6/7`, `--surface-green-3`, `--surface-amber-3`, `--ink-white`, `--ink-base`, `--ink-red-1/2/3`, `--ink-{green,amber,blue}-2`, `--ink-{cyan,pink,violet}-1`, `--outline-gray-5`, `--outline-red-1/3`, `--outline-{green-1,green-2,amber-1,amber-2,blue-1,orange-1}`.

  The only source readers of any added name are `--radius-lg` (`core/doctype/error_log/error_log.js:78,86`) and `--radius-md` (`desk/page/desktop/desktop.css:69`); see N1.
- **Selectors and variables spot-checked in both trees: 62 names in v16.52.0 and 21 in 16.32.0.** Each exists where the code cites it, or is absent where the code says "matches nothing there". The exceptions are N1b and N1d.
  - Button: `.es-button[data-variant]`, the ten `--bt-*` locals (`css/espresso/components/button.css`), `--es-bt-h`, `--icon-stroke: currentColor` (`legacy.css:46`).
  - Dock and sidebar: `body.dock-pinned .dock` (`dock.scss:223`), `.dock-item`, `.body-sidebar-top`, `.nested-container`, `.sidebar-item-container`, `.sidebar-panel`, `.panel-header-actions`.
  - Menu and popover: `.es-menu` (`menu.css:44`), `.es-menu__item`, `.es-popover`.
  - Toast: `.es-toast[data-type=info|success|warning|error]` (`toast.css:78-91`), `--es-toast-icon` (`:37,99`), and the toast's reads of `--surface-gray-9`, `--ink-base` and `--outline-gray-3` (`:47,48,133,155`).
  - Badge: `--c-fill`, `--c-fg`, `--c-line` (`badge.css:7-14`), `data-theme="amber"` and `"violet"` (`:71,87`), `.page-indicator-pill` (`ui/page.html:24`).
  - Breadcrumbs, pills and tabs: `.es-breadcrumbs__item`, `.es-tab-buttons`, `.es-pill`.
  - Form controls: `has-error-mandatory` and `has-error-invalid` (`base_input.js:270-286`, always set together with `has-error`).
  - Login: `password-strength-indicator`, `password-hint`, `password-mismatch-message`, `a[href="#forgot"]` (`www/login.html:37`).
  - Mapped variables: `--desk-sidebar-bg` (`sidebar.scss:24,28`), `--surface-elevation-3`, `--surface-alpha-gray-2`, `--outline-elevation-2`, `--focus-outline-default`, `--text-p-xs`, `--font-weight-semibold`, `--elevation-2xl`, `--bg-amber`, `--text-on-violet`, `--surface-gray-10`, `--ink-base`.
  - frappe-gantt 1.1.0 `dist`: `.current-upper`, `.current-highlight`, `.current-ball-highlight`, `.current-date-highlight`, `.grid-header`, `--g-today-highlight`, `--g-popup-actions`, `--g-weekend-highlight-color`, `--g-row-border-color`, `--g-expected-progress`, `--g-handle-color`, `--g-text-light`.
  - Absent in 16.32.0 (0 files under `frappe/public|desk|templates|www`): `.es-menu`, `.es-badge`, `.es-toast`, `.es-breadcrumbs`, `.es-tab-buttons`, `.es-pill`, `.sidebar-panel`, `.panel-header-actions`, `dock-item`, `dock-pinned`, `.current-upper`.
  - Present in 16.32.0 as cited: `.body-sidebar-container.expanded .overlay` `rgba(128,128,128,.5)` (`sidebar.scss:256`); the `.gantt-modern` scope (`gantt_view.js:96`, the only `new Gantt` in Frappe and ERPNext).
- **`sync_assets.sh` and `newest_site.sh` are test-bench only.**
  - They live in `tools/bench/`, outside the Python package. No hook or app module calls them, and `public/dist` is git-ignored (`.gitignore:6`). A user's `bench get-app` builds its own dist and never runs these scripts.
  - The premise that the bytes do not depend on the Frappe version holds:
    - both benches have esbuild 0.14.54, sass 1.69.5, rtlcss 4.1.1, postcss 8.4.31 and autoprefixer 10.4.16;
    - `esbuild/esbuild.js` differs only in plugin order (`:294`);
    - no theme SCSS imports Frappe SCSS (grep of `@import` and `@use`).
  - The served bundle name is the same on both sites (`ins_desk.bundle.SJUYZ6UF.css`, `tokens/screens/assets-*.txt`).
  - Two residual risks, both test-only: `sync_assets.py:57` rewrites `assets.json` in place (not atomically), and `b.sh build` now silently rewrites the other bench's `assets.json`.
- **The README and `pyproject.toml` do not overclaim.** Neither is in the diff. README:7 still says "Verified target: Frappe 16.32.0" and nothing mentions v16.52.0. `pyproject.toml:20` (`>=16.32.0,<17.0.0`) is unchanged, as ADR 0011 R7 requires. The R7 table is not yet in the checklist. That is consistent with the range not having moved, and the table is due at the release gate.

## 1. Blocking

**B1. On v16.52.0, user tags are painted as statuses: a status glyph and a status colour on every tag.** This blocks the R7 range claim for v16.52.0 only. It has no effect on 16.32.0.
- **Where:** `_status.scss:150` puts a `::before` shape on every `.es-badge[data-theme]`. The `@each` at `_status.scss:160-176` (rules at `:164` and `:170`) maps `blue`, `green`, `amber`, `red` and `violet` to the progress, success, pending, danger and plum families, with the dot, check, half, cross and diamond shapes.
- **Proof in Frappe v16.52.0:**
  - The form sidebar builds tags with `frappe.ui.TagEditor` (`form/sidebar/form_sidebar.js:208`), which renders each tag as `frappe.ui.badge({ theme: this.get_tag_theme(label), css_class: "form-tag", … })` (`ui/tags.js:116-124`).
  - `get_tag_theme` hashes the label onto `["blue", "green", "amber", "red", "violet"]` (`ui/tags.js:152-160`).
  - `badge.js:48` writes `data-theme` for every theme except gray.
- **Failure:** on a form with tags (the form is a P0 screen), a tag such as "Urgent" can carry a green check and the success pair, and "Approved" can carry a red cross and the danger pair. The tag's colour is a hash, but the theme makes it read as a workflow state. That breaks the status language (shape and colour are meaning, BRIEF section 3 rule 1).
- **Why the checks missed it:** `fixture_v52.html` has no `.form-tag`, and the P0 captures have no tagged document.
- **Smallest fix:** add `:not(.form-tag)` to the shape and colour selectors (`_status.scss:146,150,164,170`). The other way is to scope them to the status hosts actually rendered: list status (`list_view.js:1499,1896`), `.page-indicator-pill`, `[data-filter]`. Then add a tagged `.form-tag` fixture to `cascade.mjs` that asserts no `::before`.
- **Evidence:** COMPUTED from source. Not rendered.

## 2. Non-blocking

**N1. The 16.32.0 no-regression claim is true only for the generated map. Six hand-written or source-read changes move 16.32.0, and four of them are not acknowledged.** The claim "RESULT: Frappe 16.32.0 does not move" (`effective_diff.py:131`, evidence `effective-diff-16.32.0.txt`) checks only `_frappe_map.scss` declarations against the snapshot's `read` set. Hand-written rules and readers outside dist CSS are not covered. These move on 16.32.0:

| # | This repository | 16.32.0 proof | What a 16.32.0 site sees | Acknowledged? |
|---|---|---|---|---|
| a | `_gantt.scss:60` `.gantt .tick.thick { stroke: border-strong }` | frappe-gantt 0.6.1 has `.gantt .tick.thick` (`dist/frappe-gantt.css:22`) and adds `thick` for Mondays, first weeks and quarters (`src/index.js:381-398`) | Thick grid lines in the Gantt view become darker (they were `--ins-border` through the theme's `.gantt .tick`) | No. `selectors/desk.md` G5 says "(n/a)" for 16.32.0, which is wrong |
| b | `_base.scss:33-34` adds `.body-sidebar-top` to the inset-ring list | `ui/sidebar/sidebar.html:19`, `scss/desk/sidebar.scss:53,63` (`overflow-y: auto`) | The keyboard focus ring on 16.32.0 sidebar rows moves from outset to inset | No. The comment says "v16.52.0 adds" |
| c | `_login.scss:185` `.email-field input { padding-inline-start: 38px }` (was `padding-inline: 38px`) | `www/login.html:18-23` (start icon only) | Email inputs on login and forgot lose 38px of end padding, so long addresses show more text | No |
| d | `_actions.scss:72-78` `.es-button { --icon-stroke: currentColor; --bt-disabled-* }` | `ui/toolbar/about.js:62` `<button class="es-button hidden" data-variant="ghost">` | The About dialog's copy-versions glyph strokes in text colour | No. `_actions.scss:57` says "16.32.0 has no `.es-button`", which is false |
| e | `_hardcoded.scss:11` scrim | `sidebar.scss:256` | The mobile drawer scrim becomes the token scrim | Yes (`desk.md` G8) |
| f | `tokens.json:582-583` `--radius-md`, `--radius-lg` | `desktop.css:69` (`.desktop-cloud-settings`, hidden unless `frappe.boot.cloud_settings`, `desktop.js:429-431`); `error_log.js:78,86` (inline `<style>` in the Error Log form) | Radius 0 becomes 6px on two non-P0 elements | Yes (`source-scan-16.32.0.txt:8-13`, `test_round4_map.py:99-102`). But the `note` at `tokens.json:582-583` says "v16.52.0 only" |

- **Judgement on f, the radius:** acceptable.
  - Core plainly meant a radius. A `var()` with no declaration and no fallback resolves to 0, which is a core defect in 16.32.0. The 6px value is the approved container tier (`tokens.json:266`).
  - Neither element is on a P0 screen.
  - It changes no colour or contrast, and no layout (border-radius does not affect the box).
- **Judgement on a to e:** each is cosmetic and is, on its face, an improvement (the ring is no longer clipped, the scrim follows Dark). None changes a contrast pair or a layout box beyond (c). So none is a regression in function. But the round's never-sacrifice rule is "no regression on 16.32.0", and the evidence states "does not move" without these qualifications.
- **Smallest correction:**
  - list a to f in the checklist as intended 16.32.0 changes;
  - correct the comments at `_actions.scss:57` and `_base.scss:33` and the G5 row in `desk.md`;
  - change the notes at `tokens.json:582-583` to "16.32.0: two source readers, see SOURCE_READERS";
  - make `effective_diff` say "of the compiled-CSS readers" (or take the `SOURCE_READERS` list as extra readers).
- **Evidence:** COMPUTED from source. No before/after capture of 16.32.0 against round 3 exists in `docs/team/evidence/round4/`. The P0 captures were reviewed for defects but not compared with the round-3 baseline.

**N2. R3(b) gives globally visible Espresso names a new meaning on 16.32.0 too. Other apps on the owner's bench that read them with the 16.32.0 meaning would invert.**
- **Where:**
  - `tokens.json` `--ink-red-3` is now `red.200` / `red.700`. Frappe 16.32.0 declares it as text red: `#e03636` (`scss/espresso/_colors.scss:264`).
  - `--ink-cyan-1`, `--ink-pink-1` and `--ink-violet-1` moved from the 700 step (text) to the 50 step (near white).
  - `--surface-red-7` and `--ink-white` moved similarly.
- **What I verified:** Frappe, ERPNext, both built dists and HRMS 16.20.1 have no reader (above).
- **What I could not verify:** BRIEF and CLAUDE.md say the owner's bench has other custom apps. I cannot see them.
- **Failure, if one of them reads `var(--ink-red-3)` for error text:** on 16.32.0, with the theme installed, that text turns light pink on white.
- **Smallest correction:** add a coexistence row to the manifest and a README Troubleshooting line. List the 25 R3(b) names and give the check: `grep -rn "var(--\(ink\|surface\|outline\)-" apps/<app>`.

**N3. Holes in the audit semantics. None lets a currently dead token pass.**
- **(a) Comments count as use.** `scan_theme` (`dead_tokens.py:193-201`) does not strip comments; `scan_theme_declared` does (`:216`). So any `var(--x)` written in a theme comment puts `--x` in the "theme" category, and F1 can never fail for it.
  - Today 8 non-`--ins-` names are read only in comments: `--gray-300/400/500`, `--pink-avatar-bg`, `--purple-avatar-bg/color`, `--scrollbar-thumb/track-color`. I computed this.
  - All 8 are declared by core in both snapshots, so nothing is masked now.
  - Fix: apply the same `_BLOCK_COMMENT` and `_LINE_COMMENT` strip in `scan_theme`.
- **(b) Inert in every version passes F1.** Eleven mapped names are declared but read by no scanned stylesheet in either version, and the audit counts them as live: `--bg-dark-blue`, `--border-primary`, `--brand-color`, `--diff-changed`, `--divider-color`, `--outline-gray-modals`, `--outline-white`, `--surface-cards`, `--text-on-dark-blue`, `--text-on-dark-gray`, `--text-tiny`. ADR 0011 R5 allows this (F1 = "no version declares or reads it"). Fix: report "inert in every version" as its own line, so a truly inert remap is visible.
- **(c) The merge order mislabels.** `combine` ranks `declared-only` above `read-only` (`dead_tokens.py:55-57,264`). A name declared only in 16.32.0 and read only in v16.52.0 is therefore reported in the combined column as "inert", although it acts in v16.52.0. The report is wrong; F1 is not affected.
- **(d) The read set is dist CSS only.** `effective_diff` and the snapshots read only `sites/assets/*/dist/css{,-rtl}`. Page stylesheets (`desk/page/*/*.css`) and inline `<style>` in JS are outside, and those are exactly the two 16.32.0 readers found by hand (N1f). Fix: fold `tools/bench/source_scan.py`'s read set into `effective_diff`, or run it in the checklist step.
- **(e) F2 details.** F2(i) accepts a 16.32.0 side that is only declared. F2(iii) compares the default preset only. That is safe today: the palette bundles re-declare no Frappe name, as a grep of `ins_palette_plum.bundle.scss` for non-`--ins-` properties shows.

**N4. The committed generated reports and the checklist counts do not match HEAD.**
- `docs/audits/dead_tokens.txt` says 483 watched, 83 dead in 16.32.0, and 429 and 448 declared-and-read. HEAD produces 484, 84, 430 and 449, because c64f9aa added `--es-toast-icon`.
- `budgets.txt` says desk 120.6 KB and web 59.7 KB; HEAD builds 139.6 KB and 59.9 KB.
- `UPGRADE_AND_QA_CHECKLIST.md:26` (B6) quotes the stale numbers.
- `p0/README.md` says both reports "were reverted" on purpose.
- Both files say "do not edit", and CI does not check that they are current.
- Fix: regenerate both, commit them, and update B6.

**N5. The manifest has no row for several round-4 dependencies.** `grep` of `DEPENDENCY_MANIFEST.md` finds 0 hits for each of:
- `.gantt .tick.thick` (`_gantt.scss:60`);
- `.es-toast[data-type]` / `--es-toast-icon` (`_overlays.scss`, c64f9aa);
- `.body-sidebar-top` (`_base.scss:34`);
- `body.dock-pinned` (`_banners.scss`, `_ribbon.scss`);
- `.current-upper` and `.gantt-container:has(> .grid-header) .popup-wrapper` (`_gantt.scss`);
- `[class^="for-"]`. Row 99 still describes the explicit class list;
- the two 16.32.0 source readers of `--radius-md` and `--radius-lg`.

`manifest_selectors.py` will not check these at the next tag. Fix: add the rows to 2k with a line for each version.

**N6. `[class^="for-"]` (`_login.scss:40,456`) depends on the order of class names in core's markup.**
- It matches only when the class attribute *starts* with `for-`. That is true today in both versions (16.32.0 `www/login.html:118,134,149,164,193`, `update-password.html:14`; v16.52.0 `login.html:107,123,138,153,180`, `update-password.html:15`).
- But the v16.52.0 login templates are moving to utility classes (`login.html:13` labels, `:156` `form-signin form-forgot hide flex flex-col gap-8`). One utility class placed before `for-login` would silently drop every card rule on both versions. It also matches any web page's `[class^=for-] .page-card`.
- The comment says the change was made to fit the web budget (59.9 of 60.0 KB).
- Fix: restore `:is(.for-login, …)` and record the overrun in `budgets.py` `JUSTIFIED`, or find the bytes elsewhere.

**N7. Bundle size: desk +19 KB, web at 99.8 % of budget.** `ins_desk` grew from 120.6 to 139.6 KB raw (93 % of 150), `ins_web` is at 59.9 of 60.0 KB, and gzip is 16.4 and 9.6 KB. This is measured by my audit run, from the dist found by `budgets.py`. Most of the desk growth is the `es-badge` `@each` and the side-by-side selectors, which is the expected cost of R1. The web bundle has no room left for the next fix.

**N8. Generic class names on the 16.32.0 desk.**
- `html:root[dir] body:not(.dock-pinned) .dock` (`_dock.scss:27`) gives a border and radius to any element with class `dock` on 16.32.0, where core has none.
- `.sidebar-panel` and `.panel-header .panel-header-actions span` (`_dock.scss:35,40`) are equally broad.
- No hit in Frappe 16.32.0, ERPNext 16.33.0 or HRMS 16.20.1 desk code. ERPNext and HRMS `.panel-header` occur only in email templates, which never load `ins_desk`.
- Fix (optional): `.dock:has(> .dock-items)`, or scope to `body > .dock`.

**N9. Notes.**
- `.es-badge[data-variant="solid"]` reads `--c-solid-bg` and `--c-solid-fg` (`badge.css:10-11`), which the theme does not repoint. Solid badges keep core's gray-10 ink. Today only `data-variant="subtle"` occurs in Frappe JS.
- `_banners.scss` assumes `.dock` is a direct child of `body` when it is pinned. I did not open `dock.js` to confirm where it mounts, and no capture combines a banner with a pinned dock.
- `cascade.mjs` still defaults `--bench` to `/home/user/frappe-bench`, a path that does not exist on this machine. It needs the flag.

## 3. Scores (BRIEF section 10, my dimensions)

| Dimension | Score | Evidence |
|---|---|---|
| Upgrade-safety | 4/5 | **Holds:** no core edit, no sniffing, no new `!important` (14, unchanged), no datatable height. 83 name checks resolve in the right tree, apart from the two wrong 16.32.0 comments (N1b, N1d). The generated map does not move 16.32.0 (VERIFIED over the whole round). R3(b) names have no reader in Frappe, ERPNext, both dists or HRMS 16.20.1 (VERIFIED). The bench helpers cannot reach a user. **Held below 5 by:** B1 (v16.52.0 tags), the unacknowledged 16.32.0 movements (N1a-d), the global-meaning risk for unseen apps (N2) and the generic `.dock` selector (N8). |
| Performance | 4/5 | Within every budget (VERIFIED). The new `:has()` rules are anchored to a direct child (`:has(> .grid-header)`, `:has(> .field-icon)`). The rail rule `:has(> .nested-container.hidden .active-sidebar)` is evaluated per sidebar item but scoped to the collapsed rail. Held below 5 by +19 KB desk and the 0.1 KB web headroom (N7), which already forced the fragile selector of N6. |
| Documentation | 3/5 | Good: ADR 0011 is precise; every new rule carries `16.32.0: path:line` / `v16.52.0: path:line`; manifest 2k exists; the source scan honestly names the two 16.32.0 readers. Gaps: the committed reports and B6 counts are stale (N4), seven dependencies have no manifest row (N5), three comments or notes are false about 16.32.0 (N1), and the "does not move" result is unqualified (N1, N3d). |
| Craft | 4/5 | Component-local repointing instead of global repurposing (R4), as core itself does. Same-specificity `:is()` for the error classes. `:has(> .grid-header)` cleanly separates the two gantt majors. Audit modules are tested (110 tests) and F2 is enforced. B1 is a selector that is too broad. N3a is an asymmetry in comment stripping. N6 trades robustness for bytes. |

On my dimensions, the gate (every dimension at 4 or more) does not pass until Documentation reaches 4. N4 and N5 plus the comment corrections in N1 are enough for that.

B1 must be fixed before the range claims v16.52.0. It does not block a release whose range stays 16.32.0.

## 4. Not verified

- B1 and every item of N1 on a live site: all COMPUTED from source. Rendering them would change `midad.test` or `midad52.test`.
- Whether the owner's other custom apps read any R3(b) name (N2). I have no access to them.
- That both benches produce byte-identical theme bundles. I compared toolchain versions and `esbuild.js`, not a fresh build on each, because a build rewrites the shared dist.
- The HRMS PWA (`frontend/`) and `frappe/ui` consumers. These are SPAs with their own CSS, not desk pages; I did not scan them.
- R7 checks 7 to 11 on v16.52.0 (screens, axe, `bench run-tests`, print and email, install and uninstall gate). I read `p0/README.md` and did not re-run them.
- frappe-gantt 1.1.0 in RTL, and the pinned-dock banner grid (N9).

## Re-check after fix round

Range: `git diff 84318a4..origin/build/midad-v1`, read at 0bbceb6. Then 4770d69 arrived (checklist and manifest only), and I read it too. Evidence read: `round4/fix1/`, `fix1-print-web/`, `fix1-backend/`, `fix2/`, `fix2-login/`. Sources: `/tmp/src/frappe-16.32.0`, `/tmp/src/frappe-16.52.0`, ERPNext 16.33.0 (`/home/frappe/frappe-bench/apps/erpnext`), HRMS 16.20.1 (`/tmp/r4src/hrms-16.20.1`). I changed nothing on either bench.

### What I ran (VERIFIED, clean `git worktree` of 0bbceb6, Python 3.12.3)

| Check | Result |
|---|---|
| `uvx ruff@0.16.8 check .` / `format --check .` | All checks passed / 138 files already formatted |
| `unittest discover` midad / audits | 151 OK / 171 OK |
| `python -m institutional_theme.midad.build --check` | 12 checked, 0 stale |
| `python -m institutional_theme.audits` | passed. Combined: 0 dead in every version; 10 unread everywhere, all 10 allowed with a reason; web-scope 60 desk-only names, 0 problems; budgets 0 problems. The run left `git status` clean, so the committed reports match HEAD |
| `effective_diff --ref 84318a4 --version 16.32.0` | 822 before and 822 after, 0 changed, "does not move" |
| `effective_diff --ref 11a3a36 --version 16.32.0` | "does not move except 6 accepted declaration(s) of 2 name(s)": `--radius-md` and `--radius-lg` only |
| `effective_diff --ref 84318a4 --version 16.52.0` | 0 changed, "does not move" |
| sass 1.69.5 (bench) compile of `ins_desk` / `ins_web`, compressed | 141.8 KB (16.6 gzip) / 54.0 KB (8.9 gzip). This agrees with `budgets.txt` (142.2 / 54.4 from the bench dist) |
| Desk-only names against the built `website`, `login`, `web_form` and `erpnext-web` CSS of both benches (my own grep, independent of `web_scope.py`) | 0 of the 60 names read. Only `print.bundle` reads three of them (`--input-disabled-bg`, `--progress-bar-bg`, `--shadow-inset`). That does not matter: `www/printview.html:8` (16.32.0) and `:11` (v16.52.0) are standalone pages that load no `web_include_css` |

### State of each earlier finding

| # | State | Evidence |
|---|---|---|
| B1 | **Partly closed** | Form tags are fixed. `_status.scss:148,152,166,172,247` add `:where(:not(.form-tag))`. Core puts the class on the badge itself (`ui/tags.js:122` `css_class: "form-tag"`, `ui/components/badge.js:60`), and `live_tags.mjs` / `fix1/tags-16.52.0.json` show no shape on a live form. **Still open: Kanban v2 card tags**, see R1 below. |
| N1 | **Closed** | (a) `.tick.thick` rule removed. (b) The ring is now reached only through `.body-sidebar:has(> .standard-items-band) > .body-sidebar-top` (`_base.scss:41`). 16.32.0 has no `standard-items-band` (0 hits); v16.52.0 has it at `sidebar.html:8`. (c) `_login.scss:187` `:is(.password-field, .email-field:has(> .field-icon))` restores both 38px paddings on 16.32.0. `fix2-login/measurements.txt` row "32 en" shows padL and padR of 38px, and I computed the same cascade from the compiled CSS: RTL `(0,6,3)` after base `(0,6,3)`, then `(0,7,3)`. (d) `_actions.scss:103` skips `.about-section-header .es-button` (16.32.0 `about.js:58,62`). (e) and (f) are accepted, now in `accepted_movement.json` and checklist B10. The radius notes in `tokens.json:582-583` are corrected. |
| N2 | **Closed** | README Troubleshooting "Another app reads a global Espresso colour variable" (README:139-143). One flaw in its search command, R5. |
| N3 | **Closed** | (a) `scan_theme` strips comments (`dead_tokens.py:82-84`). (b) Unread everywhere now fails without an allowlist reason, and stale entries fail (`dead_tokens.py:389-409`). (c) Merge order fixed (`:70`). (d) `effective_diff` takes the source readers (`effective_diff.py:110-112`). `fix1-backend/mutation-proof.txt` shows each fix guarded by failing tests. |
| N4 | **Closed** | The reports are regenerated and current: my audit run left no diff. Checklist B6 and B7 were updated in 4770d69 (293/455/473, 81/15/0, 484 watched; budget table). The CI currency step is still only a patch (`fix1-backend/ci-step-proposed.patch`), so staleness can return unnoticed. NON-BLOCKING. |
| N5 | **Closed** for the seven items listed. The manifest has rows for `.gantt .tick.thick`, `.es-toast[data-type]`, `.body-sidebar-top`, `body.dock-pinned`, `.current-upper`, the gantt popup, `[class*="for-"]` and the two radius readers. Fix-round selectors are missing, see R2. |
| N6 | **Closed** | `[class*="for-"]` no longer depends on class order (`_login.scss:40,444`). I grepped the `class="…for-…"` attributes in Frappe 16.32.0, v16.52.0, ERPNext 16.33.0 and HRMS 16.20.1 templates: 0 outside `login.html` and `update-password.html`. It is broader than before (any class containing `for-`, such as `ask-for-quote`), but it only styles a `.page-card` beneath such an element. Accepted. |
| N7 | **Partly closed** | Web is 54.4 of 60 KB (5.6 KB headroom, from the desk scope split). Desk grew again, to 142.2 of 150 KB (95 %), so the next desk fix has under 8 KB. |
| N8 | **Closed** | `.dock:has(> .dock-items)` (v16.52.0 `dock.js:21,32`) and `.body-sidebar-container > .sidebar-panel` (`sidebar_panel.js:7,81`). |
| N9 | **Open (notes)** | Solid-badge locals and the banner/pinned-dock grid are unchanged. `dock.js:40-44` mounts the dock before `.body-sidebar-container`, or as the first child of `body`. The `cascade.mjs` default `/home/user/frappe-bench` now exists on this machine. |

### Hostile review of the new code

- **Audit allowlists cannot hide a dead token.**
  - `unread_allowlist.json` covers only names that core declares. F1 dead is counted and failed separately (`__main__.py:182-184`), and the allowlist is never consulted for it.
  - Stale entries fail: the name is not watched, something now reads it, or it has no reason (`dead_tokens.py:402-408`).
  - `accepted_movement.json` is keyed by name only. But acceptance applies only to an ADDED declaration of a name that only source code reads (`effective_diff.py:112,127-130`). Once the name is in a baseline, a later value change takes the `changed` path (`:121-122`) and fails. Removal also fails (`:117-119`). No hole.
- **Website map `scope: "desk"`.** Safe by both proofs: the audit and my independent grep (table above). Residual risk, not verifiable: another app's website stylesheet, or a site's Website Theme SCSS, that reads one of the 60 names. That page then gets core's Light value instead of the theme's. The effect is cosmetic, Light only, and nothing breaks.
- **`body.print-format-doc`.**
  - Absent from Frappe 16.32.0 and ERPNext 16.33.0, so 16.32.0 cannot move.
  - On v16.52.0 it is the `<body>` class of Frappe's own standard template (`templates/print_format/print_format.html:64`), and the Print Style is injected at `:54-55`.
  - The desk never gets `body.print-format-doc`. The builder preview uses a `div.print-format-doc` (`print_format_builder/components/editor/PrintFormat.vue:7`), which the `body.` prefix does not match. The Print Style CSS sent in every desk boot therefore cannot leak.
  - Only a comma list was added (no `:is()`), which is right for QtWebKit.
  - The SCSS comment cites the wrong origin, see R4.
  - A Print Style an administrator edited keeps the old CSS, by design (`ship.py:84-107`).
- **Physical properties.**
  - `_login.scss:458-466` uses `padding-left` and `padding-right` behind `html[dir="rtl"]`. This is correct: the input is forced to `ltr`, so logical properties would name the wrong edge.
  - The email bundle adds `border-right` beside `border-left`. That fits the email exception (no logical properties in mail clients, and core's templates set no `dir`).
  - Both bundles sit inside their `rtl:begin/end:ignore` wrappers (the compiled `ins_web` has the pair at lines 1 and 1639), so rtlcss cannot double-flip them.
- **`.es-button` height.**
  - v16.52.0 writes `data-size` only for non-`sm` sizes (`ui/components/button.js:57`), so `:not([data-size])` is exactly `sm`.
  - No other core rule sets `--es-bt-h`; the only reader outside `button.css` is `desk/page.scss:113` (width of a squared header button).
  - Frappe JS puts no `.es-button` inside a datatable cell or grid row (they occur in the grid footer, `form/grid.js:116-162`), so the datatable rule holds.
  - On 16.32.0 the only `.es-button` (About) reads no `--es-bt-h`, so it does not move.
  - Comfortable `sm` buttons grow from 28 to 32px. This is intended (a11y round 4) and cosmetic.
- **ar.csv context-free rows.** Frappe merges app translations in install order, CSV and then MO for each app (`translate.py:179-181`). So a context-free row overrides core's Arabic wherever that string occurs.
  - `Collapse`: core `ar.po` has `msgid "Collapse"` → `انهيار` (wrong: it means "breakdown") in both versions. `طي` replaces it, and the contexted `Collapse` / "Shrink code field." keeps core's own entry. That is safe desk-wide and an improvement.
  - `Add attachment`, `Last Edited By {0}`, `Last Edited By You`: core's `ar.po` has these with empty `msgstr`.
  - `All apps`, `Breadcrumb`, `Sidebar Menu`: not in core's `ar.po`. Each matches a v16.52.0 call exactly (`__("All apps")` ×3, `__('Sidebar Menu')` in `sidebar_header.html`, `"Breadcrumb"` in `page.html` and `breadcrumbs.html`).
  - The email rows match `_()` calls in v16.52.0 `templates/emails/password_reset.html` and `verification_code.html`, and the 16.32.0 strings in `password_reset.html:3,6`.
  - A custom app installed after this theme would still win over any of these rows. That is expected Frappe behaviour.
- **No new `!important`.** 0 added lines in the product diff. **No invented name:** every new selector and variable I checked resolves in the cited tree; two citations are wrong (R4). **16.32.0 movement:** the generated map does not move (above). The hand-written fix-2 rules that reach 16.32.0 are listed in R3.

### New findings

**R1. BLOCKING for the v16.52.0 range claim only (same scope as B1): Kanban v2 card tags are still painted as statuses.**
- **Where:** `_status.scss:166,172` exclude `.form-tag` only.
- **Proof in v16.52.0:**
  - `views/kanban_v2/kanban_page.js:1272-1281` (`tag_badge`) renders each card tag as `frappe.ui.badge({ theme: this.hash_theme(tag) })` with no `css_class`.
  - `hash_theme` hashes onto `["blue","green","amber","red","violet"]` (`:1262-1270`).
  - The tags are shown on cards at `:1248` and `:1847`.
  - Kanban v2 is opt-in per board (`list/list_factory.js:116-117`, `use_kanban_v2`).
- **Failure:** on such a board, a tag "Urgent" can carry the green check and the success pair.
- **Related:** the workspace shortcut count badge (`widgets/shortcut_widget.js:115-127`) maps a colour the administrator chose to a theme. It therefore gets a status shape too, although it is a count.
- **Smallest correction:** invert the selector to the status hosts:
  - list status, `.page-indicator-pill` and `[data-filter]`, as proposed in B1;
  - the doctype-settings state tags (`form/doctype_settings/tabs/workflow.js:32`, `notification.js:42`).

  Or, as a stop-gap, add `.kn-card .es-badge` (or the Kanban card container) to the `:where(:not(…))` list. Then add a Kanban v2 fixture to `cascade.mjs`.
- **Evidence:** COMPUTED from source; not rendered. It does not affect 16.32.0, and it does not block a release whose range stays 16.32.0.

**R2. NON-BLOCKING. Fix-round dependencies have no manifest row.** `grep -c` of `DEPENDENCY_MANIFEST.md` finds 0 rows for each of:
- `.es-button[data-size]` and `--es-bt-h` (`_actions.scss:80-87`; v16.52.0 `css/espresso/components/button.css:51,124,132`);
- `.btn-outline`, `.sidebar-item-suffix .keyboard-shortcut` and `.menu-item-shortcut` (`_typography.scss:50-52`; 16.32.0 `common/buttons.scss:159`, `desk/sidebar.scss:398,403`, `desk/menu.scss:54,58`);
- `.es-toast[data-type] > svg` with `--icon-stroke` (`_overlays.scss:89`; `toast.css:94`, `legacy.css:46`);
- `.es-tab-buttons .es-pill` `min-block-size` (`_list.scss:104`).

`manifest_selectors.py` will not check them at the next tag. Fix: add one row each to section 2k.

**R3. NON-BLOCKING. Fix-round hand-written rules move 16.32.0 outside what `effective_diff` measures, and no checklist row lists them as intended.**
- **The rules:**
  - `_typography.scss:50-53` sets weight 400 on 16.32.0's literal 420 (`buttons.scss:159`, `sidebar.scss:403`, `menu.scss:58`);
  - the forced-colours outline and bar on the current sidebar row (`_shell.scss` forced-colours block; its comment says "also marks the current row on 16.32.0").
- **Assessment:** both are intended, and the comments say so. But `.btn-outline` is a generic class name. Any app's `.btn-outline` in the desk loses weight 420 and becomes 400 (cosmetic). The "does not move" result covers the generated map only, which is the same gap N1 named.
- **Fix:** one checklist line, "intended 16.32.0 changes: …", next to B10.

**R4. NON-BLOCKING. Two wrong source citations in code comments.**
- `ins_print.bundle.scss:7` says the second root is "ERPNext 16.50's Modern formats". It is Frappe v16.52.0 `templates/print_format/print_format.html:64`, as the manifest row says.
- `_base.scss:35` cites `sidebar.html:11`; the element is at `:8`. 4770d69 noted this in the manifest but left the comment.

A reader at the next tag will look in the wrong app.

**R5. NON-BLOCKING. The README search command misses names it is meant to find.**
- `README.md:143` `var\(--(surface|ink|outline)-[a-z]+-[0-9]+\)` requires a digit and then `)`. It therefore misses `--ink-white`, which is in the list, and every read with a fallback, such as `var(--ink-red-3, #e03636)`. The fallback form is the common way apps write it.
- Fix: `var\(--(surface|ink|outline)-[a-z0-9-]+`.

**R6. Note, outside my dimension (for the i18n reviewer).** `ar.csv:306,315` render "{0} minutes" as `{0} دقائق`. Arabic needs `دقيقة` for 11 and above, and Frappe's default link expiry is in that range. Also, `ar.csv:47` `Collapse,طي` and `:298` `Collapse,طيّ,Row editor` differ by the shadda.

### Updated scores (my dimensions)

| Dimension | Score | Evidence |
|---|---|---|
| Upgrade-safety | 4/5 | **Improved:** N1, N2, N8 closed; no core edit, no `!important` added, no datatable height, no invented name. The generated map does not move 16.32.0 except the two accepted source readers, and does not move v16.52.0 (VERIFIED, run). Every new selector is anchored to markup that exists only where intended (VERIFIED in both trees). **Held below 5 by:** R1 (Kanban v2 tags on v16.52.0) and R3 (16.32.0 changes outside the measured map). |
| Performance | 4/5 | All budgets pass (VERIFIED: audit run and an independent compile). Web 54.4/60 KB after the desk-scope split. Desk 142.2/150 KB (95 %) and still rising. The new `:has()` uses are direct-child anchored (`:has(> .dock-items)`, `:has(> .standard-items-band)`, `:has(> .field-icon)`). |
| Documentation | 4/5 | **Improved:** N4 and N5 closed; checklist B6, B7 and B9-B11 match the reports; README troubleshooting added; the radius notes are true. **Held below 5 by:** R2 (four fix-2 dependencies without rows), R4 (two wrong citations), R5 (the README grep). |
| Craft | 4/5 | **Good:** the audit holes are closed with mutation-proven tests; the desk scope is proven from committed snapshots; `:where()` keeps the specificity unchanged; the RTL email-padding rule reasons from the input's own direction; the print root is a comma list for QtWebKit. **Held below 5 by:** R1, an exclusion list where a positive host list was needed. |

Gate on my dimensions: every dimension is at 4 or above, so it passes for a release whose range stays 16.32.0. R1 must be closed before the range claims v16.52.0, as B1 was.

### Not verified

- R1 on a live site. It is COMPUTED, and no Kanban v2 board exists on either bench.
- The fix-2 a11y rules on 16.32.0 beyond the evidence screenshots (`fix2/forced-32-*`, `touch-32-*`). I did not render them.
- The Print Style on a v16.52.0 standard-template PDF. I read `fix1-print-web/` but did not regenerate the PDF.
- Website stylesheets of the owner's other apps, and Website Theme SCSS, reading a desk-scoped name.
- Byte-identical bundles across the two benches; my size check was a sass compile, not the esbuild pipeline.

## Final re-check

Range: `git diff b9072b7..origin/build/midad-v1`, read at 70a62dd (product changes in f7f34c7 and d1275b6; manifest and checklist in 887dbba and 70a62dd). Evidence read: `docs/team/evidence/round4/fix3/` including `badge-classification.md`. Sources: `/tmp/src/frappe-16.32.0`, `/tmp/src/frappe-16.52.0`, ERPNext 16.50.0 (`/home/frappe/newest-bench/apps/erpnext`, the ERPNext on the v16.52.0 bench). I changed nothing on either bench.

### What I ran (VERIFIED, clean `git worktree` of 70a62dd at `/tmp/r4final`, Python 3.12.3)

| Check | Result |
|---|---|
| `uvx ruff@0.16.8 check .` / `format --check .` | All checks passed / 138 files already formatted |
| `unittest discover -s institutional_theme/midad/tests -t .` | 151 tests OK |
| `unittest discover -s institutional_theme/audits/tests -t .` | 171 tests OK |
| `python -m institutional_theme.midad.build --check` | 12 file(s) checked, 0 stale |
| `python -m institutional_theme.audits` | passed: 0 dead in every version; 10 unread, all allowed with a reason; web-scope 60, 0 problems; counterparts 30 pairs, 0 findings; budgets 0 problems. `git status` clean afterwards, so the committed reports match HEAD |
| `effective_diff --ref b9072b7 --version 16.32.0` / `--version 16.52.0` | "Frappe 16.32.0 does not move" / "Frappe 16.52.0 does not move" |
| bench sass compile of `ins_desk.bundle.scss` | Compiles; the host list is emitted as written (`.es-badge:where([data-filter], .page-indicator-pill, .side-panel-indicator *, .diw-import-log-line *)`, compiled lines 3859-3909) |
| `!important` on added lines of the product diff | 0 |
| `fix3/cascade-16.52.0.json` / `cascade-16.32.0.json` / `tags-16.52.0.json` (read, not re-run) | 7520 / 4576 / 8 rows, 0 failing. Kanban tag, shortcut count, side-panel and list-status rows pass in every scenario. These are harness fixtures, not live Kanban v2 boards |

### B1 / R1: closed

The selector is now a positive host list (`_status.scss:142`). Every `.es-badge` gets the neutral pair at `(0,3,1)` (`:144-148`), which beats core's `.es-badge[data-theme]` at `(0,2,0)` (v16.52.0 `css/espresso/components/badge.css:55-89`). A theme only stages `--ins-sb-*` (`:175-179`). Only a host copies them into `--c-*` (`:151-155`) and gets a shape (`:161`, `:181`). Draft and Cancelled still win: `--c-*` at `(0,4,1)` against `(0,3,1)`, and `::before` ties at `(0,4,2)` and wins by order (`:209`, `:221`, `:234`, `:246`).

I checked each host against v16.52.0 call sites (grep of `ui.badge` and `es-badge` over `frappe/`, 60 hits):

- `[data-filter]`: only on the list status (`list/list_view.js:1896`) and the list Select value (`:1499`). The other `data-filter` in core JS (`utils/common.js:34`) is on an avatar, not a badge.
- `.page-indicator-pill`: `ui/page.html:24`, `ui/page.js:163,299`. The comment cites `page.js:259`; that is where `data-theme` is set, which is acceptable.
- `.side-panel-indicator *`: `ui/side_panel.html:8`, filled only at `ui/side_panel.js:742-746`.
- `.diw-import-log-line *`: `core/doctype/data_import/data_import.js:2664,2710,2746,2747`. The only badge inside it is the Success/Failure result (`:2740`). The other two lines hold text and a ghost `frappe.ui.button`.

Every badge that should not look like a status is neutral, on core's own call sites:

- Form tags (`ui/tags.js:117`) and Kanban v2 card tags (`views/kanban_v2/kanban_page.js:1275`).
- Lane counts (`:2048`) and v1 column counts (`views/kanban/kanban_column.html:6`).
- Shortcut counts (`widgets/shortcut_widget.js:127`).
- Communication recipient chips (`views/communication.js:843,1058,1580`).
- The doctype-settings labels and the print-builder chips.

`tags-16.52.0.json` shows `before: none` and the neutral pair for green, blue and violet tags. R1 is closed.

**Real statuses that lost their colour and shape on v16.52.0.** The engineer lists four (the count line in `badge-classification.md` says five but the table names four):

1. The Kanban v2 Select value (`kanban_page.js:1467`; it keeps core's own icon).
2. The embedded-list badge column (`ui/embedded_list.js:293`).
3. The timeline email status (`form/templates/timeline_message_box.html:66`).
4. The workspace-restore state (`desk/page/workspace_restore/workspace_restore.js:93`).

I found three more, see F2 and F3:

- The workflow "Active" tag in doctype settings (`form/doctype_settings/tabs/workflow.js:32` through `list_panel.js:174`).
- The Kanban v1 column dot (`views/kanban/kanban_column.html:4`).
- ERPNext 16.50.0 Job Card and docstatus columns (`manufacturing/doctype/work_order/work_order.js:1431,1482`).

For the labelled ones this is **acceptable**. Each badge prints the state as text ("Sent", "Active", "Cancelled", "Completed"), so no state is lost, and grey is safer than a guessed family. On 16.32.0 the same items were `.indicator-pill`s that got a shape. This is a cross-version difference, not a regression within one version. The Kanban v1 dot is different, because it has no text (F2).

### State of the remaining findings

| # | State | Evidence |
|---|---|---|
| B1 / R1 | **Closed** | Above. |
| R2 | **Closed** | `DEPENDENCY_MANIFEST.md` has rows for `.es-button[data-size]` / `--es-bt-h`, `.btn-outline`, `.sidebar-item-suffix .keyboard-shortcut`, `.menu-item-shortcut`, `.es-toast[data-type] > svg`, `.es-tab-buttons .es-pill`, and the two forced-colours bars. I opened every cited line. Repository: `_actions.scss:80-86`, `_typography.scss:52-55`, `_overlays.scss:89-90`, `_list.scss:104-105`. 16.32.0: `buttons.scss:154,159`, `sidebar.scss:395,398,403`, `menu.scss:54,58`. v16.52.0: `buttons.scss:197,202`, `sidebar.scss:605,610,615`, `page.js:567`, `button.css:31,51,124-125,132-133,202`, `toast.css:94`, `legacy.css:46`. All match. One inaccuracy, F4. |
| R3 | **Closed** | Checklist B12 (`UPGRADE_AND_QA_CHECKLIST.md:32`) lists the intended 16.32.0 changes. `.btn-outline` is narrowed to `.body-sidebar-container .btn-outline` (`_typography.scss:52`). In 16.32.0 that container is `ui/sidebar/sidebar.html:1` and the button is `:36`. `cascade-16.32.0.json` proves that another app's `.btn-outline` keeps 420. |
| R4 | **Closed** | `ins_print.bundle.scss:7-9` now cites v16.52.0 `templates/print_format/print_format.html:64`. `_base.scss:35` cites `sidebar.html:8` (verified: `standard-items-band` is at `:8`). |
| R5 | **Open** | `README.md:143` still uses `var\(--(surface|ink|outline)-[a-z]+-[0-9]+\)`. It misses `--ink-white` and every read with a fallback. Fix unchanged: `var\(--(surface|ink|outline)-[a-z0-9-]+`. NON-BLOCKING (documentation). |
| R6 | **Closed (i18n owns the wording)** | `ar.csv:47` and `:298` now agree (`طيّ`). `ar.csv:306,315` use `{0} د.`, which avoids the 3-10 / 11+ agreement problem; see F5. |

### New ar.csv rows (context-free override check)

Frappe merges app CSVs after core (`translate.py:179-181`), so a context-free row replaces core's Arabic wherever the source string occurs.

- `Collapse sidebar` (`ar.csv:318`) has one call in v16.52.0, `ui/sidebar/sidebar.js:767`. It is absent from 16.32.0 and from core `ar.po`. Safe.
- `Notification categories` (`:319`) has one call, `ui/notifications/notifications.js:169`, and is absent from core `ar.po`. Safe.
- `Reset your password` (`:320`) has one call in each version, the email title `templates/emails/password_reset.html:1`. Core `ar.po` gives `اعد ضبط كلمه السر` (16.32.0 `:23620-23621`, v16.52.0 `:24434-24435`), which is misspelled. The replacement is an improvement, and no other string shares the msgid.
- `Collapse,طيّ` (`:47`) only adds the shadda; the earlier assessment stands.

None of the new rows can mistranslate a different core string.

### New findings

**F1. MINOR. On v16.52.0 the side-panel header shows Draft and Cancelled with the danger look (red family, cross).**

- **Where:** `_status.scss:142` makes `.side-panel-indicator *` a status host. The Draft and Cancelled rules (`:208-249`) key on `[data-filter="docstatus,…"]` or on `[data-ins-docstatus] .title-area`, and the side-panel badge has neither.
- **Proof:** v16.52.0 `model/indicator.js:73,78` returns `"red"` for both states. `ui/side_panel.js:744-746` passes only the theme. `ui/side_panel.html:3-8` carries no docstatus.
- **Failure:** a draft opened in the side panel shows "Draft" with the error cross, while the same document in the list shows the neutral ring (ADR 0008 section 2). The label is still correct.
- **Smallest correction:** accept and record it in the manifest row for the side panel. Or have `public/js/shell/form_status.js` also set `data-ins-docstatus` on `.side-panel` when its header is set. That is JS coupling to v16.52.0-only markup, so it needs its own manifest row.

**F2. MINOR. The Kanban v1 column dot loses the colour the administrator chose, and it has no text.**

- **Where:** `_status.scss:144-148` neutralises every non-host badge.
- **Proof:** v16.52.0 `views/kanban/kanban_column.html:4` is `frappe.ui.badge.html({ theme: indicator, icon: "circle" })`, an icon with no label, and `kanban_board.bundle.js:1717` re-sets its `data-theme`. On 16.32.0 the same element was `span.kanban-col-dot.indicator.{{indicator}}` (`kanban_column.html:4`), which `_status.scss:107` shapes and colours.
- **Failure:** on v16.52.0 every column dot on a v1 board is the same grey circle, so the Kanban Board Column `indicator` setting has no visible effect. The column title still names the value, so no state is lost, but administrator configuration is silently ignored.
- **Smallest correction:** add `.kanban-column-title > .es-badge:not(.kanban-column-count)` to `$ins-badge-host`. This adds one manifest row, and `kanban_column.html:4` is a core template, so it is stable.

**F3. MINOR. Status badges from other apps on v16.52.0 lose core's colour too, and nothing documents it.**

- **Where:** `_status.scss:144-148` applies to any `.es-badge`.
- **Proof:** ERPNext 16.50.0 `manufacturing/doctype/work_order/work_order.js:1431` (Job Card status from `frappe.get_indicator`) and `:1482` (Draft / Submitted / Cancelled), both `frappe.ui.badge.html({ label, theme })` inside the Work Order form. Neither is a host.
- **Failure:** those columns, and any status badge a second app on the bench renders through `frappe.ui.badge`, are grey with no shape. The text still states the state.
- **Smallest correction:** one README Troubleshooting entry, "A status badge in another app is grey on v16.52.0", naming the host list and the rule that an app status rendered through the list view (`data-filter`) or the page head keeps its look. An opt-in attribute is not proposed, because it would be a new public contract.

**F4. MINOR (documentation). The `.btn-outline` manifest row says "both versions".**

- **Where:** the `.btn-outline` row in `DEPENDENCY_MANIFEST.md`.
- **Proof:** the core rule exists in v16.52.0 (`buttons.scss:197,202`), but no v16.52.0 markup uses the class. A grep of `btn-outline` in `.js`, `.html` and `.vue` finds only `btn-outline-primary` in `website/doctype/help_article/templates/help_article.html:25-26`. The sidebar Discard button is gone from `ui/sidebar/sidebar.html`.
- **Failure:** at the next tag a maintainer looks for a v16.52.0 Discard button that does not exist.
- **Smallest correction:** reword the row to "16.32.0 only; inert on v16.52.0".

**F5. Note for the i18n reviewer, outside my dimension.**

- `ar.csv:306,315` `{0} د.`: in a government email, `د.` is also read as the abbreviation for doctor or dinar (`د.ك`, `د.إ`). The full noun with a number-agnostic phrasing, for example `خلال مدة {0} من الدقائق`, avoids both the ambiguity and the agreement problem.
- `Collapse sidebar` (`:318`) has no `Expand sidebar` partner. v16.52.0 `sidebar.js:767` switches between the two, and core `ar.po` has no entry for `Expand sidebar`, so the tooltip is Arabic in one state and English in the other.

### Final scores (my dimensions)

| Dimension | Score | Evidence |
|---|---|---|
| Upgrade-safety | 5/5 | **Gained:** B1/R1 closed with a positive host list built from all 60 v16.52.0 badge call sites (VERIFIED by grep and opened lines). Both versions "do not move" (VERIFIED, `effective_diff` run). No `!important` added (VERIFIED), no invented name (every new selector and citation opened), no datatable geometry. The 16.32.0 changes are narrowed (`.btn-outline` only in the sidebar) and recorded (B12). **Remaining (minor):** F1 to F3 are cosmetic, and in each case the label text keeps the meaning. |
| Performance | 4/5 | Budgets pass (VERIFIED, audit run): desk 143.4 of 150 KB (95.6 %, 16.8 KB gzip), web 54.4 of 60 KB. The host list is a single `:where()` with two descendant arms, evaluated only on `.es-badge`. **Held below 5 by:** under 7 KB of desk headroom. |
| Documentation | 4/5 | **Gained:** R2, R3 and R4 closed, and every cited line verified. **Held below 5 by:** R5 (README grep still wrong), F4 (the "both versions" wording), and the miscount in `badge-classification.md` (five against four rows). |
| Craft | 5/5 | The exclusion list became a host list with a single source (`$ins-badge-host`). Staging in `--ins-sb-*` avoids one rule per theme and per host. `:where()` keeps the Draft and Cancelled overrides winning without new specificity. Fixtures assert both the negative cases (Kanban tag, shortcut count) and the positive ones (side panel, list status), and a 16.32.0 fixture guards another app's `.btn-outline`. |

### Verdict

**v16.52.0 may be claimed as supported from my dimensions** (upgrade-safety, performance, documentation, craft). No finding is blocking: B1/R1 is closed, every dimension is at 4 or above, and every CI check passes on a clean worktree of 70a62dd. F1 to F3 should be recorded as known differences in the release notes or fixed in the next round. R5 and F4 are documentation corrections. The 16.32.0 claim is unaffected: the generated map does not move, and the hand-written changes are those listed in B12.

### Not verified

- F1, F2 and F3 on a live site. They are COMPUTED from source; no v1 or v2 Kanban board, side-panel draft or Work Order with Job Cards was rendered.
- The fix-3 cascade on live pages. `fix3/cascade-*.json` and `tags-16.52.0.json` are harness fixtures, which I read but did not re-run.
- HRMS releases paired with v16.52.0, and the owner's other custom apps: whether their status badges use a host. Only Frappe 16.52.0 and ERPNext 16.50.0 were searched.
- The esbuild and rtlcss build of the new host list on the bench. I compiled with sass only. The selector contains no physical property, so rtlcss has nothing to flip.
