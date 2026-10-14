# Institutional Theme (Midad)

An upgrade-safe visual identity and UI theme for the Frappe / ERPNext v16 desk, designed for a government institution: Light and Dark of equal quality, Arabic-first with full English parity, zero core edits.

**Status: Round 3 (release hardening) passed its release gate: clean install from scratch, HRMS 16.20.1, the newest v16 tag checked, coexistence with another brand app, an automated axe-core scan with 0 violations caused by the theme, and both hostile reviews with no blocking finding.** Results and scores are in `docs/team/OWNER_REVIEW.md` (Arabic); evidence in `docs/team/evidence/round3/`. The build is carried out by the agent team described in `docs/team/`.

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

Run as the bench user, in the bench directory. The bench is a Frappe v16 bench with at least one site (ERPNext is optional: the theme installs and uninstalls the same way on a Frappe-only site and on a site with ERPNext).

```bash
cd ~/frappe-bench
bench get-app https://github.com/Hamza-ALsaqaf/institutional_theme
bench --site <site> install-app institutional_theme
bench build --app institutional_theme
bench restart
```

- `bench get-app` clones the repository's default branch (shallow, remote named `upstream`), installs the Python package and builds the app's bundles. To install another branch or tag, add `--branch <name>`.
- `install-app` changes no setting by itself: the theme is on as soon as the bundles are built. An administrator's saved values are never overwritten. Running it again prints "already installed" and changes nothing.
- `bench build --app institutional_theme` builds the desk and website bundles. `get-app` already built them once, so on a first install this finishes in a few seconds with the same files; run it again after each change to the app's stylesheets or scripts.
- Restart the bench processes so the web and worker processes load the new hooks. On a bench without supervisor or systemd, `bench restart` exits 0 and restarts nothing (observed on the test bench): stop and start `bench start` or `bench serve` yourself.
- After the app's code changes (for example `git pull` in `apps/institutional_theme`), run `bench build --app institutional_theme`, `bench --site <site> migrate` and `bench restart`. `migrate` can be run any number of times: a second run changes nothing.

Check the install:

```bash
bench --site <site> list-apps
curl -s http://<site-host>/login | grep -o 'ins_web.bundle[^"]*'
```

`list-apps` shows `institutional_theme 0.1.0`; the login page of a site with the app links `ins_web.bundle.<hash>.css` and `.js`, and the desk (`/desk`, signed in) links `ins_desk.bundle` and `ins_shell.bundle`.

## Optional site configuration

Set these in `sites/<site>/site_config.json` (for example `bench --site <site> set-config ins_release "2026.1"`). All are optional.

| Key | Values | Effect |
|---|---|---|
| `ins_environment` | `production`, `training`, `uat`, `staging`, or any other word | Shows an environment ribbon on the desk for every value except `production` and an empty value. On the login and error pages, `production` shows the word "Production". Any other word is shown as "Non-production". Absent or empty means no ribbon. |
| `ins_release` | Any text | Shown as the release on the login and error pages ("Release {0}"). Empty when absent. |
| `monitor` | `1` | A Frappe key, not this app's. When set, error pages (500, error messages, 403) show a reference that users can quote to support. The same value is in the `X-Frappe-Request-Id` response header, the Error Log `trace_id` and `logs/monitor.json.log`; if nginx sends `X-Frappe-Request-Id: $request_id`, it also matches the access log. Without it, the page shows the time of the error instead. 404 pages are cached and show no reference. |

The site's `site_config.json` is read on each request; no restart is needed.

## Opt-in behaviours

Two behaviours are off after install. Turn them on in **Institutional Theme Settings**:

- **Warn before the session expires**, with **Minutes of warning** (default 5): a dialog warns an idle user before the session ends; its button keeps the session alive.
- **Show a banner when the connection is lost**: a banner at the top of the desk while the browser is offline or live updates are interrupted.

## Printing

Install ships a Print Style named **Midad** and a Letter Head named **Midad**. Neither is made the default, and Print Settings is not changed. To use them:

1. **Print Settings → Print Style**: choose "Midad".
2. **Letter Head**: open "Midad" and tick "Default Letter Head", or set it as the company's "Default Letter Head" (ERPNext), or choose it in the print view. Tick "Print with letterhead" in Print Settings if it is off.

The letter head shows the institution's names, the emblem (when it is a public file) and the default company's primary address, from Institutional Theme Settings. If you edit or delete either record, the app does not overwrite or recreate it; uninstall removes them only if they are unchanged and not linked.

**PDF generator.** Print Settings → PDF Generator offers `wkhtmltopdf` and `chrome`; both are supported.

- `wkhtmltopdf` must be **0.12.6.1 with patched Qt** (`wkhtmltopdf -V` prints `(with patched qt)`). The 0.12.6 package from the Ubuntu or Debian archive is not enough: the page overflows its width and the running header and footer do not work. Install the official build for your distribution from the wkhtmltopdf packaging releases.
- `chrome` uses the headless browser that Frappe downloads into the bench.

Printing is always light, in either desk mode.

## Uninstall

Uninstalling restores the stock Frappe look:

```bash
bench --site <site> uninstall-app institutional_theme
bench remove-app institutional_theme    # optional: also takes the app out of the bench
bench restart
```

- `uninstall-app` asks "Are you sure you want to continue? [y/N]" and first takes a backup of the site (`sites/<site>/private/backups/`). `--yes` skips the question and `--no-backup` skips the backup.
- It removes the Institutional Theme Settings doctype, the appearance page and the module; the Midad Print Style and Letter Head (only when you did not edit them and nothing links to them); this app's globals and per-user defaults; its attachments, meaning the files attached to the settings and the copies of the emblem and favicon that Frappe attached to Navbar Settings and Website Settings while the theme's values were in them (Frappe copies a file whenever one of those documents is saved); and the generated per-site stylesheets folder. Website Settings and Navbar Settings values that this app wrote (name, emblem, favicon) are put back, unless you changed them afterwards.
- What it keeps: a file you uploaded yourself stays, even when it has exactly the same bytes as the emblem, because only the copies that this app made or caused are deleted (it records them when it writes the emblem). A copy that Frappe attached to Website Settings or Navbar Settings that you still show as the logo stays. One case cannot be told apart: a file you upload to the same Website Settings logo field, with the same bytes as the emblem, after the theme wrote the emblem, looks exactly like Frappe's own copy and is removed unless it is the logo you show. This record exists only for identity values written by this version: on a site that wrote an emblem with an earlier build, uninstall cannot tell the copies from your files and leaves them (delete them in the File list if you want them gone). Palette and font choices, and the files you upload for fonts, are removed with the settings.
- The site stops linking the theme's bundles at once, without a restart. The app stays installed in the bench (and available to other sites) until `bench remove-app`; that command removes the Python package and the app folder (a copy goes to `archived/apps/` unless you add `--no-backup`), and it refuses while the app is installed on any site unless you add `--force`. It leaves a dangling `sites/assets/institutional_theme` link, which the next `bench build` removes (observed); unused `ins_*` entries stay in `sites/assets/assets.json`, which nothing references.
- The stock look after uninstall is checked by `tools/bench/gate_install_uninstall.sh`. A clean install on a second bench and site, followed by uninstall, with a comparison of every database table before and after, is `tools/bench/fresh_install.sh`.

## Developing and testing

- Unit tests and audits (no bench needed): see `.github/workflows/ci.yml`. They are `python -m unittest discover -s institutional_theme/midad/tests -t .`, `python -m unittest discover -s institutional_theme/audits/tests -t .` and `python -m institutional_theme.midad.build --check`.
- Bench tests: `tools/bench/b.sh run-tests --app institutional_theme`. Bench set-up is in `tools/bench/README.md`.
- After a Frappe upgrade, follow `docs/UPGRADE_AND_QA_CHECKLIST.md`.

## Troubleshooting

### Another brand app is installed (for example one that ships its own `*-brand.css`)

Apps load their `app_include_css` in `installed_apps` order, so an app installed after this one loads its stylesheet later and wins ties. Tested with a reproduction of such an app's documented rules (`tests/browser/coexistence.mjs`, evidence in `docs/team/evidence/round3/coexistence/`):

- Font: the other app's `html[lang=ar], html[dir=rtl] { --font-stack }` is (0,1,1); this theme sets `--font-stack` at `html:root[dir]`, (0,2,1). Midad Plex stays in use and the other app's `IBM Plex Sans Arabic` face is never requested. No action needed.
- Primary button: `[data-theme=light] .btn-primary` and its `:hover` rule are (0,2,0) and (0,3,0); this theme sets background, border and colour at `html:root[dir] .btn.btn-primary` (0,4,1) and its `:hover` (0,5,1). No action needed.
- Desktop page header border: a later `.desktop-navbar { border-bottom }` is (0,1,0); this theme restores the hairline at (0,3,1). No action needed.

What this theme cannot beat: any rule of the other app that uses `!important`, a selector of specificity (0,4,1) or more on the same property, or an inline style. Symptoms are gold or foreign-coloured buttons, a foreign font in Arabic, or a thick header border. Remedy for an administrator, in this order:

1. Remove the offending rule from the other app's stylesheet or disable its `app_include_css` (the cleanest fix; that app owns the file).
2. Otherwise report the selector to the theme maintainer: the fix is one rule at (0,5,1) or higher in `institutional_theme/public/scss/desk/`, then `bench build --app institutional_theme`.

Check which app wins: open the browser developer tools, select the element and read the "Computed" tab; the winning rule names the stylesheet (`/assets/<app>/css/...`).

### HRMS on PostgreSQL

Found on the test bench with HRMS v16.20.1 on PostgreSQL 16 (2026-10-14). These are HRMS upstream defects, not theme issues; the theme's stylesheets do not cause them. The evidence of record is `docs/team/evidence/round3/hrms/README.md` and `docs/team/evidence/round3/hrms-screens/README.md`.

- `bench install-app hrms` fails (exit 1) in the post-install patch `hrms/patches/post_install/update_employee_advance_status.py` with `argument of AND must be type boolean, not type numeric`. The test bench worked around it with a temporary in-memory replacement of that one function and a forced install (`tools/bench/hrms_install.py`). The evidence records no upstream fix; check the HRMS release notes before repeating the workaround.
- Saving a Salary Slip fails with `GroupingError` on PostgreSQL: `compute_year_to_date` and `compute_month_to_date` (`hrms/payroll/doctype/salary_slip/salary_slip.py`, defined at lines 2296 and 2320) order an aggregate by `creation`. The test seed neutralised both for its own run, so its two draft slips have zero year-to-date and month-to-date figures. The evidence says MariaDB is not affected; this was not tested here.
- Opening a Leave Application form shows an "Error in server" dialog: `get_leave_details` (`hrms/hr/doctype/leave_application/leave_application.py`, line 1009) returns 500 with `column tabLeave Application.creation must appear in the GROUP BY clause`. It occurs in every mode and language on the test bench.

### Another app reads a global Espresso colour variable (for example `--ink-red-3`)

To colour the v16.52.0 desk this theme gives 26 Frappe colour variables the meaning they have there (the `--surface-*`, `--ink-*` and `--outline-*` names marked `ADR 0011 R3b` in `design/tokens.json`: `--surface-gray-5` and `-6`, `--surface-red-5`, `-6` and `-7`, `--surface-green-3`, `--surface-amber-3`, `--ink-white`, `--ink-red-1`, `-2` and `-3`, `--ink-green-2`, `--ink-amber-2`, `--ink-blue-2`, `--ink-cyan-1`, `--ink-pink-1`, `--ink-violet-1`, `--outline-gray-5`, `--outline-red-1` and `-3`, `--outline-green-1` and `-2`, `--outline-amber-1` and `-2`, `--outline-blue-1`, `--outline-orange-1`). These are global custom properties, so they change on Frappe 16.32.0 as well. Frappe 16.32.0 itself, ERPNext 16.33.0 and HRMS 16.20.1 never read them (searched in their source and built CSS, `docs/team/evidence/round4/fix1-backend/r3b-readers-16.32.0.txt`; the one exception is the standalone ERPNext banking app at `/banking`, which declares its own values for these names and loads none of this theme's stylesheets), so the desk of a bench with only those apps is unchanged. It matters only if another app on the same bench reads one of them with the 16.32.0 meaning. For example, `--ink-red-3` was error-text red (`#e03636`) and is now a pale red (`red.200` in Light), so text coloured with it turns pale on a white page.

How to spot it: error or accent text that is nearly invisible after the theme is installed and returns when you uninstall it. Search the other app for the names: `grep -rnE "var\(--(surface|ink|outline)-[a-z]+-[0-9]+\)" apps/<app> --include=*.css --include=*.scss --include=*.js --include=*.html --include=*.vue`, then compare the hits with the list above. Remedy: have that app use its own variable, or give the colour a fixed value in that app's stylesheet.

## Out of scope

Standalone single-page apps (Helpdesk, CRM) do not load the desk CSS and are not themed.

## Licence

MIT. Bundled fonts are under the SIL Open Font License 1.1 (see `docs/FONTS.md`).
