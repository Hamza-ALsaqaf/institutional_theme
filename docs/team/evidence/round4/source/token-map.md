# Token map: Frappe 16.32.0 and v16.52.0 (round 4, ADR 0011)

For the backend-engineer (`design/tokens.json` → `frappe.vars`) and, in sections C and X, the css-engineer and the print-web-engineer. The theme-architect read both sources on 2026-10-14 in fresh clones: `v16.32.0` (`5cba016e86b5`) and `v16.52.0` (`4515014c87ec`).

**How to read this file**

- **Paths** are relative to `frappe/public/` unless they start with `www/` or `templates/`. They are given as file and line.
- **Categories** come from the committed snapshots `institutional_theme/audits/data/core_vars_frappe_16.32.0.json` and `core_vars_frappe_16.52.0.json`:
  - DR: declared and read;
  - D-: declared only (no effect);
  - -R: read only;
  - --: absent.
- **Values** use the `tokens.json` syntax:
  - `@x` is a semantic token;
  - `$x` is a scale token;
  - `ramp.N` is a ramp step;
  - L / D means light / dark.
- **Rule labels** refer to ADR 0011: R2a alias, R2b counterpart, R2c role, R3a keep the 16.32.0 value, R3b take the v16.52.0 meaning, R4 component-local.
- **Evidence labels**:
  - VERIFIED: every cited line was opened in the clone;
  - ASSUMED: the visual effect is inferred, not seen on screen.
- **No approved value changes.** Only mappings move. Every `--ins-*` token named here already exists.

## Counts

| Section | Rows |
|---|---|
| G1. Dead in v16.52.0 | 15 |
| G1b. Read only in v16.52.0 | 6 |
| G2a. Effective in 16.32.0, no effect in v16.52.0 | 3 |
| G2b. No effect in 16.32.0, effective in v16.52.0 | 99: 58 correct by ramp step, 16 correct by role, **25 to remap** |
| N. New keys to add (names only v16.52.0 reads) | **47** |
| C. Component-local (R4, not root keys) | 3 must, 4 should |
| X. Not a variable (selector fixes) | 3 |
| P. Pairs for `counterparts.json` | 30 |

## Action list for the backend-engineer

1. **Remap 26 existing keys:** the 25 rows marked **remap** in G2b, plus `--ink-white` (G1b).
2. **Add 47 keys** (section N). This includes the raw ramp step 950, which is a build change: `frappe.raw_gray_light` and `raw_gray_dark` gain `"950"`, and the `raw_hues` emitter covers 950.
3. **Keep the 15 dead names.** Each one has an effect or a declaration in 16.32.0, so it is not DEAD under ADR 0011 R5 F1. Nothing is removed.
4. **Write `counterparts.json`** from section P.
5. **Leave unchanged** every key not named here (247 effective in both versions; the 58 + 16 correct rows of G2b).

## G1. The 15 dead names (in no file of v16.52.0 `public/{scss,css,js}`, `www`, `templates`)

| Name | 16.32.0: declared · readers | v16.52.0: what the same consumer reads now | Theme value (unchanged) | Action in v16.52.0 | Evidence |
|---|---|---|---|---|---|
| `--neutral-black` | `scss/espresso/_colors.scss:24` · `common/css_variables.scss:140` (`--checkbox-color`), `desk/dark.scss:3` (`--neutral`), `desk/desktop.scss:5` (`::selection`), `_colors.scss:26` (`--invert-neutral`) | `::selection` color is `--ink-gray-9` (`scss/desk/desktop.scss:6`); `--neutral: var(--ink-base)` (`css/espresso/legacy.css:22`); `--checkbox-color: var(--ink-gray-9)` (`legacy.css:119`, read nowhere) | `slate.950` | None. Every 16.32.0 reader is already covered by another theme key (`--neutral`, `--invert-neutral`, `--ink-gray-9` mapped) or rule (`::selection` in `institutional_theme/public/scss/desk/_base.scss:50`) | VERIFIED |
| `--surface-white` | `_colors.scss:252`, `:297` · `common/buttons.scss:155` (`.btn-outline`), `common/controls.scss:775` (`.switch-thumb`), `desk/settings_dialog.scss:87,91` (fallback), `login.bundle.scss:228` (inputs) | `--surface-base` at `common/buttons.scss:198`, `common/controls.scss:806`, `desk/settings_dialog.scss:91,95`, `login.bundle.scss:90` | `@surface-base` L/D | **Add `--surface-base`** (N1) | VERIFIED |
| `--surface-menu-bar` | `_colors.scss:250`, `:325` · `desk/settings_dialog.scss:20,32,48`, `desk/sidebar.scss:39` (`.body-sidebar`), `:292` (toggle) | `settings_dialog.scss:23` `--surface-elevation-1`; `:35,:52` `--surface-sidebar`; `sidebar.scss:65` `--desk-sidebar-bg` (= `--surface-sidebar` L `:24`, `--surface-gray-1` D `:28`) | `@surface-sunken` L/D | **Add `--surface-sidebar`, `--desk-sidebar-bg`, `--surface-elevation-1`** (N2-N4) | VERIFIED |
| `--surface-modal` | `_colors.scss:251`, `:327` · `desk/card.scss:31`, `desk/menu.scss:13`, `desk/settings_dialog.scss:140` | `--surface-elevation-2` at `desk/card.scss:31`, `css/espresso/components/menu.css:53`, `popover.css:39`; `settings_dialog.scss:138` reads `--bg-color` (mapped) | `@surface-overlay` L/D | **Add `--surface-elevation-2`** (N5) | VERIFIED |
| `--surface-cards` | `_colors.scss:326` (dark block) · none | none | `@surface-raised` | None (no effect in both versions; declared in 16.32.0, so not DEAD) | VERIFIED |
| `--surface-selected` | `_colors.scss:328` · `desk/settings_dialog.scss:87,91` (active item) | `--surface-elevation-3` at `settings_dialog.scss:91,95` | `@surface-active` | Covered by N6 (`--surface-elevation-3`, sidebar value wins, R2b). Accepted difference D1 | VERIFIED |
| `--outline-white` | `_colors.scss:282` · none | none | `#ffffff` / `night.850` | None | VERIFIED |
| `--outline-gray-modals` | `_colors.scss:222`, `:296` · none | none (menus and popovers use `--outline-elevation-2`, `menu.css:69`, `popover.css:40`, added by role, N10) | `@border` | None | VERIFIED |
| `--toast-bg` | `common/css_variables.scss:93`, `desk/dark.scss:39`, `desk/toast.scss:14-30` · `desk/toast.scss:37` (`.desk-alert`) | `frappe.show_alert` (`js/frappe/ui/messages.js:430`) builds `.es-toast`: `background: var(--surface-gray-9)`, `color: var(--ink-base)`, `box-shadow: var(--elevation-lg)` (`css/espresso/components/toast.css:47-49`) | `@surface-overlay` | No root key can carry it: `--surface-gray-9` is also the solid-button hover (`button.css:35`) and stepper (`stepper.css:72`). **Component-local C3** | VERIFIED |
| `--sidebar-border-color` | `desk/sidebar.scss:5,12` · `sidebar.scss:40` (edge), `:291` (toggle) | edge `--outline-gray-1` (`sidebar.scss:66`); toggle `--outline-gray-2` (`:446`) | `@border-hairline` | None: `--outline-gray-1` is already `@border-hairline`. Toggle: accepted difference D5 | VERIFIED |
| `--divider-color` | `desk/sidebar.scss:6,13` · none | none | `@border-hairline` | None | VERIFIED |
| `--sidebar-hover-color` | `desk/sidebar.scss:3,10` · `sidebar.scss:18` (hover mixin), `:310` (toggle), `desk/menu.scss:22` (menu item) | hover mixin `--surface-gray-2` (`sidebar.scss:34`); es-menu highlight `--surface-alpha-gray-2` (`menu.css:110`) | `@surface-hover` | `--surface-gray-2` is already `@surface-hover`. **Add `--surface-alpha-gray-2`** (N7) | VERIFIED |
| `--sidebar-active-color` | `desk/sidebar.scss:4,11` · `sidebar.scss:272` (`.active-sidebar`) | `--surface-elevation-3` (`sidebar.scss:545`; also `:367`, `:447`, `desk/dock.scss:204`) | `@surface-base` / `@surface-hover` | **Add `--surface-elevation-3`** with this value (N6) | VERIFIED |
| `--border-radius-tiny` | `scss/espresso/_borders.scss:2` · `common/datepicker.scss:64` | `--radius-sm` (`common/datepicker.scss:66`) | `$radius-xs` | **Add `--radius-sm` = `$radius-xs`** (N13) | VERIFIED |
| `--border-radius-xl` | `_borders.scss:7` · `common/about.scss:11` | `--radius-xl` (`common/about.scss:11`) | `$radius-lg` | **Add `--radius-xl` = `$radius-lg`** (N16) | VERIFIED |

## G1b. The 6 read-only names (v16.52.0 reads them and declares none; the theme's declaration defines them)

| Name | 16.32.0: declared · readers | v16.52.0 readers | Same meaning? | Theme value → action | Evidence |
|---|---|---|---|---|---|
| `--invert-neutral` | `desk/dark.scss:4`, `scss/espresso/_colors.scss:26` · 16 readers, e.g. `common/buttons.scss:126,151`, `common/icons.scss:40,50,51` | `common/buttons.scss:167` (`.btn-primary:active`, core `!important`), `:193`, `common/icons.scss:33,43,44`, `desk/desktop.scss:600,603,606`, `desk/form.scss:263` | Yes, same rules | `@text-strong` → keep | VERIFIED |
| `--ink-white` | `_colors.scss:329` (dark block) · none | `css/espresso/components/button.css:285` (`.es-button.btn-danger { --bt-fg }`) | Role is "text on the red fill" | `#ffffff` / `night.950` → **remap `@on-danger` L/D** (R3b) | VERIFIED |
| `--border-radius-sm` | `_borders.scss:3` (8px) · 37 readers, e.g. `common/form.scss:5,20` | `common/controls.scss:666`, `desk/arrangement_editor.scss:118,140,217`, `desk/form_sidebar.scss:650`, `desk/kanban_v2.scss:383`, `desk/search_widget.scss:17` | Yes (core moved most readers to `--radius`, 8px: `common/form.scss:5,20`) | `$radius-sm` → keep; counterpart `--radius` (N12) | VERIFIED |
| `--border-radius` | `_borders.scss:4` (8px) · 107 readers, e.g. `common/buttons.scss:12` | `common/controls.scss:650,700`, `desk/form_sidebar.scss:711`, `templates/print_format/print_format.css:134` | Yes | `$radius-sm` → keep; counterpart `--radius` (`common/buttons.scss:14`) | VERIFIED |
| `--border-radius-md` | `_borders.scss:5` (10px) · 39 readers, e.g. `common/grid.scss:7` | `desk/arrangement_editor.scss:77,98,207`, `js/frappe/scanner/index.js:241`, `js/print_format_builder/components/editor/PrintFormatSection.vue:637`, `templates/print_format/print_format_doc.css:537` | Yes | `$radius-md` → keep; counterpart `--radius-md` (`common/grid.scss:8`) | VERIFIED |
| `--border-radius-lg` | `_borders.scss:6` (12px) · 21 readers, e.g. `common/datepicker.scss:11` | `desk/card.scss:68` | Yes | `$radius-md` → keep; counterpart `--radius-lg` (`common/datepicker.scss:10`) | VERIFIED |

## G2a. Effective in 16.32.0, no effect in v16.52.0

| Name | 16.32.0: declared · readers | v16.52.0: declared · what the same consumers read now | Action | Evidence |
|---|---|---|---|---|
| `--primary-color` | `common/css_variables.scss:130` · `desk/notification.scss:160,257`, `desk/theme_switcher.scss:45,76,100`, `js/frappe/file_uploader/FilePreview.vue:49` | `css/espresso/legacy.css:131` (`var(--gray-900)`) · notification tabs are now `es-tab-buttons` (`js/frappe/ui/notifications/notifications.js:147-165`); event chip border is `--outline-gray-1` (`desk/notification.scss:260`); selected theme card is `--ink-gray-8` (`desk/theme_switcher.scss:34-41`); the upload ring still reads `--primary-color` inline (`FilePreview.vue:49`, not in scanned CSS) | Keep the key (16.32.0 and the Vue ring). No root replacement: `--ink-gray-8` is body text everywhere else (R3c). Optional component rule C6 | VERIFIED |
| `--shadow-xl` | `scss/espresso/_shadows.scss:10` · `desk/menu.scss:14` (dropdown) | `css/espresso/effects.css:23` (`var(--elevation-xl)`) · es-menu reads `--elevation-2xl` (`components/menu.css:56`) | Keep. **Add `--elevation-2xl` = `@elevation-dialog`** (N38, same value as `--shadow-xl`, R2b) and the other `--elevation-*` (R2a) | VERIFIED |
| `--modal-shadow` | `common/css_variables.scss:24` · `desk/toast.scss:33` (`.desk-alert`) | `common/css_variables.scss:22` · es-toast reads `--elevation-lg` (`components/toast.css:49`) | Keep. `--elevation-lg` = `@elevation-overlay` by alias (`effects.css:22` `--shadow-lg: var(--elevation-lg)`, R2a outranks R2b); the design's `use` for `elevation-overlay` names toasts. Accepted difference D3 | VERIFIED |

## G2b. The 99 names that had no effect in 16.32.0 and are read in v16.52.0

Changing these cannot change 16.32.0: the 16.32.0 snapshot lists each as declared only. In v16.52.0, every `--{surface,ink,outline}-<family>-<N>` is read by the utility-class loop in `scss/common/utilities.scss:429-445`. Every raw ramp step is read by the semantic definitions in `css/espresso/colors.css`.

### Correct by ramp step (58 rows): keep

| Names | 16.32.0 declared (D-) | v16.52.0 declared (DR) | Theme value | Why it is right | Evidence |
|---|---|---|---|---|---|
| `--green-50`, `--green-400`; `--orange-50`, `-200`, `-300`, `-400`, `-900`; `--amber-50` … `--amber-900` (10); `--yellow-200`, `-400`, `-600`; `--cyan-200`, `-300`, `-400`, `-500`, `-600`, `-900`; `--teal-50` … `--teal-900` (10); `--violet-50` … `--violet-900` (10); `--pink-200`, `-300`, `-400`, `-600`, `-800`, `-900`; `--purple-200`, `-300`, `-400`, `-800`, `-900` (57 names) | `scss/espresso/_colors.scss:50-158` (for example `--green-50` `:50`, `--purple-900` `:158`) | light block `css/espresso/colors.css:34-142` (for example `--green-50` `:34`, `--violet-900` `:142`); dark block `:616-725` | `<hue>.N` (same step, both modes) | Raw palette step to theme palette step. Espresso orders both blocks lightest (50) to darkest (950), as the theme ramps do (`colors.css:34` `#f0faf3` against `:44`; dark `:616` `#c8f3de`) | VERIFIED |
| `--text-2xs` | `scss/espresso/_typography.scss:7` (12px) | `css/espresso/typography.css:14` (11px) · `desk/charts.scss:7`, `components/avatar.css:57`, `typography.css:43` and following | `$text-xs` | The theme's smallest step; the design has no 11px | VERIFIED |

### Correct by role (16 rows): keep

| Name | 16.32.0 declared | v16.52.0 declared L / D | Main v16.52.0 readers | Theme value L / D | Evidence |
|---|---|---|---|---|---|
| `--surface-gray-4` | `_colors.scss:226` | `colors.css:187` gray-300 / `:743` gray-500 | `common/buttons.scss:89`, `desk/desktop.scss:7` (`::selection` bg), `components/button.css:40` (pressed fill), `desk/theme_switcher.scss:172` | `slate.300` / `night.600` (one step beyond `@surface-active`, as Espresso's gray-300 sits beyond gray-200) | VERIFIED |
| `--surface-red-2`, `-3`, `-4` | `_colors.scss:231-233` | `colors.css:199-201` red-100/200/300 / `:755-757` red-900/800/700 | `components/alert.css:49`, `badge.css:82`, `button.css:110-112`, `menu.css:138` | `red.100`/`200`/`300` / `red.900`/`800`/`700` (identical steps) | VERIFIED |
| `--surface-green-2` | `_colors.scss:238` | `colors.css:219` green-100 / `:775` green-900 | `components/alert.css:54`, `badge.css:66` | `green.100` / `green.900` | VERIFIED |
| `--surface-amber-2` | `_colors.scss:241` | `colors.css:229` amber-100 / `:785` amber-900 | `components/alert.css:39`, `badge.css:74`, `badge-legacy-colors.css:16` | `amber.100` / `amber.900` | VERIFIED |
| `--surface-orange-1`, `--surface-violet-1`, `--surface-cyan-1`, `--surface-pink-1` | `_colors.scss:246-249` | `colors.css:258`, `:238`, `:278`, `:298` (`<hue>-50`) / `:814`, `:794`, `:834`, `:854` (`<hue>-950`) | utility classes only | `<hue>.50` / `<hue>.950` | VERIFIED |
| `--ink-green-1`, `--ink-amber-1`, `--ink-blue-1` | `_colors.scss:266`, `:269`, `:272` | `colors.css:359`, `:369`, `:349` white / `:915`, `:925`, `:905` white | solid badge text `components/badge.css:65,73,57`, `badge-legacy-colors.css:15,33` | `<hue>.50` / `<hue>.950`. Role "text on the solid fill": the theme's dark solids are light, so dark text. ASSUMED contrast, not in a `contrast.groups` pair | VERIFIED (lines) |
| `--ink-blue-link` | `_colors.scss:278` | `colors.css:454` / `:1010` blue-500 | `common/utilities.scss:453`, `components/toast.css:180` | `@text-link` (role: link) | VERIFIED |
| `--outline-gray-1` | `_colors.scss:208` | `colors.css:456` gray-200 / `:1012` gray-800 | 30 readers, e.g. `desk/sidebar.scss:66` (sidebar edge), `common/quill.scss:115`, `desk/calendar.scss:8` | `@border-hairline` | VERIFIED |
| `--outline-gray-4` | `_colors.scss:211` | `colors.css:459` gray-500 / `:1015` gray-450 | `common/color_picker.scss:30`, `desk/dock.scss:210`, `desk/theme_switcher.scss:26,31` | `@border-control` | VERIFIED |

### Remap (25 rows): the 16.32-era value means something else in v16.52.0 (R3b)

New value = the theme ramp at the step `colors.css` names in each mode, or the semantic token for the exact role. Columns: 16.32.0 declared L / D · v16.52.0 declared L / D · v16.52.0 readers · theme now L / D · **new L / D**.

| Name | 16.32.0 declared | v16.52.0 declared | v16.52.0 readers | Theme now | New | Evidence |
|---|---|---|---|---|---|---|
| `--surface-gray-5` | `scss/espresso/_colors.scss:227` #525252 / `scss/espresso/_colors.scss:302` #afafaf | `css/espresso/colors.css:188` gray-400 / `css/espresso/colors.css:744` gray-450 | `css/espresso/components/avatar.css:170`, `css/espresso/legacy.css:70`, `css/espresso/legacy.css:71`, `js/print_format_builder/components/VersionHistory.vue:171`; also `scss/common/utilities.scss:429-445` | slate.700 / night.300 | **slate.400** / **night.450** | VERIFIED |
| `--surface-gray-6` | `scss/espresso/_colors.scss:228` #383838 / `scss/espresso/_colors.scss:303` #d4d4d4 | `css/espresso/colors.css:189` gray-500 / `css/espresso/colors.css:745` gray-400 | utility classes only (`scss/common/utilities.scss:429-445`) | slate.800 / night.200 | **slate.500** / **night.400** | VERIFIED |
| `--surface-red-5` | `scss/espresso/_colors.scss:234` #cc2929 / `scss/espresso/_colors.scss:309` #e43838 | `css/espresso/colors.css:202` red-400 / `css/espresso/colors.css:758` red-600 | `css/espresso/components/button.css:284`; also `scss/common/utilities.scss:429-445` | red.600 / red.400 | **red.400** / **red.600** | VERIFIED |
| `--surface-red-6` | `scss/espresso/_colors.scss:235` #b52a2a / `scss/espresso/_colors.scss:310` #c12020 | `css/espresso/colors.css:203` red-500 / `css/espresso/colors.css:759` red-500 | `scss/common/email_composer.scss:521`, `css/espresso/components/button.css:286`; also `scss/common/utilities.scss:429-445` | red.700 / red.300 | **red.500** / **red.500** | VERIFIED |
| `--surface-red-7` | `scss/espresso/_colors.scss:236` #941f1f / `scss/espresso/_colors.scss:311` #901818 | `css/espresso/colors.css:204` red-600 / `css/espresso/colors.css:760` red-400 | `css/espresso/components/avatar.css:186`, `css/espresso/components/badge.css:80`, `css/espresso/components/button.css:106`, `css/espresso/components/button.css:287`; also `scss/common/utilities.scss:429-445` | red.800 / red.200 | **@danger** / **@danger** | VERIFIED |
| `--surface-green-3` | `scss/espresso/_colors.scss:239` #278f5e / `scss/espresso/_colors.scss:314` #1ba964 | `css/espresso/colors.css:220` green-200 / `css/espresso/colors.css:776` green-800 | utility classes only (`scss/common/utilities.scss:429-445`) | green.600 / green.400 | **green.200** / **green.800** | VERIFIED |
| `--surface-amber-3` | `scss/espresso/_colors.scss:242` #db7706 / `scss/espresso/_colors.scss:317` #e37d00 | `css/espresso/colors.css:230` amber-200 / `css/espresso/colors.css:786` amber-800 | utility classes only (`scss/common/utilities.scss:429-445`) | amber.600 / amber.400 | **amber.200** / **amber.800** | VERIFIED |
| `--ink-red-1` | `scss/espresso/_colors.scss:262` #fff7f7 | `css/espresso/colors.css:339` white / `css/espresso/colors.css:895` white | `css/espresso/components/badge.css:81`, `css/espresso/components/button.css:109`; also `scss/common/utilities.scss:429-445` | red.50 / red.950 | **@on-danger** / **@on-danger** | VERIFIED |
| `--ink-red-2` | `scss/espresso/_colors.scss:263` #f79596 / `scss/espresso/_colors.scss:339` #681916 | `css/espresso/colors.css:340` red-100 / `css/espresso/colors.css:896` red-800 | utility classes only (`scss/common/utilities.scss:429-445`) | red.300 / red.700 | **red.100** / **red.800** | VERIFIED |
| `--ink-red-3` | `scss/espresso/_colors.scss:264` #e03636 / `scss/espresso/_colors.scss:340` #e43838 | `css/espresso/colors.css:341` red-200 / `css/espresso/colors.css:897` red-700 | utility classes only (`scss/common/utilities.scss:429-445`) | red.600 / red.400 | **red.200** / **red.700** | VERIFIED |
| `--ink-green-2` | `scss/espresso/_colors.scss:267` #46b37e / `scss/espresso/_colors.scss:342` #1ba964 | `css/espresso/colors.css:360` green-100 / `css/espresso/colors.css:916` green-800 | utility classes only (`scss/common/utilities.scss:429-445`) | green.600 / green.400 | **green.100** / **green.800** | VERIFIED |
| `--ink-amber-2` | `scss/espresso/_colors.scss:270` #e79913 / `scss/espresso/_colors.scss:344` #e37d00 | `css/espresso/colors.css:370` amber-100 / `css/espresso/colors.css:926` amber-800 | utility classes only (`scss/common/utilities.scss:429-445`) | amber.600 / amber.400 | **amber.100** / **amber.800** | VERIFIED |
| `--ink-blue-2` | `scss/espresso/_colors.scss:273` #0289f7 / `scss/espresso/_colors.scss:346` #3294e3 | `css/espresso/colors.css:350` blue-100 / `css/espresso/colors.css:906` blue-800 | utility classes only (`scss/common/utilities.scss:429-445`) | blue.600 / blue.400 | **blue.100** / **blue.800** | VERIFIED |
| `--ink-cyan-1` | `scss/espresso/_colors.scss:275` #3bbde5 / `scss/espresso/_colors.scss:348` #3cb8dc | `css/espresso/colors.css:419` white / `css/espresso/colors.css:975` white | utility classes only (`scss/common/utilities.scss:429-445`) | cyan.700 / cyan.300 | **cyan.50** / **cyan.950** | VERIFIED |
| `--ink-pink-1` | `scss/espresso/_colors.scss:276` #e34aa6 / `scss/espresso/_colors.scss:349` #e359ab | `css/espresso/colors.css:439` white / `css/espresso/colors.css:995` white | utility classes only (`scss/common/utilities.scss:429-445`) | pink.700 / pink.300 | **pink.50** / **pink.950** | VERIFIED |
| `--ink-violet-1` | `scss/espresso/_colors.scss:277` #6846e3 / `scss/espresso/_colors.scss:350` #9d7cea | `css/espresso/colors.css:379` white / `css/espresso/colors.css:935` white | `css/espresso/components/badge-legacy-colors.css:24`, `css/espresso/components/badge.css:89`; also `scss/common/utilities.scss:429-445` | violet.700 / violet.300 | **violet.50** / **violet.950** | VERIFIED |
| `--outline-gray-5` | `scss/espresso/_colors.scss:212` #383838 / `scss/espresso/_colors.scss:279` #ededed | `css/espresso/colors.css:460` gray-600 / `css/espresso/colors.css:1016` gray-400 | utility classes only (`scss/common/utilities.scss:429-445`) | slate.800 / night.200 | **slate.600** / **night.400** | VERIFIED |
| `--outline-red-1` | `scss/espresso/_colors.scss:213` #fdc2c2 / `scss/espresso/_colors.scss:287` #521515 | `css/espresso/colors.css:465` red-100 / `css/espresso/colors.css:1021` red-900 | `css/espresso/components/button.css:114`, `css/espresso/components/button.css:119`; also `scss/common/utilities.scss:429-445` | red.200 / red.800 | **red.100** / **red.900** | VERIFIED |
| `--outline-red-3` | `scss/espresso/_colors.scss:215` #e03636 / `scss/espresso/_colors.scss:289` #901818 | `css/espresso/colors.css:467` red-300 / `css/espresso/colors.css:1023` red-700 | `scss/login.bundle.scss:100`, `scss/login.bundle.scss:112`, `css/espresso/components/badge.css:83`, `css/espresso/components/button.css:115` (+1); also `scss/common/utilities.scss:429-445` | red.600 / red.400 | **red.300** / **red.700** | VERIFIED |
| `--outline-green-1` | `scss/espresso/_colors.scss:216` #a6efc0 / `scss/espresso/_colors.scss:290` #0a3f27 | `css/espresso/colors.css:485` green-100 / `css/espresso/colors.css:1041` green-900 | utility classes only (`scss/common/utilities.scss:429-445`) | green.200 / green.800 | **green.100** / **green.900** | VERIFIED |
| `--outline-green-2` | `scss/espresso/_colors.scss:217` #86e0a8 / `scss/espresso/_colors.scss:291` #035831 | `css/espresso/colors.css:486` green-200 / `css/espresso/colors.css:1042` green-800 | utility classes only (`scss/common/utilities.scss:429-445`) | green.300 / green.700 | **green.200** / **green.800** | VERIFIED |
| `--outline-amber-1` | `scss/espresso/_colors.scss:218` #fbdb73 / `scss/espresso/_colors.scss:292` #4b2606 | `css/espresso/colors.css:495` amber-100 / `css/espresso/colors.css:1051` amber-900 | utility classes only (`scss/common/utilities.scss:429-445`) | amber.200 / amber.800 | **amber.100** / **amber.900** | VERIFIED |
| `--outline-amber-2` | `scss/espresso/_colors.scss:219` #fbcc55 / `scss/espresso/_colors.scss:293` #603007 | `css/espresso/colors.css:496` amber-200 / `css/espresso/colors.css:1052` amber-800 | utility classes only (`scss/common/utilities.scss:429-445`) | amber.300 / amber.700 | **amber.200** / **amber.800** | VERIFIED |
| `--outline-blue-1` | `scss/espresso/_colors.scss:220` #a7d7fd / `scss/espresso/_colors.scss:294` #052b53 | `css/espresso/colors.css:475` blue-100 / `css/espresso/colors.css:1031` blue-900 | utility classes only (`scss/common/utilities.scss:429-445`) | blue.200 / blue.800 | **blue.100** / **blue.900** | VERIFIED |
| `--outline-orange-1` | `scss/espresso/_colors.scss:221` #f4b07f / `scss/espresso/_colors.scss:295` #683108 | `css/espresso/colors.css:525` orange-100 / `css/espresso/colors.css:1081` orange-900 | utility classes only (`scss/common/utilities.scss:429-445`) | orange.300 / orange.700 | **orange.100** / **orange.900** | VERIFIED |

Notes on the remap table:

- `--surface-red-7` is the solid red of `.es-button[data-theme="red"]` (`button.css:106`) and `.es-badge[data-theme="red"]` (`badge.css:80`). `@danger` is `red.600` / `red.400`, which is also Espresso's step in each mode. Its hover `--surface-red-8` (`button.css:107`) stays unmapped. It resolves to `red.700` / `red.300` through the raw ramps, which equals `@danger-hover`.
- `--outline-red-3` borders invalid login inputs in v16.52.0 (`login.bundle.scss:100,112`). 16.32.0 used `--outline-red-2` for the same rule (`login.bundle.scss:238,288`, theme `red.300` / `red.700`). The new value equals that counterpart (R2b and R3b agree).
- `--surface-red-5`, `-6` and `--ink-white` are read by `.es-button.btn-danger` (`button.css:283-288`). That rule sets `--bt-bg`, `--bt-hover-bg` and `--bt-active-bg`, which no rule reads (grep of `public/css` and `public/scss`); only its `--bt-fg` takes effect. See C5.

## N. Keys to add: names only v16.52.0 reads (none of them in the 16.32.0 snapshot, so they are inert there)

| # | Name | v16.52.0 declared | Main readers | Rule | Value L / D | Evidence |
|---|---|---|---|---|---|---|
| N1 | `--surface-base` | `css/espresso/colors.css:183` / `:739` | 37, e.g. `common/buttons.scss:198`, `common/controls.scss:806`, `login.bundle.scss:90`, `desk/sidebar_panel.scss:26` | R2b `--surface-white` | `@surface-base` / `@surface-base` | VERIFIED |
| N2 | `--surface-sidebar` | `colors.css:194` / `:750` (dark: transparent) | `desk/settings_dialog.scss:35,52`, `desk/sidebar.scss:24`, `css/espresso/legacy.css:36` | R2b `--surface-menu-bar` (`settings_dialog.scss:32,48` → `:35,:52`) | `@surface-sunken` / `@surface-sunken` | VERIFIED |
| N3 | `--desk-sidebar-bg` | `scss/desk/sidebar.scss:24` / `:28` (dark: `--surface-gray-1`, which the theme maps to `@surface-raised`, so the key is needed) | `sidebar.scss:65` (panel and rail), `desk/dock.scss:22` (`--dock-bg`) | R2a alias of `--surface-sidebar`; R2b `--surface-menu-bar` (`sidebar.scss:39` → `:65`) | `@surface-sunken` / `@surface-sunken` | VERIFIED |
| N4 | `--surface-elevation-1` | `colors.css:195` / `:751` | `desk/settings_dialog.scss:23`, `desk/calendar.scss:16` (`--fc-page-bg-color`) | R2b `--surface-menu-bar` (`settings_dialog.scss:20` → `:23`) | `@surface-sunken` / `@surface-sunken` | VERIFIED. Accepted difference D2 |
| N5 | `--surface-elevation-2` | `colors.css:196` / `:752` | `desk/card.scss:31`, `components/menu.css:53`, `components/popover.css:39`, `common/quill.scss:205,480`, `desk/sidebar_header.scss:44`, `desk/theme_switcher.scss:19` | R2b `--surface-modal` | `@surface-overlay` / `@surface-overlay` | VERIFIED |
| N6 | `--surface-elevation-3` | `colors.css:197` / `:753` | `desk/sidebar.scss:367,447,545` (active row), `desk/dock.scss:204`, `desk/settings_dialog.scss:91,95`, `components/tab_buttons.css:115` | R2b `--sidebar-active-color` (`sidebar.scss:272` → `:545`; 4 of 7 readers are the shell) | `@surface-base` / `@surface-hover` | VERIFIED. Accepted difference D1 |
| N7 | `--surface-alpha-gray-2` | `colors.css:315` | `components/menu.css:110` (highlighted row), `common/quill.scss:497` | R2b `--sidebar-hover-color` (`desk/menu.scss:22`, `.dropdown-menu-item:hover`) | `@surface-hover` / `@surface-hover` | VERIFIED |
| N8 | `--surface-gray-10` | `colors.css:193` / `:749` | `components/tooltip.css:37,109,117,125,133`, `badge.css:10`, `badge-legacy-colors.css:41`, `button.css:34`, `progress.css:77,100`, `tabs.css:128`, `desk/calendar.scss:40`, `desk/dark.scss:24,25,36` | R2c, role "tooltips" = `@surface-inverse` (majority of readers). The button, tab and progress roles are fixed by C1 and C4, not here (R3c) | `@surface-inverse` / `@surface-inverse` | VERIFIED |
| N9 | `--ink-base` | `colors.css:329` / `:885` | `components/tooltip.css:38`, `badge.css:11`, `stepper.css:73`, `toast.css:48,133,162,196,212`, `common/utilities.scss:449`, `desk/user_settings_dialog.scss:3`, `legacy.css:22` (`--neutral`, mapped) | R2c, role "text on the inverse surface" = `@text-inverse` | `@text-inverse` / `@text-inverse` | VERIFIED |
| N10 | `--outline-elevation-2` | `colors.css:576` / `:1132` | `components/menu.css:69`, `components/popover.css:40` | R2c, `border`: "Card, section and menu outlines" | `@border` / `@border` | VERIFIED |
| N11 | `--gray-950` and `--blue-950`, `--green-950`, `--red-950`, `--orange-950`, `--amber-950`, `--yellow-950`, `--cyan-950`, `--teal-950`, `--violet-950`, `--pink-950`, `--purple-950` (12) | `colors.css:22` (gray) and the last line of each hue block, for example `:143` violet, `:99` teal; dark `:604` and following | only `colors.css` semantic definitions (for example `--ink-gray-9`, `--outline-<hue>-10`, dark `--surface-<hue>-1`) | Raw ramp passthrough (ADR 0011 R2c): unmapped semantic steps must land on a theme colour | gray `slate.950` / `night.950`; hues `<hue>.950` / `<hue>.950` | VERIFIED. Build change: `raw_gray_*` and `raw_hues` emit step 950 |
| N12 | `--radius` | `css/espresso/radius.css:19` (8px) | 172, e.g. `common/buttons.scss:14`, `common/form.scss:5,20`, `components/button.css` (`border-radius`), `desk/sidebar.scss:35,547` | R2b `--border-radius` (`buttons.scss:12` → `:14`) and `--border-radius-sm` (`form.scss:5` → `:5`), both `$radius-sm` | `$radius-sm` | VERIFIED |
| N13 | `--radius-sm` | `radius.css:18` (4px) | `common/datepicker.scss:66`, `common/quill.scss:507`, `components/menu.css:178`, `components/tabs.css:109`, `desk/sidebar_panel.scss:80`, `desk/theme_switcher.scss:63` | R2b `--border-radius-tiny` (`datepicker.scss:64` → `:66`) | `$radius-xs` | VERIFIED |
| N14 | `--radius-md` | `radius.css:20` (10px) | 48, e.g. `common/grid.scss:8,26,27`, `common/modal.scss:193,265` | R2b `--border-radius-md` (`grid.scss:7` → `:8`) | `$radius-md` | VERIFIED |
| N15 | `--radius-lg` | `radius.css:21` (12px) | 34, e.g. `common/datepicker.scss:10`, `components/menu.css:54`, `common/quill.scss:207` | R2b `--border-radius-lg` (`datepicker.scss:11` → `:10`) | `$radius-md` | VERIFIED |
| N16 | `--radius-xl` | `radius.css:22` (16px) | `common/about.scss:11`, `common/email_composer.scss:39`, `common/utilities.scss:545,575` | R2b `--border-radius-xl` | `$radius-lg` | VERIFIED |
| N17-N20 | `--font-weight-regular`, `--font-weight-medium`, `--font-weight-semibold`, `--font-weight-bold` | `css/espresso/typography.css:8-11` (420, 500, 600, 700) | 30, 41, 26 and 23 readers, e.g. `desk/sidebar.scss:177`, `components/button.css` (`font-weight`), `components/badge.css:28`, `components/toast.css:114` | R2a: `legacy.css:186-189` `--weight-X: var(--font-weight-X)` | `$weight-regular`, `$weight-medium`, `$weight-strong`, `$weight-strong` (as `--weight-*`) | VERIFIED. Without them, v16.52.0 asks the self-hosted font for weight 420 |
| N21-N25 | `--text-p-xs`, `--text-p-sm`, `--text-p-base`, `--text-p-lg`, `--text-p-xl` | `typography.css:33-37` (12, 13, 14, 16, 17px, equal to `--text-xs` … `--text-xl` at `:15-19`) | `components/menu.css:192`, `components/popover.css:63`, `components/toast.css:111,121`, `typography.css:673` and following | R2a, same scale step | `$text-xs`, `$text-sm`, `$text-base`, `$text-lg`, `$text-xl` | VERIFIED |
| N26-N31 | `--elevation-sm`, `--elevation-base`, `--elevation-md`, `--elevation-lg`, `--elevation-xl`, `--elevation-2xl` | `css/espresso/effects.css:10-15` | `components/tab_buttons.css:116,140`, `desk/kanban_v2.scss:98`, `components/toast.css:49` (lg), `components/popover.css:42` and `tooltip.css:40` (xl), `components/menu.css:56` and `common/quill.scss:208,483` (2xl), `common/utilities.scss:482-498` | R2a: `effects.css:19-24` `--shadow-X: var(--elevation-X)` (`--shadow` is base) | `@elevation-raised`, `@elevation-raised`, `@elevation-overlay`, `@elevation-overlay`, `@elevation-dialog`, `@elevation-dialog` (as `--shadow-sm`, `-base`, `-md`, `-lg`, `-xl`, `-2xl`) | VERIFIED |
| N32 | `--focus-outline-default` | `effects.css:28` / `:43` | `components/button.css:48` (`--bt-focus`), `tabs.css:107`, `breadcrumbs.css:92`, `alert.css:104`, `stepper.css:60`, `tab_buttons.css:76`, `toast.css:223`, `common/quill.scss:240` | R2c, `focus`: "Focus ring, 2px, on every interactive element" (same form as `--highlight-shadow`) | `2px solid @focus` (both) | VERIFIED. The theme's ring rule (`institutional_theme/public/scss/desk/_base.scss:19`, (0,4,2)) already wins on buttons; this covers the rest |
| N33-N34 | `--bg-amber`, `--text-on-amber` | `css/espresso/legacy.css:198-199` | `common/indicator.scss:64-87` (loop, `amber` at `:62`) | R2b `--bg-orange` / `--text-on-orange`: "Not Saved" is `orange` in 16.32.0 (`js/frappe/model/indicator.js:28`) and `amber` in v16.52.0 (same line); `utils.js:492,542` → `:527,:577` | `@status-pending-bg`, `@status-pending-fg` | VERIFIED |
| N35-N36 | `--bg-violet`, `--text-on-violet` | `legacy.css:200-201` | `common/indicator.scss:64-87` (`violet` at `:62`) | R2b `--bg-pink` / `--text-on-pink`: the shortcut widget maps `Pink: "violet"` (`js/frappe/widgets/shortcut_widget.js:120`); 16.32.0 used the lowercased colour, `pink` (`shortcut_widget.js:112`) | `@status-plum-bg`, `@status-plum-fg` | VERIFIED |

Total: 10 (N1-N10) + 12 (N11) + 5 (radius) + 4 (weights) + 5 (paragraph sizes) + 6 (elevations) + 1 (focus) + 4 (indicators) = **47 keys**.

Left unmapped on purpose (R2c, no role and no counterpart; each resolves through the theme's raw ramps or is geometry):

- `--surface-gray-8` and `--surface-gray-9` (solid hover, toast, stepper);
- `--outline-gray-6` to `--outline-gray-9`;
- the other `--{surface,ink,outline}-<hue>-<N>` steps;
- `--surface-alpha-*` other than N7;
- `--radius-1` to `--radius-9`, `--radius-2xl` and `--radius-full`: their counterparts `--border-radius-2xl` and `--border-radius-full` are not mapped either. The dock and sidebar header use `--radius-4` and `--radius-5` (`desk/dock.scss:94,120,158,190`, `desk/sidebar_header.scss:81`), which is new shell geometry;
- `--font-weight-black`;
- `--text-4xl` and above;
- `--white`, `--black`, `--transparent`;
- `--focus-outline-{red,green,amber,blue,violet}`: the theme ring wins at (0,4,2);
- `--spacing`;
- every `--dock-*`, `--es-*` and `--reka-*` (component geometry and animation).

## C. Component-local repointing (ADR 0011 R4). css-engineer, and print-web-engineer for `ins_web`

At the 0003 shape (`html:root[dir] …`). These are not `frappe.vars` keys. The audit covers them through the scoped-declaration scope of R5.

| # | Component and core lines | Set | Priority | Evidence |
|---|---|---|---|---|
| C1 | `.es-button` solid: `components/button.css:34-37` (gray default, `--bt-solid-bg: var(--surface-gray-10)`), red theme `:104-109`, variant `:149-162`. Page primary action `js/frappe/ui/page.html:61`; login `Continue` (`www/login.html`) | On `.es-button:not([data-theme="red"])`: `--bt-solid-bg: var(--ins-primary)`, `--bt-solid-bg-hover: var(--ins-primary-hover)`, `--bt-solid-bg-active: var(--ins-primary-active)`, `--bt-solid-fg: var(--ins-on-primary)`. Must appear in both `ins_desk` and `ins_web` | **Must** (round 3: near-black primary on login and desk) | VERIFIED |
| C1b | `.es-button` subtle and disabled: `button.css:38-39`, `:45-46` | `--bt-fill-bg: var(--ins-surface-fill)`, `--bt-fill-bg-hover: var(--ins-surface-fill-hover)` (as ADR 0010's `.btn` rule), `--bt-disabled-bg: var(--ins-surface-disabled)`, `--bt-disabled-fg: var(--ins-text-disabled)` | Should (Dark differs by one tone without it) | VERIFIED (lines); ASSUMED (visual) |
| C2 | `.es-badge[data-theme=X]`: `components/badge.css:7-14` (gray default), `:55-89`; legacy names `badge-legacy-colors.css:12-45` collapse `orange`+`yellow` to amber, `purple`+`pink` to violet, `cyan`+`light-blue` to blue, `grey`+`darkgrey` to gray. List status `js/frappe/list/list_view.js:1499,1896`; page-head status `js/frappe/ui/page.js:299`, `page.html:24` | For every class in `$ins-indicators` (`institutional_theme/public/scss/desk/_status.scss:77-91`), plus `amber` → pending/half and `violet` → plum/diamond: `--c-fill: var(--ins-status-<f>-bg)`, `--c-fg: var(--ins-status-<f>-fg)`, `--c-line: var(--ins-status-<f>-border)`, and the same `::before` shape as `.indicator-pill`. No `data-theme` means neutral/ring | **Must** (BRIEF 3 rule 1, one status language: without it, v16.52.0 lists and page heads show Espresso's six tints with no shape) | VERIFIED (lines); the visual is ASSUMED (not yet seen) |
| C3 | `.es-toast`: `components/toast.css:34-52` (`--surface-gray-9`, `--ink-base`, `--elevation-lg`), `:133-223` (`--ink-base`, `--ink-gray-3`, `--outline-gray-3`, `--surface-gray-8`) | On `.es-toast`: `--surface-gray-9: var(--ins-surface-overlay)`, `--surface-gray-8: var(--ins-surface-hover)`, `--ink-base: var(--ins-text)`, `--ink-gray-3: var(--ins-text-muted)`, `--outline-gray-3: var(--ins-border)`. The shadow follows N29 | Should (the design's `use` for `surface-overlay` names toasts) | VERIFIED |
| C4 | Web-form tabs `.es-tabs__indicator` (`components/tabs.css:128`) and `.es-progress__fill` / `__segment[data-filled]` (`components/progress.css:77,100`, setup wizard) | `background-color: var(--ins-primary)` ("active tab rule", `--progress-bar-bg`) | Should, low (not a P0 screen; `js/frappe/web_form/web_form.js`, `ui/slides.js`) | VERIFIED |
| C5 | `.es-button.btn-danger` (`button.css:283-288`): its `--bt-bg`, `--bt-hover-bg` and `--bt-active-bg` are read by no rule, so the background stays the subtle fill under `--bt-fg: var(--ink-white)` | Only if core markup produces it (core's own red path is `data-theme="red"`: es-buttons change look by data attributes, `js/frappe/ui/page.js:958-965`): background `var(--ins-danger)`, colour `var(--ins-on-danger)` | Check | ASSUMED (not seen in core markup) |
| C6 | Selected theme card `desk/theme_switcher.scss:34-41` (`--ink-gray-8`, was `--primary-color` at 16.32.0 `:45,76,100`) | Border `var(--ins-primary)` | Optional (BRIEF 3 rule 5) | VERIFIED |

## X. Not variables (round-3 observations that a token cannot fix)

| # | Observation | Cause in source | Fix (owner) | Evidence |
|---|---|---|---|---|
| X1 | Login inputs: empty gap where the field icons were | 16.32.0 `www/login.html:23,37` draw `svg.field-icon`; v16.52.0 `www/login.html` has none (only the eye toggle at `:29`). The theme pads both sides for the icon: `institutional_theme/public/scss/web/_login.scss:174-177` (`padding-inline: 38px`) | Pad the start side only when `.field-icon` exists, and the end side only for `.password-field` (print-web-engineer, R1 side by side) | VERIFIED |
| X2 | "Forgot password?" is grey | v16.52.0 `www/login.html:37`: `<a href="#forgot" class="text-base text-ink-gray-5">`, so `--ink-gray-5` = `@text-muted`, which is right for muted text everywhere else | Selector rule for that link: `var(--ins-text-link)` (the 16.32.0 rule is `_login.scss:189-196` on `.forgot-password-message`, gone). Do not remap `--ink-gray-5` (R3c) | VERIFIED |
| X3 | New shell: icon rail (dock) and tree sidebar | `desk/dock.scss:15-28` (`--dock-bg: var(--desk-sidebar-bg)`, `--dock-ink*` from `--ink-gray-5/7/8`), `desk/sidebar.scss` | ADR 0001 D2: dock styling is out of scope. With N3, N6 and the mapped `--ink-gray-*` it takes theme colours. No dock-specific selectors | VERIFIED |

## D. Accepted differences on v16.52.0 (none on 16.32.0)

| # | Where | 16.32.0 look | v16.52.0 with this map | Why accepted |
|---|---|---|---|---|
| D1 | Settings dialog active item (`desk/settings_dialog.scss:91,95`) | `@surface-active` | `@surface-base` / `@surface-hover` | One token (`--surface-elevation-3`) carries both roles; the sidebar has the most P0 readers (R2b) |
| D2 | Calendar "+n more" popover (`desk/calendar.scss:16`, `--fc-page-bg-color`) | FullCalendar default | `@surface-sunken` | New reader with no counterpart. The css-engineer may set `--fc-page-bg-color: var(--ins-surface-overlay)` beside the existing `--fc-border-color` (`institutional_theme/public/scss/desk/_calendar.scss:26-29`) |
| D3 | Toast shadow | `@elevation-dialog` (`--modal-shadow`) | `@elevation-overlay` | Espresso alias rule (R2a); matches the design's `use` for `elevation-overlay` |
| D4 | Notification panel tabs and the selected theme card | ink blue (`--primary-color`) | neutral ink (`--ink-gray-8`, es-tab-buttons) | Core moved these off `--primary-color`; C6 optional |
| D5 | Sidebar collapse toggle border | `@border-hairline` | `@border` (`desk/sidebar.scss:446`, `--outline-gray-2`) | Already mapped; a one-tone difference on a hover-only control |

## P. Pairs for `institutional_theme/audits/data/counterparts.json` (ADR 0011 R5 F2)

All rows are `"value": "same"` except where marked. Every name is in the snapshot of its version (16.32.0: declared or read; v16.52.0: read).

| 16.32.0 | v16.52.0 | value | why (for `differs`) |
|---|---|---|---|
| `--surface-white` | `--surface-base` | same | |
| `--surface-menu-bar` | `--surface-sidebar` | same | |
| `--surface-menu-bar` | `--desk-sidebar-bg` | same | |
| `--surface-menu-bar` | `--surface-elevation-1` | same | |
| `--surface-modal` | `--surface-elevation-2` | same | |
| `--sidebar-active-color` | `--surface-elevation-3` | same | |
| `--surface-selected` | `--surface-elevation-3` | differs | Settings dialog active item; the sidebar reader wins (token map D1) |
| `--sidebar-hover-color` | `--surface-gray-2` | same | |
| `--sidebar-hover-color` | `--surface-alpha-gray-2` | same | |
| `--sidebar-border-color` | `--outline-gray-1` | same | |
| `--border-radius` | `--radius` | same | |
| `--border-radius-sm` | `--radius` | same | |
| `--border-radius-tiny` | `--radius-sm` | same | |
| `--border-radius-md` | `--radius-md` | same | |
| `--border-radius-lg` | `--radius-lg` | same | |
| `--border-radius-xl` | `--radius-xl` | same | |
| `--shadow-sm` | `--elevation-sm` | same | |
| `--shadow-base` | `--elevation-base` | same | |
| `--shadow-md` | `--elevation-md` | same | |
| `--shadow-lg` | `--elevation-lg` | same | |
| `--shadow-xl` | `--elevation-xl` | same | |
| `--shadow-xl` | `--elevation-2xl` | same | |
| `--modal-shadow` | `--elevation-lg` | differs | Toast shadow follows the Espresso alias `--shadow-lg` (token map D3) |
| `--weight-regular` | `--font-weight-regular` | same | |
| `--weight-medium` | `--font-weight-medium` | same | |
| `--weight-semibold` | `--font-weight-semibold` | same | |
| `--bg-orange` | `--bg-amber` | same | |
| `--text-on-orange` | `--text-on-amber` | same | |
| `--bg-pink` | `--bg-violet` | same | |
| `--text-on-pink` | `--text-on-violet` | same | |

`--weight-bold` → `--font-weight-bold` and the `--text-<size>` → `--text-p-<size>` aliases are left out on purpose. They are aliases inside v16.52.0, not replacements, and section N lists them. 30 pairs.

## How this was produced

The theme-architect read both clones. Helper scripts in a scratch folder outside the repository listed every declaration and `var()` read of a name across `public/{scss,css,js}`, `templates` and `www`, then joined the result with the theme's generated `_frappe_map.scss` (light and dark blocks) and both committed snapshots. Each row above was then checked against the cited lines. Visual effects that were not looked at on a screen are marked ASSUMED.
