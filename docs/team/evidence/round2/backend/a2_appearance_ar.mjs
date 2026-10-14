// Item 2: live-region announcements of /desk/ins-appearance in Arabic, success and failed-save paths.
import { launch, adminRequest, ensureUsers, userContext, recorder, shots, BASE } from "./lib.mjs";
import { join } from "node:path";

const rec = recorder("a2_appearance_ar");
const browser = await launch();
try {
	await ensureUsers(await adminRequest(browser));
	const ctx = await userContext(browser, "ar", { theme: "Light" });
	const page = await ctx.newPage();
	await page.goto(`${BASE}/desk/ins-appearance`, { waitUntil: "networkidle" });
	await page.waitForSelector(".ins-appearance fieldset");
	const status = async () => {
		await page.waitForTimeout(400);
		return page.$eval('.ins-appearance [role="status"]', (n) => n.textContent);
	};
	const pick = (name, value) => page.locator(`input[name="${name}"][value="${value}"]`).check({ force: true });
	rec.out.data.dir = await page.evaluate(() => document.documentElement.dir + " / " + document.documentElement.lang);
	rec.out.data.region = await page.$eval('.ins-appearance [role="status"]', (n) => ({
		role: n.getAttribute("role"), ariaLive: n.getAttribute("aria-live"), ariaAtomic: n.getAttribute("aria-atomic") }));

	// Success paths (real server).
	await pick("ins-density", "compact");
	rec.out.data.densitySuccess = await status();
	await page.screenshot({ path: join(shots, "a2-density-success-ar.png") });
	await pick("ins-density", "comfortable");
	rec.out.data.densitySuccess2 = await status();
	await pick("ins-mode", "dark");
	rec.out.data.modeSuccess = await status();
	await pick("ins-mode", "light");
	rec.out.data.modeSuccess2 = await status();

	// Failed saves: the server answers 417 as it does for a validation error.
	const fail = (route) => route.fulfill({ status: 417, contentType: "application/json",
		body: JSON.stringify({ exc_type: "ValidationError", exc: "[]", _server_messages: "[]" }) });
	await page.route("**/api/method/institutional_theme.api.set_appearance", fail);
	await pick("ins-density", "compact");
	rec.out.data.densityFail = await status();
	rec.out.data.densityFailRestored = await page.$eval('input[name="ins-density"]:checked', (i) => i.value);
	rec.out.data.densityFailFocus = await page.evaluate(() => document.activeElement?.name + "=" + document.activeElement?.value);
	rec.out.data.densityAttrAfterFail = await page.evaluate(() => document.documentElement.getAttribute("data-ins-density"));
	await page.screenshot({ path: join(shots, "a2-density-fail-ar.png") });

	await page.route("**/api/method/frappe.core.doctype.user.user.switch_theme", fail);
	await pick("ins-mode", "dark");
	rec.out.data.modeFail = await status();
	rec.out.data.modeFailRestored = await page.$eval('input[name="ins-mode"]:checked', (i) => i.value);
	rec.out.data.modeAttrAfterFail = await page.evaluate(() => document.documentElement.getAttribute("data-theme-mode"));
	await page.screenshot({ path: join(shots, "a2-mode-fail-ar.png") });

	// Preset: failed apply, then a real apply (reload; the message is announced after it).
	const radios = await page.$$eval('input[name="ins-palette"]', (n) => n.map((i) => i.value));
	rec.out.data.presets = radios;
	if (radios.length > 1) {
		const current = await page.$eval('input[name="ins-palette"]:checked', (i) => i.value);
		rec.out.data.presetBefore = current;
		const target = radios.find((v) => v !== current);
		await pick("ins-palette", target);
		await page.locator(".ins-appearance button.btn-primary").click();
		rec.out.data.presetFail = await status();
		await page.screenshot({ path: join(shots, "a2-preset-fail-ar.png") });
		await page.unroute("**/api/method/institutional_theme.api.set_appearance");
		await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.locator(".ins-appearance button.btn-primary").click()]);
		await page.waitForSelector(".ins-appearance fieldset");
		rec.out.data.presetSuccessAfterReload = await status();
		await page.screenshot({ path: join(shots, "a2-preset-success-ar.png") });
		// put the preset back for this test user (through the API; the page is already reloaded)
		const back = await ctx.request.post(`${BASE}/api/method/institutional_theme.api.set_appearance`, { form: { palette: current } });
		rec.out.data.presetRestored = back.status();
	}
	rec.check("Arabic page", rec.out.data.dir.startsWith("rtl"), rec.out.data.dir);
	for (const k of ["densitySuccess", "modeSuccess", "densityFail", "modeFail", "presetFail", "presetSuccessAfterReload"]) {
		const v = rec.out.data[k];
		rec.check(`${k} is Arabic text`, v && /[؀-ۿ]/.test(v), JSON.stringify(v));
	}
} finally {
	rec.save();
	await browser.close();
}
