# Product brief

The owner's requirements for this app. This file is the contract: every decision in the build must trace back to something here. Where it conflicts with `docs/research/frappe-16.32-findings.md`, the findings win on facts about Frappe (they were read from source) and this file wins on intent.

## 1. Mission

Deliver a complete, Arabic-first, production-grade visual identity and UI theme for the ERPNext v16 desk (Frappe Framework v16), with Light and Dark modes of equal quality, packaged as an upgrade-safe custom Frappe app with **zero core edits**. The approved design is in `design/` and on the design canvas; build what was approved.

Target experience: calm, authoritative, precise, elegant, timeless. A senior official should sense the institution's seriousness within seconds. An officer working eight hours a day should feel no fatigue, ambiguity or friction.

## 2. Context

- **Client**: a formal government institution running ERPNext v16 as a mission-critical system (finance and budgeting, procurement, HR and payroll, assets and stores, projects, approvals, audit trails).
- **Personas**: executive (dashboards and approvals, tablets and large monitors); officer or accountant (dense keyboard-first entry for hours); approver (queues, workflow actions); auditor (read-only review, history, printouts); administrator; external portal users.
- **Environment**: shared office PCs (often 1366x768 or 1920x1080), some tablets, evergreen but possibly locked-down or slightly older Chromium, possibly an isolated intranet with no internet. Arabic and English, RTL and LTR. Printing and PDF are first-class. Sessions are long.
- **Stakes**: mistakes in approvals, payments and records carry legal and financial consequences. The interface must make system state unmistakable and errors harder to commit.
- **Unknown**: the institution's name, emblem and official colours. The identity is neutral and white-label.

## 3. Priorities when goals conflict

1. Correctness and unmistakable system state
2. Accessibility
3. Upgrade-safety and maintainability
4. Productivity and density
5. Aesthetic refinement

Never trade 1-3 for 5.

## 4. The approved identity: Midad

See `design/README.md` for the full description and `design/tokens.json` for every value.

- Primary: Prussian ink (OKLCH hue 252). Accent: antique brass, under 5% of any screen. Neutrals: `slate` (light) and a separately hand-tuned `night` ramp (dark).
- Type: IBM Plex Sans Arabic + IBM Plex Sans + IBM Plex Mono, self-hosted.
- One signature motif: the closing rule (the accountant's double underline with a short brass lead segment). Login, empty states, letterhead, and above grand totals. Never behind data.
- One status language: colour + text label + CSS-drawn shape, identical in lists, forms, reports, dashboards and print.
- Dark mode is a separate design, not an inversion: layered tinted surfaces where elevation is a lighter tone, softened text, no pure black backgrounds, no pure white text, shadows replaced by tonal steps and hairlines.

Forbidden: default Bootstrap or Tailwind blues, purple-gradient looks, neon, large saturated fills, heavy shadows, pill-shaped everything, mascots, emoji, skeuomorphism, glassmorphism, decorative backgrounds behind data, religious, national or political symbolism.

## 5. Customisation (owner decisions, 2026-10-13)

The theme must be flexible through settings, with the approved design as the default.

1. **Colour presets, chosen per user.** Each user may pick the colour preset they prefer. The default for both Light and Dark is `midad`, exactly as designed. Five further presets are proposed in `design/tokens.json` under `palettes` (`graphite`, `petrol`, `forest`, `plum`, `umber`); all must be calm, formal and fit for a large government system, and each must pass every audit in both modes before it ships. A preset that cannot pass is dropped, not shipped with a warning.
2. **Site-level control.** A System Manager sets the site default preset, decides which presets users may choose (or locks the site to one), and may define a custom brand preset from an official primary and accent colour. A custom preset is generated on the same lightness curves and is rejected on save if any required contrast pair fails, with a message naming the failing pair.
3. **Fonts.** A bundled list of open-licensed pairings (IBM Plex is the default; propose two or three more, for example Noto Sans Arabic, Tajawal, Almarai, each with a matched Latin face) plus the ability to upload the institution's own font files from settings. Everything is served locally; nothing is fetched from the internet at runtime.
4. **Identity.** Institution name, emblem, wordmark and favicon are swappable in one place through supported settings.
5. Light or Dark stays Frappe's own `desk_theme` (Light, Dark, Automatic). Do not invent theme names, override whitelisted methods or alter the User doctype.

## 6. Engineering rules

1. Zero core modifications. Installs with `bench install-app`, uninstalls without residue so the stock look returns.
2. Tokens first, selectors second: namespaced primitives (`--ins-*`), then a mapping onto Frappe's own variables for both modes, then minimal component CSS only where tokens cannot reach. Ship precomputed sRGB values. No `color-mix()`, relative colour syntax or container queries without a precomputed fallback.
3. Target zero `!important`; justify every use in the manifest. Never rely on source order alone. Never put overrides in `@layer`.
4. Logical properties only, so RTL needs no mirrored copy and Frappe's rtlcss pass cannot double-flip anything.
5. Minimal JavaScript, only where CSS cannot do the job. Small, defensive, idempotent. No DOM restructuring of Frappe components, no monkey-patching of core classes, no inline scripts, no `eval`, no network calls. Every visible string is translatable and has an Arabic equivalent.
6. Plain, readable CSS with custom properties; SCSS only for partial imports and simple mixins that compile in Frappe's esbuild + Dart Sass pipeline. Zero compile warnings.
7. Self-explanatory names, one concern per partial, a short header comment per file. Nothing a government IT team cannot maintain. Do not hide features or restructure information architecture.
8. Graceful failure: if the theme's CSS fails to load, core Frappe remains fully functional.
9. Never remove licence notices.

## 7. Scope

Perfect P0 first, then P1 and P2 with the same rigour.

**P0**: login, 2FA, forgot-password, session-expired. Desktop (apps) screen, sidebar, page head, search, notifications, account menu. Workspace home (Number Cards, charts, shortcuts, link cards, onboarding). List view (filters, filter pills, group-by, bulk actions, pagination, sticky columns, row states, empty state). Form view (page head, breadcrumbs, status pill, workflow actions, tabs, sections, every field control in every state: default, hover, focus, filled, read-only, disabled, mandatory-empty, invalid with message, loading, masked; child tables, attachments, timeline, assignments, shares, tags, banners, connections). Report view and Query Reports (datatable, tree reports, totals, filters). Dialogs, message boxes, toasts, freeze overlay. Buttons, menus, tooltips, popovers, link previews, autocomplete, date and time pickers, tabs, badges, tags.

**P1**: dashboards and charts, Kanban, Calendar, Tree view, Gantt, print-preview chrome, global states (skeleton, empty, 403, 404, 500, maintenance, offline, session timeout), avatars, scrollbars, selection, focus rings, keyboard-shortcuts dialog, code and text editors.

**P2**: website and portal pages, web forms, email templates, system screens, Print Style, Letter Head, PDF conventions, favicon, app logo, splash.

ERPNext and Frappe HR pages inside the desk inherit the theme through tokens. Standalone SPAs (Helpdesk, CRM) are out of scope; say so in the documentation.

## 8. Government-grade requirements

**Accessibility (WCAG 2.2 AA is the floor)**
- Contrast measured on the real token pairs in both modes. Body text and headings target 7:1 and never fall below 4.5:1. Large text 3:1. Placeholder, help and status text on tinted backgrounds 4.5:1. Input borders, icons, chart marks and focus indicators 3:1 against adjacent colours. Disabled elements stay distinguishable and legible.
- Focus always visible (2px or more, 3:1, with offset), one ring on every interactive element. Sticky headers never obscure the focused element (scroll-padding).
- Targets 24x24 CSS px or more everywhere; default controls 32px high; 44px where the pointer is coarse.
- Colour is never the only carrier of meaning. Links are distinguishable without colour. Charts carry secondary encodings (direct labels, dash or marker patterns).
- Motion 120-200 ms ease-out on colour, opacity and transform only; none on data tables; honours `prefers-reduced-motion`. Supports forced-colors. Sets `color-scheme` per mode. Usable at 200% and 400% zoom.
- Native controls, scrollbars, autofill, selection, caret and placeholder styled coherently in both modes.

**Typography and language**
- Tabular lining numerals in tables, forms, cards and reports; a monospace for codes and IDs with unambiguous 0/O and I/l/1. Western digits by default; Arabic-Indic option documented.
- Arabic: no letter-spacing, line-height +0.1 to +0.2, no synthetic bold or italic, size-compensated against Latin.
- Body and form text 14px or more, table data 13-14px, nothing readable below 12px, line-height 1.45-1.6, prose measure 45-90 characters.
- Full RTL and LTR parity: layout, direction-implying icons, breadcrumbs, progress, sticky columns, scroll affordances, number alignment, charts, tooltips, print. Mixed-direction strings render correctly.

**Layout and density**
- 4px base grid and a documented spacing scale.
- Two densities, comfortable (default, tuned for 1366x768) and compact, switchable by a root attribute.
- Sticky page head with the primary action always reachable. Sticky table headers and first column with visible scroll affordances. Rows 36px or more by default and 28px or more compact, where the framework allows (see findings on the datatable).

**Error prevention and state clarity**
- One status language for Draft, Pending approval, Approved, Rejected, Submitted, Cancelled, Amended, On hold, Overdue, Completed, mapped from Frappe's indicator colours and workflow-state styles.
- One primary action per view. Consequential actions (Submit, Approve, Reject, Cancel, Delete, Amend) visually distinct and separated from routine ones. Destructive confirmations carry consequence text and non-colour emphasis. Read-only looks different from disabled. Validation inline and summarised. Role-masked fields are clearly masked with a visible reason.
- Optional, subtle non-production ribbon (Training, UAT, Staging) driven by configuration; absent in Production.
- Legible session-expiry and idle warnings and a calm banner when the realtime connection drops. These are behaviour, not skin: ship them opt-in.

**Institutional trust cues**
- Emblem slot and system wordmark lockup in SVG (light, dark, monochrome; clear-space and minimum-size rules). The placeholder emblem is abstract, neutral and clearly a placeholder.
- Login is official and quiet: emblem, system name, authorised-use notice, support contact, version and environment line, language switch, accessible password visibility and caps-lock hint, SSO and 2FA states. No marketing copy, no photography.
- Error pages are helpful and show a reference ID. No humour.

**Print, PDF, email, portal**
- Print Style + Letter Head for A4 and Letter, bilingual-ready, always light regardless of desk mode, legible in black-and-white photocopy, with running header and footer and page X of Y, a Draft or Cancelled watermark, a QR or verification zone, signature and approval blocks, and financial statements with clear hierarchy and tabular figures.
- Email header and footer use the same identity. Website, portal and login use the same tokens through the website bundle.

**Performance, security, compatibility**
- Budgets: desk theme CSS about 150 KB unminified, login and website about 60 KB, fonts about 350 KB of WOFF2 for the default subsets. Justify any excess (extra font pairings are loaded only when selected).
- Zero runtime external dependencies. CSP-safe. No layout shift on theme switch or first paint.
- Last two major versions of Chrome, Edge, Firefox and Safari, degrading gracefully to Chromium about 100.
- Test at 1366x768, 1920x1080, 2560x1440, 1024x768, 768x1024 and 200% zoom.

## 9. Deliverables

1. **The app**, every file complete, with fonts, SVG assets, settings, Print Style, Letter Head and email styling shipped idempotently (never overwriting administrator changes) and a clean uninstall.
2. **Documentation** in `docs/`:
   - `DESIGN_SYSTEM.md`: thesis and principles, the direction and why, identity, full token tables for Light and Dark with computed contrast, spacing, radius, elevation, motion, focus, component and state specifications, status language, chart palette, RTL rules, print, portal and email standards, do and don't, white-label guide, configuration-level UX recommendations, and a decision log of the ten most consequential decisions.
   - `DEPENDENCY_MANIFEST.md`: every Frappe variable overridden and every structural selector used, with purpose, version verified against, status (VERIFIED or UNVERIFIED) and failure mode if upstream changes.
   - `UPGRADE_AND_QA_CHECKLIST.md`: what to re-verify after each v16.x release, a manual QA matrix, an accessibility test script, a browser and resolution matrix.
   - `README.md`: install, build, configuration, default mode, presets and fonts, environment ribbon, uninstall, troubleshooting.
3. **Interactive design proof**: one self-contained HTML file built from the same tokens and compiled theme CSS, using Frappe's real class names so production selectors are exercised, with controls for Light, Dark, Automatic; English LTR and Arabic RTL; density; colour preset; and a token and contrast panel. Screens as on the design canvas, with natural English and natural Arabic content.
4. **Verification assets**: a dependency-free contrast audit that covers every declared pair in both modes for every preset and exits non-zero on failure, with its output in the docs; a dead-token check proving every overridden variable exists in the core compiled CSS or is consumed by the theme.

## 10. Quality bar and integrity

- Score 1-5 on credibility, calm, clarity and hierarchy, consistency, accessibility, dark-mode parity, RTL parity, density and productivity, craft, upgrade-safety, performance, documentation. Deliver only when every dimension is 4 or more, and include the table.
- Done means: every token has Light and Dark values; every component state is designed in both; all contrast thresholds pass, shown by audit output; no placeholder content, TODOs or elided code; every override is in the manifest; the proof matches the theme; nothing requires editing Frappe core.
- Do not invent Frappe variables, classes, hooks or file paths. Verify them or label them UNVERIFIED.
- Label evidence VERIFIED (inspected or ran it), COMPUTED or ASSUMED. Never say something was tested unless it was run. Do not claim certification: say "designed to meet WCAG 2.2 AA; formal audit recommended".
- No lorem ipsum. No real institutions, emblems or personal data. No copied third-party theme code. Open-licensed fonts and assets only, each licence recorded.
