// Coexistence proof: the documented rules of another brand app (coexistence/brand_app.css, test only) are injected
// after the theme's bundles; computed styles show where Midad wins. Test users are prefixed coex-.
// Usage: NODE_PATH=/opt/pw-node/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node coexistence.mjs [--out DIR] [--base URL] [--without]
//   --without  skip the brand stylesheet (baseline).
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const base = arg("--base", "http://localhost:8000");
const out = resolve(arg("--out", join(here, "../../docs/team/evidence/round3/coexistence")));
const without = process.argv.includes("--without");
const brand = readFileSync(join(here, "coexistence/brand_app.css"), "utf8");
const PWD = "Ins-Coex-2026!";
mkdirSync(out, { recursive: true });

const post = async (request, path, data, form) => {
	const r = await request.post(`${base}${path}`, form ? { form } : { data });
	if (!r.ok()) throw new Error(`${path}: ${r.status()} ${(await r.text()).slice(0, 300)}`);
	return r;
};
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const results = [];
try {
	const admin = await browser.newContext();
	await post(admin.request, "/api/method/login", null, { usr: "Administrator", pwd: "admin" });
	for (const lang of ["ar", "en"]) for (const mode of ["Light", "Dark"]) {
		const email = `coex-${lang}-${mode.toLowerCase()}@midad.test`;
		const exists = await admin.request.get(`${base}/api/resource/User/${encodeURIComponent(email)}`);
		if (!exists.ok()) await post(admin.request, "/api/resource/User", { email, first_name: "Coex", language: lang, send_welcome_email: 0,
			new_password: PWD, roles: [{ role: "System Manager" }] });
		const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: lang === "ar" ? "ar" : "en-US" });
		await post(ctx.request, "/api/method/login", null, { usr: email, pwd: PWD });
		await post(ctx.request, "/api/method/frappe.core.doctype.user.user.switch_theme", null, { theme: mode });
		const page = await ctx.newPage();
		for (const route of ["/desk", "/app/todo/new"]) {
			await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
			await page.waitForTimeout(800);
			if (!without) await page.addStyleTag({ content: brand });
			await page.waitForTimeout(500);
			const data = await page.evaluate(async () => {
				const cs = (el, p) => (el ? getComputedStyle(el)[p] : null);
				const root = document.documentElement;
				const btn = [...document.querySelectorAll(".btn-primary")].find((b) => b.getClientRects().length && getComputedStyle(b).visibility !== "hidden") || null;
				const nav = document.querySelector(".desktop-navbar") || document.querySelector("header.navbar, .navbar");
				const text = (document.body.innerText.match(/[؀-ۿ]/) ? "مرحبا بالعالم" : "Hello world");
				const probe = document.createElement("span");
				probe.textContent = text; document.body.appendChild(probe);
				await document.fonts.ready;
				const used = [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family}:${f.weight}`);
				probe.remove();
				return {
					lang: root.lang, dir: root.dir, theme: root.getAttribute("data-theme"),
					bodyFontFamily: cs(document.body, "fontFamily"),
					fontStackVar: getComputedStyle(root).getPropertyValue("--font-stack").trim(),
					loadedFaces: [...new Set(used)],
					brandFaceLoaded: [...document.fonts].some((f) => f.family.replace(/"/g, "") === "IBM Plex Sans Arabic" && f.status === "loaded"),
					btn: btn ? { sel: btn.className, bg: cs(btn, "backgroundColor"), color: cs(btn, "color"), border: cs(btn, "borderBlockEndColor") } : null,
					navTag: nav ? `${nav.tagName.toLowerCase()}.${nav.className.split(" ").join(".")}` : null,
					navBorderBottom: nav ? `${cs(nav, "borderBottomWidth")} ${cs(nav, "borderBottomStyle")} ${cs(nav, "borderBottomColor")}` : null,
				};
			});
			const handle = await page.evaluateHandle(() => [...document.querySelectorAll(".btn-primary")].find((b) => b.getClientRects().length) || null);
			const btn = handle.asElement();
			if (btn) { await btn.hover(); await page.waitForTimeout(400);
				data.btnHover = await btn.evaluate((b) => ({ bg: getComputedStyle(b).backgroundColor, color: getComputedStyle(b).color })); }
			const shot = `${lang}-${mode.toLowerCase()}${route === "/desk" ? "-desk" : "-form"}${without ? "-baseline" : ""}.png`;
			await page.screenshot({ path: join(out, shot), clip: { x: 0, y: 0, width: 1280, height: 360 } });
			results.push({ user: email, route, ...data, shot });
		}
		await ctx.close();
	}
} finally { await browser.close(); }
writeFileSync(join(out, `coexistence${without ? "-baseline" : ""}.json`), JSON.stringify(results, null, 2));
for (const r of results) console.log(`${r.lang}/${r.theme} ${r.route} stack=${r.fontStackVar.slice(0, 40)} body=${r.bodyFontFamily.slice(0, 40)} btn=${r.btn?.bg}/${r.btn?.color} hover=${r.btnHover?.bg} nav=${r.navBorderBottom}`);
