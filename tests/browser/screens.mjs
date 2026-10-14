// P0 desk screenshots: en/ar x Light/Dark x comfortable/compact. Run: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node screens.mjs [--inject] [--only=en-light-comfortable]
// --inject compiles institutional_theme/public/scss/ins_desk.bundle.scss with the bench Sass and injects it over the live desk.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const req = createRequire(path.join(here, "package.json"));
const { chromium } = req("playwright-core");
const BASE = process.env.INS_BASE || "http://localhost:8000";
const PASSWORD = "Mdd#Test2026x";
const OUT = path.join(root, "docs/team/evidence/phase3/screens");
const inject = process.argv.includes("--inject");
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);

function compile() {
	const bench = "/home/user/frappe-bench/apps/frappe/node_modules";
	const scss = path.join(root, "institutional_theme/public/scss");
	const out = "/tmp/ins_desk.screens.css";
	execFileSync("node", [`${bench}/sass/sass.js`, "--no-source-map", `--load-path=${scss}`, `--load-path=${bench}`,
		path.join(scss, "ins_desk.bundle.scss"), out], { stdio: "inherit" });
	return fs.readFileSync(out, "utf8");
}

const screens = [
	{ name: "desktop", route: "/desk", wait: ".desktop-container, .layout-main, #body" },
	{ name: "workspace", route: "/desk/build", wait: ".layout-main-section" },
	{ name: "list", route: "/desk/user", wait: ".frappe-list .result, .list-row-container" },
	{ name: "form", route: (u) => `/desk/user/${encodeURIComponent(u)}`, wait: ".form-layout, .layout-main-section" },
	{ name: "report", route: "/desk/user/view/report", wait: ".datatable, .dt-scrollable" },
	{ name: "dialog", route: "/desk/user", wait: ".frappe-list", action: async (page) => {
		await page.evaluate(() => {
			const d = new frappe.ui.Dialog({ title: "Confirm", fields: [{ fieldtype: "Data", label: "Reference", fieldname: "ref" }, { fieldtype: "Select", label: "Kind", fieldname: "kind", options: "A\nB" }], primary_action_label: "Submit", primary_action() {} });
			d.show();
		});
		await page.waitForSelector(".modal.show", { timeout: 10000 });
		await page.waitForTimeout(600);
	} },
];

const css = inject ? compile() : null;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let count = 0;
for (const lang of ["en", "ar"]) for (const mode of ["light", "dark"]) {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: lang === "ar" ? "ar-SA" : "en-US" });
	const page = await ctx.newPage();
	page.on("pageerror", (e) => console.log(`[pageerror ${lang}-${mode}]`, e.message.slice(0, 160)));
	await page.goto(`${BASE}/login`);
	await page.fill("#login_email", `css-shell-${lang}-${mode}@midad.test`);
	await page.fill("#login_password", PASSWORD);
	await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.click(".btn-login")]);
	for (const density of ["comfortable", "compact"]) {
		if (only && only !== `${lang}-${mode}-${density}`) continue;
		for (const s of screens) {
			try {
				await page.goto(BASE + (typeof s.route === "function" ? s.route(`css-shell-${lang}-${mode}@midad.test`) : s.route));
				await page.waitForSelector(s.wait, { timeout: 30000 });
				await page.waitForTimeout(1500);
				if (css) await page.addStyleTag({ content: css });
				await page.evaluate((d) => document.documentElement.setAttribute("data-ins-density", d), density);
				if (s.action) await s.action(page);
				await page.waitForTimeout(400);
				await page.screenshot({ path: path.join(OUT, `${lang}-${mode}-${density}-${s.name}.png`) });
				count++;
			} catch (e) {
				console.log(`FAIL ${lang}-${mode}-${density}-${s.name}: ${e.message.split("\n")[0]}`);
			}
		}
	}
	await ctx.close();
}
await browser.close();
console.log(`screenshots: ${count}`);
