# Institutional Theme (Midad)

An upgrade-safe visual identity and UI theme for the Frappe / ERPNext v16 desk, designed for a government institution: Light and Dark of equal quality, Arabic-first with full English parity, zero core edits.

**Status: Phase 3 gate passed** (desk, shell and login are themed; see `docs/team/evidence/phase3/`). The build is carried out by the agent team described in `docs/team/`.

Verified target: Frappe 16.32.0, ERPNext 16.33.0, HRMS 16.20.1.

## Where to look

| | |
|---|---|
| `docs/BRIEF.md` | What is being built and to what standard |
| `design/` | The approved design: tokens, artboards, reference colour maths |
| `docs/research/frappe-16.32-findings.md` | What the Frappe source actually does |
| `docs/DEPENDENCY_MANIFEST.md` | Hooks, Frappe selectors and variables the theme depends on, with their status |
| `docs/UPGRADE_AND_QA_CHECKLIST.md` | Steps after a Frappe upgrade and the manual QA matrix |
| `docs/FONTS.md` | Font files, licences and checksums |
| `docs/adr/` | Decisions |
| `docs/team/WORKFLOW.md` | The team, phases and gates |
| `docs/team/KICKOFF_PROMPT.md` | The prompts that start each phase |
| `.claude/agents/` | The seven specialised agents |

## The identity

Midad (مداد, "ink"): Prussian ink as the primary colour, antique brass as a sparing accent, cool slate neutrals with a separately tuned dark ramp, IBM Plex Sans Arabic with IBM Plex Sans and IBM Plex Mono, and one signature motif, the accountant's closing rule. Status is always colour, label and shape together.

Users may choose among audited colour presets; `midad` is the default. A site administrator controls the default, the allowed presets, an optional custom brand preset and the font pairing.

## Install

Run as the bench user, in the bench directory:

```bash
cd ~/frappe-bench
bench get-app https://github.com/Hamza-ALsaqaf/institutional_theme
bench --site <site> install-app institutional_theme
bench build --app institutional_theme
bench restart
```

- `bench get-app` fetches the app from the repository (the `origin` remote of this repository, default branch).
- `install-app` changes no setting by itself: the theme is on as soon as the bundles are built. An administrator's saved values are never overwritten.
- `bench build --app institutional_theme` builds the desk and website bundles. Run it again after each change to the app's stylesheets or scripts.
- Restart the bench processes so the web and worker processes load the new hooks.

Check the install:

```bash
bench --site <site> list-apps
```

## Optional site configuration

Set these in `sites/<site>/site_config.json`. Both are optional.

| Key | Values | Effect |
|---|---|---|
| `ins_environment` | `production`, `training`, `uat`, `staging`, or any other word | Shows an environment ribbon on the desk for every value except `production` and an empty value. On the login and error pages, `production` shows the word "Production". Any other word is shown as "Non-production". Absent or empty means no ribbon. |
| `ins_release` | Any text | Shown as the release on the login and error pages ("Release {0}"). Empty when absent. |

## Uninstall

Uninstalling restores the stock Frappe look:

```bash
bench --site <site> uninstall-app institutional_theme
```

The generated per-site stylesheets folder is removed by the uninstall hook. The stock look after uninstall is checked by `tools/bench/gate_install_uninstall.sh`.

## Developing and testing

- Unit tests and audits (no bench needed): see `.github/workflows/ci.yml`. They are `python -m unittest discover -s institutional_theme/midad/tests -t .`, `python -m unittest discover -s institutional_theme/audits/tests -t .` and `python -m institutional_theme.midad.build --check`.
- Bench tests: `tools/bench/b.sh run-tests --app institutional_theme`. Bench set-up is in `tools/bench/README.md`.
- After a Frappe upgrade, follow `docs/UPGRADE_AND_QA_CHECKLIST.md`.

## Out of scope

Standalone single-page apps (Helpdesk, CRM) do not load the desk CSS and are not themed.

## Licence

MIT. Bundled fonts are under the SIL Open Font License 1.1 (see `docs/FONTS.md`).
