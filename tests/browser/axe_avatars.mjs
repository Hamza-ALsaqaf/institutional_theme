// Contrast of the nine Frappe avatar colour pairs (common.js:149-157 in 16.32.0) with the theme and with it blocked, Light and Dark.
// The avatar colour of a user is picked from the name, so a scan only meets the pairs of the users it happens to show.
//   cd tests/browser && PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node axe_avatars.mjs > ../../docs/team/evidence/round3/axe/avatar-pairs.md
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const req = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "package.json"));
const { chromium } = req("playwright-core");
const BASE = process.env.INS_BASE || "http://localhost:8000";
const NAMES = ["orange", "pink", "blue", "green", "dark-green", "red", "yellow", "purple", "gray"];
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const parse = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const browser = await chromium.launch({ args: ["--no-sandbox"] });
console.log("# Avatar colour pairs (4.5:1 required for the 12 to 14 px initials)\n\n| mode | variant | pair | foreground | background | ratio | pass |\n|---|---|---|---|---|---|---|");
for (const mode of ["light", "dark"]) for (const variant of ["themed", "core"]) {
	const ctx = await browser.newContext({ locale: "en-US" });
	if (variant === "core") await ctx.route("**/assets/institutional_theme/**", (r) => r.abort());
	const page = await ctx.newPage();
	await page.goto(`${BASE}/login`);
	await page.fill("#login_email", `axe-en-${mode}@midad.test`);
	await page.fill("#login_password", "Mdd#Test2026x");
	await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.press("#login_password", "Enter")]);
	await page.waitForSelector(".body-sidebar", { timeout: 30000, state: "attached" });
	await page.waitForTimeout(1500);
	const pairs = await page.evaluate((names) => names.map((n) => {
		const e = document.createElement("span");
		e.style.cssText = `background-color: var(--${n}-avatar-bg); color: var(--${n}-avatar-color)`;
		document.body.appendChild(e);
		const cs = getComputedStyle(e), out = [n, cs.color, cs.backgroundColor, document.documentElement.dataset.theme];
		e.remove();
		return out;
	}), NAMES);
	for (const [n, fg, bg] of pairs) { const f = parse(fg), b = parse(bg), r = ratio(f, b); console.log(`| ${mode} | ${variant} | ${n} | ${hex(f)} | ${hex(b)} | ${r.toFixed(2)} | ${r >= 4.5 ? "yes" : "NO"} |`); }
	await ctx.close();
}
await browser.close();
