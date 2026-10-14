# Round 5 fix round 2 (upgrade review S1 and S2)

Labels: VERIFIED (ran it, output here), COMPUTED, ASSUMED. Captures and probes: `scripts/shots.mjs` (Kanban v1 dot, side panel Draft/Submitted/Cancelled; `16.52.0-after/`, `16.32.0-after/`), `scripts/embedded.mjs` (`probe-embedded.json`), `cascade/`.

## S2: embedded-list arm dropped
- `desk/_status.scss`: `.embedded-list-table td > .es-badge` removed from `$ins-badge-host`; the comment above it says why (core renders status and label columns alike, `embedded_list.js:290-296`, Workspace "Access", Role "Type"; BRIEF 3 rule 1). The Kanban v1 dot arm stays.
- Cascade (`tests/browser/cascade.mjs`, fixture `harness/fixture_v52.html`): the embedded-list assertion now requires a `data-theme` cell to be neutral with no shape, which is a real test of the removal (it failed once while the arm was still in the build).
- VERIFIED (COMPUTED) `probe-embedded.json`: the Work Order-style table and the Role form's Documents tab: every cell is the neutral fill (`rgb(241,244,248)` Light, `rgb(29,37,47)` Dark), `::before` width `auto` (no shape), label printed. Captures `16.52.0-after/*-workorder-style.png`, `*-role-embedded.png`.
- Manifest row (`DEPENDENCY_MANIFEST.md`, the `.embedded-list-table` row) rewritten as "NOT a status host". Proposed checklist and README wording is at the end of `../README.md`.

## S1: `side_panel_status.js`
- The body observer no longer queries the document. It is `childList` on `<body>` only (no subtree): core appends the panel as a direct child of `<body>` once (`side_panel.js:415`) and never removes it (`hide()` only toggles classes, `:800-811`). It reads each added node (`matches` or `querySelector` on that node), and disconnects as soon as the host is found. If the host already exists at start-up it is used directly and no observer is made on the body. The host observer (`childList` on `.side-panel-indicator`) is unchanged.
- Accessor: `frappe.ui.get_side_panel()` (`side_panel.js:814-818`) is used when it exists, falling back to the private `frappe.ui._side_panel`. It only constructs a panel when none exists, and `markIndicator` runs only after `.side-panel-indicator` exists (so the panel exists); the accessor is undefined until the lazy `side_panel.bundle.js` loads (so on 16.32.0, which has no side panel, nothing is called and the body observer never finds a host). `preview.doc` and `current.doctype` stay internal reads inside try/catch.
- VERIFIED behaviour identical on v16.52.0 (`16.52.0-after/probe.json`, `side-*`): Draft `data-ins-filter docstatus,=,0` neutral fill, 9 px ring; Submitted blue dot (8 px, no filter); Cancelled `docstatus,=,2` muted fill, 8 px square (radius 1px); en and ar, Light and Dark (12 of 12), captured through the lazy bundle path (`frappe.require("side_panel.bundle.js")` then `get_side_panel().open`), so the observer found a host added after start-up. Captures `16.52.0-after/*-sidepanel-*.png`.
- 16.32.0: `shots.mjs` Kanban and list captures, 0 `pageerror`; the only console errors are the bench's missing socket.io (`Error connecting to socket.io`, a 404 for it), present on both versions and unrelated.
- Not measured: CPU cost (COMPUTED from the code: no per-mutation work after the first matching node, none at all when the host exists at start-up).

## Checks
Build (one build for the intended CSS plus a second after my first edit missed the host line, which I caught because the embedded cells still came back coloured): 0 warnings. `audits` passed, `midad.build --check` 0 stale, `docs/audits/budgets.txt` regenerated. Cascade 16.32.0 4576 of 4576, v16.52.0 7680 of 7680 (`cascade/`).
