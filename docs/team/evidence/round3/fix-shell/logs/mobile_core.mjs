import { chromium, BASE } from "./lib.mjs";
const OUT = process.argv[2];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const res = {};
for (const variant of ["core", "themed"]) {
	const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "en-US", extraHTTPHeaders: { "Accept-Language": "en" }, reducedMotion: "reduce" });
	if (variant === "core") await ctx.route("**/assets/institutional_theme/**", (r) => r.abort());
	const page = await ctx.newPage();
	await page.goto(`${BASE}/login`);
	await page.fill("#login_email", "axe-en-light@midad.test");
	await page.fill("#login_password", "Mdd#Test2026x");
	await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.click(".btn-login")]);
	await page.goto(BASE + "/desk/user");
	await page.waitForSelector(".list-row-container", { timeout: 30000 });
	await page.waitForTimeout(2500);
	res[variant] = await page.evaluate(() => [...document.querySelectorAll(".list-row .indicator-pill")].slice(0, 8).map((p) => { const r = p.getBoundingClientRect(); const par = p.closest(".level-right") || p.parentElement; const pr = par.getBoundingClientRect(); return { text: p.textContent.trim(), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), parentLeft: Math.round(pr.left), parentRight: Math.round(pr.right), parentOverflow: getComputedStyle(par).overflow, clipped: r.left < pr.left - 1 || r.right > pr.right + 1 }; }));
	await page.screenshot({ path: `${OUT}/mobile-375-list-${variant}.png`, clip: { x: 0, y: 0, width: 375, height: 560 } });
	await ctx.close();
}
console.log(JSON.stringify(res, null, 1));
await b.close();
