# Institutional Theme (Midad)

A custom Frappe app that re-skins the ERPNext v16 desk for a government institution: Light and Dark, Arabic-first, upgrade-safe, zero core edits. The repository currently holds the approved design and an installable but empty app skeleton.

## Read before doing anything

1. `docs/BRIEF.md` — the owner's requirements. The contract.
2. `docs/research/frappe-16.32-findings.md` — facts read from Frappe source. Several contradict common assumptions about Frappe themes; read section 2 (cascade) and section 5 (datatable) at minimum.
3. `design/README.md`, then `design/tokens.json` and `design/canvas/midad.css` — the approved design.
4. `docs/adr/0001-owner-decisions.md` — decisions already made. Do not reopen them.
5. `docs/team/WORKFLOW.md` — phases, gates, who owns which files.

## Non-negotiables

- **Verified target**: Frappe 16.32.0, ERPNext 16.33.0, HRMS 16.20.1. Clone those exact tags to inspect source. Never assume v14, v15 or early-v16 markup.
- **Zero core edits.** Everything lives in this app.
- **Do not invent** Frappe variables, classes, hooks or paths. Open the source and confirm, or label the item UNVERIFIED in `docs/DEPENDENCY_MANIFEST.md`.
- **Never claim something was tested unless you ran it.** Label evidence VERIFIED, COMPUTED or ASSUMED.
- **`design/tokens.json` is the single source of truth.** Generated files carry a "generated, do not edit" header and are never edited by hand.
- **The `midad` preset must stay exactly as approved.** A change to an approved value needs a decision record and the owner's sign-off.
- **Logical CSS properties only.** Wrap each bundle in `/*rtl:begin:ignore*/ … /*rtl:end:ignore*/`.
- **Never override frappe-datatable row or cell height in CSS.** It breaks scrolling (findings section 5).
- **Private font-family names** (for example `Midad Sans`), never `IBM Plex Sans Arabic`: another app in the owner's bench already registers that name.
- **No `!important`** without an entry in the manifest saying why nothing else works.
- No lorem ipsum, no TODO, no elided code, no real institutions or personal data.

## Layout

```
design/                     approved design (read-only reference)
docs/                       brief, findings, decisions, team workflow, final documentation
institutional_theme/        the Frappe app package
  hooks.py                  hooks are commented out until their target exists
  public/scss|js|fonts|images
  translations/ar.csv       source,translation[,context] with no header
.claude/agents/             the seven specialised agents and their model and effort
```

## Conventions

- Python: tabs, ruff (configuration in `pyproject.toml`), type hints on public functions.
- CSS namespace `--ins-*`; root attributes `data-ins-*`; bundle names start with `ins_`.
- Commits: conventional prefixes (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), one concern per commit.
- Work on the branch `build/midad-v1`; commit and push after every completed task. `main` is fast-forwarded only to a commit whose phase gate passed, so it is always shippable.
- Documentation and code comments are in English. Every user-visible string is wrapped for translation and has an Arabic entry.

## Working economically

The owner has a usage limit. Respect it.

- Read the files named for your task, not the repository. Use search before opening large files.
- Do not re-derive what the findings file already establishes; re-verify only the lines you depend on.
- Do not spawn an agent for something a few tool calls would do.
- When blocked, report what you found to the lead and do not loop. The lead decides; the run is autonomous and nobody waits for the owner (see `docs/team/WORKFLOW.md`, Autonomous mode).
- Reviewers read the diff and the files it touches, not everything.
