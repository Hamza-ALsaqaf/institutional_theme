// Logs in as Administrator and checks that the HRMS desk routes load and show the seeded records.
// The locale is set explicitly: core calls new Intl.Locale(navigator.language) (alt_keyboard_shortcuts.js:99), which throws in a headless browser without one.
// Login by Enter in the password field: the 16.52 login page has no .btn-login (16.32.0 has; both submit the form on Enter).
// Run: NODE_PATH=/opt/pw-node/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/bench/hrms_check.mjs
import { createRequire } from "node:module";
const req = createRequire("/opt/pw-node/package.json");
const { chromium } = req("playwright-core");
const BASE = process.env.INS_BASE || "http://localhost:8000";
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 800 }, locale: "en-US" })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
await page.goto(`${BASE}/login`);
await page.fill("#login_email", "Administrator");
await page.fill("#login_password", "admin");
await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.press("#login_password", "Enter")]);
let bad = 0;
for (const [route, sel, min] of [
	["/app/employee", ".list-row-container", 5],
	["/desk/leave-application", ".list-row-container", 2],
	["/desk/salary-slip", ".list-row-container", 2],
	["/desk/employee/HR-EMP-00003", ".form-layout", 1],
	["/desk/leave-application/HR-LAP-2026-00001", ".form-layout", 1],
	["/desk/salary-slip/Sal%20Slip%2FHR-EMP-00001%2F00001", ".form-layout", 1],
	["/desk/leaves", ".layout-main-section", 1],
	["/desk/payroll", ".layout-main-section", 1],
]) {
	await page.goto(BASE + route);
	let n = 0;
	try { await page.waitForSelector(sel, { timeout: 30000 }); await page.waitForTimeout(1200); n = await page.locator(sel).count(); } catch { /* counted as failure below */ }
	const ok = n >= min;
	if (!ok) bad++;
	console.log(`${ok ? "PASS" : "FAIL"} ${route} -> ${page.url().replace(BASE, "")} (${sel} x${n}, need ${min})`);
}
console.log(`page errors: ${errors.length}`, errors.slice(0, 3));
await b.close();
process.exit(bad ? 1 : 0);
