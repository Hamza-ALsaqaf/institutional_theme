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
];
const colorScheme = { light: "light", dark: "dark", automatic: "light dark" };

const html = readFileSync(join(here, "harness/fixture.html"), "utf8");
function pageFor(dir, pal, mode) {
	const sheet = { core: core[dir === "rtl" ? "rtl" : "ltr"], desk: built.desk[dir], graphite: built.graphite[dir] };
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
	// Autofill cover must survive focus: the reset is skipped for :-webkit-autofill, so the rule text is the proof available headless.
	const afRule = await page.evaluate(() => [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } }).filter((r) => r.selectorText && /box-shadow/.test(r.cssText) && /focus-visible/.test(r.selectorText) && /autofill/.test(r.selectorText)).length);
	record(scenario, "box-shadow reset excludes :-webkit-autofill", ">= 1 rule", String(afRule), afRule >= 1);

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
