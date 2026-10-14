// Live check of fix 1 B1: a form with two user tags (.form-tag) on a real bench, Light and Dark, English and Arabic, both densities.
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node live_tags.mjs <label> <base-url> <out-dir>   e.g. live_tags.mjs 16.52.0 http://midad52.test:8001 docs/team/evidence/round4/fix1
// Test-only credentials Administrator / admin (tools/bench/env.sh). Adds two tags to the "Render check open" To Do, removes them again and restores the user's language and theme.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(join(here, "package.json"))("playwright-core");
const [label, base, outArg] = process.argv.slice(2);
if (!label || !base || !outArg) throw new Error("usage: live_tags.mjs <label> <base-url> <out-dir>");
const out = resolve(outArg);
mkdirSync(out, { recursive: true });
const host = new URL(base).hostname;
const browser = await chromium.launch({ args: ["--no-sandbox", "--no-proxy-server", `--host-resolver-rules=MAP ${host} 127.0.0.1`] });
const api = await (await browser.newContext()).request;
if (!(await api.post(`${base}/api/method/login`, { form: { usr: "Administrator", pwd: "admin" } })).ok()) throw new Error("login failed");
const csrf = ((await (await api.get(`${base}/app`)).text()).match(/csrf_token\s*=\s*"([^"]+)"/) || [])[1] || "";
const call = async (method, url, data) => {
	const r = await api.fetch(`${base}${url}`, { method, data, headers: { "X-Frappe-CSRF-Token": csrf } });
	if (!r.ok()) throw new Error(`${method} ${url} -> ${r.status()} ${(await r.text()).slice(0, 200)}`);
	return r.json();
};
const original = (await call("GET", "/api/resource/User/Administrator")).data;
const description = "Render check open";
const found = (await call("GET", `/api/resource/ToDo?filters=${encodeURIComponent(JSON.stringify([["description", "=", description]]))}&fields=["name"]`)).data;
const name = found.length ? found[0].name : (await call("POST", "/api/resource/ToDo", { description, status: "Open" })).data.name;
const tags = ["Approved", "Urgent", "Plan", "Audit"];
for (const t of tags) await call("POST", "/api/method/frappe.desk.doctype.tag.tag.add_tag", { tag: t, dt: "ToDo", dn: name });

const results = [];
try {
	for (const lang of ["en", "ar"]) for (const mode of ["Light", "Dark"]) {
		await call("PUT", "/api/resource/User/Administrator", { language: lang, desk_theme: mode });
		const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: lang === "ar" ? "ar-SA" : "en-US" });
		const page = await ctx.newPage();
		await ctx.request.post(`${base}/api/method/login`, { form: { usr: "Administrator", pwd: "admin" } });
		for (const density of ["comfortable", "compact"]) {
			for (let attempt = 0; attempt < 4; attempt++) {
				await page.goto(`${base}/desk/todo/${name}`, { waitUntil: "domcontentloaded" });
				await page.waitForSelector(".form-tag", { timeout: 60000 });
				const seen = await page.evaluate(() => ({ t: document.documentElement.getAttribute("data-theme"), l: document.documentElement.lang }));
				if (seen.t === mode.toLowerCase() && seen.l.startsWith(lang)) break;
				if (attempt === 3) throw new Error(`page shows ${JSON.stringify(seen)}, wanted ${mode}/${lang}`);
				await page.waitForTimeout(1500);
			}
			await page.evaluate((d) => document.documentElement.setAttribute("data-ins-density", d), density);
			await page.waitForTimeout(900);
			const m = await page.evaluate(() => {
				const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
				const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
				const tag = (e) => { const s = getComputedStyle(e), l = e.querySelector(".es-badge__label") || e, ls = getComputedStyle(l), b = getComputedStyle(e, "::before");
					return { label: l.textContent.trim(), theme: e.getAttribute("data-theme"), bg: s.backgroundColor, fg: ls.color, before: b.content, contrast: +ratio(ls.color, s.backgroundColor).toFixed(2) }; };
				const pill = document.querySelector(".page-head .page-indicator-pill:not(.hide), .page-head .indicator-pill:not(.hide)");
				return { dir: document.documentElement.dir, tags: [...document.querySelectorAll(".form-tag")].map(tag),
					status: pill && { cls: pill.className, theme: pill.getAttribute("data-theme"), before: getComputedStyle(pill, "::before").content, width: getComputedStyle(pill, "::before").width } };
			});
			const file = `tags-${label}-${lang}-${mode.toLowerCase()}-${density}.png`;
			await page.screenshot({ path: join(out, file) });
			results.push({ version: label, lang, mode, density, file, ...m });
		}
		await ctx.close();
	}
} finally {
	for (const t of tags) await call("POST", "/api/method/frappe.desk.doctype.tag.tag.remove_tag", { tag: t, dt: "ToDo", dn: name }).catch(() => {});
	await call("PUT", "/api/resource/User/Administrator", { language: original.language || "en", desk_theme: original.desk_theme || "Light" });
	await browser.close();
}
writeFileSync(join(out, `tags-${label}.json`), JSON.stringify(results, null, 1));
let bad = 0;
for (const r of results) {
	const ok = r.tags.length >= 2 && r.tags.every((t) => (t.before === "none" || t.before === "normal") && t.contrast >= 4.5) && r.status && r.status.before !== "none" && r.status.before !== "normal";
	if (!ok) bad++;
	console.log(r.lang, r.mode, r.density, ok ? "ok" : "FAIL", JSON.stringify(r.tags.map((t) => [t.label, t.theme, t.before, t.contrast])), "status", JSON.stringify(r.status && [r.status.theme, r.status.before]));
}
process.exitCode = bad ? 1 : 0;
