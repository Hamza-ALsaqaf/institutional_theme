// Shared Playwright helpers for the css-form proof: login, compile, inject.
// Run with PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers.
import { createRequire } from "node:module";
import fs from "node:fs";
const req = createRequire("/home/user/institutional_theme/tests/browser/package.json");
export const { chromium } = req("playwright-core");
export const PW = "Mdd#Test2026x";
export async function open(user, { width = 1366, height = 900, css = null, density = null } = {}) {
	const browser = await chromium.launch({ args: ["--no-sandbox"] });
	const ctx = await browser.newContext({ viewport: { width, height } });
	const page = await ctx.newPage();
	await page.goto("http://localhost:8000/login");
	await page.fill("#login_email", user);
	await page.fill("#login_password", PW);
	await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.click(".btn-login")]);
	return { browser, page, inject: async () => { if (css) await page.addStyleTag({ content: fs.readFileSync(css, "utf8") }); if (density) await page.evaluate((d) => document.documentElement.setAttribute("data-ins-density", d), density); } };
}
export async function goto(page, route) {
	await page.goto("http://localhost:8000" + route);
	await page.waitForFunction(() => window.cur_frm || document.querySelector(".page-head, .layout-main"), null, { timeout: 60000 });
	await page.waitForTimeout(1500);
}
