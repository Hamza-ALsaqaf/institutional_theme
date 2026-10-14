// Geometry of the breadcrumb list and links (clip rect versus link boxes). Usage: node geo.mjs en|ar
import { createRequire } from "node:module";
const req = createRequire("/home/runner/work/institutional_theme/institutional_theme/tests/browser/package.json");
const { chromium } = req("playwright-core");
const lang = process.argv[2] || "en";
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: lang === "ar" ? "ar-SA" : "en-US", extraHTTPHeaders: { "Accept-Language": lang }, reducedMotion: "reduce" });
const page = await ctx.newPage();
await page.goto("http://localhost:8000/login"); await page.fill("#login_email", `css3-${lang}-light@midad.test`); await page.fill("#login_password", "Mdd#Test2026x");
await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.click(".btn-login")]);
await page.goto(`http://localhost:8000/desk/user/${encodeURIComponent(`css3-${lang}-light@midad.test`)}`); await page.waitForSelector(".navbar-breadcrumbs li"); await page.waitForTimeout(2500);
console.log(JSON.stringify(await page.evaluate(() => { const ul = document.querySelector(".navbar-breadcrumbs"); const cs = getComputedStyle(ul); const r = (e) => { const x = e.getBoundingClientRect(); return [x.left, x.top, x.right, x.bottom].map((v) => +v.toFixed(1)); };
	const anc = []; for (let e = ul; e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e); if (c.overflowX !== 'visible' || c.overflowY !== 'visible' || c.contain !== 'none' || c.clipPath !== 'none') anc.push([e.tagName + '.' + e.className.toString().slice(0, 40), c.overflowX + '/' + c.overflowY, r(e)]); }
	return { anc, overflow: cs.overflow, clipMargin: cs.overflowClipMargin, ul: r(ul), links: [...ul.querySelectorAll(":scope > li > a")].map((a) => ({ r: r(a), display: getComputedStyle(a).display })) }; })));
await b.close();
