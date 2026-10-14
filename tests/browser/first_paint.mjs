// First paint per preset and mode: with the desk script blocked, only the splash paints. Its background
// must equal the audited --bg-color the finished desk resolves (ADR 0003, "no flash").
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node first_paint.mjs [--base http://localhost:8000] [--out DIR]
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const base = arg("--base", "http://localhost:8000");
const out = resolve(arg("--out", "docs/team/evidence/phase3/runtime"));
const presets = (arg("--presets", "midad,graphite,petrol,forest,plum")).split(",");
const modes = ["Light", "Dark"];
const admin = { usr: "Administrator", pwd: "admin" };
mkdirSync(out, { recursive: true });

async function api(request, method, body) {
	const response = await request.post(`${base}/api/method/${method}`, { form: body });
	if (!response.ok()) throw new Error(`${method}: ${response.status()} ${await response.text()}`);
	return (await response.json()).message;
}

async function ensureUser(adminRequest, email) {
	const exists = await adminRequest.get(`${base}/api/resource/User/${encodeURIComponent(email)}`);
	if (exists.ok()) return;
	const created = await adminRequest.post(`${base}/api/resource/User`, {
		data: { email, first_name: "FirstPaint", send_welcome_email: 0, new_password: "Ins-Paint-2026!",
			roles: [{ role: "System Manager" }] },
	});
	if (!created.ok()) throw new Error(`create ${email}: ${await created.text()}`);
}

async function pixel(page, png) {
	return page.evaluate(async (b64) => {
		const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
		const bitmap = await createImageBitmap(blob);
		const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
		const context = canvas.getContext("2d");
		context.drawImage(bitmap, 0, 0);
		const [r, g, b] = context.getImageData(5, Math.floor(bitmap.height / 2), 1, 1).data;
		return [r, g, b];
	}, png.toString("base64"));
}

const browser = await chromium.launch();
const results = [];
try {
	const adminContext = await browser.newContext({ locale: "en-US" });
	await api(adminContext.request, "login", admin);
	const probe = await browser.newPage();
	for (const preset of presets) {
		for (const mode of modes) {
			const email = `fp-${preset}-${mode.toLowerCase()}@midad.test`;
			await ensureUser(adminContext.request, email);
			const context = await browser.newContext({ viewport: { width: 900, height: 600 }, locale: "en-US" });
			await api(context.request, "login", { usr: email, pwd: "Ins-Paint-2026!" });
			await api(context.request, "institutional_theme.api.set_appearance", { palette: preset });
			await api(context.request, "frappe.core.doctype.user.user.switch_theme", { theme: mode });
			const page = await context.newPage();
			// Block every script: the server-rendered head (CSS links, html attributes) is all that paints.
			await page.route("**/*", (route) => (route.request().resourceType() === "script" ? route.abort() : route.continue()));
			await page.goto(`${base}/desk`, { waitUntil: "domcontentloaded" });
			await page.waitForTimeout(600);
			const painted = await pixel(probe, await page.screenshot());
			await context.close();

			const live = await browser.newContext({ viewport: { width: 900, height: 600 }, locale: "en-US" });
			await api(live.request, "login", { usr: email, pwd: "Ins-Paint-2026!" });
			const desk = await live.newPage();
			await desk.goto(`${base}/desk`, { waitUntil: "networkidle" });
			const expected = await desk.evaluate(() => {
				const node = document.createElement("div");
				node.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue("--bg-color");
				document.body.appendChild(node);
				const value = getComputedStyle(node).backgroundColor;
				node.remove();
				return (value.match(/\d+/g) || []).slice(0, 3).map(Number);
			});
			const links = await desk.evaluate(() => [...document.querySelectorAll('head link[rel="stylesheet"]')].map((l) => l.getAttribute("href")));
			await live.close();
			const match = painted.every((v, i) => Math.abs(v - expected[i]) <= 1);
			results.push({ preset, mode, painted, expected, match, paletteLinked: links.some((h) => h.includes(`ins_palette_${preset}`)) || preset === "midad" });
		}
	}
} finally {
	await browser.close();
}
writeFileSync(join(out, "first_paint.json"), JSON.stringify(results, null, 2));
for (const r of results) console.log(`${r.match && r.paletteLinked ? "PASS" : "FAIL"} ${r.preset} ${r.mode} painted=${r.painted} expected=${r.expected}`);
process.exit(results.every((r) => r.match && r.paletteLinked) ? 0 : 1);
