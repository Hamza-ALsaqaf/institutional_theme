# B1: "before" baseline on the benches (old desk CSS, three-block map)

Tooling: `capture/capture.mjs` (screenshots plus a gzipped computed-style dump per capture; `--version`, `--out`, `--bench-dir`; the same command runs unchanged into `after/<version>/`), `capture/names.json` (the 424 mapped names), `capture/compare_dumps.py BEFORE AFTER` (variables, nested `[data-theme]` elements, root attributes and per-element computed style). Run:

    NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node capture.mjs --version 16.32.0 --out ../after/16.32.0

What a capture is: Chromium 141, 1280x800, en-US, as `css-headroom-en@example.com` or `css-headroom-ar@example.com` (System Manager; deleted and re-created at the start of every run so the form timeline is identical; each user switches its own theme with `switch_theme`; Administrator is never touched). Time is frozen with `page.clock.setFixedTime(2030-06-15T12:00Z)`, so relative dates read "3 y" in every run. Transitions and animations are disabled by an injected style sheet (before and after alike). The list and the report are filtered to `name like css-headroom-%` so row counts cannot drift; the form is the logged-in test user's own User form. Density `compact` is the `data-ins-density` attribute set after load, as in the round-4 script. Each dump holds all 424 mapped names on `html` and on every nested `[data-theme]` element, and for every element of the page (the icon sprite excluded) 53 computed properties (colour, border, background, shadow, font, size, spacing, display, ...) with `::before` and `::after` when they generate content.

## 16.32.0 (`midad.test`, port 8000, ERPNext 16.33.0 and HRMS 16.20.1 installed): 58 captures, 0 failed

`before/16.32.0/`: 48 main (en and ar x Light and Dark x comfortable and compact x desktop, workspace Build, User list, User form, User report view, Confirm dialog) plus 10 extra (Automatic with the OS emulated dark and light x desktop, list, form and theme-switcher dialog; the switcher in Light and in Dark). 0 horizontal overflow, every Arabic capture `dir=rtl`, all 424 names non-empty on `html` in every dump, the 4 switcher dumps have 6 nested `[data-theme]` elements each (the preview tiles), every other dump none. Files: `screens/*.png`, `dumps/*.json.gz` (about 1 MB), `index.json`, `run.log`.

Desk bundle (hash of the content served to the browser):

| | start 19:34:19Z | end 19:38:32Z |
|---|---|---|
| assets.json `ins_desk.bundle.css` | `dist/css/ins_desk.bundle.HG5CL44N.css`, sha256 `28e8ac8bb544117c460103c0ec342075f03eecee8fef6ec30d66af03f219a87b`, 149708 B | same |
| assets-rtl.json `rtl_ins_desk.bundle.css` | `dist/css-rtl/ins_desk.bundle.HXWCBO42.css`, sha256 `7540405cff471ec33e5bc69f56b6feefbe1f4443b061ce9c09f0a3af720ad851`, 149708 B | same |

34 captures linked the LTR file (English) and 24 the RTL file (Arabic). Both files hash to `9eef821318e512fe45bd7d40859c50e25f1d93b018ba90c7ec3a0ae032efa5b6` once the last line (the `sourceMappingURL` comment, which names the file's own hash) is removed, so the RTL bundle equals the LTR bundle in content (the rtl:ignore wrapper) and the file names differ only by that comment. Content did not change during this batch.

A first batch of the same 58 started at 19:27 and straddled a rebuild of the shared dist (the `hrms52` build stage, 19:31): the file name went from `XVAD5JZV` to `HG5CL44N` (and before that `5LN36KYD`) with identical size, differing only in the comment (ASSUMED for the earlier files: they are gone, only the sizes match). I redid the whole batch after the dist settled; that is the committed baseline. Comparing the discarded first batch with the redo (`before/16.32.0/determinism-run1-vs-run2.txt`): 56 of 58 dumps are identical in every variable and every element.

Known nondeterminism (not a CSS change): in the two Automatic form dumps, two adjacent role checkboxes in the hidden Roles editor swap their checked state between runs (2 elements, `background-color` and `background-image`). The role list order of a fresh user is unstable. Expect the same 2-element flip in any `*-form` dump in B2 and treat it as noise when the paths end `...div[3]>div[1]>div[0]>input`.

Hash note for B2: the 16.32.0 and the 16.52.0 bench share one dist folder (`institutional_theme/public/dist`, symlinked by both), built by whichever bench's build ran last (`b.sh build` for 16.32.0; `b52.sh build` for the newest tag, which then runs `sync_assets.sh`). For a comparison on bundle content, build "after" with the same builder as the one recorded here and compare the content hash with the comment stripped (`bundle-served.json`, `sha256WithoutSourceMapComment`). Otherwise the comparison rests on the computed-style dumps alone.
