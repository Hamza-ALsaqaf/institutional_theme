import { createRequire } from "node:module";
const req = createRequire("/home/runner/work/institutional_theme/institutional_theme/tests/browser/package.json");
export const { chromium } = req("playwright-core");
export const BASE = "http://localhost:8000";
export async function login(browser, lang = "en", opts = {}) {
	const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 }, locale: lang === "ar" ? "ar-SA" : "en-US", extraHTTPHeaders: { "Accept-Language": lang }, reducedMotion: "reduce" });
	if (opts.block) await ctx.route(opts.block, (r) => r.abort());
	const page = await ctx.newPage();
	await page.goto(`${BASE}/login`);
	await page.fill("#login_email", `axe-${lang}-light@midad.test`);
	await page.fill("#login_password", "Mdd#Test2026x");
	await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.click(".btn-login")]);
	return { ctx, page };
}
