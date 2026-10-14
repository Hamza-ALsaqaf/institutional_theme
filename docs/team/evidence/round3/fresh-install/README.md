# Clean install from scratch, as an administrator would (round 3, item 1)

Script: `tools/bench/fresh_install.sh` (`all`, or one stage). Every command, exit code and duration is in `*/commands.tsv`; every command's output is in `*/logs/<step>.log`. Run 2026-10-14 on the GitHub Actions runner (2 vCPUs, shared with two other agents).

## What was built, and why

| | |
|---|---|
| Bench | A **second, fresh bench**, `/home/frappe/fresh-bench`: `bench init --frappe-branch v16.32.0` (40 s), so `bench get-app` really fetches the app from GitHub as `README.md` says. Own Redis on 13001 and 11001, web on **8010** (never 8000), the shared PostgreSQL 16 cluster. `midad.test` was not touched (its bench was only used to run the new unit tests). |
| `fresh.test` | **Frappe only.** The app declares no `required_apps` (`bench get-app` prints "Ignoring dependencies") and `README.md` promises a Frappe/ERPNext desk theme, so Frappe only is the minimum an administrator can have. |
| `fresherp.test` | **Frappe and ERPNext v16.33.0**, the stack the institution runs. The app is installed after ERPNext, the order an administrator would use. |
| `idem.test` | Frappe only; install twice and migrate twice (idempotency). |
| What was installed | `build/midad-v1` at `f39fa10` (final run; `branch/logs/fresh.test-app-version.log`). The `main` run installed `0b605da` (the merge of PR 2) with the literal README command. |

Both sites got a stock `bench migrate` and the non-interactive setup wizard (fictional data) before the "before" snapshot, so that the only difference between "before" and "after uninstall" can come from this app. Without the stock migrate the first run (`run1-harness-v1/`) reported differences that core's own migrate causes (Desktop Icon and Navbar Item counts).

## Runs

| Folder | Harness | What it is |
|---|---|---|
| `run1-harness-v1/` | first version | `main`, README literal. Showed three harness faults (the `/app` check did not follow the redirect to `/desk`; snapshots written to a folder the bench user cannot write; no stock migrate before the baseline) and the first sign of the File residue below. Kept as history. |
| `main/` | v2 | `main` (`0b605da`), README literal, both sites. **Found the defect**: `tabFile` 2 to 3 after install and uninstall (a File attached to Navbar Settings and its file in `public/files` were left behind). Everything else passed. |
| `branch/` | v3 (final) | `build/midad-v1` at `f39fa10`, which contains the fix. **0 failed steps** in `all`; then the `idempotency` stage. |

## Results of the final run (`branch/`), VERIFIED

README steps as run, in seconds (exit code 0 for every one):

| Step (README "Install", as written) | `fresh.test` | `fresherp.test` |
|---|---|---|
| `bench get-app https://github.com/Hamza-ALsaqaf/institutional_theme --branch build/midad-v1` (also builds the bundles) | 10 | (bench-wide, done once) |
| `bench --site <site> install-app institutional_theme` | 3 | 4 |
| `bench build --app institutional_theme` | 6 | 4 |
| `bench restart` (exit 0, restarts nothing on this bench) | 1 | 1 |
| `bench --site <site> list-apps` shows `institutional_theme 0.1.0 build/midad-v1` | 1 | 1 |
| `bench --site <site> uninstall-app institutional_theme` with `y` typed at the prompt (takes a backup) | 5 | 7 |

Around them: `bench init` 40 s; `new-site` 26 s and 23 s; ERPNext `get-app` 25 s and `install-app` 60 s; setup wizard 25 s (ERPNext site); stock `migrate` 8 s and 20 s. Whole `all` run: 7 min 53 s wall (`started.txt`, `finished.txt`).

| Check | Result | Evidence |
|---|---|---|
| Login page after install links `ins_web.bundle.*.css` and `.js`, both download (200) | pass on both sites | `verify-<site>-installed.txt` |
| Signed in as Administrator, `/app` redirects to `/desk`, which links `ins_desk.bundle.*.css` and `ins_shell.bundle.*.js`, both download (200) | pass on both sites | same file |
| Same after `install-app` again and two `migrate` runs | pass | `verify-<site>-after-migrate.txt` |
| `install-app` a second time | exit 0, "App institutional_theme already installed" | `logs/<site>-install-again.log` |
| Screenshots of `/login` and `/app/todo`: stock, installed, after uninstall | installed differs from stock (77 percent and 21 percent of pixels); **after uninstall is identical to stock** (login 0 pixels on both sites, todo 3 pixels on `fresh.test` and 6 on `fresherp.test`, channel delta 2 at most, out of 1 049 088) | `shots-<site>/`, `shots-<site>/pixel-diff.txt` |
| Uninstall: doctype, Print Style and Letter Head "Midad", globals, identity values, files, versions, site folder | `RESIDUE: none` | `logs/<site>-residue-gate-state.log` (the Phase 0 gate's checks) |
| Uninstall: row count of **every table** of the site before install and after uninstall | `RESIDUE: none` on both sites (only activity tables differ: Activity Log, Comment, Deleted Document, Permission Log, Sessions, Version) | `logs/<site>-residue-table-diff.log`, `snapshot-<site>-*.json` |
| No `sites/<site>/public/files/institutional_theme` folder, no stray file in `public/files` | pass | `logs/<site>-site-files.log` |
| After uninstall, without restarting the web server, login and `/desk` link no `ins_` bundle | pass | `verify-<site>-after-uninstall-no-restart.txt` |
| `bench remove-app institutional_theme --no-backup` (after both sites uninstalled) | exit 0; app folder and Python package gone; both sites still list their apps; the Frappe site still logs in and serves `/desk` with no `ins_` link | `logs/remove-app*.log`, `verify-remove-app-frappe-site.txt` |
| After `remove-app` | `sites/assets/institutional_theme` is a dangling link until the next `bench build` removes it; `sites/assets/assets.json` keeps 12 unused `ins_` entries (nothing references them) | `logs/remove-app-assets-*.log` |
| Idempotency (`idem.test`): table counts unchanged by a second `install-app` and by two `migrate` runs; Letter Head and Print Style `modified` stamps identical before and after; an administrator's `default_density = Compact` still `Compact` after both | pass | `idem-*` rows of `commands.tsv`, `logs/idem-*.log` |

Two of the `idem` diffs name tables explicitly: `tabDesktop Icon` is accepted in `idem-diff-2-3` because core's `install-app` re-creates the "Frappe Framework" icon (app `frappe`) and the next `migrate` removes it again (`desktop-icons-after-install-app.txt` against `desktop-icons-after-migrate.txt`). It is core behaviour on any app install, not this app's row. The first two attempts of the `idempotency` stage (visible only in this paragraph, their rows were replaced) failed on exactly that table, once without a stock migrate before the install and once with it.

## Defect found and fixed in the app

`institutional_theme/institutional_theme/doctype/institutional_theme_settings/identity_sync.py`, `delete_attachments()`. Saving Navbar Settings with the emblem makes core attach a copy of the emblem to Navbar Settings (`attached_to_field` `app_logo`, a new name such as `gate-emblema7b14f.png`, same `content_hash`). `restore()` put the logo back, but the copy and its file stayed after uninstall (`main/logs/fresh.test-site-files.log` lists the file; `main/logs/fresh.test-residue-table-diff.log` shows `tabFile: before 2, after 3`). The Phase 0 gate did not see it because it counted only Files attached to the settings doctype.
Fix (minimal): `delete_attachments()` also deletes File rows attached to `Navbar Settings`/`app_logo` whose `content_hash` equals one of the settings' own files, unless Navbar Settings currently shows that file; other files an administrator attached are never touched. Two new unit tests (`test_delete_attachments_removes_the_navbar_copies_core_made`, `test_delete_attachments_keeps_a_navbar_copy_that_is_showing`); the first fails without the fix and passes with it; the whole module passes, 45 tests (`test-identity-sync-fix.log`). Commit `f640145`. After the fix both sites show `RESIDUE: none` and no stray file.
Not covered: an emblem that was replaced several times leaves Navbar copies of the older emblems, which are indistinguishable from an administrator's own uploads and are kept on purpose.

## `README.md` changes (install and uninstall sections only)

| Where | Change | Why (evidence) |
|---|---|---|
| Install, intro | Says ERPNext is optional | `fresh.test` has no ERPNext and installs and uninstalls the same way |
| Install, `get-app` bullet | Default branch, shallow, remote `upstream`, `--branch` to choose another; the old text said the remote was `origin` | `logs/*-readme-1-get-app.log` (`git clone ... --depth 1 --origin upstream`) |
| Install, `get-app` also builds | Says `get-app` already built the bundles, so `bench build --app` is a few seconds on a first install | the get-app log runs `bench build --app institutional_theme` |
| Install, `install-app` bullet | "Running it again prints already installed" | `logs/*-install-again.log` |
| Install, restart bullet | On a bench without supervisor or systemd `bench restart` exits 0 and restarts nothing | `logs/*-readme-4-restart.log` is empty |
| Install, after changes | New: `build`, `migrate`, `restart` after the app's code changes; `migrate` is repeatable | idempotency stage. The `git pull` update path itself was not run |
| Install, check | New: `list-apps` output and a `curl` of the login page for `ins_web.bundle`, the desk links `ins_desk` and `ins_shell` | `verify-*.txt` |
| Uninstall | New: the confirmation prompt, the backup (`sites/<site>/private/backups/`), `--yes`, `--no-backup`; what is removed and restored (including the Navbar copy); no restart needed; the app stays in the bench until `bench remove-app`, which removes package and folder, refuses while installed on a site, leaves a dangling assets link that `bench build` removes | `logs/*-readme-6-uninstall.log`, `logs/remove-app*.log`, bench source `bench/bench.py` `uninstall` and `validate_app_uninstall` (read) |

## Selectors depended on (16.32.0)

Core behaviours this evidence and the fix rely on, observed on the fresh bench: `bench get-app` runs `bench build --app` itself; `uninstall-app` prompts, then "Backing up..." and removes DocType, Page, Module Def, Desktop Icons and Workspace Sidebars; saving Navbar Settings with a file URL of another document attaches a File copy to Navbar Settings (`File.attached_to_field = app_logo`, same `content_hash`); `/app` redirects to `/desk`. No Frappe source line was opened for these; they are observed behaviour (COMPUTED from runs), not manifest rows.

## Strings

None: no user-visible string was added or changed.

## Not verified, not done

- Production process managers: `bench restart` under supervisor or systemd, nginx, a real `bench update` of the app.
- The `README.md` update path after a `git pull` (`build`, `migrate`, `restart`): only `migrate` repeated twice was run.
- Only English; the Arabic screens are covered by other rounds.
- Emblem replaced more than once before uninstall (see above).
- A site whose HRMS is installed (item 2).
