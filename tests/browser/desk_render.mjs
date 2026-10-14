// Render check of the desk on a live bench (round 4, ADR 0011): the To Do list and a To Do form with a status chip,
// Light and Dark, English and Arabic, both densities, plus the computed colours of the primary action and one status badge.
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node desk_render.mjs <label> <base-url> <out-dir>
//   e.g. desk_render.mjs 16.52.0 http://midad52.test:8001 docs/team/evidence/round4/desk
// Test-only credentials: Administrator / admin (tools/bench/env.sh). The script changes Administrator's language and theme and restores them.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(join(here, "package.json"))("playwright-core");
const [label, base, outArg] = process.argv.slice(2);
if (!label || !base || !outArg) throw new Error("usage: desk_render.mjs <label> <base-url> <out-dir>");
const out = resolve(outArg);
mkdirSync(out, { recursive: true });
const host = new URL(base).hostname;

const browser = await chromium.launch({ args: ["--no-sandbox", "--no-proxy-server", `--host-resolver-rules=MAP ${host} 127.0.0.1`] });
const api = await (await browser.newContext()).request;
const login = await api.post(`${base}/api/method/login`, { form: { usr: "Administrator", pwd: "admin" } });
if (!login.ok()) throw new Error("login failed " + login.status());
const call = async (method, url, data) => {
	const r = await api.fetch(`${base}${url}`, { method, data, headers: { "X-Frappe-CSRF-Token": csrf } });
	if (!r.ok()) throw new Error(`${method} ${url} -> ${r.status()} ${(await r.text()).slice(0, 200)}`);
	return r.json();
};
let csrf = "";
{
	const html = await (await api.get(`${base}/app`)).text();
	csrf = (html.match(/csrf_token\s*=\s*"([^"]+)"/) || [])[1] || "";
}
const original = (await call("GET", "/api/resource/User/Administrator")).data;

// Three To Dos with distinct statuses give three distinct chips.
const names = {};
for (const [status, description] of [["Open", "Render check open"], ["Closed", "Render check closed"], ["Cancelled", "Render check cancelled"]]) {
	const found = (await call("GET", `/api/resource/ToDo?filters=${encodeURIComponent(JSON.stringify([["description", "=", description]]))}&fields=["name"]`)).data;
	names[status] = found.length ? found[0].name : (await call("POST", "/api/resource/ToDo", { description, status })).data.name;
}

const results = [];
try {
	for (const lang of ["en", "ar"]) for (const mode of ["Light", "Dark"]) {
		await call("PUT", "/api/resource/User/Administrator", { language: lang, desk_theme: mode });
		const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: lang === "ar" ? "ar-SA" : "en-US" });
		const page = await ctx.newPage();
		page.on("pageerror", (e) => console.log(`[pageerror ${label} ${lang}-${mode}]`, e.message.slice(0, 160)));
		await ctx.request.post(`${base}/api/method/login`, { form: { usr: "Administrator", pwd: "admin" } });
		for (const density of ["comfortable", "compact"]) for (const screen of ["list", "form"]) {
			const url = screen === "list" ? `${base}/desk/todo` : `${base}/desk/todo/${names.Open}`;
			// The user's theme and language come from boot data that the server caches briefly: reload until the page shows the requested ones.
			for (let attempt = 0; attempt < 4; attempt++) {
				await page.goto(url, { waitUntil: "domcontentloaded" });
				await page.waitForSelector(screen === "list" ? ".list-row-container" : ".form-layout", { timeout: 60000 });
				const seen = await page.evaluate(() => ({ t: document.documentElement.getAttribute("data-theme"), l: document.documentElement.lang }));
				if (seen.t === mode.toLowerCase() && seen.l.startsWith(lang)) break;
				if (attempt === 3) throw new Error(`page shows ${JSON.stringify(seen)}, wanted ${mode}/${lang}`);
				await page.waitForTimeout(1500);
			}
			await page.waitForSelector(screen === "list" ? ".list-row-container .level-item.hidden-xs, .list-row-container .indicator-pill, .list-row-container .es-badge" : ".page-head .indicator-pill:not(.hide), .page-head .es-badge.page-indicator-pill:not(.hide)", { timeout: 20000 });
			await page.evaluate((d) => document.documentElement.setAttribute("data-ins-density", d), density);
			await page.waitForTimeout(900);
			const measured = await page.evaluate(() => {
				const cs = (e) => e && (({ backgroundColor, color, borderTopColor }) => ({ backgroundColor, color, borderTopColor }))(getComputedStyle(e));
				const primary = document.querySelector(".page-head .primary-action:not(.hide)") || document.querySelector(".page-head .btn-primary:not(.hide)");
				const badge = document.querySelector(".list-row-container .es-badge, .list-row-container .indicator-pill, .page-head .es-badge.page-indicator-pill:not(.hide), .page-head .indicator-pill:not(.hide)");
				const info = (e) => e && { tag: e.tagName.toLowerCase(), cls: e.className, theme: e.getAttribute("data-theme"), ...cs(e) };
				return {
					dir: document.documentElement.dir, theme: document.documentElement.getAttribute("data-theme"), lang: document.documentElement.lang,
					primary: info(primary), badge: info(badge), badgeShape: badge && { content: getComputedStyle(badge, "::before").content, width: getComputedStyle(badge, "::before").width },
				};
			});
			const file = `${label}-${lang}-${mode.toLowerCase()}-${density}-${screen}.png`;
			await page.screenshot({ path: join(out, file) });
			results.push({ version: label, lang, mode, density, screen, file, ...measured });
		}
		await ctx.close();
	}
} finally {
	await call("PUT", "/api/resource/User/Administrator", { language: original.language || "en", desk_theme: original.desk_theme || "Light" });
	await browser.close();
}
writeFileSync(join(out, `render-${label}.json`), JSON.stringify(results, null, 1));
console.log(`${label}: ${results.length} screenshots`);
for (const r of results.filter((x) => x.density === "comfortable" && x.screen === "form")) console.log(r.lang, r.mode, "primary", JSON.stringify(r.primary && [r.primary.backgroundColor, r.primary.color]), "badge", JSON.stringify(r.badge && [r.badge.theme, r.badge.backgroundColor, r.badge.color]));
