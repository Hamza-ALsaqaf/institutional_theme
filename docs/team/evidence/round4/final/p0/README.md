# Round 4 final capture: P0 desk screens

Commit under test: `70a62dd` (HEAD of `build/midad-v1` after `git pull --rebase`; no SCSS changed in this task). Both benches were rebuilt from HEAD with `tools/bench/b.sh build` and `tools/bench/b52.sh build` (the build wrapper then synced assets between the two benches; the final check reported 0 theme entries missing on each bench's own assets.json). Captured as Administrator with `scripts/p0.mjs` (a copy of the round-4 script with the output path pointed here); language and theme set on the User record per run and restored to en and Light afterwards.

Files: `16.32.0/` (48: en/ar x Light/Dark x comfortable/compact x 6 screens), `16.52.0/` (24, comfortable), `sheets/` (one 2x2 sheet per version, density and screen: en-light, en-dark on top, ar-light, ar-dark below, so the Arabic capture sits beside the English one), `checks-<version>.json` (probe data), `cascade/cascade-<version>.json`, `run-*.log`.

## Capture matrix

All cells captured and viewed (through the sheets, plus the full-size ar-dark compact dialog).

| Screen | 16.32.0 comfortable (en/ar x L/D) | 16.32.0 compact (en/ar x L/D) | 16.52.0 comfortable (en/ar x L/D) |
|---|---|---|---|
| desktop | 4 viewed | 4 viewed | 4 viewed |
| workspace (Build) | 4 viewed | 4 viewed | 4 viewed |
| list (User) | 4 viewed | 4 viewed | 4 viewed |
| form (User Administrator) | 4 viewed | 4 viewed | 4 viewed |
| report (User report view) | 4 viewed | 4 viewed | 4 viewed |
| dialog (Confirm) | 4 viewed | 4 viewed | 4 viewed |

Probe (clipped-text on buttons, labels, cells, nav items; horizontal overflow; direction; theme): 16.32.0 48 captures, 16.52.0 24 captures; 0 failed captures, 0 horizontal overflow, 0 clipped-text hits; every Arabic capture has `dir=rtl` (24 of 24 and 12 of 12); `data-theme` as requested in all.

## What I saw

- Light and Dark are consistent on every screen: tokens, status pills, inputs sunken in Dark, tabs, datatable header and checkboxes, overlay surface. Datatable row heights are core's.
- Arabic is a true mirror of English on all six screens: sidebar and rail on the right, titles right-aligned, action buttons on the left, pager and list counts mirrored, form columns reversed. Differences beyond mirroring, all core behaviour and visible side by side in `sheets/`:
  - Mixed-direction text: long Latin app names on the 16.32.0 desktop truncate at the logical start ("... Framework"), a Latin report cell shows "...dministrator", form activity lines interleave Latin and Arabic runs.
  - Arabic copy is shorter or longer, so the workspace chips and the Arabic "Module Def" card title truncate ("تعريف وحدة بر...").
  - Row counts differ between languages in some captures (11 users vs 9): bench data created by other test runs between captures, not styling.
- 16.52.0 shows the new shell (icon rail, top launcher bar, breadcrumb in the head); 16.32.0 the classic sidebar. Same tokens and look inside the content. Accepted core difference (ADR 0011 D).
- Compact on 16.32.0: list rows, form fields and datatable are denser, nothing clipped; the list sheet and the other five sheets viewed.

## Observations that are not theme defects

1. 16.32.0 Arabic desktop, 3 of 4 captures (compact Light, both Dark comfortable and compact): a broken-image icon with alt text "شعار التطبيق" at the top-right. Cause: the bench test fixture `/files/ins-test-emblem*.png` returns 500 or 404 while another agent's gates run on the same bench (reproduced once in three loads, the other two loaded). The theme does not render that image; the alt text is core's app-logo `img`. Not a CSS defect.
2. 16.32.0 compact ar-dark dialog (`16.32.0/ar-dark-compact-dialog.png`): the Submit button is grey in the capture, where the round-4 capture and the comfortable capture show the light blue primary. I re-ran that state three times: computed background `rgb(167, 201, 240)` with text `rgb(6, 26, 48)`, not hovered or disabled, stable at 0.6 s and 2.6 s (the first iteration was Light because the theme was switched without reload and is not relevant). So the stable state is correct; the grey frame is a transitional paint I could not reproduce and did not root-cause. Flagging it for the lead rather than calling it fine.

No theme defect found; no SCSS was changed.

## Cascade (re-run from HEAD, `tests/browser/cascade.mjs`)

| Version | Passed | Total | Failures |
|---|---|---|---|
| 16.32.0 (`/home/frappe/frappe-bench`) | 4576 | 4576 | 0 |
| 16.52.0 (`/home/frappe/newest-bench`) | 7520 | 7520 | 0 |

(Round 4 earlier today counted 4256 and 6304; the assertion set has grown since.)

## Not verified

Compact density on 16.52.0 (not asked). Real touch and screen-reader behaviour. The transitional grey Submit frame above. Browser locale is en-US in every capture; Arabic numerals come from the server.
