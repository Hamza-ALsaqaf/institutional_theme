// Capture the evidence for one state of the site (before install, installed, after uninstall).
//
//   NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
//     node tools/bench/capture.mjs <label> <out-dir> [base-url]
//
// Writes into <out-dir>:
//   assets-<label>.txt   every <link rel=stylesheet>, <script src> and data-theme attribute found in
//                        the raw server HTML of /login and /app (logged in as Administrator), plus the
//                        data-theme values read from the live DOM after the page has rendered
//   <label>-login.png    /login at 1366x768
//   <label>-todo.png     /app/todo at 1366x768, logged in
//
// Test-only credentials: Administrator / admin (see tools/bench/env.sh).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
// The root container ships "playwright"; the CI runner installs "playwright-core" (same API).
let playwright;
try {
	playwright = require("playwright");
} catch {
	playwright = require("playwright-core");
}
const { chromium } = playwright;

const [label, outDir, baseUrl = "http://midad.test:8000"] = process.argv.slice(2);
if (!label || !outDir) {
	console.error("usage: capture.mjs <label> <out-dir> [base-url]");
	process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const VIEWPORT = { width: 1366, height: 768 };
const user = process.env.SITE_USER || "Administrator";
const password = process.env.SITE_PASSWORD || "admin";

// Pull the facts out of raw HTML. Sorted so that two runs diff cleanly.
function extract(html) {
	const styles = [...html.matchAll(/<link\b[^>]*>/gi)]
		.map((m) => m[0])
		.filter((tag) => /rel=["']?stylesheet/i.test(tag))
		.map((tag) => (tag.match(/href=["']([^"']+)["']/i) || [])[1])
		.filter(Boolean);
	const scripts = [...html.matchAll(/<script\b[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]);
	const themes = [...html.matchAll(/\bdata-theme[\w-]*=["'][^"']*["']/gi)].map((m) => m[0]);
	return { styles, scripts, themes };
}

// Bundle file names carry a content hash (for example desk.bundle.ABC123.css). Keep the raw URL
// and also print the hash-free name so a hash change is visible but a structure change is clear.
function section(title, items) {
	return [`## ${title} (${items.length})`, ...items.map((i) => i), ""].join("\n");
}

const browser = await chromium.launch({
	args: ["--no-sandbox", "--no-proxy-server", "--host-resolver-rules=MAP midad.test 127.0.0.1"],
});
const context = await browser.newContext({ viewport: VIEWPORT, locale: "en-US" });
const lines = [`# asset list: ${label}`, `# base url: ${baseUrl}`, ""];

async function rawHtml(url) {
	const response = await context.request.get(url);
	return { status: response.status(), html: await response.text() };
}

// Logged-out /login
{
	const { status, html } = await rawHtml(`${baseUrl}/login`);
	const found = extract(html);
	lines.push(`# GET /login -> ${status}`, "");
	lines.push(section("/login stylesheets", found.styles));
	lines.push(section("/login scripts", found.scripts));
	lines.push(section("/login data-theme attributes (raw html)", found.themes));

	const page = await context.newPage();
	await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
	await page.waitForTimeout(500);
	const live = await page.evaluate(() => ({
		dataTheme: document.documentElement.getAttribute("data-theme"),
		dataThemeMode: document.documentElement.getAttribute("data-theme-mode"),
		bodyDataTheme: document.body.getAttribute("data-theme"),
	}));
	lines.push("## /login data-theme (live DOM)", JSON.stringify(live), "");
	await page.screenshot({ path: path.join(outDir, `${label}-login.png`), animations: "disabled", caret: "hide" });
	await page.close();
}

// Log in through the same endpoint the login form uses.
{
	const response = await context.request.post(`${baseUrl}/api/method/login`, {
		form: { usr: user, pwd: password },
	});
	lines.push(`# POST /api/method/login -> ${response.status()}`, "");
	if (!response.ok()) {
		writeFileSync(path.join(outDir, `assets-${label}.txt`), lines.join("\n"));
		console.error("login failed", response.status(), await response.text());
		await browser.close();
		process.exit(1);
	}
}

// Logged-in /app (raw HTML of the desk shell) and the rendered ToDo list.
{
	const { status, html } = await rawHtml(`${baseUrl}/app`);
	const found = extract(html);
	lines.push(`# GET /app -> ${status}`, "");
	lines.push(section("/app stylesheets", found.styles));
	lines.push(section("/app scripts", found.scripts));
	lines.push(section("/app data-theme attributes (raw html)", found.themes));

	const page = await context.newPage();
	await page.goto(`${baseUrl}/app/todo`, { waitUntil: "load" });
	await page.waitForSelector(".page-head", { timeout: 60000 });
	await page.waitForTimeout(3000);
	const live = await page.evaluate(() => ({
		dataTheme: document.documentElement.getAttribute("data-theme"),
		dataThemeMode: document.documentElement.getAttribute("data-theme-mode"),
		bodyDataTheme: document.body.getAttribute("data-theme"),
		stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href")),
	}));
	lines.push("## /app/todo data-theme (live DOM)", JSON.stringify({ ...live, stylesheets: undefined }), "");
	lines.push(section("/app/todo stylesheets (live DOM)", live.stylesheets));
	await page.screenshot({ path: path.join(outDir, `${label}-todo.png`), animations: "disabled", caret: "hide" });
	await page.close();
}

writeFileSync(path.join(outDir, `assets-${label}.txt`), lines.join("\n") + "\n");
await browser.close();
console.log(`captured ${label} into ${outDir}`);
