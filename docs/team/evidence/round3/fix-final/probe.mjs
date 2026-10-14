// Copy of fix-css2/probe.mjs without the user set-up, writing into fix-final. Verifies the three css2 fixes on the real build. Usage: node probe.mjs  (NODE_PATH and PLAYWRIGHT_BROWSERS_PATH set as in DISPATCH)
import { createRequire } from "node:module";
import fs from "node:fs";
const req = createRequire("/home/runner/work/institutional_theme/institutional_theme/tests/browser/package.json");
const { chromium } = req("playwright-core");
const BASE = "http://localhost:8000", PW = "Mdd#Test2026x";
const OUT = new URL(".", import.meta.url).pathname;
const b = await chromium.launch({ args: ["--no-sandbox"] });
const pairs = ["en-light", "en-dark", "ar-light", "ar-dark"];
// users css3-<lang>-<mode>@midad.test already exist (created by the fix-css2 run); the web API refuses new writes while the queue holds stale jobs
const lum = (c) => { const [r, g, bl] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
const ratio = (a, c) => { const x = lum(a), y = lum(c); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
const results = [];
for (const t of pairs) {
	const [lang, mode] = t.split("-");
	for (const vw of [375, 1280]) {
		const ctx = await b.newContext({ viewport: { width: vw, height: 812 }, locale: lang === "ar" ? "ar-SA" : "en-US", extraHTTPHeaders: { "Accept-Language": lang }, reducedMotion: "reduce", ...(vw === 375 ? { isMobile: true, hasTouch: true } : {}) });
		const page = await ctx.newPage();
		await page.goto(`${BASE}/login`); await page.fill("#login_email", `css3-${t}@midad.test`); await page.fill("#login_password", PW);
		await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.click(".btn-login")]);
		await page.goto(BASE + "/desk/user"); await page.waitForSelector(".list-row-container", { timeout: 30000 }); await page.waitForTimeout(2500);
		const list = await page.evaluate(() => [...document.querySelectorAll(".list-row-container")].slice(1).map((c) => {
			const pill = [...c.querySelectorAll(".indicator-pill")].find((p) => p.getBoundingClientRect().width > 0); if (!pill) return null;
			const r = pill.getBoundingClientRect(); const hits = []; if (r.bottom > innerHeight - 56 || r.top < 0) return null;
			for (const [fx, fy] of [[0.1, 0.5], [0.3, 0.5], [0.5, 0.5], [0.9, 0.5], [0.3, 0.2], [0.3, 0.8]]) { const e = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); hits.push(e && (e === pill || pill.contains(e))); }
			const rr = pill.closest(".list-row").getBoundingClientRect();
			return { w: Math.round(r.width), covered: hits.filter((x) => !x).length, insideRow: r.left >= rr.left - 1 && r.right <= rr.right + 1 };
		}).filter(Boolean));
		const bc = await page.evaluate(() => { const a = document.querySelector(".navbar-breadcrumbs > li:first-child > a"); const n = document.querySelector(".navbar-breadcrumbs > li:nth-child(2) > a"); const r = a.getBoundingClientRect(); const q = n && n.getBoundingClientRect(); const s = document.querySelector(".navbar-breadcrumbs > li:first-child"); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), left: Math.round(r.left), right: Math.round(r.right), nextLeft: q && Math.round(q.left), nextRight: q && Math.round(q.right) }; });
		const clip = { x: 0, y: 0, width: vw, height: vw === 375 ? 520 : 400 };
		await page.screenshot({ path: `${OUT}/list-${t}-${vw}.png`, clip });
		let danger;
		if (vw === 1280) {
			await page.goto(BASE + "/desk/notification/new"); await page.waitForSelector(".form-layout"); await page.waitForTimeout(1500);
			await page.evaluate(() => { cur_frm.add_child("recipients"); cur_frm.refresh_field("recipients"); }); await page.waitForTimeout(600);
			await page.locator(".form-grid .grid-row .btn-open-row").first().click();
			const btn = page.locator(".form-in-grid .grid-delete-row").first(); await btn.waitFor();
			const read = async (state) => page.evaluate((state) => { const e = document.querySelector(".form-in-grid .grid-delete-row"); const cs = getComputedStyle(e); const svg = e.querySelector("svg"); return { state, color: cs.color, bg: cs.backgroundColor, opacity: cs.opacity, icon: svg ? getComputedStyle(svg).color : null, stroke: svg ? getComputedStyle(svg.querySelector("path,use,*") || svg).stroke : null }; }, state);
			danger = [await read("normal")];
			await btn.hover(); await page.waitForTimeout(300); danger.push(await read("hover"));
			await page.mouse.down(); danger.push(await read("active")); await page.mouse.move(5, 5); await page.mouse.up();
			await btn.focus(); await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab"); await page.waitForTimeout(200); danger.push(await read("focus"));
			await page.evaluate(() => document.querySelector(".form-in-grid .grid-delete-row").setAttribute("disabled", "")); danger.push(await read("disabled"));
			danger.forEach((d) => { d.ratio = +ratio(rgb(d.color).slice(0, 3), rgb(d.bg).slice(0, 3)).toFixed(2); });
			await page.screenshot({ path: `${OUT}/danger-${t}.png`, clip: { x: 0, y: 0, width: 1280, height: 900 } });
		}
		results.push({ t, vw, list, bc, danger });
		await ctx.close();
	}
}
fs.writeFileSync(`${OUT}/probe.json`, JSON.stringify(results, null, 1));
for (const r of results) console.log(r.t, r.vw, JSON.stringify({ chips: r.list.map((x) => `${x.w}/${x.covered}/${x.insideRow}`), bc: r.bc, danger: r.danger && r.danger.map((d) => `${d.state}:${d.ratio}`) }));
await b.close();
