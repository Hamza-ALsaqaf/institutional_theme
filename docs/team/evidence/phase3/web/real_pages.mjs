// Real-build (no injection) screenshots of the logged-out pages. Run: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node real_pages.mjs <reset-key>
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../../..");
const { chromium } = createRequire(path.join(root, "tests/browser/package.json"))("playwright-core");
const KEY = process.argv[2], PW = "Web-Test-Pass-4471x", H = "http://midad.test:8000";
const browser = await chromium.launch({ args: ["--no-sandbox", "--no-proxy-server", "--host-resolver-rules=MAP midad.test 127.0.0.1"] });
const results = {};
const ctxFor = (lang) => browser.newContext({ locale: lang === "ar" ? "ar" : "en-US", viewport: { width: 1366, height: 768 }, baseURL: H });
async function check(page, name, lang) {
	const r = await page.evaluate(() => {
		const vis = [...document.querySelectorAll("body *")].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden");
		const ls = vis.filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).letterSpacing) > 0).map((e) => e.tagName + "." + e.className + "=" + getComputedStyle(e).letterSpacing);
		const btn = document.querySelector("button.ins-reveal");
		return { dir: document.documentElement.dir, lang: document.documentElement.lang, bodyClass: document.body.className, ownCss: !!document.querySelector('link[href*="ins_web.bundle"]'), letterSpacingTextNodes: ls.length, letterSpacingSample: ls.slice(0, 3), reveal: btn ? { label: btn.getAttribute("aria-label"), box: (({ width, height }) => [width, height])(btn.getBoundingClientRect()), visible: btn.getClientRects().length > 0 } : null, title: document.title, h1: document.querySelector("h1,h2,.page-card-head")?.textContent.trim() };
	});
	results[`${name}-${lang}`] = r;
	await page.screenshot({ path: path.join(here, `real-${name}-${lang}.png`) });
}
const bench = (py) => execFileSync(path.join(root, "tools/bench/b.sh"), ["console"], { input: py, encoding: "utf8" });
for (const lang of ["en", "ar"]) {
	let ctx = await ctxFor(lang), page = await ctx.newPage();
	await page.goto(`/login?_lang=${lang}#forgot`, { waitUntil: "networkidle" });
	await page.waitForTimeout(300);
	await check(page, "forgot", lang);
	await page.goto(`/update-password?key=${KEY}&_lang=${lang}`, { waitUntil: "networkidle" });
	await page.fill("#new_password", "x").catch(() => {});
	await check(page, "update-password", lang);
	await page.goto(`/no-such-page-xyz?_lang=${lang}`, { waitUntil: "networkidle" });
	await check(page, "404", lang);
	await page.goto(`/printview?doctype=User&name=Administrator&_lang=${lang}`, { waitUntil: "networkidle" });
	await check(page, "403", lang);
	await ctx.close();
	// session expired: log in over REST, open desk, kill the session from a second context, trigger a desk request
	ctx = await ctxFor(lang); page = await ctx.newPage();
	await ctx.request.post("/api/method/login", { form: { usr: "web-session@example.com", pwd: PW } });
	await page.goto(`/app/user?_lang=${lang}`, { waitUntil: "networkidle" });
	bench('import frappe.sessions\nfrappe.sessions.clear_sessions("web-session@example.com", force=True); frappe.db.commit()\n');
	await page.evaluate(() => frappe.call({ method: "frappe.client.get_count", args: { doctype: "User" } }).catch(() => null)).catch(() => null);
	await page.waitForURL(/\/login/, { timeout: 5000 }).catch(() => {});
	results[`session-after-call-${lang}`] = page.url();
	if (!/\/login/.test(page.url())) await page.goto(`/desk/user?_lang=${lang}`);
	await page.waitForLoadState("networkidle");
	results[`session-url-${lang}`] = page.url();
	await check(page, "session-expired", lang);
	await ctx.close();
}
// 2FA: global switch on only for this block; web-twofa-role flags the only affected user. Restored in finally.
try {
	bench('frappe.db.set_single_value("System Settings","enable_two_factor_auth",1); frappe.db.commit()\n');
	for (const lang of ["en", "ar"]) {
		const ctx = await ctxFor(lang), page = await ctx.newPage();
		await page.goto(`/login?_lang=${lang}`, { waitUntil: "networkidle" });
		await page.fill("#login_email", "web-twofa@example.com"); await page.fill("#login_password", PW);
		await page.click(".btn-login");
		await page.waitForTimeout(2500); await page.waitForLoadState("networkidle");
		results[`twofa-url-${lang}`] = page.url();
		await check(page, "2fa", lang);
		await ctx.close();
	}
} finally {
	bench('frappe.db.set_single_value("System Settings","enable_two_factor_auth",0); frappe.db.commit(); print("2FA_NOW", frappe.db.get_single_value("System Settings","enable_two_factor_auth"))\n');
}
await browser.close();
import("node:fs").then((fs) => fs.writeFileSync(path.join(here, "real-pages-check.json"), JSON.stringify(results, null, 1)));
console.log(JSON.stringify(results, null, 1));
