// Computed style of every element of the website pages, for a before and after comparison.
//
//   node tools/bench/web_style_capture.mjs <base-url> <out.json>
//
// Test-bench only. It loads the login pages (English and Arabic), the 404 page and, logged in as the test
// Administrator (tools/bench/env.sh), the portal pages and two web forms, waits for network idle, and records for
// every element of `html` the resolved value of every CSS property (and of ::before and ::after when they
// generate content), plus the resolved value of every custom property named in `names.json` on `html`.
// tools/bench/web_style_diff.py compares two such files. Needs playwright-core (tests/browser/node_modules).
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";

const require = createRequire(new URL("../../tests/browser/", import.meta.url));
const { chromium } = require("playwright-core");

const [base, out, namesFile] = process.argv.slice(2);
if (!base || !out) {
	console.error("usage: web_style_capture.mjs <base-url> <out.json> [names.json]");
	process.exit(2);
}
const names = namesFile ? JSON.parse(readFileSync(namesFile, "utf8")) : [];
const host = new URL(base).hostname;

const PUBLIC = [
	["login-en", "/login?_lang=en"],
	["login-ar", "/login?_lang=ar"],
	["login-forgot-en", "/login?_lang=en#forgot"],
	["login-forgot-ar", "/login?_lang=ar#forgot"],
	["login-email-link-en", "/login?_lang=en#login-with-email-link"],
	["update-password", "/update-password?key=none"],
	["not-found", "/404-no-such-page"],
];
const SIGNED_IN = [
	["me", "/me"],
	["third-party-apps", "/third_party_apps"],
	["orders", "/orders"],
	["portal", "/portal"],
	["timesheets", "/timesheets"],
	["webform-account-deletion", "/request-for-account-deletion/new"],
	["webform-task", "/tasks/new"],
];

// The properties a design token can reach: colour, surface, line, shadow, shape, type and spacing. Reading all
// ~350 properties of the ~10,000 elements of a Frappe page (most of them in the icon sprite) takes minutes.
const PROPERTIES = [
	"color", "background-color", "background-image", "border-top-color", "border-right-color", "border-bottom-color",
	"border-left-color", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
	"border-top-style", "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius",
	"border-bottom-right-radius", "outline-color", "outline-width", "outline-style", "outline-offset", "box-shadow",
	"text-shadow", "fill", "stroke", "stroke-width", "opacity", "caret-color", "accent-color", "text-decoration-color",
	"text-decoration-line", "font-family", "font-size", "font-weight", "line-height", "letter-spacing",
	"padding-top", "padding-right", "padding-bottom", "padding-left", "margin-top", "margin-right",
	"margin-bottom", "margin-left", "width", "height", "display", "visibility", "z-index", "content", "gap",
	"scrollbar-color", "color-scheme",
];

const snapshot = (page, customNames) =>
	page.evaluate(({ customNames, PROPERTIES }) => {
		const props = (cs) => PROPERTIES.map((name) => `${name}:${cs.getPropertyValue(name)}`).join(";");
		const elements = {};
		const walk = (el, path) => {
			const cs = getComputedStyle(el);
			const key = `${path}>${el.localName}${el.id ? "#" + el.id : ""}`;
			elements[key] = props(cs);
			for (const pseudo of ["::before", "::after"]) {
				const ps = getComputedStyle(el, pseudo);
				if (ps.content && ps.content !== "none" && ps.content !== "normal") elements[key + pseudo] = props(ps);
			}
			[...el.children].forEach((child, index) => {
				if (child.id === "all-symbols") return; // the icon sprite, injected after load, never painted
				if (["SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT", "TITLE", "symbol", "defs"].includes(child.tagName)) return;
				walk(child, `${key}[${index}]`);
			});
		};
		walk(document.documentElement, "");
		const root = getComputedStyle(document.documentElement);
		const custom = {};
		for (const name of customNames) custom[name] = root.getPropertyValue(name).trim();
		return { elements, custom, dir: document.documentElement.dir };
	}, { customNames, PROPERTIES });

const browser = await chromium.launch({ args: ["--no-sandbox", "--no-proxy-server", `--host-resolver-rules=MAP ${host} 127.0.0.1`] });
const result = {};
const started = Date.now();
async function visit(context, list) {
	for (const [label, path] of list) {
		const page = await context.newPage();
		const response = await page.goto(base + path, { waitUntil: "networkidle" });
		await page.waitForTimeout(400);
		const shot = await snapshot(page, names);
		result[label] = {
			path,
			status: response.status(),
			stylesheets: await page.evaluate(() =>
				[...document.styleSheets].map((s) => (s.href || "inline").replace(/^.*\/assets\//, "")),
			),
			...shot,
		};
		await page.close();
	}
}
const visitor = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await visit(visitor, PUBLIC);
await visitor.close();
const admin = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const probe = await admin.newPage();
await probe.goto(`${base}/login`, { waitUntil: "networkidle" });
const login = await probe.request.post(`${base}/api/method/login`, { form: { usr: "Administrator", pwd: "admin" } });
if (login.status() !== 200) throw new Error(`login failed: ${login.status()}`);
await probe.close();
await visit(admin, SIGNED_IN);
await admin.close();
await browser.close();
writeFileSync(out, JSON.stringify(result));
for (const [label, page] of Object.entries(result)) {
	console.log(`${label}: ${page.status} ${Object.keys(page.elements).length} elements, ${page.stylesheets.length} stylesheets`);
}
