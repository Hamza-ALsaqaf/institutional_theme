// Keyboard-only pass of the Appearance page (ADR 0002), in LTR and RTL.
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node appearance_keyboard.mjs [--base URL] [--out DIR]
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const base = arg("--base", "http://localhost:8000");
const out = resolve(arg("--out", "docs/team/evidence/phase3/runtime"));
mkdirSync(out, { recursive: true });
const checks = [];
const check = (name, ok, detail = "") => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); };

async function post(request, path, options) {
	const response = await request.post(`${base}${path}`, options);
	if (!response.ok()) throw new Error(`${path}: ${response.status()} ${await response.text()}`);
	return response;
}

const browser = await chromium.launch();
try {
	const adminContext = await browser.newContext();
	await post(adminContext.request, "/api/method/login", { form: { usr: "Administrator", pwd: "admin" } });
	for (const lang of ["en", "ar"]) {
		const email = `kb-${lang}@midad.test`;
		const exists = await adminContext.request.get(`${base}/api/resource/User/${encodeURIComponent(email)}`);
		if (!exists.ok()) {
			await post(adminContext.request, "/api/resource/User", { data: { email, first_name: "Keyboard", language: lang,
				send_welcome_email: 0, new_password: "Ins-Keys-2026!", roles: [{ role: "System Manager" }] } });
		}
		const context = await browser.newContext({ viewport: { width: 1100, height: 800 }, locale: lang === "ar" ? "ar-SA" : "en-US" });
		await post(context.request, "/api/method/login", { form: { usr: email, pwd: "Ins-Keys-2026!" } });
		await post(context.request, "/api/method/frappe.core.doctype.user.user.switch_theme", { form: { theme: "Light" } });
		const page = await context.newPage();
		await page.goto(`${base}/desk/ins-appearance`, { waitUntil: "networkidle" });
		await page.waitForSelector(".ins-appearance fieldset");
		const tag = `[${lang}]`;
		check(`${tag} dir`, (await page.evaluate(() => document.documentElement.dir)) === (lang === "ar" ? "rtl" : "ltr"));
		const groups = await page.$$eval(".ins-appearance fieldset", (n) => n.map((f) => f.querySelector("legend")?.textContent));
		check(`${tag} three fieldsets with legends`, groups.length === 3 && groups.every(Boolean), JSON.stringify(groups));
		check(`${tag} h1 focusable by script only`, (await page.$eval(".ins-appearance h1", (h) => h.getAttribute("tabindex"))) === "-1");
		check(`${tag} status region`, await page.$('.ins-appearance [role="status"]') !== null);

		// Tab reaches the checked radio of each group; the arrow keys move the selection, no dialog opens.
		await page.focus(".ins-appearance h1");
		await page.keyboard.press("Tab");
		const first = await page.evaluate(() => document.activeElement?.name);
		check(`${tag} tab reaches the mode group`, first === "ins-mode", String(first));
		const before = await page.$eval('input[name="ins-mode"]:checked', (i) => i.value);
		await page.keyboard.press("ArrowDown");
		await page.waitForFunction((b) => document.querySelector('input[name="ins-mode"]:checked')?.value !== b, before);
		const after = await page.$eval('input[name="ins-mode"]:checked', (i) => i.value);
		check(`${tag} arrow changes the mode`, after !== before, `${before} -> ${after}`);
		await page.waitForTimeout(300);
		check(`${tag} data-theme-mode follows`, (await page.evaluate(() => document.documentElement.getAttribute("data-theme-mode"))) === after);
		check(`${tag} no dialog opened`, (await page.$$(".modal.show")).length === 0);
		const status = await page.$eval('.ins-appearance [role="status"]', (n) => n.textContent);
		check(`${tag} announcement`, status.length > 0, status);
		await page.$eval(`input[name="ins-mode"][value="light"]`, (i) => i.click());

		// Apply: reload, focus on h1, message in the status region.
		const presets = await page.$$('input[name="ins-palette"]');
		if (presets.length > 1) {
			const apply = page.locator(".ins-appearance button.btn-primary");
			check(`${tag} apply disabled while unchanged`, await apply.isDisabled());
			const other = await page.$('input[name="ins-palette"]:not(:checked)');
			await other.focus();
			await page.keyboard.press("Space");
			check(`${tag} apply enabled after a different choice`, await apply.isEnabled());
			await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}), apply.click()]);
			await page.waitForSelector(".ins-appearance h1");
			await page.waitForTimeout(300);
			check(`${tag} focus lands on the h1`, await page.evaluate(() => document.activeElement?.tagName === "H1"));
			const message = await page.$eval('.ins-appearance [role="status"]', (n) => n.textContent);
			check(`${tag} reload message`, message.length > 0, message);
		} else {
			check(`${tag} one preset: name and note only`, presets.length === 0);
		}
		await context.close();
	}
} finally {
	await browser.close();
}
writeFileSync(join(out, "appearance_keyboard.json"), JSON.stringify(checks, null, 2));
process.exit(checks.every((c) => c.ok) ? 0 : 1);
