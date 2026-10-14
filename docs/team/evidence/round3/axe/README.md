# Automated accessibility scan (round 3, item 5)

Script: `tests/browser/axe.mjs` (axe-core 4.13.0 through `@axe-core/playwright` 4.13.0, pinned in `tests/browser/package.json` and the lockfile; Playwright 1.56.1). `tests/browser/axe_avatars.mjs` checks the nine avatar colour pairs.
Run (about 9 minutes per variant on 2 shared vCPUs): `cd tests/browser && npm ci && PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node axe.mjs [--variant=themed|core|both] [--only=en-light,ar-dark] [--screens=list,form]`. `node axe.mjs --summarize` rebuilds `summary.md` and `classified.json` from the JSON files.

## What was run (VERIFIED, output in this directory)

- Users `axe-{en,ar}-{light,dark}@midad.test` created through `POST /api/resource/User` from a page logged in as Administrator (System Manager role, `language`, `desk_theme` set). Administrator was not changed. `run-themed.log` first lines: `created 200` or `updated 200` per user.
- 23 screens per language and light mode, 20 in Dark (the logged-out pages are always light, the website bundle has no dark tokens): desktop, workspace (Build), workspace with number cards and charts (Invoicing), list, list with a selected row, filter popover, form, new form (mandatory empty), invalid field, form with an empty child table (Notification), date picker, report view, query report (General Ledger), global search, notifications panel, dialog, message box, toasts, freeze overlay, the theme's appearance page, login, forgot password, 404 page.
- Each page reports `data-theme`, `dir`, `lang` and the theme stylesheet in effect (`meta` in the JSON), so the mode and language are proven per screen, not assumed. WCAG tags `wcag2a wcag2aa wcag21a wcag21aa wcag22aa`. Animations are reduced with `reducedMotion: "reduce"`.
- Two variants per language-mode: `themed` (normal) and `core` (every `/assets/institutional_theme/**` request aborted). Files: `run-themed-<lang>-<mode>.json`, `run-core-<lang>-<mode>.json` (violations with selector, HTML, failure summary and, for contrast, foreground, background, ratio, font size). `classified.json` holds one row per themed node with its class (`theme` or `core`), `fixedByTheme` (nodes present only with the theme blocked) and coverage. `summary.md` has the tables (rule, impact, nodes, screens, language-mode, sample selector) and a contrast table by colour pair.
- Result: 0 screen errors in 8 runs (`Coverage` in `summary.md`). 1154 violation nodes in the themed runs: 1140 also occur with the theme blocked (core), 14 are caused by the theme. The theme removes 292 nodes that the stock look has (`fixedByTheme`): 122 colour contrast (including the stock login pages), 112 unlabeled form fields (`label`), 40 `target-size`, 12 `select-name`, 4 `image-alt` on the login pages, 2 `button-name`.
- The page error `undefined` is thrown once per run identically with and without the theme (core).
- Caveat: a second Chromium page cannot prove how a screen looks to a screen reader; axe finds about a third of WCAG issues. The numbers are an automated floor, not a conformance claim.

## Theme-caused violations for the css-engineer (14 nodes, all `color-contrast`, all initials in `.avatar-frame`)

Cause: the desk avatar colour pairs `--{orange,pink,blue,green,dark-green,red,yellow,purple,gray}-avatar-{bg,color}` (Frappe `scss/desk/avatar.scss`, light at lines 6-31, dark from line 39) resolve to the theme's palette steps 500 on 50. The theme sets these variables only in `scss/web/_website.scss:227-236` (website), not on the desk. A user's avatar colour is chosen from the name, so a scan meets only the pairs of the users on screen; `avatar-pairs.md` has all nine, measured on the live desk:

| | light, themed | dark, themed |
|---|---|---|
| fails 4.5:1 | orange `#ae5000` on `#ffe7db` 4.49, pink 3.41, blue 3.17, red 3.47, yellow 2.34, purple `#a76fc7` on `#faf4fe` 3.39 | orange 4.49, pink 3.41, blue 3.17, green `#def3e6` on `#37a16d` 2.79, dark-green 2.79, red `#fff4f3` on `#e15552` 3.47, yellow 2.34, purple 3.39 |
| passes | green, dark-green 7.58; gray 8.38 | gray 10.58 |

Seen in the scan (selector, screens, mode): `.avatar-frame` (also `.avatar-medium > .avatar-frame.standard-image[title]`, `.avatar-medium-2 > …`, `.avatar-small > …`) on desktop, workspace, workspace-cards, list, list-selected, form, form-new, form-invalid, form-child-table, report-view, query-report, appearance:
- ar-light: `#a76fc7` on `#faf4fe`, 3.38, 14 px and 12 px (class `theme`: the stock purple pair passes at 4.64)
- en-dark: `#fff4f3` on `#e15552`, 3.46 (core 4.18 on the same node, so the theme is worse)
- ar-dark: `#def3e6` on `#37a16d`, 2.78 (core 2.10, fails in both)
- en-light: `#c96393` on `#fff3f8`, 3.41 (core 3.44, fails in both)

Suggested fix (css-engineer): define the desk `--*-avatar-bg/-color` pairs from the existing status token pairs (as `_website.scss` already does for the website), with every pair at 4.5:1 or more in both modes, and add the nine pairs to the contrast audit. After the fix run `tests/browser/axe_avatars.mjs`.

No `.text-secondary` or extra-muted nodes remain in the final themed run: the two theme-caused contrast sets seen in the first run (`.text-secondary` `#7c7c7c` on `#f7f9fc` 3.95, and `.help-box.text-extra-muted` `#6f7781` on `#171e28` 3.69 in Dark) are absent from the final run; the css-engineer's commit 1e56a23 (Bootstrap text utilities and extra-muted tokenised) landed between the two scans (inference, not separately verified).

## Core violations

`core-violations.md` (rules, counts, file:line causes, and which ones the theme could still fix by CSS or by attributes from `public/js/shell/`).

## Not done

2FA page, session-expired dialog, mobile and tablet widths, HRMS and other P1 pages, print views, emails. The `meta-viewport` rule (zoom disabled in `www/desk.html:14-15`) cannot be fixed without editing core.

## Strings

None (no user-visible text added).
