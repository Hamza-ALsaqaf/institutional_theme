# Institutional Theme (Midad)

An upgrade-safe visual identity and UI theme for the Frappe / ERPNext v16 desk, designed for a government institution: Light and Dark of equal quality, Arabic-first with full English parity, zero core edits.

**Status: approved design and app skeleton.** The app installs but includes nothing in the desk yet. The build is carried out by the agent team described in `docs/team/`.

Verified target: Frappe 16.32.0, ERPNext 16.33.0, HRMS 16.20.1.

## Where to look

| | |
|---|---|
| `docs/BRIEF.md` | What is being built and to what standard |
| `design/` | The approved design: tokens, artboards, reference colour maths |
| `docs/research/frappe-16.32-findings.md` | What the Frappe source actually does |
| `docs/adr/` | Decisions |
| `docs/team/WORKFLOW.md` | The team, phases and gates |
| `docs/team/KICKOFF_PROMPT.md` | The prompts that start each phase |
| `.claude/agents/` | The seven specialised agents |

## The identity

Midad (مداد, "ink"): Prussian ink as the primary colour, antique brass as a sparing accent, cool slate neutrals with a separately tuned dark ramp, IBM Plex Sans Arabic with IBM Plex Sans and IBM Plex Mono, and one signature motif, the accountant's closing rule. Status is always colour, label and shape together.

Users may choose among audited colour presets; `midad` is the default. A site administrator controls the default, the allowed presets, an optional custom brand preset and the font pairing.

## Install (once built)

```bash
cd ~/frappe-bench
./env/bin/pip install -e apps/institutional_theme
echo "institutional_theme" >> sites/apps.txt
bench --site <site> install-app institutional_theme
bench build --app institutional_theme
```

Uninstalling restores the stock Frappe look:

```bash
bench --site <site> uninstall-app institutional_theme
```

## Out of scope

Standalone single-page apps (Helpdesk, CRM) do not load the desk CSS and are not themed.

## Licence

MIT. Bundled fonts are under the SIL Open Font License 1.1.
