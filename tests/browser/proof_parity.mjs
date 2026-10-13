// Parity of the interactive proof with the live desk (ADR 0007): getComputedStyle of probe selectors, proof against product.
// Usage: NODE_PATH=/opt/pw-node/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node proof_parity.mjs \
//   [--bench /home/user/frappe-bench] [--base http://midad.test:8000] [--proof docs/proof/midad-proof.html] [--out parity.json] [--quick]
// Needs the test site, users css-r2-{en,ar}-light@midad.test (password below) and six ToDo records for each.
// Exit code 1 on any mismatch, stale asset path, missing probe or non-allowed network request.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// playwright-core from the package, else the shared test-bench install (ESM ignores NODE_PATH).
const { chromium } = await import("playwright-core").catch(() => import("/opt/pw-node/node_modules/playwright-core/index.mjs"));
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const bench = arg("--bench", "/home/user/frappe-bench");
const base = arg("--base", "http://midad.test:8000");
const proofPath = resolve(arg("--proof", join(repo, "docs/proof/midad-proof.html")));
const outFile = resolve(arg("--out", join(repo, "docs/proof/parity.json")));
const quick = process.argv.includes("--quick");
const PW = process.env.PROOF_USER_PASSWORD || "Css-r2-Pass-9271!";
const user = (lang) => `css-r2-${lang}-light@midad.test`;

const failures = [];
const log = { matrix: [], extra: {}, stale: [], offline: {}, counts: { configs: 0, probes: 0, mismatches: 0 } };
const fail = (m) => { failures.push(m); if (failures.length <= 60) console.log("FAIL", m); };

// ---- Probes. `size` adds block size. Selectors must exist in both documents.
const PROPS = ["color", "backgroundColor", "borderTopColor", "borderTopWidth", "borderTopStyle", "borderBottomColor", "borderBottomWidth", "borderBottomStyle",
	"fontFamily", "fontSize", "fontWeight", "lineHeight", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "borderTopLeftRadius", "colorScheme"];
const P = (selector, size = false) => ({ selector, size });
const PROBES = {
	list: [P("html"), P(".page-head"), P(".page-head .title-text"), P(".page-actions .primary-action:not(.hide)", true), P(".standard-filter-section"), P(".list-row-head"), P(".list-row"),
		P(".list-row .indicator-pill.red"), P(".list-row .list-subject a"), P(".list-paging-area .btn-paging", true), P(".standard-sidebar-item.active-sidebar"), P(".standard-sidebar-item.active-sidebar .sidebar-item-label"), P(".sidebar-header .header-title")],
	form: [P("html"), P(".page-head .indicator-pill"), P(".page-head .title-text"), P(".form-layout .frappe-control[data-fieldname=status] .control-label"), P(".form-layout select.form-control", true),
		P(".form-layout .frappe-control[data-fieldname=date] .form-control", true), P(".form-layout .frappe-control[data-fieldname=date] .control-label"), P(".form-layout .frappe-control[data-fieldname=date] .control-input"), P(".form-layout .form-section.visible-section")],
	report: [P("html"), P(".page-head .title-text"), P(".datatable"), P(".dt-row-header .dt-cell", true), P(".dt-row-header .dt-cell__content"), P(".dt-scrollable .dt-row-0 .dt-cell--col-2", true),
		P(".dt-scrollable .dt-row-0 .dt-cell--col-2 a"), P(".dt-scrollable .dt-row-1 .dt-cell--col-4", true)],
	dialog: [P("html"), P(".modal-content"), P(".modal-header"), P(".modal-title"), P(".modal-body"), P(".msgprint"), P(".btn-modal-close", true), P(".indicator.red"), P(".modal-backdrop")],
	login: [P("html"), P("body"), P(".login-content"), P(".page-card-head h4"), P(".page-card-subtitle"), P(".form-label"), P("#login_password", true), P(".btn-login", true), P(".forgot-password-message a"), P(".ins-masthead"), P(".ins-lang-link")],
};
const DESK = ["list", "form", "report", "dialog"];
const PRESETS = ["midad", "graphite", "forest", "petrol", "plum"];

const probeFn = ([probes, props]) => probes.map(({ selector, size }) => {
	const doc = window.__probeDoc || document;
	const root = window.__probeRoot ? doc.querySelector(window.__probeRoot) || doc : doc;
	const el = selector === "html" ? doc.documentElement : (root.querySelector(selector) || doc.querySelector(selector));
	if (!el) return { selector, missing: true };
	const s = doc.defaultView.getComputedStyle(el);
	const v = {}; for (const p of props) v[p] = s[p];
	if (size) v.height = el.getBoundingClientRect().height + "px";
	return { selector, v };
});

const near = (a, b) => {
	if (a === b) return true;
	const pa = /^(-?[\d.]+)px$/.exec(a), pb = /^(-?[\d.]+)px$/.exec(b);
	return !!(pa && pb && Math.abs(parseFloat(pa[1]) - parseFloat(pb[1])) <= 0.5);
};

function compare(tag, live, proof) {
	log.counts.configs++;
	for (let i = 0; i < live.length; i++) {
		const l = live[i], p = proof[i];
		log.counts.probes++;
		if (l.missing || p.missing) { log.counts.mismatches++; fail(`${tag} ${l.selector}: missing in ${l.missing ? "live" : ""}${l.missing && p.missing ? "+" : ""}${p.missing ? "proof" : ""}`); continue; }
		for (const k of Object.keys(l.v)) {
			if (!near(l.v[k], p.v[k])) { log.counts.mismatches++; fail(`${tag} ${l.selector} ${k}: live ${l.v[k]} proof ${p.v[k]}`); }
		}
	}
}

// ---- Stale check: every manifest path embedded in the proof equals the bench's current one.
function staleCheck(html) {
	const data = JSON.parse(/<script type="application\/json" id="proof-data">([\s\S]*?)<\/script>/.exec(html)[1].replace(/<\\\//g, "</"));
	const cur = { ...JSON.parse(readFileSync(join(bench, "sites/assets/assets.json"), "utf8")) };
	const curRtl = JSON.parse(readFileSync(join(bench, "sites/assets/assets-rtl.json"), "utf8"));
	for (const [key, path] of Object.entries(data.manifest)) {
		const now = key.startsWith("rtl_") ? curRtl[key] : cur[key];
		if (now !== path) { log.stale.push({ key, proof: path, bench: now }); fail(`stale asset path ${key}: proof ${path} bench ${now}`); }
	}
	const srcs = [...html.matchAll(/<style data-src="([^"]+)"/g)].map((m) => m[1]).filter((s) => s.startsWith("/assets/"));
	const known = new Set(Object.values(data.manifest));
	for (const s of srcs) if (!known.has(s)) fail(`style data-src not in manifest: ${s}`);
	return { manifestEntries: Object.keys(data.manifest).length, styleTags: srcs.length };
}

const browser = await chromium.launch();
const html = readFileSync(proofPath, "utf8");
log.stale.size = staleCheck(html);

// ---- Proof page (file://), with a network guard: anything not file:/data: and not a known core /assets/ URL fails.
const proofCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const proof = await proofCtx.newPage();
const blocked = [], allowedAssets = new Set();
proof.on("request", (r) => {
	const u = r.url();
	if (u.startsWith("data:") || u === "about:srcdoc" || u === "about:blank") return;
	if (u.startsWith("file:")) { if (u.startsWith("file:///assets/")) allowedAssets.add(u.split("?")[0]); else if (!u.startsWith(pathToFileURL(proofPath).href)) blocked.push(u); return; }
	blocked.push(u);
});
await proof.goto(pathToFileURL(proofPath).href);
await proof.waitForTimeout(800);
log.offline = { allowedCoreAssetUrls: [...allowedAssets].slice(0, 5), allowedCount: allowedAssets.size, blocked };
for (const u of blocked) fail(`proof made a request outside file:/data: and core /assets/: ${u}`);

// ---- Live pages.
async function liveLogin(lang) {
	const ctx = await browser.newContext({ baseURL: base, locale: lang === "ar" ? "ar-SA" : "en-US", viewport: { width: 1280, height: 900 } });
	const r = await ctx.request.post("/api/method/login", { form: { usr: user(lang), pwd: PW } });
	if (!r.ok()) { fail(`cannot log in ${user(lang)} (${r.status()}); create the css-r2 test users first`); throw new Error("login"); }
	return ctx;
}
async function settle(page, sel) {
	await page.goto(page.__url, { waitUntil: "load" });
	await page.waitForFunction(() => window.frappe && frappe.router && document.querySelector(".page-container, .layout-main"), null, { timeout: 30000 }).catch(() => {});
	await page.waitForSelector(sel, { timeout: 30000 });
	await page.waitForTimeout(900);
	await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
}
async function openLive(ctx, screen, lang) {
	const page = await ctx.newPage();
	page.on("domcontentloaded", () => {});
	const urls = { list: ["/desk/todo", ".list-row"], form: ["/desk/todo/new", ".form-layout .frappe-control[data-fieldname=date]"], report: ["/desk/todo/view/report", ".dt-scrollable .dt-row-1"], dialog: ["/desk/todo", ".list-row"] };
	page.__url = base + urls[screen][0];
	await settle(page, urls[screen][1]);
	await page.addStyleTag({ content: NO_MOTION });
	// An unseen record gets `level-item bold ellipsis` on the subject span, a seen one a bare span (list_view.js get_subject_element, get_seen_class); the proof shows the seen state.
	if (screen === "list") await page.evaluate(() => document.querySelectorAll(".list-row .list-subject > span.bold").forEach((e) => e.removeAttribute("class")));
	if (screen === "form") await page.evaluate(() => document.querySelector('.frappe-control[data-fieldname="date"]').classList.add("has-error"));
	if (screen === "dialog") {
		await page.evaluate(() => frappe.msgprint({ title: "Message", message: "Body", indicator: "red" }));
		await page.waitForSelector(".modal.show .modal-content", { timeout: 15000 });
		await page.waitForTimeout(700);
	}
	return page;
}
async function setLive(page, cfg, lang, rtl) {
	await page.evaluate(async ({ cfg, lang, rtl, palettes }) => {
		const r = document.documentElement;
		r.setAttribute("data-theme-mode", cfg.mode); r.setAttribute("data-theme", cfg.mode); r.setAttribute("data-ins-density", cfg.density);
		document.querySelectorAll("link[data-parity-preset]").forEach((l) => l.remove());
		if (cfg.preset !== "midad") {
			await new Promise((res) => { const l = document.createElement("link"); l.rel = "stylesheet"; l.setAttribute("data-parity-preset", "1"); l.href = palettes[cfg.preset]; l.onload = res; l.onerror = res; document.head.appendChild(l); });
		}
	}, { cfg, lang, rtl, palettes: PALETTE_URLS[rtl ? "rtl" : "ltr"] });
	await page.waitForTimeout(150);
}
const PALETTE_URLS = { ltr: {}, rtl: {} };
{
	const a = JSON.parse(readFileSync(join(bench, "sites/assets/assets.json"), "utf8")), b = JSON.parse(readFileSync(join(bench, "sites/assets/assets-rtl.json"), "utf8"));
	for (const p of PRESETS.slice(1)) { PALETTE_URLS.ltr[p] = base + a[`ins_palette_${p}.bundle.css`]; PALETTE_URLS.rtl[p] = base + b[`rtl_ins_palette_${p}.bundle.css`]; }
}
async function setProof(cfg, lang, screen) {
	await proof.evaluate(([c, l, s]) => { window.__proofApply({ screen: s, lang: l, mode: c.mode, density: c.density, preset: c.preset }); }, [cfg, lang, screen]);
	await proof.evaluate((s) => { window.__probeRoot = `#screen-${s}`; window.__probeDoc = undefined; }, screen);
	await proof.waitForTimeout(120);
}
const proofProbes = (screen) => proof.evaluate(probeFn, [PROBES[screen], PROPS]);
async function proofLoginProbes() {
	const frame = proof.frame({ url: "about:srcdoc" }) || proof.frames().find((f) => f !== proof.mainFrame());
	return frame.evaluate(probeFn, [PROBES.login, PROPS]);
}

// Transitions would make a computed value depend on timing; both sides run without them (test-only rule).
const NO_MOTION = "*, *::before, *::after { transition: none !important; animation: none !important; }";
await proof.addStyleTag({ content: NO_MOTION });
const configs = [];
for (const mode of ["light", "dark"]) for (const density of ["comfortable", "compact"]) for (const preset of quick ? ["midad", "graphite"] : PRESETS) configs.push({ mode, density, preset });

for (const lang of ["en", "ar"]) {
	const ctx = await liveLogin(lang);
	const rtl = lang === "ar";
	for (const screen of DESK) {
		const page = await openLive(ctx, screen, lang);
		for (const cfg of configs) {
			const tag = `${lang}/${screen}/${cfg.mode}/${cfg.density}/${cfg.preset}`;
			await setLive(page, cfg, lang, rtl);
			await setProof(cfg, lang, screen);
			const live = await page.evaluate(probeFn, [PROBES[screen], PROPS]);
			const prf = await proofProbes(screen);
			const before = failures.length;
			compare(tag, live, prf);
			log.matrix.push({ tag, probes: live.length, ok: failures.length === before });
		}
		// Extra passes on the first config only, in the same page.
		for (const [name, media] of [["forced-colors", { forcedColors: "active" }], ["reduced-motion", { reducedMotion: "reduce" }]]) {
			await page.emulateMedia(media); await proof.emulateMedia(media);
			const q = name === "forced-colors" ? "(forced-colors: active)" : "(prefers-reduced-motion: reduce)";
			const m1 = await page.evaluate((q) => matchMedia(q).matches, q), m2 = await proof.evaluate((q) => matchMedia(q).matches, q);
			const cfg = { mode: "light", density: "comfortable", preset: "midad" };
			await setLive(page, cfg, lang, rtl); await setProof(cfg, lang, screen);
			const tag = `${lang}/${screen}/${name}`;
			const before = failures.length;
			if (!m1 || !m2) fail(`${tag}: media query did not match (live ${m1}, proof ${m2})`);
			compare(tag, await page.evaluate(probeFn, [PROBES[screen], PROPS]), await proofProbes(screen));
			log.extra[tag] = failures.length === before;
			await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" }); await proof.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });
		}
		await page.close();
	}
	await ctx.close();
	// Login (the web bundles; Light by design, so only the language varies).
	const lctx = await browser.newContext({ baseURL: base, locale: rtl ? "ar-SA" : "en-US", viewport: { width: 1280, height: 900 } });
	const lp = await lctx.newPage();
	await lp.goto(`${base}/login?_lang=${lang}`, { waitUntil: "load" });
	await lp.waitForSelector(".btn-login", { timeout: 20000 });
	await lp.waitForTimeout(600);
	await lp.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
	await proof.evaluate(([l]) => window.__proofApply({ screen: "login", lang: l, mode: "light", density: "comfortable", preset: "midad" }), [lang]);
	await proof.waitForTimeout(600);
	const tag = `${lang}/login`;
	const before = failures.length;
	compare(tag, await lp.evaluate(probeFn, [PROBES.login, PROPS]), await proofLoginProbes());
	log.matrix.push({ tag, probes: PROBES.login.length, ok: failures.length === before });
	await lctx.close();
}

// ---- Touch context: pointer: coarse must match before the comparison is meaningful (ASSUMED in ADR 0007).
{
	const tctx = await browser.newContext({ baseURL: base, hasTouch: true, isMobile: true, viewport: { width: 1024, height: 800 } });
	const tp = await tctx.newPage();
	const coarse = await tp.evaluate(() => matchMedia("(pointer: coarse)").matches);
	log.extra["pointer-coarse-matchMedia"] = coarse;
	if (!coarse) fail("touch context: (pointer: coarse) did not match in Chromium emulation");
	await tctx.close();
}
// ---- 320px reflow screenshot of the proof.
{
	const small = await browser.newContext({ viewport: { width: 320, height: 640 } });
	const sp = await small.newPage();
	await sp.goto(pathToFileURL(proofPath).href);
	await sp.waitForTimeout(600);
	await sp.screenshot({ path: outFile.replace(/\.json$/, "-320.png") });
	log.extra["reflow-320-screenshot"] = outFile.replace(/\.json$/, "-320.png");
	await small.close();
}

await browser.close();
log.failures = failures.length;
log.failureSample = failures.slice(0, 40);
writeFileSync(outFile, JSON.stringify(log, null, 1));
console.log(`parity: ${log.counts.configs} comparisons, ${log.counts.probes} probes, ${log.counts.mismatches} mismatches, ${log.stale.length} stale, ${blocked.length} blocked requests; failures ${failures.length}`);
process.exit(failures.length ? 1 : 0);
