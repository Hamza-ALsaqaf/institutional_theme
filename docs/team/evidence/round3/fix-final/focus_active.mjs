// P1: Tab to the first three breadcrumbs on the User list and screenshot the focus ring (clip around the crumbs).
// P2: force :active on the grid Delete button and read computed colours (resting values alongside). Usage: node focus_active.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
const req = createRequire("/home/runner/work/institutional_theme/institutional_theme/tests/browser/package.json");
const { chromium } = req("playwright-core");
const BASE = "http://localhost:8000", PW = "Mdd#Test2026x";
const OUT = new URL(".", import.meta.url).pathname;
const b = await chromium.launch({ args: ["--no-sandbox"] });
const lum = (c) => { const [r, g, bl] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
const ratio = (a, c) => { const x = lum(a), y = lum(c); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
const out = [];
for (const t of ["en-light", "en-dark", "ar-light", "ar-dark"]) {
	const lang = t.slice(0, 2);
	const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 3, locale: lang === "ar" ? "ar-SA" : "en-US", extraHTTPHeaders: { "Accept-Language": lang }, reducedMotion: "reduce" });
	const page = await ctx.newPage();
	await page.goto(`${BASE}/login`); await page.fill("#login_email", `css3-${t}@midad.test`); await page.fill("#login_password", PW);
	await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.click(".btn-login")]);
	// a three-crumb page: a User form (Home / User / name)
	await page.goto(`${BASE}/desk/user/${encodeURIComponent(`css3-${t}@midad.test`)}`); await page.waitForSelector(".navbar-breadcrumbs li", { timeout: 30000 }); await page.waitForTimeout(2500);
	await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
	await page.mouse.click(5, 5);
	const rings = [];
	for (let i = 0; i < 3; i++) {
		await page.evaluate((i) => { const a = document.querySelectorAll(".navbar-breadcrumbs > li > a")[i]; a.focus({ focusVisible: true }); }, i);
		await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab"); await page.waitForTimeout(150);
		const info = await page.evaluate((i) => { const a = document.querySelectorAll(".navbar-breadcrumbs > li > a")[i]; const cs = getComputedStyle(a); const r = a.getBoundingClientRect(); let inside = true; for (let e = a.parentElement; e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e); if (c.overflowX !== "visible" || c.overflowY !== "visible") { const u = e.getBoundingClientRect(); if (r.left < u.left - 0.01 || r.right > u.right + 0.01 || r.top < u.top - 0.01 || r.bottom > u.bottom + 0.01) inside = false; } } return { focused: document.activeElement === a, outline: cs.outlineWidth + " " + cs.outlineStyle, offset: cs.outlineOffset, ringInsideList: inside, box: [r.left, r.top, r.width, r.height].map(Math.round) }; }, i);
		rings.push(info);
		const ul = await page.evaluate(() => { const r = document.querySelector(".navbar-breadcrumbs").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
		await page.screenshot({ path: `${OUT}/focus-${t}-${i + 1}.png`, clip: { x: Math.max(0, Math.round(ul[0]) - 12), y: Math.max(0, Math.round(ul[1]) - 12), width: Math.min(520, Math.round(ul[2]) + 24), height: Math.round(ul[3]) + 24 } });
	}
	await page.goto(`${BASE}/desk/notification/new`); await page.waitForSelector(".form-layout"); await page.waitForTimeout(1500);
	await page.evaluate(() => { cur_frm.add_child("recipients"); cur_frm.refresh_field("recipients"); }); await page.waitForTimeout(600);
	await page.locator(".form-grid .grid-row .btn-open-row").first().click();
	const btn = page.locator(".form-in-grid .grid-delete-row").first(); await btn.waitFor();
	// Force :active through the DevTools protocol (a real mouse-down did not match :active in the headless run).
	const cdp = await ctx.newCDPSession(page); await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
	const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
	const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: ".form-in-grid .grid-delete-row" });
	const read = () => page.evaluate(() => { const e = document.querySelector(".form-in-grid .grid-delete-row"); const cs = getComputedStyle(e); return { matchesActive: e.matches(":active"), color: cs.color, bg: cs.backgroundColor, shadow: cs.boxShadow }; });
	await page.mouse.move(5, 5); await page.waitForTimeout(400);
	const rest = await read();
	await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["active"] }); await page.waitForTimeout(400);
	const st = await read();
	const bx = await btn.boundingBox();
	await page.screenshot({ path: `${OUT}/pressed-${t}.png`, clip: { x: Math.max(0, bx.x - 40), y: Math.max(0, bx.y - 20), width: bx.width + 80, height: bx.height + 40 } });
	st.rest = rest;
	st.ratio = +ratio(rgb(st.color).slice(0, 3), rgb(st.bg).slice(0, 3)).toFixed(2); st.restRatio = +ratio(rgb(rest.color).slice(0, 3), rgb(rest.bg).slice(0, 3)).toFixed(2);
	out.push({ t, rings, pressed: st });
	console.log(t, JSON.stringify({ rings: rings.map((r) => `${r.focused}/${r.outline}/${r.offset}/${r.ringInsideList}`), pressed: st }));
	await ctx.close();
}
fs.writeFileSync(`${OUT}/focus_active.json`, JSON.stringify(out, null, 1));
await b.close();
