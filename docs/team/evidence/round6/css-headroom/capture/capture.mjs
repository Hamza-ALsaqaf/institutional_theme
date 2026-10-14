// Screenshots plus a deterministic computed-style dump of the desk, for a before and after comparison
// (docs/team/evidence/round6/css-headroom). Test-bench only; reads the bench, never builds or restarts it.
//
//   NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
//     node capture.mjs --version 16.32.0 --out DIR [--bench-dir /home/user/frappe-bench] [--only SUBSTRING] [--matrix main|extra|all]
//
// --version  16.32.0 (http://midad.test:8000, route prefix /app, densities comfortable+compact) or
//            16.52.0 (http://midad52.test:8001, /desk, comfortable only).
// --out      output folder; the same script runs unchanged into before/<version>/ and after/<version>/.
// --bench-dir  bench whose sites/assets/assets.json is hashed at the start and the end of the run.
// --only     run only captures whose id contains this text (ids look like en-light-comfortable-list).
//
// Users: css-headroom-en@example.com and css-headroom-ar@example.com (System Manager), created on first use.
// Administrator is used only to create those users and to set THEIR language and desk theme; its own
// language and theme are never touched. Time is frozen with page.clock.setFixedTime so relative dates do
// not move between runs; transitions and animations are switched off by an injected style sheet so a
// computed colour is never read in the middle of a transition (the same sheet is injected before and after).
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const arg = (name, fallback) => {
	const index = process.argv.indexOf(`--${name}`);
	return index === -1 ? fallback : process.argv[index + 1];
};
const version = arg("version");
const outDir = arg("out");
if (!version || !outDir) {
	console.error("usage: capture.mjs --version 16.32.0|16.52.0 --out DIR [--bench-dir DIR] [--only TEXT] [--matrix main|extra|all]");
	process.exit(2);
}
const only = arg("only", "");
const matrix = arg("matrix", "all");
const benchDir = arg("bench-dir", version === "16.32.0" ? "/home/user/frappe-bench" : "/home/frappe/newest-bench");
const base = version === "16.32.0" ? "http://midad.test:8000" : "http://midad52.test:8001";
const P = version === "16.32.0" ? "/app" : "/desk";
const densities = version === "16.32.0" ? ["comfortable", "compact"] : ["comfortable"];
const hostname = new URL(base).hostname;
const names = JSON.parse(readFileSync(new URL("./names.json", import.meta.url), "utf8"));
const PASSWORD = "Css-Headroom-1!x";
const FIXED_TIME = new Date("2030-06-15T12:00:00Z");
const FILTER = "%5B%22like%22%2C%22css-headroom-%25%22%5D"; // ["like","css-headroom-%"]: only the test users, so row counts never drift

// What a design token can reach: colour, surface, line, shadow, shape, type, size and spacing (the list of
// tools/bench/web_style_capture.mjs).
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

const screens = (lang) => [
	{ name: "desktop", route: P, wait: "body" },
	{ name: "workspace", route: `${P}/build`, wait: ".layout-main-section" },
	{ name: "list", route: `${P}/user?name=${FILTER}`, wait: ".frappe-list .result, .list-row-container" },
	{ name: "form", route: `${P}/user/css-headroom-${lang}%40example.com`, wait: ".form-layout" },
	{ name: "report", route: `${P}/user/view/report?name=${FILTER}`, wait: ".datatable, .dt-scrollable" },
	{
		name: "dialog",
		route: `${P}/user?name=${FILTER}`,
		wait: ".frappe-list",
		action: async (page) => {
			await page.evaluate(() => {
				new frappe.ui.Dialog({
					title: "Confirm",
					fields: [
						{ fieldtype: "Data", label: "Reference", fieldname: "ref" },
						{ fieldtype: "Select", label: "Kind", fieldname: "kind", options: "A\nB" },
					],
					primary_action_label: "Submit",
					primary_action() {},
				}).show();
			});
			await page.waitForSelector(".modal.show", { timeout: 10000 });
			await page.waitForTimeout(600);
		},
	},
];
const switcher = {
	name: "switcher",
	route: `${P}/user?name=${FILTER}`,
	wait: ".frappe-list",
	action: async (page) => {
		await page.evaluate(() => new frappe.ui.ThemeSwitcher().show());
		await page.waitForSelector(".modal.show .theme-grid [data-theme]", { timeout: 10000 });
		await page.waitForTimeout(800);
	},
};

// ---- Captures to run.
const plan = [];
if (matrix === "main" || matrix === "all") {
	for (const lang of ["en", "ar"])
		for (const mode of ["light", "dark"])
			for (const density of densities)
				for (const screen of screens(lang))
					plan.push({ id: `${lang}-${mode}-${density}-${screen.name}`, lang, theme: mode[0].toUpperCase() + mode.slice(1), scheme: "light", density, screen });
}
if (matrix === "extra" || matrix === "all") {
	for (const scheme of ["dark", "light"]) {
		const list = screens("en");
		for (const name of ["desktop", "list", "form"])
			plan.push({ id: `en-automatic-os${scheme}-comfortable-${name}`, lang: "en", theme: "Automatic", scheme, density: "comfortable", screen: list.find((s) => s.name === name) });
		plan.push({ id: `en-automatic-os${scheme}-comfortable-switcher`, lang: "en", theme: "Automatic", scheme, density: "comfortable", screen: switcher });
	}
	for (const mode of ["light", "dark"])
		plan.push({ id: `en-${mode}-comfortable-switcher`, lang: "en", theme: mode[0].toUpperCase() + mode.slice(1), scheme: "light", density: "comfortable", screen: switcher });
}
const selected = plan.filter((item) => item.id.includes(only));

// ---- Bundle hashes from the bench's sites/assets/assets.json.
function bundleState() {
	const state = { at: new Date().toISOString(), bench: benchDir };
	for (const [file, key] of [["assets.json", "ins_desk.bundle.css"], ["assets-rtl.json", "rtl_ins_desk.bundle.css"]]) {
		const assets = JSON.parse(readFileSync(path.join(benchDir, "sites/assets", file), "utf8"));
		const url = assets[key];
		const bytes = readFileSync(path.join(benchDir, "sites", url.replace(/^\//, "")));
		state[key] = { url, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
	}
	return state;
}

mkdirSync(path.join(outDir, "screens"), { recursive: true });
mkdirSync(path.join(outDir, "dumps"), { recursive: true });
const started = bundleState();
writeFileSync(path.join(outDir, "bundle-start.json"), JSON.stringify(started, null, 1) + "\n");
console.log("bundle at start", JSON.stringify(started));

const browser = await chromium.launch({ args: ["--no-sandbox", "--no-proxy-server", `--host-resolver-rules=MAP ${hostname} 127.0.0.1`] });
const newContext = async (colorScheme = "light") => {
	const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "en-US", colorScheme });
	return context;
};

// ---- Administrator: only to create the css-headroom users and to set their language and theme.
const adminContext = await newContext();
const admin = await adminContext.newPage();
const adminLogin = await adminContext.request.post(`${base}/api/method/login`, { form: { usr: "Administrator", pwd: "admin" } });
if (adminLogin.status() !== 200) throw new Error(`Administrator login failed: ${adminLogin.status()}`);
await admin.goto(`${base}${P}`, { waitUntil: "domcontentloaded" });
await admin.waitForFunction(() => window.frappe && frappe.csrf_token && frappe.csrf_token !== "{{ csrf_token }}", null, { timeout: 60000 });
const api = (method, url, body) =>
	admin.evaluate(
		async ([method, url, body]) => {
			const response = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json", "X-Frappe-CSRF-Token": frappe.csrf_token },
				body: body ? JSON.stringify(body) : undefined,
			});
			return { status: response.status, text: (await response.text()).slice(0, 300) };
		},
		[method, url, body],
	);
const emailOf = (lang) => `css-headroom-${lang}@example.com`;
for (const lang of ["en", "ar"]) {
	const exists = await api("GET", `/api/resource/User/${encodeURIComponent(emailOf(lang))}`);
	if (exists.status === 404 || exists.status === 403) {
		const created = await api("POST", "/api/resource/User", {
			email: emailOf(lang),
			first_name: `CssHeadroom${lang.toUpperCase()}`,
			enabled: 1,
			send_welcome_email: 0,
			new_password: PASSWORD,
			language: lang,
			desk_theme: "Light",
			roles: [{ role: "System Manager" }],
		});
		console.log("create user", emailOf(lang), created.status);
		if (created.status >= 300) throw new Error(`cannot create ${emailOf(lang)}: ${created.text}`);
	} else {
		await api("PUT", `/api/resource/User/${encodeURIComponent(emailOf(lang))}`, { language: lang, enabled: 1, new_password: PASSWORD });
		console.log("user exists", emailOf(lang), exists.status);
	}
}
const setTheme = async (lang, theme) => {
	const result = await api("PUT", `/api/resource/User/${encodeURIComponent(emailOf(lang))}`, { desk_theme: theme, language: lang });
	if (result.status !== 200) throw new Error(`cannot set theme ${theme} for ${lang}: ${result.status} ${result.text}`);
};

// ---- Per-user browser contexts, logged in once per colour scheme.
const sessions = new Map();
async function session(lang, scheme) {
	const key = `${lang}/${scheme}`;
	if (sessions.has(key)) return sessions.get(key);
	const context = await newContext(scheme);
	const login = await context.request.post(`${base}/api/method/login`, { form: { usr: emailOf(lang), pwd: PASSWORD } });
	if (login.status() !== 200) throw new Error(`login ${emailOf(lang)}: ${login.status()}`);
	const page = await context.newPage();
	page.setDefaultTimeout(30000);
	page.on("pageerror", (error) => console.log("[pageerror]", error.message.slice(0, 160)));
	await page.clock.setFixedTime(FIXED_TIME);
	sessions.set(key, { context, page });
	return sessions.get(key);
}

// ---- The dump: every mapped variable on html and on every nested [data-theme] element, and the computed style
// of every element for PROPERTIES (deduplicated into a table of distinct style strings).
const dumpPage = (page) =>
	page.evaluate(
		({ names, PROPERTIES }) => {
			const root = document.documentElement;
			const variables = (el) => {
				const cs = getComputedStyle(el);
				const found = {};
				for (const name of names) found[name] = cs.getPropertyValue(name).trim();
				return found;
			};
			const attributes = (el) => Object.fromEntries([...el.attributes].filter((a) => a.name !== "style").map((a) => [a.name, a.value.slice(0, 80)]));
			const table = new Map();
			const paths = [];
			const index = [];
			const walk = (el, at) => {
				const cs = getComputedStyle(el);
				const key = `${at}>${el.localName}${el.id ? "#" + el.id : ""}`;
				const text = PROPERTIES.map((name) => cs.getPropertyValue(name)).join("|");
				if (!table.has(text)) table.set(text, table.size);
				paths.push(key);
				index.push(table.get(text));
				for (const pseudo of ["::before", "::after"]) {
					const ps = getComputedStyle(el, pseudo);
					if (ps.content && ps.content !== "none" && ps.content !== "normal") {
						const ptext = PROPERTIES.map((name) => ps.getPropertyValue(name)).join("|");
						if (!table.has(ptext)) table.set(ptext, table.size);
						paths.push(key + pseudo);
						index.push(table.get(ptext));
					}
				}
				[...el.children].forEach((child, i) => {
					if (child.id === "all-symbols") return; // the icon sprite, never painted
					if (["SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT", "TITLE", "symbol", "defs"].includes(child.tagName)) return;
					walk(child, `${key}[${i}]`);
				});
			};
			walk(root, "");
			const nested = [...document.querySelectorAll("[data-theme]")]
				.filter((el) => el !== root)
				.map((el) => {
					const chain = [];
					for (let node = el; node && node !== root; node = node.parentElement) {
						chain.unshift(`${node.localName}${node.id ? "#" + node.id : ""}.${[...node.classList].slice(0, 3).join(".")}`);
					}
					return { path: chain.join(" > "), attrs: attributes(el), variables: variables(el) };
				});
			return {
				root: { attrs: attributes(root), variables: variables(root) },
				nested,
				properties: PROPERTIES,
				styles: [...table.keys()],
				paths,
				index,
				stylesheets: [...document.styleSheets].map((s) => (s.href || "inline").replace(/^.*\/assets\//, "")),
			};
		},
		{ names, PROPERTIES },
	);

const results = [];
let lastTheme = new Map();
for (const item of selected) {
	const { lang, theme, scheme, density, screen } = item;
	const entry = { id: item.id, lang, theme, os: scheme, density, screen: screen.name };
	try {
		if (lastTheme.get(lang) !== theme) {
			await setTheme(lang, theme);
			lastTheme.set(lang, theme);
		}
		const { page } = await session(lang, scheme);
		await page.emulateMedia({ colorScheme: scheme });
		await page.goto(base + screen.route);
		await page.waitForSelector(screen.wait, { timeout: 30000 });
		await page.waitForTimeout(2500);
		await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}" });
		await page.evaluate((d) => document.documentElement.setAttribute("data-ins-density", d), density);
		if (screen.action) await screen.action(page);
		await page.waitForTimeout(500);
		entry.info = await page.evaluate(() => {
			const html = document.documentElement;
			return { dir: html.dir, lang: html.lang, dataTheme: html.dataset.theme, mode: html.dataset.themeMode, hscroll: html.scrollWidth > innerWidth + 1, path: location.pathname + location.search };
		});
		await page.screenshot({ path: path.join(outDir, "screens", `${item.id}.png`), animations: "disabled", caret: "hide" });
		const dump = await dumpPage(page);
		dump.id = item.id;
		dump.info = entry.info;
		writeFileSync(path.join(outDir, "dumps", `${item.id}.json.gz`), gzipSync(JSON.stringify(dump), { level: 9 }));
		entry.elements = dump.paths.length;
		entry.distinctStyles = dump.styles.length;
		entry.nestedThemeElements = dump.nested.length;
		entry.rootVariablesNonEmpty = Object.values(dump.root.variables).filter(Boolean).length;
		console.log(`ok ${item.id}: ${entry.elements} elements, ${entry.distinctStyles} styles, ${entry.nestedThemeElements} nested, data-theme=${entry.info.dataTheme}/${entry.info.mode}`);
	} catch (error) {
		entry.fail = error.message.split("\n")[0];
		console.log(`FAIL ${item.id}: ${entry.fail}`);
	}
	results.push(entry);
}

const ended = bundleState();
writeFileSync(path.join(outDir, "bundle-end.json"), JSON.stringify(ended, null, 1) + "\n");
writeFileSync(path.join(outDir, "index.json"), JSON.stringify({ version, base, matrix, only, started: started.at, ended: ended.at, results }, null, 1) + "\n");
console.log("bundle at end", JSON.stringify(ended));
console.log(`captures ok ${results.filter((r) => !r.fail).length} of ${results.length}`);
await browser.close();
