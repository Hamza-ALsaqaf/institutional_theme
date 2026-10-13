// Screenshots of the logged-out pages with this app's CSS injected over the live core page.
// Run: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node shots.mjs [--no-inject]
// /tmp/frag.json holds the masthead, footer and body class rendered by web_content.py (bench console).
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../../..");
const { chromium } = createRequire(path.join(root, "tests/browser/package.json"))("playwright-core");
const BASE = process.env.INS_BASE || "http://localhost:8000";
const inject = !process.argv.includes("--no-inject");
const bench = "/home/user/frappe-bench/apps/frappe/node_modules";
const scss = path.join(root, "institutional_theme/public/scss");
execFileSync("node", [`${bench}/sass/sass.js`, "--no-source-map", `--load-path=${scss}`, path.join(scss, "ins_web.bundle.scss"), "/tmp/ins_web.shots.css"], { stdio: "inherit" });
const css = fs.readFileSync("/tmp/ins_web.shots.css", "utf8");
const frag = JSON.parse(fs.readFileSync("/tmp/frag.json", "utf8"));

const browser = await chromium.launch();
async function shot(name, lang, route, key, action, viewport = { width: 1366, height: 768 }) {
	const ctx = await browser.newContext({ locale: lang === "ar" ? "ar-SA" : "en-US", viewport });
	const page = await ctx.newPage();
	await page.goto(`${BASE}${route}${route.includes("?") ? "&" : "?"}_lang=${lang}`, { waitUntil: "networkidle" });
	if (inject) {
		const f = frag[`${lang}:${key}`];
		await page.evaluate((f) => {
			document.body.insertAdjacentHTML("afterbegin", f.banner_html);
			document.body.insertAdjacentHTML("beforeend", f.body_include);
			f.body_class.trim().split(/\s+/).forEach((c) => document.body.classList.add(c));
		}, f);
		// Prepended to <head>, so it loads BEFORE core's login.bundle.css: specificity alone must win.
		await page.evaluate((c) => { const st = document.createElement("style"); st.textContent = c; document.head.prepend(st); }, css);
	}
	if (action) await action(page);
	await page.waitForTimeout(500);
	if (name.startsWith("login-") && !name.includes("error") && !name.includes("mobile")) {
		console.log(name, JSON.stringify(await page.evaluate(() => {
			const g = (s, p) => getComputedStyle(document.querySelector(s))[p];
			return { btnBg: g(".btn-login", "backgroundColor"), btnBorder: g(".btn-login", "borderTopColor"), inputH: g("#login_email", "height"), inputBorder: g("#login_email", "borderTopColor"), cardBorderTop: g(".for-login .page-card", "borderTopWidth"), logoDisplay: g(".page-card-head .app-logo", "display"), font: g("body", "fontFamily").slice(0, 40), pageBg: g("body", "backgroundColor") };
		})));
	}
	const dir = await page.evaluate(() => document.documentElement.dir);
	await page.screenshot({ path: path.join(here, `${name}.png`), fullPage: true });
	console.log(name, "dir=" + dir, "body class=" + (await page.evaluate(() => document.body.className)));
	await ctx.close();
}
const forgot = async (p) => { await p.evaluate(() => { location.hash = "forgot"; }); await p.waitForTimeout(400); };
const invalid = async (p) => {
	await p.fill("#login_email", "s.alharbi@jiha.example");
	await p.fill("#login_password", "x");
	await p.evaluate(() => { document.querySelector(".page-card-body").classList.add("invalid"); document.querySelector(".login-error-banner").style.display = "flex"; document.querySelector(".login-error-banner span").textContent = document.documentElement.lang === "ar" ? "اسم المستخدم أو كلمة المرور غير صحيحة" : "Invalid login credentials"; });
};
const twofa = async (p) => { await p.evaluate(() => { request_otp(); }); };
for (const lang of ["en", "ar"]) {
	await shot(`login-${lang}`, lang, "/login", "www/login.html");
	await shot(`login-error-${lang}`, lang, "/login", "www/login.html", invalid);
	await shot(`login-mobile-${lang}`, lang, "/login", "www/login.html", null, { width: 390, height: 800 });
	await shot(`forgot-${lang}`, lang, "/login", "www/login.html", forgot);
	await shot(`twofa-${lang}`, lang, "/login", "www/login.html", twofa);
	await shot(`notfound-${lang}`, lang, "/this-page-does-not-exist", "www/404.html");
}
await browser.close();
