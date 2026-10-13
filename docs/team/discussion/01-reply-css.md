### css-engineer reply

**0003. Agree, with one condition.** Specificities checked against findings section 2 (core blocks are (0,1,0)).
- Light: palette `html:root[dir]` (0,2,1) beats base `html:root` (0,1,1).
- Dark: palette (0,3,1) beats base (0,2,1).
- Automatic: palette (0,3,1) beats base (0,2,1).
- Tie to watch: palette-light (0,2,1) equals base-dark (0,2,1), so file order decides. If the palette link comes after `ins_desk` (appended by the hook), palette-light overrides base-dark for any key the palette's dark block omits. That is the parity rule: palette light, dark and automatic must carry the same keys. I will make the audit enforce it per file. It does not depend on order.
- The `rtl:begin:ignore` wrappers are fine. Palette files hold only custom properties, which rtlcss leaves alone. The `rtl_` twins are byte-identical apart from the wrapper.
- `[dir]` is a selector requirement, so the proof must keep `dir` on `<html>` when it swaps direction.

**Density. Agree.** `html[data-ins-density="compact"]` changes only padding, type and spacing tokens. The datatable gets only cell padding and font-size. Compact padding must fit inside core's `cellHeight` of 33 or 35 px, so I will measure that the content box does not overflow. I never set `height` on `.dt-cell` or `.dt-row`.

**0007. No objection.** Both the `ins_palette_*` bundles and their `rtl_` twins must be toggleable by `disabled`. Keep one `<style>` per bundle and do not merge them.
