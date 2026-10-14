// Shared Playwright helpers for the round-2 CSS evidence (login, contexts, data creation over REST).
import { chromium } from "/opt/pw-node/node_modules/playwright-core/index.mjs";
export const BASE = "http://midad.test:8000";
export const PW = "Css-r2-Pass-9271!";
export const combos = [];
for (const lang of ["en", "ar"]) for (const mode of ["light", "dark"]) combos.push({ lang, mode, user: `css-r2-${lang}-${mode}@midad.test` });
export async function admin() {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({ baseURL: BASE });
	await ctx.request.post("/api/method/login", { form: { usr: "Administrator", pwd: "admin" } });
	return { browser, ctx, api: ctx.request };
}
export async function launch(c, extra = {}) {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({ baseURL: BASE, locale: c.lang === "ar" ? "ar-SA" : "en-US", viewport: { width: 1280, height: 800 }, ...extra });
	const r = await ctx.request.post("/api/method/login", { form: { usr: c.user, pwd: PW } });
	if (!r.ok()) throw new Error("login " + c.user + " " + r.status());
	const page = await ctx.newPage();
	return { browser, ctx, page };
}
export async function ready(page, path) {
	await page.goto(BASE + path, { waitUntil: "load" });
	await page.waitForFunction(() => window.frappe && frappe.router && document.querySelector(".page-container, .layout-main"), null, { timeout: 30000 }).catch(() => {});
	await page.waitForLoadState("networkidle").catch(() => {});
	await page.waitForTimeout(1200);
}
