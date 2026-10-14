// Computed-style proof that the theme wins over the real compiled Frappe desk CSS.
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node cascade.mjs [--out DIR] [--bench /home/user/frappe-bench] [--tag 16.52.0]
// ADR 0011 R6: one run per Frappe version, on that bench's compiled core CSS and the theme CSS built here, LTR and RTL, Light and Dark.
// Each assertion lists the versions it applies to (`only(...)`); the default is both. A selector that matches nothing fails.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { layers, resolve as resolveVars, norm } from "./harness/css_model.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const bench = arg("--bench", "/home/user/frappe-bench");
const outDir = resolve(arg("--out", join(process.env.TMPDIR || "/tmp", "ins-cascade")));
const evidence = resolve(arg("--evidence", join(repo, "docs/team/evidence/round4/desk")));
// The version under test comes from the bench's frappe package (`__version__ = "16.52.0"`), unless --tag overrides it.
const tag = arg("--tag", (readFileSync(join(bench, "apps/frappe/frappe/__init__.py"), "utf8").match(/__version__\s*=\s*"([^"]+)"/) || [])[1]);
if (!tag) throw new Error("cannot read the Frappe version of " + bench);
const only = (versions) => versions.includes(tag);
const scss = join(repo, "institutional_theme/public/scss");
mkdirSync(outDir, { recursive: true });
mkdirSync(evidence, { recursive: true });

// ---- Build the bundles exactly as Frappe's esbuild does (sass 1.69.5, quietDeps), then rtlcss.
const sassPath = join(bench, "apps/frappe/node_modules/sass");
const rtlcss = join(bench, "apps/frappe/node_modules/rtlcss/bin/rtlcss.js");
const loadPaths = (process.env.INS_SASS_LOAD_PATH || "").split(":").filter(Boolean);
const warnings = [];
function compile(entry, name) {
	const sass = require_(sassPath);
	const r = sass.renderSync({
		file: entry, includePaths: loadPaths, quietDeps: true,
		logger: { warn: (m) => warnings.push(`${name}: ${m}`), debug: (m) => warnings.push(`${name}: ${m}`) },
	});
	const ltr = join(outDir, `${name}.css`), rtl = join(outDir, `${name}.rtl.css`);
	writeFileSync(ltr, r.css);
	execFileSync("node", [rtlcss, ltr, rtl], { stdio: "ignore" });
	return { ltr, rtl, bytes: r.css.length };
}
import { createRequire } from "node:module";
const require_ = createRequire(import.meta.url);

const built = {
	desk: compile(join(scss, "ins_desk.bundle.scss"), "ins_desk"),
	graphite: compile(join(scss, "generated/ins_palette_graphite.bundle.scss"), "ins_palette_graphite"),
};
const strip = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, "");
const rtlIdentical = Object.fromEntries(Object.entries(built).map(([k, v]) => [k, strip(v.ltr) === strip(v.rtl)]));

// ---- Core CSS from the bench manifests.
const manifest = (f, key) => join(bench, "sites", JSON.parse(readFileSync(join(bench, "sites", f), "utf8"))[key].replace(/^\//, ""));
const core = { ltr: manifest("assets/assets.json", "desk.bundle.css"), rtl: manifest("assets/assets-rtl.json", "rtl_desk.bundle.css") };
for (const f of Object.values(core)) if (!existsSync(f)) throw new Error("core css missing: " + f);

// ---- Scenarios.
const gen = join(scss, "generated");
const baseFiles = [join(gen, "_tokens.scss"), join(gen, "_scale.scss"), join(scss, "fonts/_plex.scss"), join(gen, "_frappe_map.scss")];
const paletteFile = join(gen, "ins_palette_graphite.bundle.scss");
const modes = [
	{ id: "light", mode: "light", theme: "light", scheme: "light" },
	{ id: "dark", mode: "dark", theme: "dark", scheme: "light" },
	{ id: "automatic-light", mode: "automatic", theme: "automatic", scheme: "light" },
	{ id: "automatic-dark", mode: "automatic", theme: "automatic", scheme: "dark" },
];
const palettes = [
	{ id: "midad", order: ["core", "desk"], files: baseFiles },
	{ id: "graphite-after", order: ["core", "desk", "graphite"], files: [...baseFiles, paletteFile] },
	{ id: "graphite-before", order: ["core", "graphite", "desk"], files: [...baseFiles, paletteFile] },
	// upgrade-phase2 item 6: the other installed app's rules (harness/second_app.css) load after ins_desk.
	{ id: "second-app", order: ["core", "desk", "other"], files: baseFiles },
];
const colorScheme = { light: "light", dark: "dark", automatic: "light dark" };

const html = readFileSync(join(here, "harness/fixture.html"), "utf8");
function pageFor(dir, pal, mode) {
	const sheet = { core: core[dir === "rtl" ? "rtl" : "ltr"], desk: built.desk[dir], graphite: built.graphite[dir], other: join(here, "harness/second_app.css") };
	const links = pal.order.map((k) => `<link rel="stylesheet" href="${pathToFileURL(sheet[k])}">`).join("\n");
	const file = join(outDir, `page-${dir}-${pal.id}-${mode.id}.html`);
	writeFileSync(file, html.replace("{{LINKS}}", links).replace("{{DIR}}", dir).replace("{{LANG}}", dir === "rtl" ? "ar" : "en")
		.replace("{{MODE}}", mode.mode).replace("{{THEME}}", mode.theme));
	return file;
}

const results = [];
const V52 = ["16.52.0"];
const record = (scenario, check, expected, actual, pass, versions) => results.push({ version: tag, versions: versions || ["16.32.0", "16.52.0"], scenario, check, expected, actual, pass });
// Core CSS is minified (`[data-variant=solid]`), so quotes are dropped on both sides before looking for a selector.
const coreText = Object.fromEntries(Object.entries(core).map(([k, f]) => [k, readFileSync(f, "utf8").replace(/["']/g, "")]));
const fixtureV52 = readFileSync(join(here, "harness/fixture_v52.html"), "utf8");

// ---- v16.52.0 assertions (ADR 0011 R6 "New for v16.52.0"). Fixture markup is quoted from v16.52.0 source in the fixture's comments.
// `selects` fails when a selector matches nothing: the fixture must contain it, and the compiled core CSS must still carry a rule that mentions it.
// ---- Round-4 fix 1, both versions: N1 (16.32.0 renders as in round 3) and N8 (generic class names are not styled). Fixture: harness/fixture_fix1.html.
const fixtureFix1 = readFileSync(join(here, "harness/fixture_fix1.html"), "utf8");
async function fix1(page, scenario) {
	await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });
	const rec = (check, expected, actual, pass) => record(scenario, check, expected, actual, pass);
	await page.evaluate((html) => { const d = document.createElement("div"); d.id = "fix1"; d.innerHTML = html; document.body.append(d); }, fixtureFix1);
	const tok = (n, prop) => page.evaluate(([n, prop]) => { const e = document.createElement("i"); e.style[prop] = `var(${n})`; document.body.append(e); const c = getComputedStyle(e)[prop]; e.remove(); return c; }, [n, prop]);
	const st = (id, p) => page.evaluate(([id, p]) => getComputedStyle(document.getElementById(id))[p], [id, p]);
	const border = await tok("--ins-border", "color");
	rec("gantt .tick.thick keeps the round-3 line colour (--ins-border)", border, await st("fx-tick-thick", "stroke"), (await st("fx-tick-thick", "stroke")) === border);
	await page.keyboard.press("Shift");
	const offset = async (id) => { await page.evaluate((i) => document.getElementById(i).focus(), id); return page.evaluate((i) => { const s = getComputedStyle(document.getElementById(i)); return `${s.outlineStyle} ${s.outlineOffset}`; }, id); };
	const o32 = await offset("fx-sb32-a"), o52 = await offset("fx-sb52-a");
	rec("sidebar focus ring without standard-items-band (16.32.0 markup): outside, offset 2px", "solid 2px", o32, o32 === "solid 2px");
	rec("sidebar focus ring with standard-items-band (v16.52.0 markup): inside, offset -2px", "solid -2px", o52, o52 === "solid -2px");
	await page.evaluate(() => document.activeElement?.blur());
	const sec = await tok("--ins-text-secondary", "color");
	rec("About dialog copy button glyph strokes in --ins-text-secondary (round 3)", sec, await st("fx-about-icon", "stroke"), (await st("fx-about-icon", "stroke")) === sec);
	// Core's own v16.52.0 rules may style a class-only element, so the check is that the THEME's values are not applied.
	const fd = await page.evaluate(() => { const s = getComputedStyle(document.getElementById("fx-foreign-dock")); return { w: s.borderTopWidth, c: s.borderTopColor, r: s.borderTopLeftRadius }; });
	const lg = await page.evaluate(() => { const e = document.createElement("i"); e.style.borderRadius = "var(--ins-radius-lg)"; document.body.append(e); const r = getComputedStyle(e).borderTopLeftRadius; e.remove(); return r; });
	rec("foreign .dock: the theme hairline and overlay radius are not applied", `not (1px ${border} ${lg})`, `${fd.w} ${fd.c} ${fd.r}`, !(fd.w === "1px" && fd.c === border && fd.r === lg));
	const elev = await tok("--ins-elevation-overlay", "boxShadow");
	rec("foreign .sidebar-panel: the theme overlay shadow is not applied", `!= ${elev}`, await st("fx-foreign-panel", "boxShadow"), (await st("fx-foreign-panel", "boxShadow")) !== elev);
	const sm = await page.evaluate(() => { const e = document.createElement("i"); e.style.borderRadius = "var(--ins-radius-sm)"; document.body.append(e); const r = getComputedStyle(e).borderTopLeftRadius; e.remove(); return r; });
	rec("foreign .panel-header-actions span: the theme radius is not applied", `!= ${sm}`, await st("fx-foreign-span", "borderTopLeftRadius"), (await st("fx-foreign-span", "borderTopLeftRadius")) !== sm);
}

// ---- Round-4 accessibility fix 2 (items 2, 4, 5, 6, 7, 12). Fixture: harness/fixture_fix2.html. Items 2, 5, 6, 7 and the dock exist on v16.52.0 only.
const fixtureFix2 = readFileSync(join(here, "harness/fixture_fix2.html"), "utf8");
async function fix2(page, scenario) {
	const rec = (check, expected, actual, pass, versions) => record(scenario, check, expected, actual, pass, versions);
	await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });
	await page.evaluate((html) => { const d = document.createElement("div"); d.id = "fix2"; d.innerHTML = html; document.body.append(d); }, fixtureFix2);
	const tok = (n, prop) => page.evaluate(([n, prop]) => { const e = document.createElement("i"); e.style[prop] = `var(${n})`; document.body.append(e); const c = getComputedStyle(e)[prop]; e.remove(); return c; }, [n, prop]);
	const cs = (id, props, pseudo) => page.evaluate(([id, props, pseudo]) => { const s = getComputedStyle(document.getElementById(id), pseudo || null); return Object.fromEntries(props.map((p) => [p, s[p]])); }, [id, props, pseudo]);
	// 12: the literal 420 is replaced by the regular weight (both versions).
	const reg = await tok("--ins-weight-regular", "fontWeight");
	for (const id of ["fx2-outline", "fx2-kbd"]) rec(`#${id}: literal 420 replaced by --ins-weight-regular`, reg, (await cs(id, ["fontWeight"])).fontWeight, (await cs(id, ["fontWeight"])).fontWeight === reg);
	if (only(["16.32.0"])) { const w = (await cs("fx2-outline-app", ["fontWeight"])).fontWeight; rec("another app's .btn-outline outside core containers keeps core's literal 420", "420", w, w === "420", ["16.32.0"]); }
	if (!only(V52)) return;
	const r52 = (check, expected, actual, pass) => rec(check, expected, actual, pass, V52);
	// 2: the drawn stroke of the toast icon is the status ink (stroke == color == --ins-status-*-solid).
	for (const [t, fam] of [["success", "success"], ["error", "danger"]]) {
		const want = await tok(`--ins-status-${fam}-solid`, "color"), got = await cs(`fx2-toast-icon-${t}`, ["stroke", "color"]);
		r52(`.es-toast[data-type=${t}] icon: stroke = --ins-status-${fam}-solid`, want, `${got.stroke} / color ${got.color}`, got.stroke === want && got.color === want);
	}
	// 5: control height from the theme scale (comfortable 32px here; compact and coarse come from the same token in _scale.scss).
	const h = await tok("--ins-control-height", "height"), hs = await tok("--ins-control-height-sm", "height");
	for (const [id, want] of [["fx2-bt-default", h], ["fx2-bt-md", h], ["fx2-bt-xs", hs]]) r52(`#${id} height = ${want === h ? "--ins-control-height" : "--ins-control-height-sm"}`, want, (await cs(id, ["height"])).height, (await cs(id, ["height"])).height === want);
	const ib = await cs("fx2-bt-icon", ["width", "height"]);
	r52("icon button is square at --ins-control-height", `${h} x ${h}`, `${ib.width} x ${ib.height}`, ib.width === h && ib.height === h);
	const pm = await cs("fx2-pill-off", ["minHeight", "height"]);
	r52("page-size pill min-height = --ins-control-height-sm, rendered height >= it", `>= ${hs}`, `${pm.height} (min ${pm.minHeight})`, pm.minHeight === hs && parseFloat(pm.height) >= parseFloat(hs));
	// 6: the pressed pill has a ring in --ins-border-control and the medium weight; the idle pill has neither.
	const on = await cs("fx2-pill-on", ["boxShadow", "fontWeight"]), off = await cs("fx2-pill-off", ["boxShadow", "fontWeight"]);
	const bc = await tok("--ins-border-control", "color"), med = await tok("--ins-weight-medium", "fontWeight");
	r52("pressed pill: inset 1px ring in --ins-border-control and medium weight", `${bc} inset 0 0 0 1px | ${med}`, `${on.boxShadow} | ${on.fontWeight}`, on.boxShadow === `${bc} 0px 0px 0px 1px inset` && on.fontWeight === med);
	r52("idle pill: no ring, not the pressed weight", `shadow none, weight != ${med}`, `${off.boxShadow} | ${off.fontWeight}`, off.boxShadow === "none" && off.fontWeight !== med);
	// 7: disabled buttons: dashed boundary (solid in the control colour, subtle in the hairline), different from each other, text on the disabled pair.
	const ds = await cs("fx2-dis-solid", ["borderTopStyle", "borderTopWidth", "borderTopColor", "color"]), db = await cs("fx2-dis-subtle", ["borderTopStyle", "borderTopWidth", "borderTopColor", "color"]);
	const td = await tok("--ins-text-disabled", "color");
	r52("disabled solid .es-button: 2px dashed boundary in --ins-border-control, text --ins-text-disabled", `dashed 2px ${bc} ${td}`, `${ds.borderTopStyle} ${ds.borderTopWidth} ${ds.borderTopColor} ${ds.color}`, ds.borderTopStyle === "dashed" && ds.borderTopWidth === "2px" && ds.borderTopColor === bc && ds.color === td);
	r52("disabled subtle .es-button: 1px dashed boundary in --ins-border-control, text --ins-text-disabled", `dashed 1px ${bc} ${td}`, `${db.borderTopStyle} ${db.borderTopWidth} ${db.borderTopColor} ${db.color}`, db.borderTopStyle === "dashed" && db.borderTopWidth === "1px" && db.borderTopColor === bc && db.color === td);
	r52("disabled solid and subtle are distinguishable (boundary width differs)", "2px vs 1px", `${ds.borderTopWidth} vs ${db.borderTopWidth}`, ds.borderTopWidth !== db.borderTopWidth);
	// 4: forced colours: the accent bar of the current sidebar row and dock tile is a system colour, and the row takes an outline; the pressed pill a border.
	await page.emulateMedia({ forcedColors: "active", reducedMotion: "no-preference" });
	const hl = await page.evaluate(() => { const e = document.createElement("i"); e.style.cssText = "forced-color-adjust:none;background-color:Highlight"; document.body.append(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; });
	for (const id of ["fx2-sb-active", "fx2-dock-active"]) {
		const bar = await cs(id, ["backgroundColor"], "::before"), o = await cs(id, ["outlineStyle", "outlineWidth"]);
		r52(`forced colours: #${id} bar = Highlight and a 1px outline`, `${hl} | solid 1px`, `${bar.backgroundColor} | ${o.outlineStyle} ${o.outlineWidth}`, bar.backgroundColor === hl && o.outlineStyle === "solid" && o.outlineWidth === "1px");
	}
	const pb = await cs("fx2-pill-on", ["borderTopStyle", "borderTopWidth"]), pi = await cs("fx2-pill-off", ["borderTopStyle"]);
	r52("forced colours: pressed pill has a 1px solid border, idle pill none", "solid 1px | none", `${pb.borderTopStyle} ${pb.borderTopWidth} | ${pi.borderTopStyle}`, pb.borderTopStyle === "solid" && pb.borderTopWidth === "1px" && pi.borderTopStyle === "none");
	await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });
}

async function v1652(page, dir, scenario) {
	const rec = (check, expected, actual, pass) => record(scenario, check, expected, actual, pass, V52);
	await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });
	await page.evaluate((html) => { const d = document.createElement("div"); d.id = "v52"; d.innerHTML = html; document.body.append(d); }, fixtureV52);
	const selects = async (label, selector, coreNeedle) => {
		const n = await page.evaluate((s) => document.querySelectorAll(s).length, selector);
		const inCore = coreText[dir].includes(coreNeedle.replace(/["']/g, ""));
		rec(`selector matches: ${label}`, "fixture >= 1 and core CSS rule present", `${selector}: ${n} in fixture, core rule ${inCore}`, n > 0 && inCore);
	};
	const tok = (n, prop) => page.evaluate(([n, prop]) => { const e = document.createElement("i"); e.style[prop] = `var(${n})`; document.body.append(e); const c = getComputedStyle(e)[prop]; e.remove(); return c; }, [n, prop]);
	const cs = (id, props, pseudo) => page.evaluate(([id, props, pseudo]) => { const s = getComputedStyle(document.getElementById(id), pseudo || null); return Object.fromEntries(props.map((p) => [p, s[p]])); }, [id, props, pseudo]);
	const eq = (check, want, got) => rec(check, want, got, want === got);

	// -- solid .es-button (css/espresso/components/button.css:34-37, 149-162; ui/page.html:61)
	await selects("solid .es-button", '.es-button[data-variant="solid"]', '.es-button[data-variant="solid"]');
	const prim = await tok("--ins-primary", "backgroundColor"), primHover = await tok("--ins-primary-hover", "backgroundColor"), onPrim = await tok("--ins-on-primary", "color");
	const btn = await cs("es-solid", ["backgroundColor", "color"]);
	eq(".es-button solid: background = --ins-primary", prim, btn.backgroundColor);
	eq(".es-button solid: text = --ins-on-primary", onPrim, btn.color);
	eq(".es-button glyph strokes in the button text colour (--icon-stroke = currentColor)", onPrim, await page.evaluate(() => getComputedStyle(document.getElementById("es-solid-icon")).stroke));
	await page.hover("#es-solid"); await page.waitForTimeout(400); // core transitions the background
	eq(".es-button solid:hover background = --ins-primary-hover", primHover, (await cs("es-solid", ["backgroundColor"])).backgroundColor);
	await page.mouse.move(0, 0);
	const activeVar = await page.evaluate(() => getComputedStyle(document.getElementById("es-solid")).getPropertyValue("--bt-solid-bg-active").trim());
	eq(".es-button solid: --bt-solid-bg-active resolves to --ins-primary-active", norm(await tok("--ins-primary-active", "color")), norm(await page.evaluate((v) => { const e = document.createElement("i"); e.style.color = v; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; }, activeVar)));
	const red = await cs("es-solid-red", ["backgroundColor"]);
	rec(".es-button[data-theme=red] solid keeps core's red (not primary)", `!= ${prim}`, red.backgroundColor, red.backgroundColor !== prim && red.backgroundColor !== "rgba(0, 0, 0, 0)");
	eq(".es-button subtle: fill = --ins-surface-fill", await tok("--ins-surface-fill", "backgroundColor"), (await cs("es-subtle", ["backgroundColor"])).backgroundColor);
	const dis = await cs("es-disabled", ["backgroundColor", "color"]);
	eq(".es-button:disabled background = --ins-surface-disabled", await tok("--ins-surface-disabled", "backgroundColor"), dis.backgroundColor);
	eq(".es-button:disabled text = --ins-text-disabled", await tok("--ins-text-disabled", "color"), dis.color);

	// -- B1: user tags are not statuses (ui/tags.js:116-124): no shape, the neutral pair, text >= 4.5:1
	await selects(".es-badge.form-tag", ".es-badge.form-tag", ".es-badge[data-theme");
	{
		const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
		const nums = (c) => c.match(/[\d.]+/g).map(Number);
		for (const id of ["tag-green", "tag-red", "tag-violet"]) {
			const g = await cs(id, ["backgroundColor", "color"]), b = await cs(id, ["content"], "::before");
			const [x, y] = [lum(nums(g.color)), lum(nums(g.backgroundColor))].sort((p, q) => q - p);
			const ratio = (x + 0.05) / (y + 0.05);
			rec(`${id}: no status shape`, "none or normal", b.content, b.content === "none" || b.content === "normal");
			rec(`${id}: neutral pair`, `${await tok("--ins-status-neutral-bg", "backgroundColor")} ${await tok("--ins-status-neutral-fg", "color")}`, `${g.backgroundColor} ${g.color}`,
				g.backgroundColor === (await tok("--ins-status-neutral-bg", "backgroundColor")) && g.color === (await tok("--ins-status-neutral-fg", "color")));
			rec(`${id}: text contrast >= 4.5`, ">= 4.5", ratio.toFixed(2), ratio >= 4.5);
		}
	}

	// -- .es-badge (badge.css:7-14, 55-89; badge-legacy-colors.css:12-45; list_view.js:1896; page.js:259)
	await selects(".es-badge[data-theme]", ".es-badge[data-theme]", '.es-badge[data-theme="green"]');
	await selects(".es-badge.page-indicator-pill", ".es-badge.page-indicator-pill", ".page-indicator-pill");
	// theme: [status family, shape]. Independent of the SCSS map: the design's status language (BRIEF 3 rule 1).
	const badges = { gray: ["neutral", "ring"], grey: ["neutral", "ring"], darkgrey: ["muted", "ring"], green: ["success", "check"], red: ["danger", "cross"], amber: ["pending", "half"],
		orange: ["pending", "half"], yellow: ["warning", "bars"], blue: ["progress", "dot"], "light-blue": ["info", "dot"], cyan: ["teal", "dot"], violet: ["plum", "diamond"],
		purple: ["special", "diamond"], pink: ["plum", "diamond"] };
	const shape = {
		check: (x) => x.borderRightWidth === "2px" && x.transform !== "none",
		cross: (x) => (x.backgroundImage.match(/linear-gradient/g) || []).length === 2,
		half: (x) => /linear-gradient/.test(x.backgroundImage) && /50%|4\.5px/.test(x.borderTopLeftRadius),
		bars: (x) => /linear-gradient/.test(x.backgroundImage) && x.borderTopLeftRadius === "0px" && x.width === "9px",
		dot: (x) => x.backgroundColor !== "rgba(0, 0, 0, 0)" && x.width === "8px" && /50%|4px/.test(x.borderTopLeftRadius),
		diamond: (x) => x.width === "7px" && x.transform !== "none" && x.backgroundColor !== "rgba(0, 0, 0, 0)",
		ring: (x) => x.backgroundImage === "none" && /^1(\.5)?px$/.test(x.borderTopWidth) && x.width === "9px",
	};
	for (const [theme, [family, kind]] of Object.entries(badges)) {
		const id = `badge-${theme}`;
		const got = await cs(id, ["backgroundColor", "color", "borderTopColor"]);
		const want = { bg: await tok(`--ins-status-${family}-bg`, "backgroundColor"), fg: await tok(`--ins-status-${family}-fg`, "color"), line: await tok(`--ins-status-${family}-border`, "color") };
		rec(`.es-badge ${theme}: fill, text and line = status ${family}`, `${want.bg} ${want.fg} ${want.line}`, `${got.backgroundColor} ${got.color} ${got.borderTopColor}`, got.backgroundColor === want.bg && got.color === want.fg && got.borderTopColor === want.line);
		const sh = await cs(id, ["content", "display", "width", "borderRightWidth", "borderTopWidth", "borderTopLeftRadius", "backgroundImage", "backgroundColor", "transform"], "::before");
		rec(`.es-badge ${theme}: shape ${kind}`, kind, `${sh.width} ${sh.borderTopLeftRadius} ${sh.transform}`, sh.content === '""' && shape[kind](sh));
	}
	// Round-4 fix 3 (R1): status look only on status hosts. A Kanban v2 tag and a shortcut count carry data-theme but are not statuses.
	for (const id of ["tag-kanban", "count-shortcut"]) {
		const g = await cs(id, ["backgroundColor", "color"]), b = await cs(id, ["content"], "::before");
		rec(`${id} (data-theme, not a status host): neutral pair and no shape`, `${await tok("--ins-status-neutral-bg", "backgroundColor")}, no ::before`, `${g.backgroundColor}, ${b.content}`,
			g.backgroundColor === (await tok("--ins-status-neutral-bg", "backgroundColor")) && g.color === (await tok("--ins-status-neutral-fg", "color")) && (b.content === "none" || b.content === "normal"));
	}
	{
		const g = await cs("badge-side", ["backgroundColor"]), b = await cs("badge-side", ["content", "borderRightWidth"], "::before");
		rec("side-panel status badge: success fill and check", await tok("--ins-status-success-bg", "backgroundColor"), g.backgroundColor, g.backgroundColor === (await tok("--ins-status-success-bg", "backgroundColor")) && b.content === '""' && b.borderRightWidth === "2px");
		const l = await cs("badge-green", ["backgroundColor"]), lb = await cs("badge-green", ["content"], "::before");
		rec("list status (data-filter, theme green): success fill and a shape", await tok("--ins-status-success-bg", "backgroundColor"), l.backgroundColor, l.backgroundColor === (await tok("--ins-status-success-bg", "backgroundColor")) && lb.content === '""');
	}
	// Round 5: Kanban v1 column dot, the embedded-list cell (stays neutral) and the side-panel Draft (a11y/upgrade round-4 F1, F2, F3).
	{
		const successBg = await tok("--ins-status-success-bg", "backgroundColor");
		{
			const g = await cs("badge-kanban-dot", ["backgroundColor"]), b = await cs("badge-kanban-dot", ["content", "borderRightWidth"], "::before");
			rec("badge-kanban-dot (status host, theme green): success fill and check", successBg, g.backgroundColor, g.backgroundColor === successBg && b.content === '""' && b.borderRightWidth === "2px");
		}
		{
			const g = await cs("badge-embedded", ["backgroundColor"]), b = await cs("badge-embedded", ["content"], "::before");
			rec("embedded-list cell (data-theme, not a status host): neutral fill and no shape", `${await tok("--ins-status-neutral-bg", "backgroundColor")}, no ::before`, `${g.backgroundColor}, ${b.content}`,
				g.backgroundColor === (await tok("--ins-status-neutral-bg", "backgroundColor")) && (b.content === "none" || b.content === "normal"));
		}
		const svg = await cs("kanban-dot-svg", ["display"]);
		rec("Kanban dot: core's circle svg is hidden (the shape replaces it)", "none", svg.display, svg.display === "none");
		const c = await cs("badge-kanban-count", ["backgroundColor"]), cb = await cs("badge-kanban-count", ["content"], "::before");
		rec("Kanban column count (data-theme, not a status host): neutral fill and no shape", `${await tok("--ins-status-neutral-bg", "backgroundColor")}, no ::before`, `${c.backgroundColor}, ${cb.content}`,
			c.backgroundColor === (await tok("--ins-status-neutral-bg", "backgroundColor")) && (cb.content === "none" || cb.content === "normal"));
		const sd = await cs("badge-side-draft", ["backgroundColor", "color"]), sdb = await cs("badge-side-draft", ["backgroundImage"], "::before");
		rec("side-panel Draft (data-ins-filter docstatus,=,0, red): neutral pair, ring", await tok("--ins-status-neutral-bg", "backgroundColor"), sd.backgroundColor, sd.backgroundColor === (await tok("--ins-status-neutral-bg", "backgroundColor")) && sd.color === (await tok("--ins-status-neutral-fg", "color")) && sdb.backgroundImage === "none");
	}
	const pill = await cs("badge-page", ["backgroundColor", "color"]), pillBefore = await cs("badge-page", ["content", "borderRightWidth", "transform"], "::before");
	rec("page-status chip (.es-badge.page-indicator-pill green): success pair and check", `${await tok("--ins-status-success-bg", "backgroundColor")} ${await tok("--ins-status-success-fg", "color")}`, `${pill.backgroundColor} ${pill.color}`,
		pill.backgroundColor === (await tok("--ins-status-success-bg", "backgroundColor")) && pill.color === (await tok("--ins-status-success-fg", "color")) && pillBefore.borderRightWidth === "2px");
	const pillGray = await cs("badge-page-gray", ["backgroundColor", "color"]), pillGrayBefore = await cs("badge-page-gray", ["content", "width"], "::before");
	rec("page-status chip without data-theme: neutral pair and a shape", await tok("--ins-status-neutral-bg", "backgroundColor"), pillGray.backgroundColor, pillGray.backgroundColor === (await tok("--ins-status-neutral-bg", "backgroundColor")) && pillGrayBefore.content === '""');
	const plain = await cs("badge-plain", ["backgroundColor"]), plainBefore = await cs("badge-plain", ["content"], "::before");
	rec("plain .es-badge (no theme, not the page chip): neutral fill, no shape", `${await tok("--ins-status-neutral-bg", "backgroundColor")}, no ::before`, `${plain.backgroundColor}, ${plainBefore.content}`,
		plain.backgroundColor === (await tok("--ins-status-neutral-bg", "backgroundColor")) && (plainBefore.content === "none" || plainBefore.content === "normal"));
	const d0 = await cs("badge-draft", ["backgroundColor", "color"]), d0b = await cs("badge-draft", ["backgroundImage", "borderTopWidth"], "::before");
	rec("Draft badge (list data-filter docstatus,=,0): neutral pair, ring", await tok("--ins-status-neutral-bg", "backgroundColor"), d0.backgroundColor, d0.backgroundColor === (await tok("--ins-status-neutral-bg", "backgroundColor")) && d0.color === (await tok("--ins-status-neutral-fg", "color")) && d0b.backgroundImage === "none");
	const d2 = await cs("badge-cancelled", ["backgroundColor", "color"]), d2b = await cs("badge-cancelled", ["borderTopLeftRadius"], "::before");
	rec("Cancelled badge (list data-filter docstatus,=,2): muted pair, square", await tok("--ins-status-muted-bg", "backgroundColor"), d2.backgroundColor, d2.backgroundColor === (await tok("--ins-status-muted-bg", "backgroundColor")) && d2b.borderTopLeftRadius === "1px");
	const t0 = await cs("badge-title-draft", ["backgroundColor"]), t0b = await cs("badge-title-draft", ["backgroundImage"], "::before");
	rec("Draft chip in the form title (data-ins-docstatus=0, red): neutral pair, ring", await tok("--ins-status-neutral-bg", "backgroundColor"), t0.backgroundColor, t0.backgroundColor === (await tok("--ins-status-neutral-bg", "backgroundColor")) && t0b.backgroundImage === "none");
	const t2 = await cs("badge-title-cancelled", ["backgroundColor"]), t2b = await cs("badge-title-cancelled", ["borderTopLeftRadius"], "::before");
	rec("Cancelled chip in the form title (data-ins-docstatus=2, red): muted pair, square", await tok("--ins-status-muted-bg", "backgroundColor"), t2.backgroundColor, t2.backgroundColor === (await tok("--ins-status-muted-bg", "backgroundColor")) && t2b.borderTopLeftRadius === "1px");

	// -- sidebar, its active row and label weights (sidebar.scss:65, 167-177, 544-551)
	await selects("sidebar panel", ".body-sidebar-container .body-sidebar", ".body-sidebar-container");
	await selects("active sidebar row", ".standard-sidebar-item.active-sidebar", ".active-sidebar");
	eq("sidebar panel background (--desk-sidebar-bg) = --ins-surface-sunken", await tok("--ins-surface-sunken", "backgroundColor"), (await cs("sb-panel", ["backgroundColor"])).backgroundColor);
	const act = await cs("sb-active", ["boxShadow", "borderTopLeftRadius"]);
	rec("active sidebar row: hairline ring, no drop shadow, small radius", `0 0 0 1px ${await tok("--ins-border", "color")} | ${await tok("--ins-radius-sm", "borderTopLeftRadius")}`, `${act.boxShadow} | ${act.borderTopLeftRadius}`,
		act.boxShadow === `${await tok("--ins-border", "color")} 0px 0px 0px 1px` && act.borderTopLeftRadius === (await tok("--ins-radius-sm", "borderTopLeftRadius")));
	const al = await cs("sb-active-label", ["fontWeight", "color"]);
	eq("active sidebar label: strong weight", String(await page.evaluate(() => { const e = document.createElement("i"); e.style.fontWeight = "var(--ins-weight-strong)"; document.body.append(e); const w = getComputedStyle(e).fontWeight; e.remove(); return w; })), al.fontWeight);
	eq("active sidebar label colour = --ins-text-strong", await tok("--ins-text-strong", "color"), al.color);
	const il = await cs("sb-idle-label", ["fontWeight"]);
	eq("idle sidebar label weight = --font-weight-regular (mapped to the regular weight)", String(await page.evaluate(() => { const e = document.createElement("i"); e.style.fontWeight = "var(--ins-weight-regular)"; document.body.append(e); const w = getComputedStyle(e).fontWeight; e.remove(); return w; })), il.fontWeight);

	// -- menu highlight (menu.css:109-111) and the menu panel
	await selects("menu highlight", ".es-menu__item[data-highlighted]", ".es-menu__item[data-highlighted]");
	eq(".es-menu__item[data-highlighted] background = --ins-surface-hover", await tok("--ins-surface-hover", "backgroundColor"), (await cs("menu-hi", ["backgroundColor"])).backgroundColor);
	const pan = await cs("menu-panel", ["backgroundColor", "borderTopColor"]);
	eq(".es-menu panel background = --ins-surface-overlay", await tok("--ins-surface-overlay", "backgroundColor"), pan.backgroundColor);

	// -- toast (toast.css:34-52, 133-223; ui/components/toast.js:97)
	await selects(".es-toast", ".es-toast", ".es-toast");
	const toast = await cs("toast", ["backgroundColor", "color", "borderTopColor", "borderTopWidth"]);
	eq(".es-toast background = --ins-surface-overlay", await tok("--ins-surface-overlay", "backgroundColor"), toast.backgroundColor);
	eq(".es-toast text = --ins-text", await tok("--ins-text", "color"), toast.color);
	eq(".es-toast border = 1px --ins-border", `1px ${await tok("--ins-border", "color")}`, `${toast.borderTopWidth} ${toast.borderTopColor}`);
	eq(".es-toast__close text = --ins-text", await tok("--ins-text", "color"), (await cs("toast-close", ["color"])).color);
	await page.hover("#toast-action"); await page.waitForTimeout(400);
	eq(".es-toast__action:hover background = --ins-surface-hover", await tok("--ins-surface-hover", "backgroundColor"), (await cs("toast-action", ["backgroundColor"])).backgroundColor);
	await page.mouse.move(0, 0);

	// -- .form-control radius: core reads `var(--radius)` (scss/common/form.scss:5), mapped to the small radius
	eq(".form-control radius = --ins-radius-sm", await tok("--ins-radius-sm", "borderTopLeftRadius"), (await cs("field", ["borderTopLeftRadius"])).borderTopLeftRadius);
}

const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
for (const dir of ["ltr", "rtl"]) for (const pal of palettes) for (const mode of modes) {
	const scenario = `${dir}/${pal.id}/${mode.id}`;
	const ctx = await browser.newContext({ colorScheme: mode.scheme });
	const page = await ctx.newPage();
	await page.goto(pathToFileURL(pageFor(dir, pal, mode)).href);

	// 1. Every variable the map declares, plus the --ins tokens, resolves to the generated value.
	const decls = layers(pal.files, mode.mode, mode.scheme);
	const names = Object.keys(decls).filter((n) => n.startsWith("--") && !/ins-(duration|z-|ease)/.test(n));
	const actual = await page.evaluate((names) => {
		const cs = getComputedStyle(document.documentElement);
		return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n)]));
	}, names);
	let bad = [];
	for (const n of names) {
		const want = norm(resolveVars(decls[n], decls));
		if (norm(actual[n]) !== want) bad.push({ n, want, got: norm(actual[n]) });
	}
	record(scenario, `all ${names.length} custom properties from generated partials`, "0 mismatches", `${bad.length} mismatches` + (bad.length ? " e.g. " + JSON.stringify(bad.slice(0, 3)) : ""), bad.length === 0);

	// 2. A named representative set, with the literal resolved value recorded.
	const rep = ["--bg-color", "--fg-color", "--text-color", "--border-color", "--control-bg", "--gray-500", "--gray-900", "--primary", "--btn-primary", "--scrollbar-thumb-color", "--text-muted", "--modal-bg", "--focus-default"];
	for (const n of rep) {
		const want = decls[n] === undefined ? null : norm(resolveVars(decls[n], decls));
		const got = await page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n), n);
		record(scenario, n, want, norm(got), want !== null && norm(got) === want);
	}
	const cs = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
	record(scenario, "color-scheme", colorScheme[mode.mode], cs, cs === colorScheme[mode.mode]);

	// 3. Painted values: the body and a control use the mapped colours, not core's literals.
	const px = await page.evaluate(() => {
		const probe = (v, prop) => { const e = document.createElement("i"); e.style[prop] = `var(${v})`; document.body.append(e); const r = getComputedStyle(e)[prop]; e.remove(); return r; };
		return { bg: getComputedStyle(document.documentElement).backgroundColor, bgVar: probe("--bg-color", "backgroundColor"),
			field: getComputedStyle(document.getElementById("field")).backgroundColor, ctl: probe("--control-bg", "backgroundColor"),
			text: getComputedStyle(document.body).color, textVar: probe("--text-muted", "color"), bodyBg: getComputedStyle(document.body).backgroundColor };
	});
	record(scenario, "html background = --bg-color", px.bgVar, px.bg, px.bg === px.bgVar);
	record(scenario, ".form-control background = --control-bg", px.ctl, px.field, px.field === px.ctl);
	record(scenario, "body background (info) = --bg-color", px.bgVar, px.bodyBg, px.bodyBg === px.bgVar);
	record(scenario, "body colour = --text-muted (core body rule)", px.textVar, px.text, px.text === px.textVar);

	// 3b. ADR 0010: fields on surface-field with a control border; buttons keep surface-fill; datatable inputs stay borderless.
	const a10 = await page.evaluate(() => {
		const tok = (n, prop) => { const e = document.createElement("i"); e.style[prop] = `var(${n})`; document.body.append(e); const c = getComputedStyle(e)[prop]; e.remove(); return c; };
		const f = getComputedStyle(document.getElementById("field")), b = getComputedStyle(document.getElementById("btn2")), d = getComputedStyle(document.getElementById("dtfield"));
		return { fBg: f.backgroundColor, fWant: tok("--ins-surface-field", "backgroundColor"), fBd: `${f.borderTopWidth} ${f.borderTopStyle} ${f.borderTopColor}`,
			fBdWant: `1px solid ${tok("--ins-border-control", "color")}`, bBg: b.backgroundColor, bWant: tok("--ins-surface-fill", "backgroundColor"),
			dBd: `${d.borderTopWidth} ${d.borderTopStyle}`, dBg: d.backgroundColor, dWant: tok("--ins-surface-field", "backgroundColor") };
	});
	record(scenario, "ADR0010 .form-control background = surface-field", a10.fWant, a10.fBg, a10.fBg === a10.fWant);
	record(scenario, "ADR0010 .form-control border = 1px solid border-control", a10.fBdWant, a10.fBd, a10.fBd === a10.fBdWant);
	record(scenario, "ADR0010 .btn-default background = surface-fill", a10.bWant, a10.bBg, a10.bBg === a10.bWant);
	record(scenario, "ADR0010 .datatable .form-control has no border", "0px none", a10.dBd, /^0px none$/.test(a10.dBd));

	// 4. Base rules: font-synthesis, scroll-padding, caret, placeholder.
	const b = await page.evaluate(() => {
		const f = document.getElementById("field"), r = document.documentElement;
		const tok = (n) => { const e = document.createElement("i"); e.style.color = `var(${n})`; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; };
		return { fs: getComputedStyle(r).fontSynthesis, sp: getComputedStyle(r).scrollPaddingBlockStart, ph: getComputedStyle(f, "::placeholder").color,
			phWant: tok("--ins-text-placeholder"), caret: getComputedStyle(f).caretColor, caretWant: tok("--ins-text-strong"),
			head: getComputedStyle(r).getPropertyValue("--ins-page-head-height").trim() };
	});
	record(scenario, "font-synthesis", "none", b.fs, /none/.test(b.fs) || b.fs === "none");
	record(scenario, "scroll-padding-block-start = head + 8px", `${parseFloat(b.head) + 8}px`, b.sp, b.sp === `${parseFloat(b.head) + 8}px`);
	record(scenario, "::placeholder colour", b.phWant, b.ph, b.ph === b.phWant);
	record(scenario, "caret-color", b.caretWant, b.caret, b.caret === b.caretWant);

	// 5. One focus ring: reach each control with Tab so :focus-visible applies.
	const ringWant = await page.evaluate(() => { const e = document.createElement("i"); e.style.color = "var(--ins-focus)"; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; });
	const order = ["btn", "field", "badge", "check", "select", "dtbtn"];
	await page.evaluate(() => document.activeElement?.blur());
	for (const id of order) {
		await page.keyboard.press("Tab");
		const got = await page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { id: e.id, w: s.outlineWidth, st: s.outlineStyle, c: s.outlineColor, o: s.outlineOffset, bs: s.boxShadow }; });
		const inside = id === "dtbtn";
		const ok = got.id === id && got.w === "2px" && got.st === "solid" && got.c === ringWant && got.o === (inside ? "-2px" : "2px");
		record(scenario, `focus ring on #${id}`, `2px solid ${ringWant} offset ${inside ? "-2px" : "2px"}`, `${got.id}: ${got.w} ${got.st} ${got.c} offset ${got.o}`, ok);
		record(scenario, `no second ring (box-shadow) on #${id}`, "none or non-focus shadow only", got.bs, !/0px 0px 0px 2px/.test(got.bs.replace(/rgb[a]?\([^)]*\)/g, "")) || got.bs === "none");
	}
	const modal = await page.evaluate(() => { const m = document.getElementById("modalshell"); m.focus(); return getComputedStyle(m).outlineStyle; });
	record(scenario, "modal shell is not ringed", "none", modal, modal === "none");

	// 6. Reduced motion and forced colours (re-evaluated on the same page).
	await page.emulateMedia({ reducedMotion: "reduce" });
	const rm = await page.evaluate(() => { const s = getComputedStyle(document.querySelector(".page-head")); return { t: s.transitionDuration, d: getComputedStyle(document.documentElement).getPropertyValue("--ins-duration").trim() }; });
	record(scenario, "reduced-motion: .page-head transition collapsed", "0.00001s", rm.t, parseFloat(rm.t) <= 0.00002);
	record(scenario, "reduced-motion: --ins-duration", "0ms", rm.d, rm.d === "0ms");
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const nm = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ins-duration").trim());
	record(scenario, "no-preference: --ins-duration", "160ms", nm, nm === "160ms");

	// 5b. Checkboxes in clipped containers: the ring must stay visible on checked and unchecked boxes.
	const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
	const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
	const checkIds = ["dt-off", "dt-on", "gr-off", "gr-on", "ls-off", "ls-on"];
	for (const id of checkIds) {
		await page.evaluate(() => document.activeElement?.blur());
		let reached = false;
		for (let i = 0; i < 40 && !reached; i++) { await page.keyboard.press("Tab"); reached = await page.evaluate((id) => document.activeElement.id === id, id); }
		const c = await page.evaluate(() => {
			const e = document.activeElement, s = getComputedStyle(e);
			const rgb = (v) => v.match(/[\d.]+/g).map(Number);
			let n = e.parentElement, bg = null;
			while (n && !bg) { const col = getComputedStyle(n).backgroundColor; const m = rgb(col); if (m.length < 4 || m[3] === 1) bg = m.slice(0, 3); n = n.parentElement; }
			const probe = (v) => { const i = document.createElement("i"); i.style.color = `var(${v})`; document.body.append(i); const r = getComputedStyle(i).color; i.remove(); return rgb(r).slice(0, 3); };
			return { id: e.id, w: s.outlineWidth, st: s.outlineStyle, off: s.outlineOffset, ring: rgb(s.outlineColor).slice(0, 3), bg, fill: probe("--primary"), checked: e.checked,
				rowBgs: ["--ins-surface-base", "--ins-surface-hover", "--ins-surface-selected", "--ins-surface-selected-strong"].map((v) => [v, probe(v)]) };
		});
		const ok = reached && c.w === "2px" && c.st === "solid" && c.off === "2px";
		record(scenario, `checkbox #${id} (${c.checked ? "checked" : "unchecked"}): ring 2px solid, offset +2px (outside the box)`, "2px solid offset 2px", `${c.w} ${c.st} offset ${c.off}`, ok);
		const rBg = ratio(c.ring, c.bg);
		record(scenario, `checkbox #${id}: ring vs effective background >= 3`, ">= 3", rBg.toFixed(2), rBg >= 3);
		for (const [name, rgb] of c.rowBgs) { const r = ratio(c.ring, rgb); record(scenario, `checkbox #${id}: ring vs ${name} >= 3`, ">= 3", r.toFixed(2), r >= 3); }
		if (c.checked) { const rf = ratio(c.ring, c.fill); record(scenario, `checkbox #${id}: ring vs checked fill (info; ring is outside, fill is not adjacent)`, "info", rf.toFixed(2), true); }
	}
	// Border widths below 2px compute to 1px at device-pixel ratio 1, so the 1.5px ring is asserted as 1px or 1.5px.
	// Second app (findings 8): its (0,2,0) and (0,3,0) `.btn-primary` rules and its (0,1,1) --font-stack must lose to the theme.
	const sa = await page.evaluate(() => {
		const tok = (n) => { const e = document.createElement("i"); e.style.backgroundColor = `var(${n})`; document.body.append(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; };
		const r = getComputedStyle(document.documentElement);
		return { bg: getComputedStyle(document.getElementById("act-approve")).backgroundColor, primary: tok("--ins-primary"), stack: r.getPropertyValue("--font-stack").trim(), sans: r.getPropertyValue("--ins-font-sans").trim(), hoverWant: tok("--ins-primary-hover") };
	});
	record(scenario, ".btn-primary background = --ins-primary (beats [data-theme=light] .btn-primary)", sa.primary, sa.bg, sa.bg === sa.primary);
	record(scenario, "--font-stack = --ins-font-sans (beats html[lang=ar] --font-stack)", sa.sans, sa.stack, sa.stack === sa.sans);
	await page.hover("#act-approve");
	const hv = await page.evaluate(() => getComputedStyle(document.getElementById("act-approve")).backgroundColor);
	record(scenario, ".btn-primary:hover background = --ins-primary-hover", sa.hoverWant, hv, hv === sa.hoverWant);
	await page.mouse.move(0, 0);
	// Autofill cover must survive focus: the reset is skipped for :-webkit-autofill, so the rule text is the proof available headless.
	const afRule = await page.evaluate(() => [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } }).filter((r) => r.selectorText && /box-shadow/.test(r.cssText) && /focus-visible/.test(r.selectorText) && /autofill/.test(r.selectorText)).length);
	record(scenario, "box-shadow reset excludes :-webkit-autofill", ">= 1 rule", String(afRule), afRule >= 1);

	// 7. Phase 3 (css-C): descendants that core re-declares (upgrade-phase2 item 4), control states, status shapes, actions, masking, tabs, Arabic typography.
	const p3 = await page.evaluate(() => {
		const tok = (n, prop) => { const e = document.createElement("i"); e.style[prop] = `var(${n})`; document.body.append(e); const c = getComputedStyle(e)[prop]; e.remove(); return c; };
		const $ = (id) => document.getElementById(id);
		const cs = (id, pseudo) => getComputedStyle($(id), pseudo || null);
		const v = (id, name) => getComputedStyle($(id)).getPropertyValue(name).trim();
		const px = (name) => { const e = document.createElement("i"); e.style.width = `var(${name})`; document.body.append(e); const w = getComputedStyle(e).width; e.remove(); return w; };
		const o = {};
		// descendants
		o.scope = {};
		for (const id of ["modal2", "fig", "erow"]) o.scope[id] = { control: tok("--control-bg", "backgroundColor"), got: (() => { const e = document.createElement("i"); e.style.backgroundColor = v(id, "--control-bg"); document.body.append(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; })() };
		o.fieldWant = tok("--ins-surface-field", "backgroundColor");
		o.fieldBg = { modal: cs("modalfield").backgroundColor, fig: cs("figfield").backgroundColor, erow: cs("erowfield").backgroundColor };
		o.btnInModal = cs("modalbtn2").backgroundColor; o.fillWant = tok("--ins-surface-fill", "backgroundColor");
		o.modalBorder = (() => { const e = document.createElement("i"); e.style.color = v("modal2", "--border-color"); document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; })();
		o.hairWant = tok("--ins-border-hairline", "color");
		o.chart = { stroke: v("chart", "--charts-stroke-width"), circle: (() => { const e = document.createElement("i"); e.style.color = v("chart", "--charts-dataset-circle-stroke"); document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; })(), circleW: (() => { const e = document.createElement("i"); e.style.width = v("chart", "--charts-dataset-circle-stroke-width"); document.body.append(e); const c = getComputedStyle(e).width; e.remove(); return c; })() };
		o.raisedWant = tok("--ins-surface-raised", "color");
		o.disabledBgVar = (() => { const e = document.createElement("i"); e.style.backgroundColor = v("erow", "--input-disabled-bg"); document.body.append(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; })();
		o.disabledWant = tok("--ins-surface-disabled", "backgroundColor");
		// states
		const b = (id) => { const s = cs(id); return { w: s.borderTopWidth, st: s.borderTopStyle, c: s.borderTopColor, bbs: s.borderBottomStyle, bbc: s.borderBottomColor, bg: s.backgroundColor, color: s.color, sh: s.boxShadow, cur: s.cursor }; };
		o.dis = b("dis"); o.ro = b("ro"); o.rov = b("rov"); o.err = b("errfield"); o.dtdis = b("dtdis"); o.erowdis = b("erowdis"); o.masked = b("maskedvalue");
		o.t = { disabledBg: tok("--ins-surface-disabled", "backgroundColor"), dim: tok("--ins-text-disabled", "color"), dash: tok("--ins-border", "color"), hair: tok("--ins-border-hairline", "color"), strong: tok("--ins-text-strong", "color"), danger: tok("--ins-danger", "color"), strongBorder: tok("--ins-border-strong", "color") };
		o.maskAfter = { content: cs("masked", "::after").content, text: document.getElementById("maskedreason").textContent, display: cs("maskedreason").display, size: cs("maskedreason").fontSize };
		o.maskLock = cs("masked", "::before").content; o.maskLabelLock = getComputedStyle(document.querySelector("#masked .control-label"), "::before").content;
		// status
		const ps = (id) => { const s = cs(id, "::before"); return { content: s.content, display: s.display, bw: s.borderRightWidth, bblw: s.borderBottomWidth, radius: s.borderTopLeftRadius, bgi: s.backgroundImage, bg: s.backgroundColor, tf: s.transform, w: s.width, h: s.height }; };
		o.pill = Object.fromEntries(["pill-green", "pill-red", "pill-orange", "pill-black", "pill-draft", "pill-cancelled", "pill-title-draft", "pill-title-cancelled"].map((id) => [id, ps(id)]));
		o.pillBg = { draft: cs("pill-draft").backgroundColor, neutral: tok("--ins-status-neutral-bg", "backgroundColor"), cancelled: cs("pill-cancelled").backgroundColor, muted: tok("--ins-status-muted-bg", "backgroundColor"), red: cs("pill-red").backgroundColor, danger: tok("--ins-status-danger-bg", "backgroundColor"), black: cs("pill-black").backgroundColor, ink: tok("--ins-status-ink-bg", "backgroundColor") };
		// actions and banners
		const rj = cs("act-reject"); o.reject = { bd: rj.borderTopColor, color: rj.color, w: rj.borderTopWidth, g: cs("act-reject", "::before").backgroundImage };
		o.approve = { g: cs("act-approve", "::before").borderRightWidth, tf: cs("act-approve", "::before").transform };
		o.banner = { bg: cs("banner").backgroundColor, want: tok("--ins-feedback-danger-bg", "backgroundColor"), color: cs("banner").color, fg: tok("--ins-feedback-danger-fg", "color"), edge: cs("banner").borderInlineStartWidth };
		// tabs
		o.tabs = { on: (() => { const s = cs("tab-on"); return { w: s.borderBottomWidth, c: s.borderBottomColor, fw: s.fontWeight, color: s.color }; })(), off: (() => { const s = cs("tab-off"); return { fw: s.fontWeight, color: s.color }; })(), primary: tok("--ins-primary", "color"), strongText: tok("--ins-text-strong", "color"), secondary: tok("--ins-text-secondary", "color") };
		// typography
		o.type = { btn: cs("btn").letterSpacing, pill: cs("pill-green").letterSpacing, lbl: getComputedStyle(document.querySelector("#masked .control-label")).letterSpacing, num: cs("dtnum").fontVariantNumeric, lh: getComputedStyle(document.body).lineHeight, lhWant: v("btn", "--ins-leading-arabic") || getComputedStyle(document.documentElement).getPropertyValue("--ins-leading-arabic").trim() };
		return o;
	});
	const rgbEq = (a, b) => a === b;
	for (const [id, r] of Object.entries(p3.scope)) record(scenario, `descendant #${id}: --control-bg = surface-field`, p3.fieldWant, r.got, r.got === p3.fieldWant);
	for (const [k, got] of Object.entries(p3.fieldBg)) record(scenario, `field inside ${k} paints surface-field`, p3.fieldWant, got, got === p3.fieldWant);
	record(scenario, "button inside .modal keeps surface-fill", p3.fillWant, p3.btnInModal, p3.btnInModal === p3.fillWant);
	record(scenario, ".modal --border-color = border-hairline", p3.hairWant, p3.modalBorder, p3.modalBorder === p3.hairWant);
	record(scenario, ".chart-container --charts-stroke-width = 2px", "2px", p3.chart.stroke, p3.chart.stroke === "2px");
	record(scenario, ".chart-container circle stroke = surface-raised", p3.raisedWant, p3.chart.circle, p3.chart.circle === p3.raisedWant);
	record(scenario, ".chart-container circle stroke width = 2px", "2px", p3.chart.circleW, p3.chart.circleW === "2px");
	record(scenario, ".editable-row --input-disabled-bg = surface-disabled", p3.disabledWant, p3.disabledBgVar, p3.disabledBgVar === p3.disabledWant);
	record(scenario, "disabled field: dashed 1px border, disabled fill, dim text", `1px dashed ${p3.t.dash} on ${p3.t.disabledBg}, ${p3.t.dim}`, `${p3.dis.w} ${p3.dis.st} ${p3.dis.c} on ${p3.dis.bg}, ${p3.dis.color}`, p3.dis.w === "1px" && p3.dis.st === "dashed" && p3.dis.c === p3.t.dash && p3.dis.bg === p3.t.disabledBg && p3.dis.color === p3.t.dim && p3.dis.cur === "not-allowed");
	record(scenario, "read-only input: flat, solid hairline underline, strong text", `transparent, solid ${p3.t.hair}, ${p3.t.strong}`, `${p3.ro.bg}, ${p3.ro.bbs} ${p3.ro.bbc}, ${p3.ro.color}`, p3.ro.bg === "rgba(0, 0, 0, 0)" && p3.ro.bbs === "solid" && p3.ro.bbc === p3.t.hair && p3.ro.color === p3.t.strong && p3.ro.st === "solid" && p3.ro.c === "rgba(0, 0, 0, 0)");
	record(scenario, "read-only value (.like-disabled-input): flat, hairline underline, strong text", `transparent, solid ${p3.t.hair}, ${p3.t.strong}`, `${p3.rov.bg}, ${p3.rov.bbs} ${p3.rov.bbc}, ${p3.rov.color}`, p3.rov.bg === "rgba(0, 0, 0, 0)" && p3.rov.bbs === "solid" && p3.rov.bbc === p3.t.hair && p3.rov.color === p3.t.strong);
	record(scenario, "read-only is visibly distinct from disabled (fill, border style, text colour all differ)", "differs", `${p3.ro.bg}/${p3.dis.bg}; ${p3.ro.st}/${p3.dis.st}; ${p3.ro.color}/${p3.dis.color}`, p3.ro.bg !== p3.dis.bg && p3.ro.bbs !== p3.dis.st && p3.ro.color !== p3.dis.color);
	record(scenario, "datatable disabled input keeps border none", "0px none", `${p3.dtdis.w} ${p3.dtdis.st}`, p3.dtdis.w === "0px" && p3.dtdis.st === "none");
	record(scenario, "editable-row disabled input keeps border none", "0px none", `${p3.erowdis.w} ${p3.erowdis.st}`, p3.erowdis.w === "0px" && p3.erowdis.st === "none");
	record(scenario, "error field: danger border plus inset second cue", `solid ${p3.t.danger}, inset shadow`, `${p3.err.st} ${p3.err.c}, ${p3.err.sh}`, p3.err.c === p3.t.danger && /inset/.test(p3.err.sh));
	record(scenario, "masked value: dashed strong border", `dashed ${p3.t.strongBorder}`, `${p3.masked.st} ${p3.masked.c}`, p3.masked.st === "dashed" && p3.masked.c === p3.t.strongBorder);
	record(scenario, "masked wrapper shows its reason as a real element (no generated text, so it is read once)", 'block, no ::after', `${p3.maskAfter.display}, ${p3.maskAfter.content}`, p3.maskAfter.display === "block" && p3.maskAfter.text === "Hidden for your role" && (p3.maskAfter.content === "none" || p3.maskAfter.content === "normal"));
	record(scenario, "masked label carries a drawn lock", '""', p3.maskLabelLock, p3.maskLabelLock === '""');
	const pl = p3.pill;
	record(scenario, "pill green (no-indicator-dot): check shape", "2px right border, rotated", `${pl["pill-green"].bw} ${pl["pill-green"].tf}`, pl["pill-green"].bw === "2px" && pl["pill-green"].tf !== "none" && pl["pill-green"].content === '""');
	record(scenario, "pill red: cross (two gradients)", "2 linear-gradients", pl["pill-red"].bgi.slice(0, 60), (pl["pill-red"].bgi.match(/linear-gradient/g) || []).length === 2);
	record(scenario, "pill orange: half disc (gradient and round)", "50% radius and gradient", `${pl["pill-orange"].radius} ${pl["pill-orange"].bgi.slice(0, 30)}`, /linear-gradient/.test(pl["pill-orange"].bgi) && /50%|4\.5px/.test(pl["pill-orange"].radius));
	record(scenario, "Draft (form title, data-ins-docstatus=0): ring on the neutral pair", `ring, ${p3.pillBg.neutral}`, `${pl["pill-title-draft"].radius} ${pl["pill-title-draft"].bgi}`, pl["pill-title-draft"].bgi === "none" && /^1(\.5)?px$/.test(pl["pill-title-draft"].bw));
	record(scenario, "Cancelled (form title, data-ins-docstatus=2): filled square", "1px radius, filled", `${pl["pill-title-cancelled"].radius} ${pl["pill-title-cancelled"].bg}`, pl["pill-title-cancelled"].radius === "1px" && pl["pill-title-cancelled"].bg !== "rgba(0, 0, 0, 0)");
	record(scenario, "Draft (list data-filter): neutral pair, ring", `${p3.pillBg.neutral}`, `${p3.pillBg.draft} ${pl["pill-draft"].bw}`, p3.pillBg.draft === p3.pillBg.neutral && /^1(\.5)?px$/.test(pl["pill-draft"].bw));
	record(scenario, "Cancelled (list data-filter): muted pair, square", `${p3.pillBg.muted}`, `${p3.pillBg.cancelled} ${pl["pill-cancelled"].radius}`, p3.pillBg.cancelled === p3.pillBg.muted && pl["pill-cancelled"].radius === "1px");
	record(scenario, "Rejected (red) differs in shape from Draft and Cancelled", "cross vs ring vs square", `${pl["pill-red"].bgi.slice(0, 12)} | ${pl["pill-draft"].bw} | ${pl["pill-cancelled"].radius}`, pl["pill-red"].bgi !== pl["pill-draft"].bgi && pl["pill-draft"].radius !== pl["pill-cancelled"].radius);
	record(scenario, "black pill gets the ink pair", p3.pillBg.ink, p3.pillBg.black, p3.pillBg.black === p3.pillBg.ink);
	record(scenario, "data-ins-action=reject: danger outline and cross glyph", `1px ${p3.t.danger}, 2 gradients`, `${p3.reject.w} ${p3.reject.bd}, ${(p3.reject.g.match(/linear-gradient/g) || []).length} gradients`, p3.reject.w === "1px" && p3.reject.bd === p3.t.danger && p3.reject.color === p3.t.danger && (p3.reject.g.match(/linear-gradient/g) || []).length === 2);
	record(scenario, "data-ins-action=approve: check glyph", "2px border, rotated", `${p3.approve.g} ${p3.approve.tf}`, p3.approve.g === "2px" && p3.approve.tf !== "none");
	record(scenario, ".form-message.red: feedback pair, 4px start edge", `${p3.banner.want}, ${p3.banner.fg}, 4px`, `${p3.banner.bg}, ${p3.banner.color}, ${p3.banner.edge}`, p3.banner.bg === p3.banner.want && p3.banner.color === p3.banner.fg && p3.banner.edge === "4px");
	record(scenario, "active tab: 2px primary underline, strong weight and text", `2px ${p3.tabs.primary}, 600, ${p3.tabs.strongText}`, `${p3.tabs.on.w} ${p3.tabs.on.c}, ${p3.tabs.on.fw}, ${p3.tabs.on.color}`, p3.tabs.on.w === "2px" && p3.tabs.on.c === p3.tabs.primary && p3.tabs.on.fw === "600" && p3.tabs.on.color === p3.tabs.strongText);
	record(scenario, "idle tab: secondary text, regular weight", `${p3.tabs.secondary}, 400`, `${p3.tabs.off.color}, ${p3.tabs.off.fw}`, p3.tabs.off.color === p3.tabs.secondary && p3.tabs.off.fw === "400");
	record(scenario, "numeric datatable content: tabular lining numerals", "tabular-nums", p3.type.num, /tabular-nums/.test(p3.type.num) && /lining-nums/.test(p3.type.num));
	if (dir === "rtl") {
		const zero = (x) => x === "normal" || x === "0px";
		record(scenario, "Arabic: letter-spacing 0 on .btn, pill and label (core sets 0.02em)", "normal or 0px", `${p3.type.btn} | ${p3.type.pill} | ${p3.type.lbl}`, zero(p3.type.btn) && zero(p3.type.pill) && zero(p3.type.lbl));
		record(scenario, "Arabic: body line-height = --ins-leading-arabic (1.65 x 14px)", "23.1px", p3.type.lh, Math.abs(parseFloat(p3.type.lh) - 23.1) < 0.2);
	}
	// Tabs and switch: the ring must reach the tab (core `outline: none` at (0,5,0)), and an idle tab keeps its weight on focus.
	await page.keyboard.press("Tab");
	const tabFocus = await page.evaluate((ring) => {
		const out = {};
		for (const id of ["tab-on", "tab-off"]) { const e = document.getElementById(id); e.focus({ focusVisible: true }); const s = getComputedStyle(e); out[id] = { ok: document.activeElement === e && e.matches(":focus-visible"), w: s.outlineWidth, st: s.outlineStyle, c: s.outlineColor, o: s.outlineOffset, fw: s.fontWeight }; }
		return out;
	}, ringWant);
	for (const [id, t] of Object.entries(tabFocus)) record(scenario, `focus ring on #${id}: 2px solid ring, inside (-2px)`, `2px solid ${ringWant} -2px`, `${t.w} ${t.st} ${t.c} ${t.o} (focus-visible ${t.ok})`, t.ok && t.w === "2px" && t.st === "solid" && t.c === ringWant && t.o === "-2px");
	record(scenario, "idle tab keeps regular weight when focused (no width jump)", "400", tabFocus["tab-off"].fw, tabFocus["tab-off"].fw === "400");
	await page.evaluate(() => document.activeElement?.blur());
	// Ribbon: html attribute plus the element the script appends.
	const rb = await page.evaluate(() => {
		const r = document.documentElement; r.setAttribute("data-ins-environment", "uat");
		const e = document.createElement("div"); e.className = "ins-env-ribbon"; e.setAttribute("role", "note"); e.textContent = "UAT"; document.body.append(e);
		const s = getComputedStyle(e), h = getComputedStyle(r);
		const out = { pos: s.position, z: s.zIndex, h: s.height, top: s.top, sp: h.scrollPaddingBlockStart, head: h.getPropertyValue("--ins-page-head-height").trim(), hit: s.pointerEvents };
		e.remove(); r.removeAttribute("data-ins-environment"); return out;
	});
	record(scenario, "ribbon: fixed, z-index 1021 (below the 1040 backdrop), 24px, pointer-events none", "fixed 1021 24px", `${rb.pos} ${rb.z} ${rb.h} ${rb.hit}`, rb.pos === "fixed" && rb.z === "1021" && rb.h === "24px" && rb.hit === "none");
	record(scenario, "ribbon: scroll-padding-block-start grows by the ribbon height", `${parseFloat(rb.head) + 8 + 24}px`, rb.sp, rb.sp === `${parseFloat(rb.head) + 8 + 24}px`);
	await page.emulateMedia({ forcedColors: "active" });
	await page.evaluate(() => document.getElementById("btn").focus());
	await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab");
	const fc = await page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { id: e.id, st: s.outlineStyle, w: s.outlineWidth, c: s.outlineColor, pill: getComputedStyle(document.getElementById("badge")).outlineStyle, mm: matchMedia("(forced-colors: active)").matches }; });
	record(scenario, "forced-colors: media active", "true", String(fc.mm), fc.mm);
	record(scenario, "forced-colors: ring still drawn", "2px solid", `${fc.w} ${fc.st} ${fc.c}`, fc.st === "solid" && fc.w === "2px");
	record(scenario, "forced-colors: badge keeps an outline shape", "solid", fc.pill, fc.pill === "solid");
	await page.evaluate(() => document.activeElement?.blur());
	for (let i = 0, ok = false; i < 40 && !ok; i++) { await page.keyboard.press("Tab"); ok = await page.evaluate(() => document.activeElement.id === "dt-on"); }
	const fcc = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { id: document.activeElement.id, st: s.outlineStyle, w: s.outlineWidth }; });
	record(scenario, "forced-colors: focused checked checkbox has an outline", "dt-on 2px solid", `${fcc.id} ${fcc.w} ${fcc.st}`, fcc.id === "dt-on" && fcc.st === "solid" && fcc.w === "2px");
	await fix1(page, scenario);
	await fix2(page, scenario);
	if (only(["16.52.0"])) await v1652(page, dir, scenario);
	await ctx.close();
}
await browser.close();

const pass = results.filter((r) => r.pass).length, fail = results.length - pass;
const summary = { version: tag, generated: new Date().toISOString(), core, bundles: Object.fromEntries(Object.entries(built).map(([k, v]) => [k, v.bytes])), sassWarnings: warnings, rtlIdentical, total: results.length, pass, fail };
writeFileSync(join(evidence, `cascade-${tag}.json`), JSON.stringify({ summary, results }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const r of results.filter((r) => !r.pass).slice(0, 25)) console.log("FAIL", r.scenario, r.check, "| want", r.expected, "| got", r.actual);
process.exitCode = fail || warnings.length || Object.values(rtlIdentical).includes(false) ? 1 : 0;
