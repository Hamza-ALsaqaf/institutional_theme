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
