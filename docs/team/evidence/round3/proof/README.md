# Interactive proof, round 3 extension

Screens added to `docs/proof/midad-proof.html`, in ADR 0007 order: workspace (desktop) and toasts. Grid, submitted and cancelled form states were not attempted (see `docs/proof/README.md`, "Cut").

- Rebuilt with `python3 tools/proof/build_proof.py --bench /home/user/frappe-bench` (no bench build, no warnings; the build's class check passed). Size 5.34 MB (limit 7 MB).
- VERIFIED: `node tests/browser/proof_parity.mjs` (full matrix, exit 0): 266 comparisons, 2794 probes, 0 mismatches, 0 stale paths, 0 blocked requests. `docs/proof/parity.json` holds the run. Light/Dark, en/ar, both densities, five presets, forced-colors and reduced-motion for every screen.
- VERIFIED: toolbar radios switch screen, mode and language on the new screens (`*.png` here; computed `dir`/`data-theme` printed by the script, `lang` and `dir` as asserted).
- Live references: test users `css-r2-{en,ar}-light@midad.test` were recreated on the new bench (the bench had none) with six ToDos each, and given the ERPNext roles of round 2. Live workspace is `/desk/home`; the Playwright context must set `locale` or core throws in `AltShortcutGroup` and the workspace stays empty.
- Selectors depended on (16.32.0): `frappe/public/js/frappe/ui/messages.js` 443-455 (`.alert.desk-alert`, `#alert-container`); workspace blocks as rendered live (`.shortcut-widget-box`, `.links-widget-box`, `.link-item`, `.ce-header .h4` scoped by `[data-page-route=Workspaces]` in core desk CSS). The proof markup carries `data-page-route="Workspaces"` for that reason.
- Not verified: the proof's workspace content differs from a live user's (fewer widgets); probes compare computed style, not layout.
