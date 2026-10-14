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
