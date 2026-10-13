// Computed-style proof that the theme wins over the real compiled Frappe desk CSS.
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node cascade.mjs [--out DIR] [--bench /home/user/frappe-bench]
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
const evidence = resolve(arg("--evidence", join(repo, "docs/team/evidence/phase2")));
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
const record = (scenario, check, expected, actual, pass) => results.push({ scenario, check, expected, actual, pass });

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
	await ctx.close();
}
await browser.close();

const pass = results.filter((r) => r.pass).length, fail = results.length - pass;
const summary = { generated: new Date().toISOString(), core, bundles: Object.fromEntries(Object.entries(built).map(([k, v]) => [k, v.bytes])), sassWarnings: warnings, rtlIdentical, total: results.length, pass, fail };
writeFileSync(join(evidence, "css-cascade.json"), JSON.stringify({ summary, results }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const r of results.filter((r) => !r.pass).slice(0, 25)) console.log("FAIL", r.scenario, r.check, "| want", r.expected, "| got", r.actual);
process.exitCode = fail || warnings.length || Object.values(rtlIdentical).includes(false) ? 1 : 0;
