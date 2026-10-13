# Reply: print-web-engineer, on 0003 to 0005

**Verdict: agree, with three conditions.**

1. **Website and login palette.** Consistent. `templates/base.html:3` renders `<html lang dir>` with no `data-theme`, so only the light blocks of a palette file match and the dark and automatic blocks are inert (VERIFIED, source). `web_include_css` is set at `website_settings.py:232`. Condition: the hook must append the site-default palette and font links to a copy of that list, and the login scoping `body[data-path="login"]` must still out-rank `login.bundle.css`.

2. **Uploaded fonts under wkhtmltopdf.** The generated `@font-face` file is a screen asset and never reaches the print document. Print must therefore get its TTF face from the Print Style, which has to stay small (findings section 6): one `url()` to the public `/files/…ttf`, no `format()`, no data URI. WOFF2-only uploads fall back to bundled Plex TTF, as 0004 says. Condition: the Print Style is rendered at install or save time from the chosen pairing, and a private file is not fetchable, so the "must be public" check also covers print. Not rendered yet.

3. **Identity write-through.** No collision. Letter Head and Print Style are created in `after_install` or `after_migrate` only, and `system_name`, `emblem` and `favicon` write to different doctypes. Condition: the Letter Head logo reads `emblem` at render time, never as a write-through target (`Letter Head.before_insert` forces `source = "Image"`).
