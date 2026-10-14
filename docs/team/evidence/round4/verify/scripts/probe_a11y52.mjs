// Probe: the elements behind the nine a11y_attrs.mjs checks that fail on v16.52.0. Prints, per language, the selector
// the check uses, whether it matches, and the markup that is found instead. usage: INS_BASE=... node probe_a11y52.mjs
import { createRequire } from "node:module";
const req = createRequire(new URL("../../../../../../tests/browser/package.json", import.meta.url));
const { chromium } = req("playwright-core");
const BASE = process.env.INS_BASE || "http://localhost:8001";
const browser = await chromium.launch();
for (const lang of ["en", "ar"]) {
	for (const blocked of [false, true]) {
		const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: lang === "ar" ? "ar-SA" : "en-US", extraHTTPHeaders: { "Accept-Language": lang } });
		if (blocked) await ctx.route("**/assets/institutional_theme/**", (r) => r.abort());
		const page = await ctx.newPage();
		await page.goto(`${BASE}/login`);
		await page.fill("#login_email", `axe-${lang}-light@midad.test`);
		await page.fill("#login_password", "Mdd#Test2026x");
		await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.press("#login_password", "Enter")]);
		await page.goto(`${BASE}/desk/user`);
		await page.waitForSelector(".list-row-container", { timeout: 30000 });
		await page.waitForTimeout(1500);
		const list = await page.evaluate(() => {
			const q = (s) => document.querySelector(s);
			const brief = (e) => (e ? e.outerHTML.replace(/\s+/g, " ").slice(0, 260) : null);
			return {
				breadcrumbOld: brief(q(".navbar-breadcrumbs > li:first-child > a")),
				breadcrumbAny: brief(q(".navbar-breadcrumbs, .breadcrumb-container, [class*='breadcrumb']")),
				logoOld: brief(q(".sidebar-header .header-logo > img")),
				sidebarHeader: brief(q(".sidebar-header, .body-sidebar .sidebar-header, .sidebar-top")),
				headerButtonOld: brief(q(".sidebar-header > button.drop-icon")),
			};
		});
		await page.goto(`${BASE}/desk/user/axe-${lang}-light%40midad.test`);
		await page.waitForSelector(".form-layout", { timeout: 30000 });
		await page.waitForTimeout(1500);
		const form = await page.evaluate(() => {
			const q = (s) => document.querySelector(s);
			const brief = (e) => (e ? e.outerHTML.replace(/\s+/g, " ").slice(0, 300) : null);
			return { assign: brief(q(".add-assignment-btn")), attach: brief(q(".add-attachment-btn")), share: brief(q(".share-doc-btn")), tags: brief(q(".add-tags-btn")), top: brief(q(".scroll-to-top")) };
		});
		await page.goto(`${BASE}/desk/notification/new`);
		await page.waitForSelector(".form-layout", { timeout: 30000 });
		await page.evaluate(() => { cur_frm.add_child("recipients"); cur_frm.refresh_field("recipients"); });
		await page.waitForTimeout(700);
		await page.locator(".form-grid .grid-row .btn-open-row").first().click();
		await page.waitForSelector(".form-in-grid .frappe-control input, .form-in-grid .frappe-control select", { timeout: 10000 });
		await page.waitForTimeout(1000);
		const editor = await page.evaluate(() => { const e = document.querySelector(".form-in-grid .grid-collapse-row"); return e ? e.outerHTML.replace(/\s+/g, " ").slice(0, 300) : null; });
		console.log(JSON.stringify({ lang, themeBlocked: blocked, list, form, editor }, null, 1));
		await ctx.close();
	}
}
await browser.close();
