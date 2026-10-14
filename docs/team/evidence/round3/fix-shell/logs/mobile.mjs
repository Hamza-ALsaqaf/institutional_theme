import { chromium, BASE } from "./lib.mjs";
import fs from "node:fs";
const OUT = process.argv[2];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const res = [];
for (const variant of ["themed-zoomable", "core-viewport"]) {
	const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "en-US", extraHTTPHeaders: { "Accept-Language": "en" }, reducedMotion: "reduce" });
	// "core-viewport": same theme, but the original meta is restored by blocking only the viewport module's effect (re-write the meta on load)
	const page = await ctx.newPage();
	await page.goto(`${BASE}/login`);
	await page.fill("#login_email", "axe-en-light@midad.test");
	await page.fill("#login_password", "Mdd#Test2026x");
	await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.click(".btn-login")]);
	for (const [name, route, wait] of [["list", "/desk/user", ".list-row-container"], ["form", "/desk/user/axe-en-light@midad.test", ".form-layout"], ["report", "/desk/user/view/report", ".datatable"]]) {
		await page.goto(BASE + route);
		await page.waitForSelector(wait, { timeout: 30000, state: "attached" });
		await page.waitForTimeout(2500);
		const m = await page.evaluate(() => ({ meta: document.querySelector("meta[name=viewport]").content, innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, vv: window.visualViewport && { scale: visualViewport.scale, width: visualViewport.width } }));
		res.push({ variant, name, ...m });
		if (variant === "themed-zoomable") await page.screenshot({ path: `${OUT}/mobile-375-${name}.png` });
	}
	await ctx.close();
	break;
}
fs.writeFileSync(`${OUT}/mobile-375.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
await b.close();
