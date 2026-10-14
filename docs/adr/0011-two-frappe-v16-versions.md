# 0011 — Supporting two Frappe v16 versions

Status: accepted, 2026-10-14 (the lead delegated acceptance under Autonomous mode). Round 4, item 1. Settles how G1 to G8 of `docs/UPGRADE_AND_QA_CHECKLIST.md` are closed. Builds on 0001 D1 and D2, 0003 and 0010. Row-by-row data: `docs/team/evidence/round4/source/token-map.md`.

## Context

- One code base for Frappe **16.32.0** (`5cba016`, the verified target) and **v16.52.0** (`4515014`). Both sources were read in fresh clones.
- v16.52.0 adds the Espresso token files `public/css/espresso/{colors,radius,effects,typography,spacing,legacy}.css` and their components. Old names survive only as aliases in `legacy.css:16-98`. `--border-radius-*` are no longer declared: `scss/espresso/_borders.scss:4-5` says `legacy.css` keeps them, but it does not. The `--sidebar-*` colours became `--desk-sidebar-bg` (`scss/desk/sidebar.scss:24,28`).
- Every Espresso declaration is at (0,1,0): `:root, [data-theme="light"]` (`colors.css:10-11`), `[data-theme="dark"], .dark` (`:591-592`), `:root` (`radius.css:5`, `effects.css:9`, `typography.css:7`, `legacy.css:6,21,101,174,185,197`) and `[data-theme="dark"]` (`effects.css:41`, `legacy.css:141`). The 0003 shapes at (0,2,1) and (0,3,1) beat all of them, so delivery does not change. No desk code adds `.dark` (grep of `public/js`, `www` and `templates`).
- Three facts drive the rules:
  1. Espresso semantic tokens point at ramps, for example `--surface-red-2: var(--red-100)` (`colors.css:199`). The theme's raw-ramp mapping therefore already flows into every semantic token the theme does not override.
  2. Some names exist in both versions with a different meaning. 16.32.0 has `--ink-red-3: #e03636` (`scss/espresso/_colors.scss:264`), a red text colour; v16.52.0 has `var(--red-200)` (`colors.css:341`), a light tint.
  3. Some roles moved from global tokens into component-local variables:
     - The page primary action is `.es-button[data-variant="solid"]` (`js/frappe/ui/page.html:61`), painted by `--bt-solid-bg: var(--surface-gray-10)` (`button.css:34`). That is the near-black button seen in round 3.
     - List and page-head statuses are `.es-badge[data-theme]` (`list/list_view.js:1499,1896`, `ui/page.js:299`), painted by `--c-*` (`badge.css:10-14`), not `.indicator-pill`.

## Decision

**R1. Side by side, never detected.**
- *Variables.* Every name that either version reads is a key in `design/tokens.json` `frappe.vars`, and both are always emitted. A name a version lacks does nothing there.
- *Selectors.* Old and new selectors share one rule as a plain comma list, or sit in adjacent rules. Each carries a comment of the form `16.32.0: path:line` / `v16.52.0: path:line`.
- *Forbidden.* Version checks in JS or in `frappe.boot`, version-specific bundles, and new `!important` added for this purpose.
- *Removal.* A name or selector that only 16.32.0 has is removed only when 16.32.0 leaves the range.

**R2. A name that only one version reads is mapped by the first rule that applies.**
- (a) *Alias.* Core defines it as an alias of a name the theme maps, or as the same scale step. It takes that name's value. Examples:
  - `--shadow-xl: var(--elevation-xl)` (`effects.css:23`), so `--elevation-xl` takes the theme's `--shadow-xl` value;
  - `--weight-regular: var(--font-weight-regular)` (`legacy.css:186`);
  - `--desk-sidebar-bg: var(--surface-sidebar)` (`sidebar.scss:24`);
  - `--text-p-sm: 13px` = `--text-sm` (`typography.css:16,34`).
- (b) *Counterpart.* It replaced the other version's name at the same consumer (same file and rule). It takes the counterpart's `--ins-*` value. Example: `about.scss:11` reads `--border-radius-xl` in 16.32.0 and `--radius-xl` in v16.52.0. When several counterparts disagree, the one with the most readers on P0 screens wins; the others are listed as accepted differences.
- (c) *Role.* Otherwise it takes the semantic token whose `use` in `tokens.json` names that role. If none fits, it is left unmapped, and Espresso's value then resolves through the theme's raw ramps (fact 1). For that reason the raw ramps also emit step 950, which v16.52.0 declares (`colors.css:22` and following).

**R3. Same name, different meaning.**
- (a) If the name has an effect in 16.32.0 (declared and read there), its value stays as it is. Rule 3 (upgrade safety) outranks rule 5 (aesthetics) in BRIEF section 3, and 16.32.0 must not regress.
  - Where v16.52.0 reads such a name on a P0 screen with the other meaning, the fix goes on the component (R4).
  - Today no fix is needed: `--surface-gray-7`, `--ink-red-4`, `--ink-green-3`, `--ink-amber-3`, `--ink-blue-3` and `--outline-red-2` are read in v16.52.0 only through utility classes that no core template uses (`scss/common/utilities.scss:429-445`).
  - `--surface-blue-3` keeps its single consumer, `desk/card.scss:2`, in both versions.
- (b) If the name has no effect in 16.32.0 (declared only, or absent), it takes the v16.52.0 meaning:
  - either the theme ramp at the step `colors.css` names in each mode,
  - or the semantic token for that exact role (`--surface-red-7`, the solid red, becomes `@danger`; `--ink-red-1`, the text on it, becomes `@on-danger`).
  The 16.32.0 snapshot shows the name is not read there, so 16.32.0 cannot change.
- (c) A global token is never repurposed to fix one component.

**R4. Component-local repointing.**
- *When.* The approved look needs a value on one component that differs from what the global token means elsewhere.
- *How.* Repoint that component's own custom properties at the 0003 shape. This is the pattern core itself uses (`button.css:31-32`, `badge-legacy-colors.css:1-5`) and the one ADR 0010 used for `--control-bg`.
- *Required now:*
  - `--bt-solid-*` on `.es-button:not([data-theme="red"])`;
  - `--c-fill`, `--c-fg` and `--c-line` on `.es-badge`, per status family, from `--ins-status-*`, plus the status shape;
  - the toast surface on `.es-toast`.

**R5. Dead-token audit.** Each supported version has one snapshot, `institutional_theme/audits/data/core_vars_frappe_<version>.json`.
- *Snapshots.* Each is written by `--write-core-snapshot` from every `*.css` in `sites/assets/{frappe,erpnext}/dist/css{,-rtl}` of a bench on that tag. CI reads only the snapshots.
- *Scope.* Every `frappe.vars` key, plus every non-`--ins-` custom property declared in hand-written theme SCSS (`public/scss/**`, outside `generated/`). Today that means `--control-bg`, `--btn-primary`, `--charts-*`, `--fc-border-color` and others; after R4 it adds `--bt-*` and `--c-*`.
- *Report.* For each version, the five existing categories with counts.
- *F1 fails* on a name that is dead in every supported version: no version's core declares or reads it, and the theme does not use it. A name dead in only one version is a side-by-side mapping (R1) and is reported, not failed.
- *F2 fails* on the counterpart table `institutional_theme/audits/data/counterparts.json`. The table is maintained by hand and reviewed with the token map. Each entry has the form `{"16.32.0": name, "16.52.0": name, "value": "same" | "differs", "why": text}`. F2 fails when:
  - (i) a 16.32.0 name is neither declared nor read in the 16.32.0 snapshot, or a v16.52.0 name is not read in the v16.52.0 snapshot, so the table cannot go stale;
  - (ii) the theme maps one side of a pair and not the other;
  - (iii) `same` pairs differ in their light or dark value, or a `differs` pair has an empty `why`.
- *Report only.* For each version, the names that core reads only in that version and that are neither mapped nor listed in the table, written to `docs/audits/dead_tokens.txt`.

**R6. Cascade test.** `tests/browser/cascade.mjs` runs once per version.
- *Inputs.* That bench's compiled core CSS and its compiled theme CSS, LTR and RTL.
- *Matrix.* Light and Dark.
- *Version tags.* Each assertion lists the versions it applies to (both by default). A selector that only one version has gets two assertions, each with fixture markup quoted from that version's source and its `path:line` in a comment.
- *Failure.* An assertion whose selector matches nothing fails.
- *New for v16.52.0:*
  - the solid `.es-button`: background, hover and text;
  - `.es-badge` for each status class;
  - the sidebar and its active row;
  - the menu highlight;
  - `.es-toast`;
  - `.form-control` radius;
  - sidebar label weight.

**R7. Supported range.** The README and the checklist may claim `>=16.32.0,<17`, "tested on 16.32.0 and v16.52.0", only if v16.52.0 passes every check below and 16.32.0 still passes all of them. Otherwise the claim stays "16.32.0", and v16.52.0 is listed as "tested, not supported" together with the checks it failed. A check that was given up under the sacrifice order counts as failed.
- `pyproject.toml:20` (`frappe = ">=16.32.0,<17.0.0"`) is the bench install constraint. It stays unchanged in both cases, because narrowing it could stop the newest-tag check from installing. UNVERIFIED: whether `bench get-app` enforces it. Running `get-app` with a narrowed value would settle it; that is not needed while the value is not narrowed.
- Checks 1 to 4 run once. Checks 5 to 13 run on each version.
  1. ruff 0.16.8 check and format.
  2. Both unit-test suites.
  3. `python -m institutional_theme.midad.build --check`.
  4. `python -m institutional_theme.audits` on the committed snapshots: F1 = 0, F2 = 0, and contrast, parity, colour vision and budgets all pass.
  5. The same audit with `--core-css <version>=<bench assets>`: categories equal those of the committed snapshot.
  6. The cascade test (R6).
  7. Screenshots of every P0 screen, Light and Dark, Arabic and English, reviewed with no blocking defect.
  8. axe on P0 screens: no serious or critical violation that stock core of that version does not also have.
  9. `bench run-tests --app institutional_theme`.
  10. The print and email checks.
  11. The install and uninstall gate with the residue check.
  12. Every manifest row carries a line for each version; no row is `missing` without a replacement or a "Not delivered" entry.
  13. Both hostile reviews of the round-4 diff have no open blocking finding.

## Alternatives rejected

1. *Detect the version in JS and set a root attribute.* It runs after first paint (0003), adds a moving part, and every name is harmless where it is absent anyway.
2. *One bundle per version, chosen by the hook.* It doubles the build and audit surface for no visual gain.
3. *Map `--surface-gray-10` to `@primary`.* It fixes buttons but turns tooltips (`tooltip.css:37`), solid gray badges (`badge.css:10`) and the calendar's today chip (`calendar.scss:40`) ink blue.
4. *Delete the 16.32-era overrides of semantic ramp tokens.* That is equivalent inside core, but HRMS, which the audit does not scan, may read them. Remapping keeps them themed and audited.
5. *Fail on every name only one version reads that the theme does not map.* That is 446 names in v16.52.0, mostly ramp steps that resolve through the raw ramps. The noise would hide real gaps; the reviewed table does the job instead.

## Consequences

- **backend-engineer**:
  - `tokens.json`: the remaps and additions in the token map;
  - raw ramps: step 950;
  - `counterparts.json`, F1, F2 and the scoped-declaration scope;
  - the v16.52.0 snapshot from LTR and RTL CSS;
  - regenerated files.
- **css-engineer**:
  - R4 for `.es-button`, `.es-badge` (add `amber` → pending/half and `violet` → plum/diamond to `$ins-indicators`) and `.es-toast`;
  - R1 selectors;
  - R6.
- **print-web-engineer**:
  - the R4 `.es-button` partial in `ins_web` as well (login `Continue`);
  - the field-icon padding only where `.field-icon` exists (v16.52.0 `www/login.html` has none);
  - the "Forgot password?" link colour set by a selector, not by remapping `--ink-gray-5`.
- **scribe**: manifest rows with a line for each version, and the range per R7.
- **reviewers**: check R1 (no detection, no new `!important`) and R3(a).

## Verification

- F1 and F2 run in CI.
- R6 output is stored per version in the round-4 evidence folder.
- The R7 table goes in the checklist, with an evidence path for each check.

## Evidence (16.32.0 and v16.52.0)

- `public/css/espresso/*.css` and `components/*.css` (v16.52.0), and `scss/espresso/_colors.scss` and `_borders.scss` (16.32.0), at the lines quoted above.
- Categories come from both committed snapshots.
- Every row is in the token map.
