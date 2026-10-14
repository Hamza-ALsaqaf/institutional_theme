# Axe fixes by CSS (round 3, wave 2, css-engineer)

Files: `institutional_theme/public/scss/desk/_avatar.scss`, `_core_contrast.scss`, `_desktop.scss` (new, imported at the end of `ins_desk.bundle.scss`), and a timeline block in `desk/_form.scss`. No token value changed, no `!important` added, no literal colour, logical properties only.

## 1. Avatar initials (14 theme-caused nodes)

Mapping: `avatar-map.txt` (also `/tmp/r3/avatar-map.txt`). One declaration per variable on `html:root[dir]`, valued with `--ins-status-*` pairs; the tokens switch with the mode, so Light and Dark are the same lines (core sets the variables at `:root` and `[data-theme="dark"]`, specificity (0,1,0); ours is (0,2,1)).
VERIFIED: `node tests/browser/axe_avatars.mjs` on the live desk, output `avatar-pairs-after.md`: themed, all nine pairs pass in both modes (light 8.01 to 9.54, dark 10.22 to 10.71). The 12 `NO` rows in that file are the `core` variant (theme blocked), kept for comparison.

## 2. Core colour contrast

VERIFIED (computed style, then WCAG ratio, in en and ar, Light and Dark; `verify.log`, `verify.json`, screenshots in `shots/`; script `scripts/verify.mjs`):
- air-datepicker other-month day and nav-title icon: `--ins-text-muted` (6.28 on white in Light, 6.14 on the overlay surface in Dark; before 1.34 and 2.74, and not dark aware).
- highlight.js: `.hljs` on `--ins-surface-sunken`, tokens in status foregrounds. Lowest ratio 5.95 (comment, Light) and 7.52 (Dark); the rest 9.6 to 14.2. Rendered by loading `syntax_highlighting.bundle.js` and highlighting a Python sample in a `.help-box` (the real description path is `base_input.js:248-251`; the sample was inserted by script, not through a DocField description).
- `.onb-progress-badge` (and the sibling `-complete`, which has the same flaw): warning and success status pairs, 8.06 Light and 10.22 Dark. VERIFIED by mounting the real `frappe.ui.UserOnboarding` panel with two steps, which injects core's style tag, so the override is proven against core's rule.
56 computed assertions, 0 failing.

## 3. target-size on the desktop screen

The 18x18 failing nodes are not the app tiles (127x126) but the thumbnails inside folder tiles: anchors with `href`, `pointer-events: none`, 18 px in a 2.1 px gap (`desktop.css:278-308`). `_desktop.scss` gives them `min-block-size/min-inline-size: 24px` and takes the extra box back with negative margins (-3px inline, -6px block end), so the grid tracks stay the same. VERIFIED: anchors measure 24x24 in 4 combinations; in one page, with the rule on and with it overridden off, the folder (54 x 52.94) and all nine thumbnail positions are identical (`scripts/folder.mjs`). Axe `target-size` no longer fires on the desktop screen (below). Caveat: the thumbnails stay focusable links that a pointer cannot hit (core's choice, a JS or markup matter, not CSS).

## 4. Timeline links

Design system convention (`DESIGN_SYSTEM.md`): link colour `--ins-text-link`, hover `--ins-text-link-hover`; underline on hover for attachment links. Inside running text the link differs from the text by under 3:1 (axe: 1.48), so the cue here is a permanent underline (`text-underline-offset: 2px`). VERIFIED computed: `text-decoration-line: underline` in 4 combinations; screenshots `shots/timeline-*.png`.

## Axe, targeted (themed), `axe/`

Screens desktop, form, datepicker, list, workspace, four language-mode pairs (`axe/run-themed-*.json`; en-light list, form and datepicker timed out under load in that run and were re-run alone: `axe/run-themed-en-light-rerun-list-form-datepicker.json`). Result: 0 `color-contrast`, 0 `target-size`, 0 `link-in-text-block`; the only violation left on these screens is `meta-viewport` (core, 14 nodes in the final run; the earlier run in this directory also showed button-name, label and others that backend-engineer's attribute work removed in between). Not the full 23-screen scan: backend-engineer D runs that.

## Cascade

`node tests/browser/cascade.mjs --evidence <dir>`: 4256 of 4256 pass, 0 failures, `sassWarnings: []`, desk RTL identical (`cascade/css-cascade.json`, `cascade-run.log`). Build: `tools/bench/b.sh build --app institutional_theme`, no warnings. `/tmp/r3/css-wave2-done` written after the final build.

## !important needed

None added.

## Selectors depended on (Frappe 16.32.0, under /home/frappe/frappe-bench/apps/frappe/frappe/)

| Selector | Source | Purpose | Breaks if it changes |
|---|---|---|---|
| `--{colour}-avatar-bg/-color` variables, read inline by `.avatar-frame` | `public/scss/desk/avatar.scss:6-31` (light), `:39` onward (dark) | avatar pairs | initials fall back to the failing core pairs |
| `.datepicker--cell-day.-other-month-`, `.datepicker--cell-year.-other-decade-`, `.datepicker--nav-title i` | `node_modules/air-datepicker/dist/css/datepicker.min.css` (compiled in `public/scss/common/datepicker.scss:2`) | dim days and nav chevron | faded days again |
| `.hljs`, `.hljs-keyword` and the other token classes | highlight.js default theme, compiled into `public/dist/css/desk.bundle.*.css`; used by `public/js/frappe/form/controls/base_input.js:248-251` and `public/js/syntax_highlighting.bundle.js` (import line of the stylesheet not located) | code samples in field descriptions | white block and pastel tokens in Dark |
| `.onb-progress-badge`, `.onb-progress-badge-complete` | `public/js/frappe/ui/user_onboarding/user_onboarding.bundle.js:209-275` (style tag injected at runtime), markup `OnboardingPanel.vue:259,262` | progress badge | amber on cream, 3.01:1 |
| `.folder-icon .icons > .desktop-icon` | `desk/page/desktop/desktop.css:278-308`, markup `public/js/frappe/ui/desktop_icon.html:1` | thumbnail target size | thumbnails shrink to 18 px again |
| `.new-timeline .timeline-item .timeline-content a` | `public/scss/desk/timeline.scss:58,94` (markup built in `public/js/frappe/form/footer/version_timeline_content_builder.js` and timeline code) | underline cue | link colour only |
