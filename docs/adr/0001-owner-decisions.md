# 0001 — Owner decisions

Status: accepted (owner, 2026-10-13). These are settled. Later records build on them; none may contradict them without the owner.

## D1. Target version
Frappe 16.32.0, ERPNext 16.33.0, HRMS 16.20.1: the versions the owner runs. Verify against those tags. Also run the dead-token audit and the selector checks against the newest v16 tag and record differences in the upgrade checklist, without changing the supported range until they are resolved.

## D2. Navigation model
16.32 has no dock and no persistent top navbar. The theme styles the Desktop page, the sidebar and the sticky page head. A dock or header in a later release is out of scope until it exists in the verified target.

## D3. Identity
Midad, as approved in `design/`. Default preset for both Light and Dark. Its values are frozen.

## D4. Colour customisation
- Colour is chosen **per user** from a set of audited presets. `midad` is the default. Proposed alternatives: `graphite`, `petrol`, `forest`, `plum`, `umber` (`design/tokens.json` → `palettes`). Each ships only if it passes every contrast and colour-vision audit in both modes; `forest` and `umber` must also pass a status-distinguishability check.
- A System Manager sets the site default, restricts which presets users may pick (down to one), and may define one custom brand preset from an official primary and accent colour.
- A custom preset is generated on the approved lightness curves and **rejected on save** if a required contrast pair fails. No "save anyway".
- Light or Dark remains Frappe's own `desk_theme`. The User doctype is not altered.

## D5. Font customisation
A bundled list of open-licensed pairings (IBM Plex default, plus two or three more) and the ability to upload the institution's own font files in settings. Only the selected pairing is loaded. Nothing is fetched from the internet.

## D6. One implementation of the colour maths
Dependency-free Python, shared by the build pipeline, the audits and the runtime settings. `design/reference/color.mjs` is the specification; `design/reference/tokens.resolved.json` is the fixture.

## D7. Behaviour is opt-in
The idle-session warning and the connection banner change behaviour, not appearance. They ship disabled and are enabled in settings.

## D8. Delivery and autonomy
The owner pushes this repository to GitHub and starts one run. The team then works **fully autonomously, with no questions to the owner**, through every phase. Work happens on `build/midad-v1`; `main` is fast-forwarded to each gate-verified commit, so it always holds a working product. Decisions taken on the owner's behalf are recorded in `docs/team/OWNER_REVIEW.md`.

## Open, for the architect to decide in Phase 1
Write one short record each (`0002` onwards), with the alternatives considered and the reason.

1. Where a user's preset and density choice is stored without altering the User doctype (user defaults, or a small doctype of this app).
2. How presets reach the page with no flash of the wrong palette: all audited presets compiled into the bundle under a root attribute, with the attribute applied before first paint. Confirm the mechanism against how `desk.html` loads scripts.
3. How the custom brand preset and uploaded fonts are delivered: a CSS file generated on save and on migrate and included per site, or a cached endpoint. No inline styles. State what happens after a database restore without files.
4. The settings doctype: fields, permissions, validation messages in Arabic and English.
5. The test bench for cloud sessions: database, how Python 3.14 and the pinned Frappe tag are installed, and how long a cold start takes.
6. How the interactive proof is built from the same compiled CSS on top of the real core CSS.
