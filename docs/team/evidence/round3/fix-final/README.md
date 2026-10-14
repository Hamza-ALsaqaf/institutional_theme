# fix-final (round 3, backend-engineer G)

Run 2026-10-14 on the runner bench (`/home/frappe/frappe-bench`, site `midad.test`, Frappe 16.32.0), Chromium via Playwright, explicit `locale` and `Accept-Language`, own users `g-en-light@midad.test` and `g-ar-light@midad.test` (`make_users.py`, created through `bench console` because the web API answered `QueueOverloaded`, 550 stale queued jobs; the `max_queued_jobs` site-config change tried first did not take effect in the running web and was removed again). Builds: `tools/bench/b.sh build --app institutional_theme`, no warnings, no new `!important`. No web restart, no uninstall.

## M1 aria-selected on form tabs (VERIFIED)

Change: `public/js/shell/a11y_rules.js` `syncTab` writes with `setAttr` (the mirroring setter) instead of `put`; the comment is corrected. Commit a463066.

Finding that refines the review: on 16.32.0 a tab click does not reach Bootstrap's writer. `form/tab.js:129-132` binds `click` on the button and calls `set_active()` (adds `active`); the delegated handler `form/layout.js:555` then calls `$(...).tab("show")`, and Bootstrap's `show()` returns at once because the element already has `active` (`node_modules/bootstrap/js/src/tab.js:57-64`). So the earlier `put` also gave correct values after a click and after `scroll_to_field` (`tab_probe_old.log`, lines "click B" and "set_active A"). The failure exists when Bootstrap's own `tab("show")` runs (it writes `aria-selected`, `tab.js:167-176`, and moves no pane) and `Tab.set_active()` follows. That is reachable by a direct call or a future core change, not by the clicks of 16.32.0. The fix is still right: the value is a pure mirror of `.active`.

| Step (en, User form) | old `put` | new `setAttr` |
|---|---|---|
| initial, click B, `scroll_to_field` back to A | correct | correct |
| Bootstrap `tab("show")` on C, then `layout.tabs[0].set_active()` | A `active=true sel=false`, C `sel=true active=false` (WRONG) | A `sel=true active=true`, C `sel=false` |

Logs: `tab_probe_old.log`, `tab_probe_new.log` (script `tab_probe.mjs`). `tests/browser/a11y_attrs.mjs` extended (`INS_USER_PREFIX=g` selects the users): after the first click, after `scroll_to_field` of a Data field on tab A (`Tab.set_active()` path), after a second click, and the synthetic case; each asserts exactly one `aria-selected="true"` and that it is the `.active` button. Result `a11y_attrs-results.md`: 100 PASS, 0 FAIL, en and ar (all earlier checks too).

## m2 `.list-row .level-right` z-index 2 to 1 (VERIFIED)

`_list.scss` now `z-index: 1` (ties with `.list-subject` at 1; the block is later in the DOM, so it paints above; core's sticky header is 2, `list.scss:11-14`). Probe `probe.mjs` (copy of fix-css2's without user set-up), 375 and 1280 px, en and ar, Light and Dark: every chip fully inside the viewport has 0 of 6 sample points covered (7 chips at 375, 12 at 1280 per run) and stays inside its row. Run after the last build (`probe.log`, `probe.json`). Not re-run with the property removed (the cause is established in fix-css2). Whether the core header actually sticks in 16.32 stays unverified, as the review said.

## m3, m4 manifest (VERIFIED by tool)

`docs/DEPENDENCY_MANIFEST.md` 2j.2: four new rows (`.btn.btn-danger`, `.grid-delete-row`, `.list-row .level-right` / `.list-subject` stacking, home breadcrumb). 2j.1: the `aria-selected` row corrected (Bootstrap does write it, with the refinement above); datatable citations `rowmanager.js`, `cellmanager.js`, `utils.js` written as `apps/frappe/node_modules/frappe-datatable/src/...`; `highlight.js/styles/tomorrow.css` written with its `apps/frappe/node_modules/` prefix; the viewport row records the iOS focus-zoom consequence. `python3 -I tools/bench/manifest_selectors.py ... --old/--new /home/frappe/frappe-bench/apps/frappe` (16.32.0 against 16.32.0): 191 rows, present 159, moved 17, changed 0, missing 0, unchecked 15; exit 0. No 2j row reports "not found in the old tree" now (2j had 3; rows of 2d, 2e and 2i with the same note were not touched). `manifest-selectors.tsv`, `.md`. Not run against another tag.

## m5 budgets.txt (VERIFIED)

Cause: not a path problem. `/home/user/frappe-bench` is a symlink to `/home/frappe/frappe-bench` (`ls -l /home/user`), so the audit's default bench is this bench. The committed `docs/audits/budgets.txt` was last written in commit 401b2d2, when `ins_shell` was 18.3 KB; later builds did not re-run `python -m institutional_theme.audits` against the bench (CI has no build and keeps the committed file; local runs restored it). Regenerated with `python3 -m institutional_theme.audits` on the current build: `budgets: 0 problem(s)`, `audits: passed`, `ins_shell.bundle.js` 20.7 KB raw (limit 24.0), 6.8 KB gzip (limit 8.0). Only `docs/audits/budgets.txt` changed among the audit outputs.

## P1 breadcrumb focus ring (lead's addition, VERIFIED)

Cause found: core clips both `ul.navbar-breadcrumbs.ellipsis` and `.title-area.ellipsis` (overflow hidden, `geo.mjs`), and the 4 px negative margin of the 24 px home link put its box outside the title area. The suggested `outline-offset` alone was not enough: with it the home ring was still cut on the outer side, and the middle crumb (core `a` is `display: inline`, list `line-height: 1`) drew only two vertical bars (Chrome draws an inset ring on a tall inline box that way; reproduced with the clip removed too). Changes in `_page_head.scss`: `a:focus-visible { outline-offset: calc(var(--ins-focus-width) * -1) }` for all crumbs; the home link keeps its 24 x 24 box but loses the -4px margin (the glyph now sits 4 px further inline-end than in fix-css2, and the next crumb 8 px, instead of 4 px); middle crumbs are `display: inline-block`. Design effect to be accepted by the lead: that 4 px glyph shift.
Check (`focus_active.mjs`, 1280 px, DPR 3, en and ar, Light and Dark, Tab focus on the first three crumbs of the User form): computed `outline` 2px solid, offset -2px, and each link box lies inside every clipping ancestor (12 of 12 true; with the offset change alone, 6 of 12 were outside the list box (list-only check of the first run)). Screenshots `focus-<lang>-<mode>-<n>.png`: ring complete on all four sides on each of the three crumbs (read: en-light 1 to 3, ar-dark 2; the others not opened one by one). Home link still 24 x 24 (probe). 375 px not applicable (core hides the crumbs).

## P2 pressed danger button (lead's addition, VERIFIED)

Core `.btn:active { color; background-color; box-shadow: ... !important }` (`frappe/public/scss/common/buttons.scss:16-21`) wins over the theme's pressed rule. With `:active` forced through DevTools on the real `.grid-delete-row`: Light `rgb(40, 49, 60)` on `rgb(241, 244, 248)` 11.94:1; Dark `rgb(223, 227, 232)` on `rgb(29, 37, 47)` 12.00:1, en and ar (`focus_active.json`, `pressed-*.png`). The earlier "active" ratios described these neutral colours, not a red pressed state. Corrected: `fix-css2/README.md` section 1 and the comment in `_actions.scss`. The theme's `:active` selectors are left in place (they apply only if core drops the `!important`). A real mouse-down did not match `:active` in the headless run, hence the forced state.

## Selectors depended on (16.32.0)

`form/tab.js:95-108,129-132`; `form/layout.js:555`; `form/form.js:2120-2121`; `node_modules/bootstrap/js/src/tab.js:57-64,167-176`; `scss/common/buttons.scss:16-21,130-133`; `scss/desk/list.scss:11-14,155-158`; `scss/desk/breadcrumb.scss:7-30`; `ui/page.html:17`. Strings: none new.

## Not done

Mobile (375 px) breadcrumb ring; Safari and Firefox rendering of the ring; iOS focus zoom (no device); the unmodified `css-cascade.json` in `docs/team/evidence/phase2/` was already modified when this task started and is left alone.
