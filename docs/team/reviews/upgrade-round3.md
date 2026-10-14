# Upgrade review, round 3 (origin/main...HEAD, 537f9b9)

Scope: `git diff origin/main...HEAD`, product code first: `public/js/shell/{a11y_names,a11y_rules,grid_names}.js`, `ins_shell.bundle.js`, the six SCSS partials and `ins_desk.bundle.scss`, `identity_sync.py` and its tests, `audits/avatars.py`, `ar.csv`. After that, the README Install, Uninstall and Troubleshooting sections, the round-3 changes to the manifest and the checklist, and the evidence READMEs in `docs/team/evidence/round3/`. I read the sources in `/home/frappe/frappe-bench/apps/frappe` (v16.32.0, `git describe`) and `/home/frappe/newest-bench/apps/frappe` (v16.52.0). Bench CLI source: `~/.local/share/uv/tools/frappe-bench/.../bench`. I changed nothing on the live bench.

## What holds (VERIFIED by reading source)

- **No core edits and no monkey-patching in the product.** The new JS writes `aria-label`, `aria-labelledby`, `role`, `alt` and a label `id`, and nothing else. It adds, moves and removes no node. It wraps no core function. Core never reads `aria-label`, `role="presentation"` or `alt` to drive logic (grep of `frappe/public/js`, no hits). The one monkey-patch is in test tooling: `tools/bench/hrms_install.py` replaces an HRMS patch function in memory. That code is outside the app package and the README labels it a test-bench workaround.
- **The observer does not loop on its own writes.** `a11y_names.js:73` filters attributes to `data-original-title`, `title` and `data-state`. Every attribute the module writes is outside that filter, and `setAttr` (`dom.js:13`) writes only on change. The callback never scans the document. It queues added nodes and processes them once per frame.
- **A name that core or an administrator sets wins.** `a11y_rules.js:16-29` writes only onto an empty attribute or a value the module wrote itself. `grid_names.js:38-40` follows the same rule.
- **Every selector in a11y_rules.js exists in 16.32.0**, at the lines cited in `a11y_rules.js` and `a11y-attrs/README.md`:
  - `links_widget.js:31`, `base_list.js:1310`, `chart_widget.js:511`, `OnboardingPanel.vue:236-238,248`, `dom.js:354`, `form_footer.html:6`, `form_sidebar.html:92,108,136`, `tags.js:21`
  - `sidebar_header.html:4,17`, `sidebar_item.js:207-218,252`, `sidebar_item.html:16,44`, `tab.js:30`, `layout.js:46`, `breadcrumbs.js:100-111,282`, `list_view.js:1334-1340,2706,2738,2748`, `edit_filter.html:8-17`, `filter.js:106,298-303`, `workspace.js:220-222`
  - frappe-datatable 1.20.7: `datatable.js:126`, `rowmanager.js:360-363`, `cellmanager.js:817-823` (`data-is-header` is written only on header cells, because `makeDataAttributeString` skips `undefined`)
- **Every selector and variable in the new CSS exists in 16.32.0:**
  - the 18 `--*-avatar-bg/color` variables (`desk/avatar.scss:1-31`, dark from `:34`)
  - `.desktop-navbar` (`desk/page/desktop/desktop.html:3`)
  - `.folder-icon .icons > .desktop-icon` (`desktop_icon.html:11`, `desktop.js:702,841`)
  - `.onb-progress-badge(-complete)` (`OnboardingPanel.vue:259,262`)
  - air-datepicker `-other-month-`, `-other-decade-`, `.datepicker--nav-title i`
  - the Bootstrap text utilities with literal `!important` in the compiled `desk.bundle.6M445LMD.css`, for example `.text-secondary{color:#7c7c7c!important}`
  - `.text-extra-muted` (`global.scss:608-610`)
  - Core's `$primary` is `$gray-900` (`espresso/_colors.scss:16`), so re-pointing `.text-primary` at strong text does not change its meaning.
- **`!important`: there are 14 declarations, as the manifest says.** I counted them by grep with comment lines removed: 4 in `_calendar.scss`, 9 in `_hardcoded.scss:75-82,87`, 1 in `_website.scss:39`. Each is in manifest section 4. Ours is (0,3,1) against core's (0,1,0) for the base rule and (0,2,1) for `a.text-*:hover`, so the Bootstrap hover rules are beaten too.
- **No datatable row or cell heights. Logical properties only.** I grepped the five changed partials.
- **`ar.csv`: no duplicate keys in 290 rows, and no row overrides core.** `Condition` and `Filter` carry contexts, and Frappe keys a CSV row with a context as `source:context` (`translate.py:207-211`, `translate.js:12-13`). The bare core strings stay "الحالة" and "منقي". The other 9 new strings have no `msgstr` in frappe, erpnext or hrms `ar.po` (erpnext "Select row {0}" is empty).
- **README uninstall claims are supported by source:**
  - the prompt, `--yes` and `--no-backup` (`installer.py:409-438`)
  - `remove-app` refusing while the app is installed (`bench/bench.py:131` calls `validate_app_uninstall`, which calls `validate_app_installed_on_sites`, `:54-57`). This refusal was not run. Its evidence row says the command ran after both sites had uninstalled.

## 1. Blocking

**B1. Report View and query-report data checkboxes get a false name: "Select row N".**
- **Where:** `a11y_rules.js:210` selects `.dt-cell input[type='checkbox']`, and `nameDatatableCheckbox` (`:156-166`) names any such input.
- **Proof in Frappe:** core's formatter renders every Check field value as `<input type="checkbox" disabled class="disabled-selected|deselected">` (`frappe/public/js/frappe/form/formatters.js:165-167`). Report View and query reports place that output inside `.dt-cell`. In frappe-datatable the selection checkbox is only in column 0 (`datamanager.js:55-68` pushes `_checkbox` first, `:386-389`).
- **Failure:** on a P0 screen, a screen reader announces each read-only field value, for example "Enabled", as "Select row 3, checkbox, checked, dimmed". A Check field being edited inline in Report View (the control inside `.dt-cell__edit`) gets the same false name.
- **Why the checks missed it:** axe accepts any name, so the re-scan cannot catch this. The `a11y-attrs` run had no Check column.
- **Smallest fix:** select `.dt-cell--col-0 input[type='checkbox']:not([disabled])` and skip anything inside `.dt-cell__edit`.
- **Evidence:** COMPUTED from source. I did not run it.

**B2. The round-3 overrides and core dependencies are not in the manifest.**
- **The rule:** BRIEF section 10 says "every override is in the manifest". CLAUDE.md requires each Frappe dependency to be confirmed or labelled UNVERIFIED in `docs/DEPENDENCY_MANIFEST.md`.
- **What is missing:** section 2i (`:194`) covers coexistence, HRMS and grid names only. It has no row for:
  - the 24 selectors of `a11y_rules.js` (13 rules, 11 button classes) and the `.page-icon-group` ellipsis check
  - the desk `_avatar.scss` remap. Row `:161` covers only `web/_website.scss`.
  - `_core_contrast.scss` (datepicker, highlight.js, onboarding badge)
  - `_desktop.scss` (folder thumbnails)
  - the timeline link rule (`_form.scss:91-99`)
- **Failure at the next upgrade:** `tools/bench/manifest_selectors.py` reads only sections 2a to 2h (its docstring, lines 7-9). It does not read 2i either, so none of these dependencies is checked against a new tag. One has already changed: OnboardingPanel is gone in v16.52.0 (`ui/user_onboarding/` does not exist), and nothing flagged it.
- **Smallest fix:** add a section 2j built from `a11y-attrs/README.md` "Selectors depended on" plus the four CSS partials, each row VERIFIED with the 16.32.0 lines above. Then make `manifest_selectors.py` read 2i and 2j.

## 2. Should-fix

1. **Uninstall leaves the emblem behind in Website Settings.**
   - **Where:** `identity_sync.py:186-198` cleans copies on `Navbar Settings.app_logo` only. Yet `sync` writes the emblem to `Website Settings.app_logo`, `splash_image` (both Attach Image) and the favicon to `favicon` (Attach) (`identity_sync.py:37-45`).
   - **Proof in Frappe:** core's `doc_events["*"]["on_update"]` runs `attach_files_to_document` (`frappe/hooks.py:171-176`). It creates a File copy with the same `file_url` whenever a document with an Attach field pointing at another document's file is saved (`core/doctype/file/utils.py:312-372`).
   - **Failure:** an administrator saves Website Settings for any reason while the theme is installed. After uninstall, up to three File rows stay attached to Website Settings, and they keep the emblem on disk (`file.py:605-618`). The gate never saves Website Settings, which is why it reports "RESIDUE: none".
   - **Fix:** run the same query for `("Website Settings", app_logo | splash_image | favicon)`, comparing each copy with that field's current value.
2. **`delete_attachments` can delete an administrator's own file.**
   - **How:** the filter is "attached to Navbar Settings.app_logo, same `content_hash`, not showing". Consider an administrator who once uploaded the institution's emblem as the navbar logo and later replaced it. Core's dedup (`file.py:819-835`) then gives the theme's emblem the same `content_hash` and `file_url`. The administrator's old row (not showing) is deleted, and the disk file goes with it if no other row shares the hash.
   - **Proof in this repository:** the test (`test_institutional_theme_settings.py:529-551`) uses different bytes for "theirs", so it does not cover this case.
   - **Fix:** in `sync()`, after `settings.save()`, record the names of the File rows created for the written value (`attached_to_doctype` Navbar Settings, `file_url` = value, `creation` >= the save) in the WRITTEN global. Delete only those names. This also covers older emblems, which the evidence leaves as residue.
3. **The README overclaims what uninstall removes.** README:103 says uninstall removes "its attachments, including the copy of the emblem that Frappe attaches to Navbar Settings". Two leftovers are not mentioned:
   - Navbar copies of older emblems are kept on purpose (`fresh-install/README.md`, "Not covered").
   - The Website Settings copies from item 1 remain.
4. **The QA checklist is stale.** `UPGRADE_AND_QA_CHECKLIST.md:127-150` still says "theme mitigation in progress … It is NOT a pass" on 15 rows. The re-scan (`axe-rescan/README.md`) has since cut the total from 1154 to 312 nodes, and 0 of the remaining nodes are caused by the theme. Finalise each row as the header says ("fixed by theme (re-scan)", "still present", "core, not fixable by the theme").
5. **The observer queue grows in a hidden tab.**
   - **Where:** `a11y_names.js:55-60` schedules with `requestAnimationFrame`, which browsers pause in background tabs. Meanwhile `deep` keeps strong references to every added node, including ones core later detaches.
   - **Failure:** a desk tab left in the background with a list refreshing over realtime keeps detached rows in memory. When the tab becomes visible, it pays for one large pass.
   - **Fix:** `document.hidden ? setTimeout(run, 250) : requestAnimationFrame(run)`.
   - Measured cost when visible is fine: about 25-30 ms per 1500 rows (`a11y-attrs/timing.json`).

## 3. Notes

- `.desktop-navbar` (`_shell.scss:45-46`): in v16.52.0 the header lost the `.navbar` class (`desktop.html:3`), so core no longer draws the hairline there. Our rule then adds a border that the stock look does not have. Review it at the upgrade.
- The OnboardingPanel rules (`a11y_rules.js:62-63,206`, `_core_contrast.scss` badge rules) match nothing on v16.52.0. They fail harmlessly.
- `grid_names.js` says grids in dialogs are left alone "to avoid a document-wide observer" (`grid-names/README.md:15`). `a11y_names.js` now is one. A `.modal .grid-row-check` rule in `a11y_rules.js` would close that gap at no extra cost.
- `nameButton` names a button with its tooltip text, and Bootstrap also sets `aria-describedby` to the same text while the tooltip shows, so it is read twice. Harmless.
- `delete_doc("File")` adds an "Attachment Removed" Comment to Navbar Settings (`file.py:248-249`). That row survives uninstall. The table diff accepts it as activity.
- The newest-tag findings (G1 to G8: 15 dead tokens, the login rewrite, frappe-gantt 1.x, near-black primary buttons) are recorded in the checklist with consequences. None is in the supported range. Before the range moves, all of them must be resolved.

## 4. Scores (BRIEF section 10, my dimensions)

| Dimension | Score | Evidence |
|---|---|---|
| Upgrade-safety | 4/5 | Attributes only, no patching, and every selector verified in 16.32.0 and present in 16.52.0 except OnboardingPanel, which fails harmlessly. The 9 new `!important` are scoped and justified. Held below 5 by the B2 manifest gap, the Website Settings residue (should-fix 1) and the narrow file-deletion case (should-fix 2). |
| Performance | 4/5 | One body observer: filtered attributes, no self-trigger, batched per frame, measured (`timing.json`). The grid observer relabels only the rows that changed. `ins_shell` is 19.3 of 24 KB. The hidden-tab queue (should-fix 5) is the gap. |
| Documentation | 3/5 | The README install and uninstall commands are correct and backed by `fresh-install/commands.tsv` (0 failed steps) and bench source. The troubleshooting specificities are right. But manifest 2j is missing (B2), the checklist axe table is stale (should-fix 4) and the README overclaims (should-fix 3). |
| Craft | 4/5 | Idempotent start, try/catch per node, a WeakMap guard against overriding names, contexts used correctly in `ar.csv`, and tests for the new uninstall path. B1 is a selector that is too broad, and the fix is one line. |

The gate needs every dimension at 4 or more. Documentation reaches 4 when B2 and should-fix 3 and 4 are done. B1 must be fixed before release.

## 5. Not verified

- B1 on a live Report View with a Check column, and should-fix items 1 and 2 on a live site. All three are COMPUTED from source. Running them would change `midad.test`, which this review may not do.
- `bench remove-app` refusing while the app is installed: read in bench source, not run.
- Screen reader output: the evidence uses only the Chromium accessibility tree.
- Observer cost on a long Ace or Quill editing session, and in a grid with hundreds of rows.
- HRMS desk templates that use the `.text-*` utilities: I took them from the evidence and did not open them.

## Second pass (fix round, `92af3a6..25909f2`)

Scope: `git diff 92af3a6..HEAD` for `institutional_theme`, `tools`, `README.md`, `docs/DEPENDENCY_MANIFEST.md` and `docs/UPGRADE_AND_QA_CHECKLIST.md`, and the evidence in `docs/team/evidence/round3/{fix-shell,fix-uninstall,fix-css,fix-css2}/README.md`. Both late items landed before I finished, so both are reviewed here: the CSS fixes (25909f2: danger button, mobile status chip, home breadcrumb) and the scribe's manifest and checklist update (ca6ede7). Frappe source: `/home/frappe/frappe-bench/apps/frappe` (`git describe`: v16.32.0). I also used v16.52.0 in `/home/frappe/newest-bench/apps/frappe`. I changed nothing on either bench.

What I ran: `python3 -I -m unittest discover -s institutional_theme/audits/tests -t .` (48 tests, OK). I also ran `tools/bench/manifest_selectors.py` on the committed manifest, 16.32.0 against 16.52.0 (output in `/tmp/r3sp/`, not committed). It read 187 rows including 2i and 2j, and reported OnboardingPanel as "file gone". I read the size of the built `ins_shell.bundle.62QEWGOY.js`: 21,238 bytes. Everything else below is read from source, and each item says so.

### First-pass findings

| Finding | Status | Evidence |
|---|---|---|
| B1: Check values named "Select row N" | **Fixed** | `a11y_rules.js:273` is now `.dt-cell--col-0 input[type='checkbox']:not([disabled])`, and `:187-188` returns early for anything disabled or inside `.dt-cell__edit`. frappe-datatable puts `_checkbox` first (`datamanager.js:55-68`), and core's Check formatter writes `disabled` (`formatters.js:165-167`). VERIFIED before and after on the bench (`fix-shell/README.md` "Before", probe2). |
| B2: round-3 dependencies missing from the manifest | **Fixed** | Section 2j (2j.1 shell names, 2j.2 desk CSS remaps, 2j.3 proof-only) is committed. No PENDING row is left (`grep -c PENDING` finds only the sentence saying they are resolved). `manifest_selectors.py` now reads every `### 2x` heading and exits 1 on a table it cannot read. A test covers this (`audits/tests/test_manifest_selectors.py`). I ran it: see above. The rows for 25909f2 are missing; see m3. |
| SF1: Website Settings copies left after uninstall | **Fixed** | `identity_sync.py:236-266` also collects `Website Settings` rows by field, written `file_url` and `creation >= since`. VERIFIED: `fix-uninstall` `new-code` and `new-code-favicon` show `RESIDUE: none`. The negative control `old-code` reproduces the 2 Website copies with the previous file. |
| SF2: an administrator's same-bytes file deleted | **Fixed, with one documented residual case** | Ownership is now recorded, not inferred from `content_hash`. Navbar rows are recorded by name at sync time (`identity_sync.py:186-197`); a row that existed before `since` cannot be recorded. VERIFIED: in `new-code` the administrator's row and file survive, and in `old-code` they are deleted. The residual case is README:104 (see "identity_sync" below). |
| SF3: README overclaim | **Fixed** | README:103-104 now lists what is removed and what is kept, including earlier-build sites and the one case that cannot be told apart. |
| SF4: stale checklist axe table | **Fixed** | `UPGRADE_AND_QA_CHECKLIST.md:132-146` uses the three final statuses. C42 is final, and C43 (uninstall residue) was added. |
| SF5: observer queue in a hidden tab | **Fixed** | `dom.js` `defer()` uses a 250 ms timer when `document.hidden`, and requestAnimationFrame plus a 1 s backup otherwise. `a11y_names.js`, `field_labels.js` and `grid_names.js` all use it, and the `queued` flag keeps it to one pending run. |
| Note: `.modal .grid-row-check` gap | Not addressed (it was a note) | `grid_names.js` still skips grids in dialogs. |

### Regression hunt

**identity_sync and `ins_identity_files`** (READ in source, bench run in `fix-uninstall`):
- **Timestamps.** `_stamp()` is `str(now_datetime())`, which is system time zone and naive. `File.creation` is `now()` (`model/base_document.py:754`), and `now()` formats `now_datetime()` (`utils/data.py:371-373,415-423`). Same clock, same zone, microsecond precision, so the `>=` comparison is sound. One exception: `now()` substitutes `frappe.flags.current_date` (`data.py:417-421`), a test-only flag. Under it a File's date is not the stamp's date. This does not affect production.
- **Can it delete an administrator's file?**
  - Navbar: no. Only rows created inside the sync's own `settings.save()` are recorded.
  - Website Settings: yes, in one case, the one README:104 states. An administrator uploads the emblem's exact bytes into the same Website Settings field after the theme wrote it, and does not show it. Core's de-duplication (`core/doctype/file/file.py:819-835`) gives it the theme's `file_url`, so it is indistinguishable. The disk file survives only if another row shares the hash (`file.py:605-618`). This is accepted and documented.
  - Rows still shown are never deleted (`_owned_copies`, the `file_url != showing` check).
- **Earlier builds.** There is no migration patch (`patches.txt` is empty), so a site that synced with an earlier build has no record. Uninstall then deletes only the rows attached to the settings doctype, and leaves the Navbar copies as residue. This fails safe (residue, never deletion) and README:104 says so.
- **If the global is lost.** For example, a partial restore or a manual DefaultValue cleanup. `_load` returns `{}`, so again residue and never deletion. A full backup restore brings the global back, because it is a `tabDefaultValue` row.
- **Order and failure.** `before_uninstall` runs `restore → delete attachments → clear globals` (`install.py:96-98`), each step isolated. If deletion fails, `clear_globals` (prefix `ins_identity_`) still removes the record and the rows stay as residue. `clear_default(key=…, parent="__global")` matches `frappe/defaults.py:194`.

**viewport.js** (READ):
- The source line still matches: `www/desk.html:14-15` in 16.32.0, and identical in 16.52.0 by the selector tool.
- The script makes one attribute write on the existing meta, on desk only (`app_include_js`, `hooks.py:22`), and does nothing if the meta is absent or already allows zoom.
- No desk JS reads the viewport meta: grep of `frappe/public/js` finds `viewport` only inside the minified `lib/fingerprintjs.js`, and no `meta[name=viewport]` selector. It is upgrade-safe. One side effect is listed as m1.

**`role="main"` on `#body`** (READ): `www/desk.html:38-42` (16.52.0: `:50-54`). There is no `<main>` or `role=main` anywhere in `frappe/public/js`. The header and the app sidebar are outside `#body`. Core appends only the freeze backdrop to `#body` (`dom.js:152`). The script skips if a role or a main already exists. No issue.

**Observers** (READ):
- The body observer filters on `data-original-title`, `title` and `data-state`, and its writes (`aria-*`, `role`, `alt`, `id`) are outside that filter.
- The new tablist observer filters on `class` and writes only `aria-selected`.
- Neither can trigger itself. The tablist observer is created once per tablist (WeakSet) and is collected with the node.
- The tab state is correct only until Bootstrap writes; see M1.

**Check-value naming** (READ):
- The header name comes from the header `.dt-cell__content` `title`, which the datatable always writes (`cellmanager.js:939`), matched by `data-col-index`.
- Col-0 and header cells are excluded. A disabled checkbox in col-0 on a table with neither the checkbox nor the serial column stays unnamed. That is not a false name.
- The row number is `data-row-index` (the data index), not the visual position after a sort. The selection names already use the same scheme. This is a note.

**Bundle**: the built `ins_shell` is 21,238 bytes (20.7 KB) against 24 KB. `docs/audits/budgets.txt:25` still says 18.3 KB because the audit measures `/home/user/frappe-bench` (`budgets.txt:2`), not this bench. See m5.

**fix-css2 (25909f2)** (READ, evidence VERIFIED by its author):
- **Danger button.** `--ins-on-danger` and `--ins-danger-hover` are defined for Light (`generated/_tokens.scss:46-47`), Dark (`:320-321`) and the auto block (`:593-594`). No palette redefines `--ins-danger`, so nothing light leaks into Dark. The rule is (0,4,1) against core's (0,2,0) (`common/buttons.scss:130-133`), and the tie with the tagged-action rule is resolved by file order inside one partial, not across bundles. No `!important`.
- **Breadcrumb.** Logical margins, and no flip risk under rtlcss.
- **Status chip.** See m2.

### Blocking

None.

### Major

**M1. Form tab `aria-selected` stops following the active tab after the first click.**
- **Where:** `a11y_rules.js:123-125` (`syncTab` uses `put`), with the ownership guard at `:16-21` (`mayWrite`).
- **Proof in Frappe:** a tab click runs Bootstrap's plugin (`form/layout.js:555`, `$(e.currentTarget).tab("show")`). Bootstrap 4.6.2 (`node_modules/bootstrap/package.json:4`) writes `aria-selected` itself on elements with `role="tab"` (`node_modules/bootstrap/js/src/tab.js:167-176`). After that click the values are Bootstrap's, so `mayWrite` refuses every later write. Core's other path to a tab, `Tab.set_active()` (`form/tab.js:95-108`), moves only the `active` class. That path is called from `form.js:2120-2121` (`scroll_to_field`: undo, URL hash, onboarding steps), `form.js:1583,1592` and `layout.js:438,450`.
- **Failure:** the user clicks tab B, then any `set_active` returns to tab A. A is visibly active, but a screen reader announces B as selected and A as not selected (WCAG 4.1.2).
- **Why the checks missed it:** the bench check in `fix-shell` (finding 4) followed a click only, and on a click Bootstrap and the module agree.
- **Also wrong:** the manifest 2j row ("no `aria-selected` written by core") and the comment at `a11y_rules.js:117-120` ("writes nothing else").
- **Smallest fix:** `aria-selected` is a pure mirror of the `active` class, so write it with `setAttr(button, "aria-selected", …)` instead of `put`. A value derived from the same class never overrides anyone's intent. Then correct the comment and the manifest row (cite `bootstrap/js/src/tab.js:167-176`).
- **Evidence:** COMPUTED from source. Not run.

### Minor

- **m1. Removing `maximum-scale` re-enables iOS Safari's focus zoom** (`viewport.js:8`).
  - **Cause:** form text is 14px (`design/tokens.json:240` `text-base`), and WebKit zooms the page when an input under 16px gets focus, unless `maximum-scale=1`.
  - **Failure:** on an iPhone, the page zooms in on every field tap and stays zoomed.
  - **Evidence:** ASSUMED, from known WebKit behaviour. No device was run, and fix-css2 lists pinch/zoom as not done.
  - **Fix:** record this as an accepted consequence in the 2j viewport row and in the checklist. Optionally, ask the lead for 16px controls under `@media (pointer: coarse)`.
- **m2. `.list-row .level-right { z-index: 2 }` (`_list.scss:60-62`) equals core's sticky list header** (`.list-row-container:first-child`, `z-index: 2`, `desk/list.scss:11-14`).
  - **Failure:** both sit in the same stacking context, so the later row's block paints over the header wherever the header actually sticks.
  - **Evidence:** UNVERIFIED that it sticks in 16.32. `result-container` is `overflow-x: auto` with no bounded height (`list.scss:601-607`), so probably not.
  - **Fix:** `z-index: 1` is enough. It ties with `.list-subject` (`_list.scss:54`), and `.level-right` comes later in the DOM, so it still wins.
- **m3. The manifest has no row for the 25909f2 dependencies.** Missing: `.btn.btn-danger` (`common/buttons.scss:130-133`), `.grid-delete-row` (its own evidence says "line not re-read"), and the breadcrumb home-link sizing. Row 235 covers only its `aria-label`, and the CSS cites `desk/breadcrumb.scss:7-30`. Fix: add three rows to 2j.2.
- **m4. Some 2j citations cannot be resolved by the upgrade tool.** Bare `rowmanager.js` and `cellmanager.js` come back as "not found in the old tree either (manifest path not resolvable)", so those citations go unchecked at the next tag. Fix: write them as `apps/frappe/node_modules/frappe-datatable/src/…`.
- **m5. `docs/audits/budgets.txt` is stale** (18.3 KB against 20.7 KB built for `ins_shell`) because the audit's bench path is not this bench. Fix: regenerate it on this bench, or point the audit at it.

### Scores (final)

| Dimension | Score | Evidence |
|---|---|---|
| Upgrade-safety | 4/5 | Attributes only, with no core JS reading anything we write (viewport, `#body` role, tab state). B2 is closed and the tool is proven against 16.52.0. Uninstall ownership is recorded and fails safe when the record is missing. Held below 5 by the undocumented 25909f2 rows (m3) and the unresolvable citations (m4). |
| Performance | 4/5 | Hidden-tab backlog fixed. 20.7 of 24 KB. No self-trigger in any observer. The per-cell header lookup in `nameDatatableValue` is not measured on a 1500-row report. |
| Documentation | 4/5 | Manifest 2j, README uninstall and checklist C42/C43 are fixed and honest about limits. Two errors remain: the 2j tab row is factually wrong about core (M1), and m3/m5. |
| Craft | 4/5 | B1 fixed precisely, with an honest before/after. Ownership is recorded rather than guessed, with a negative control. M1 is a one-line correction. |

Every dimension is at 4, so the gate passes on my dimensions. Fix M1 (code, comment and manifest row) before `main` is fast-forwarded. It is a one-line change, and leaving it ships a false screen-reader state on every tabbed form. m1 to m5 can follow in the next round.

### Not verified

- M1 and m2 on a live site: both are COMPUTED from source.
- iOS focus zoom (m1): no device.
- Uninstall after a restore without files (File rows whose disk file is missing).
- Arabic screen-reader output for "{0}، الصف {1}".
- Pinch-zoom itself.
- Cost of `nameDatatableValue` on large reports.
