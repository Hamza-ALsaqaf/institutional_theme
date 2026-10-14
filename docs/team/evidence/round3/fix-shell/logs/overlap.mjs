import { chromium, BASE } from "./lib.mjs";
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "en-US", reducedMotion: "reduce" });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.fill("#login_email", "axe-en-light@midad.test");
await page.fill("#login_password", "Mdd#Test2026x");
await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.click(".btn-login")]);
await page.goto(BASE + "/desk/user");
await page.waitForSelector(".list-row-container", { timeout: 30000 });
await page.waitForTimeout(2500);
console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll(".list-row-container")].slice(1, 4).map((c) => {
	const pill = [...c.querySelectorAll(".indicator-pill")].find((p) => p.getBoundingClientRect().width > 0);
	const r = pill.getBoundingClientRect();
	const top = document.elementFromPoint(r.left + 8, r.top + r.height / 2);
	const chain = []; for (let e = top; e && e !== c; e = e.parentElement) chain.push(e.tagName.toLowerCase() + "." + [...e.classList].join(".") + "[" + getComputedStyle(e).backgroundColor + "|z=" + getComputedStyle(e).zIndex + "|pos=" + getComputedStyle(e).position + "]");
	return { pill: [Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.bottom)], hit: chain.slice(0, 4) };
})), null, 1));
await b.close();
