# Upgrade review, round 2 (3c222cf..HEAD, 82d6d0b)

The previous findings are resolved. The `/todo` diff after uninstall is back to 3 px with a max delta of 2 (`gate/pixel-diff.txt`). The `_tree.scss` physical resets are gone. `_error_pages.scss:78` now uses `start`.

## 1. Blocking

- **A Letter Head kept on uninstall breaks printing.** `print/ship.py:373-380` keeps "Midad" when it is linked or changed, and those are the usual cases once a site uses it. The kept record still calls `ins_identity()` (`print/letter_head.html:4`, `letter_head_footer.html:29`). After uninstall the `jinja` hook is gone. Frappe uses `DebugUndefined` (`utils/jinja.py:66`), and calling an undefined name raises `UndefinedError`. COMPUTED: I ran this with jinja2 from the bench env. `render_template` turns it into "Context Error" (`utils/jinja.py:157-160`) at `www/printview.py:232,241`. Every print or PDF of a document linked to that Letter Head then fails. The gate only covers the untouched, unlinked path (`gate_state.py` residue). Smallest fix: write `{%- set ins = ins_identity() if ins_identity is defined else {} -%}` in both templates.

## 2. Scores

- **Upgrade-safety, 3/5:** the finding above. Apart from it the code is careful: the checksum/adopt/skip logic, `is_default` 0 under `in_migrate` (`letter_head.py:40,62`), the singles link check that keeps a Print Style chosen in Print Settings (`delete_doc.py:329`), and residue "none".
- **Performance, 4/5:** `ins_web` is 59.7 of 60 KB (`budgets.txt`), which leaves 0.3 KB of headroom. Budgets are skipped in CI because CI has no build, so nothing enforces them there.
- **Documentation, 3/5:** the manifest contradicts itself. It says "Count of `!important` … 4", but there are 5. Section 2f says `_website.scss` "carries no `!important`", but line 39 has one. `after_install` is marked UNVERIFIED although its consumer is `installer.py:360-361`.
- **Craft, 4/5:** 138 integration and 164 unit tests pass. The opt-in JS does no work when disabled, starts once and checks its core APIs (`auth.py:450`, `container.js:19`). The 5 `!important` are justified and scoped: inline FullCalendar colours (`calendar.js:441-449`) and core's `border: none !important` (`calendar.scss:65`).

## 3. Risks for the next minor upgrade

1. **Stale Print Style after an upgrade (major).** `after_migrate` ships from `assets.json`, and an update usually migrates before it builds. The Print Style then holds the previous CSS until the next migrate or settings save.
2. **`body:not([onload])` (`ins_print.bundle.scss:406-411`)** depends on `pdf_header_footer.html:66` keeping `onload` and on the Chrome header page having no `onload`.
3. **`body:has(> .ins-banner)` grid** (`_banners.scss:6`) assumes body has only two in-flow children.
4. **Gantt `direction: ltr`** (`_gantt.scss:61`) should be removed if frappe-gantt gains RTL support.
5. **`test_print_ship.clean()`** clears Print Settings `print_style` and force-deletes "Midad". C10 says the deletion persists, so running the tests on a live site loses that data.
6. **Dark calendar chips** drop the per-event colour (`_calendar.scss:26-31`).

## 4. Not verified

- The bench CLI order of migrate and build: there is no bench package on this host.
- Real uninstall with a linked Letter Head. I did not run it, because uninstall is not allowed in this review.
- wkhtmltopdf output.
- Premailer output.
- The masked-field ARIA with a screen reader.
- A live socket disconnect.

## Second pass (fix round 1)

**Blocking now: None.** The kept Letter Head finding is resolved, with run evidence. Both templates now check `ins_identity is defined` (`print/letter_head.html:6-7`, `letter_head_footer.html:4`). The gate edits the record and prints with it after a real uninstall, in English and Arabic, as HTML and as wkhtmltopdf PDF. The result was "KEPT PRINT: ok" (`gate-final/kept-print.log`; `gate-commands.tsv` rows 14-18 exit 0). Residue was "none". 142 integration and 164 unit tests passed.

`test_print_ship.py` is now safe on a live site. Neither `ship.py` nor `install.py` commits. The class cleanup rolls back (`integration_test_case.py:72,194`). `tearDown` restores the records and asserts the snapshot.

The three Documentation items are fixed: 5 `!important`, `_website.scss:39`, and `after_install` VERIFIED.

Minor issues, none blocking:
- `kept-cleanup` leaves `Deleted Document` rows on the bench.
- The `.btn` forced-colours border adds 2px, in that mode only.
- `field_errors.js` re-queries a Table wrapper's grid inputs on every class change.
- The guard row in manifest 2g still says COMPUTED. The gate run makes it VERIFIED.


Scores:
- **Upgrade-safety 4/5:** the kept record prints without the app (gate). Selector and inline-colour coupling remain.
- **Performance 4/5:** one bounded observer per layout, filtered to `class`. `ins_web` CSS is still about 61 KiB (`build1.log`), and CI has no budget check.
- **Documentation 4/5:** all three contradictions fixed. The new 2g rows label what is ASSUMED.
- **Craft 4/5:** guarded templates, a test for records saved before the guard, and a non-destructive print test. The physical `margin-left` is justified.
