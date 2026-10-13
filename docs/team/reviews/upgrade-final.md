# Upgrade review, final (29a3004..HEAD, b0228e0)

Checked in the 16.32.0 source: `after_commit` is run at `database/database.py:1194` and reset on rollback at `:1203`. `web_include_js` is rendered at `templates/base.html:105`. The core reveal handler binds directly (`login.js:108`, `update-password.html:125`). Letter-spacing is set at `login.bundle.scss:365,423,434`.

## 1. Blocking

None. There are 0 `!important` in the 18 built files and no `.dt-*` height rule. The residue check reports "none", and login after uninstall is pixel-identical to login before install. Phase 3 findings 1-3 are fixed (`guard_log.py`, `after_commit`, `_prune_temporary`).

- **MAJOR (evidence):** `/todo` after uninstall differs from before install in 271 px, max delta 173 (`gate/pixel-diff.txt`). Phase 3 showed 3 px, max delta 2. Antialiasing does not explain this. Fix: inspect the diff image and record the cause.
- **MINOR:** two physical properties have no manifest entry: `desk/_tree.scss:5,10,15` (a `padding-left` and `margin-left` reset of `tree.scss:50`) and `web/_error_pages.scss:78` (`text-align: left`). Fix: add both to the manifest.
- **MINOR:** `web/_base.scss:29-30` repeats `.ins-auth` six times to win on specificity. Letter-spacing is still UNVERIFIED (`DEPENDENCY_MANIFEST.md:57`), and `after_commit` has no manifest row.

## 2. Scores

- **Upgrade-safety, 4/5:** no core edits, no `!important`, no residue. The JS wraps volatile core markup.
- **Performance, 4/5:** measured raw / gzipped:

  | Bundle | Raw | Gzipped |
  |---|---|---|
  | `ins_desk` | 108,758 B | 12.9 KB |
  | `ins_web` | 164,757 B | 13.4 KB |
  | `ins_shell.js` | 5.5 KB | 2.2 KB |
  | `ins_web.js` | 1.5 KB | 0.7 KB |

  Palettes are 2.1 to 8.2 KB each. `ins_web` is 52% larger than the desk bundle, without `data:` URIs; I did not explain why.
- **Documentation, 4/5:** each selector is mapped to a core line. The gaps are listed above.
- **Craft, 4/5:** 140 tests pass and the audits pass. One `MutationObserver` watches the whole body on every web page (`ins_web.bundle.js:65`).

## 3. Risks for the next minor upgrade

1. **Login markup.** The script assumes `svg.toggle-password[toggle]` and the icon ids `#es-line-preview` and `#es-line-hide`. If core switches to delegated binding or renames the ids, the reveal or its icon breaks silently.
2. **Specificity race.** If core adds a deeper chain or `!important` to `letter-spacing`, it beats the six repeated classes, and Arabic letters stop joining.
3. **JS-generated classes.** If core changes `.dt-cell--col-0/1`, `.freeze-row`, `.skeleton-card` or `.indicator.blink`, those rules stop matching without any error.

## 4. Not verified

The cause of the 271 px diff. Keyboard use of the reveal in a real browser. Why `ins_web` is so large. The README install section. wkhtmltopdf. I re-ran no build, test or gate; the findings come from the logs.
