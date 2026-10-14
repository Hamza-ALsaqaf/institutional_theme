# Coexistence with another brand app (round 3, item 4)

Run 2026-10-14 on the bench `midad.test` (real build, `bench build --app institutional_theme`, no warnings). Test users `coex-{ar,en}-{light,dark}@midad.test`.

## What was run
- `node tests/browser/coexistence.mjs --without` : baseline (`coexistence-baseline.json`). Exit 0.
- `node tests/browser/coexistence.mjs` : brand stylesheet `tests/browser/coexistence/brand_app.css` appended as a later `<style>` after the bundles (`coexistence.json`, screenshots `*-desk.png`, `*-form.png`). Routes `/desk` (desktop page) and `/app/todo/new`.
- `node tests/browser/cascade.mjs` after the SCSS change: 4256/4256 pass, 0 fail (`cascade-after-navbar-fix.json`). VERIFIED.

## Results (VERIFIED, computed styles, all four user/mode combinations)
| Rule of the other app | Spec | Result with the stylesheet injected |
|---|---|---|
| `html[lang=ar], html[dir=rtl] { --font-stack: "IBM Plex Sans Arabic" }` | (0,1,1) | Midad wins. `--font-stack` and body `font-family` stay `"Midad Plex Sans Arabic", "Midad Plex Sans", ...`; the brand `IBM Plex Sans Arabic` face is never loaded (`brandFaceLoaded: false`). Our map is `html:root[dir]` (0,2,1). |
| `[data-theme=light] .btn-primary` and `:hover` | (0,2,0)/(0,3,0) | Midad wins. Light: rgb(27,80,134) on white, hover rgb(15,58,101). Dark unaffected by the brand rules (own selector is light only): rgb(167,201,240). Ours `html:root[dir] .btn.btn-primary` (0,4,1), hover (0,5,1) (`desk/_actions.scss:38-49`, existing). |
| `.desktop-navbar { border-bottom: 2px solid gold }` | (0,1,0) | LOST before the fix (2px rgb(184,134,11) observed). FIXED: `desk/_shell.scss` (end of file) `html:root[dir] .desktop-navbar { border-block-end: 1px solid var(--border-color) }` (0,3,1). After: 1px hairline, identical to baseline in Light and Dark. |

Note on the navbar: `.desktop-navbar` exists in 16.32.0 only on the desktop page (`/desk`, `frappe/desk/page/desktop/desktop.html:3`, `header.desktop-navbar.navbar.navbar-expand.navbar-container`). `/app/*` pages have no `.navbar` element in 16.32.0 (observed: none), so the brand rule has no effect there.

## Where Midad cannot win (COMPUTED by specificity, not run)
A brand rule with `!important`, specificity (0,4,1) or higher on the same property, or inline styles. Remedy documented in `README.md`, section "Troubleshooting".

## Selectors depended on
| Selector | Source (16.32.0) | Purpose | Breaks if changed |
|---|---|---|---|
| `header.desktop-navbar.navbar` | `frappe/desk/page/desktop/desktop.html:3` | desktop page header | hairline reverts to core `.navbar` border (0,1,0) |
| `.navbar { border-bottom: 1px solid var(--border-color) }` | `frappe/public/scss/desk/navbar.scss:1-4` | the value we re-assert | none, the fix sets its own value |

## Strings
None.

## Not done
No run with a rule using `!important`. Only the documented rules were reproduced, not the other app's full file (not available in the bench).
