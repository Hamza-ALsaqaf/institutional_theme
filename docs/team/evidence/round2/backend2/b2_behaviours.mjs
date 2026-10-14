// Opt-in behaviours on the real bench: connection banner (offline/online) and idle warning (fake clock).
// Settings are enabled through the REST API and restored to their original values at the end.
import { launch, adminRequest, ensureUsers, userContext, recorder, shots, BASE } from "./lib.mjs";
import { join } from "node:path";

const rec = recorder("b2_behaviours");
const browser = await launch();
const SETTINGS = `${BASE}/api/resource/Institutional Theme Settings/Institutional Theme Settings`;
const KEYS = ["enable_idle_warning", "idle_warning_minutes", "enable_connection_banner"];
let admin, original;

const bannerInfo = (page, kind) => page.evaluate((kind) => {
	const el = document.querySelector(`body > .ins-banner[data-ins-banner="${kind}"]`);
	if (!el) return null;
	const text = el.querySelector(".ins-banner-text");
	const button = el.querySelector(".ins-banner-action");
	const labelled = el.getAttribute("aria-labelledby") && document.getElementById(el.getAttribute("aria-labelledby"));
	return { role: el.getAttribute("role"), firstChild: document.body.firstElementChild === el, count: document.querySelectorAll(".ins-banner").length,
		text: text && text.textContent, button: button && button.textContent, labelledBy: el.getAttribute("aria-labelledby"), labelOk: labelled === text,
		buttonClass: button && button.className, focusOnButton: !!button && document.activeElement === button, display: getComputedStyle(el).display };
}, kind);

const boot = (page) => page.evaluate(() => ({ ins: frappe.boot.ins && { idle_warning: frappe.boot.ins.idle_warning, idle_minutes: frappe.boot.ins.idle_minutes,
	connection_banner: frappe.boot.ins.connection_banner }, session_expiry: (frappe.boot.sysdefaults || {}).session_expiry || null }));

// ar.csv is the scribe's file and has no entry for these strings yet. To see the Arabic layout, the proposed
// translations are put into core's message table in the page; the evidence says so.
const PROPOSED_AR = {
	"You are offline. Changes cannot be saved until the connection returns.": "أنت غير متصل بالإنترنت. لا يمكن حفظ التغييرات حتى يعود الاتصال.",
	"Live updates are interrupted. The page will keep trying to reconnect.": "توقفت التحديثات الفورية. ستواصل الصفحة محاولة إعادة الاتصال.",
	"The connection is back.": "عاد الاتصال.",
	"You have been inactive. Your session may end soon.": "لم يُسجَّل أي نشاط منك. قد تنتهي جلستك قريباً.",
	"Stay signed in": "الاستمرار في الجلسة",
	"The session could not be refreshed. Try again.": "تعذّر تجديد الجلسة. حاول مرة أخرى.",
	"Your session has ended. Sign in again to continue.": "انتهت جلستك. سجّل الدخول مجدداً للمتابعة.",
	"Sign in": "تسجيل الدخول",
};
async function open(lang, extra = {}) {
	const ctx = await userContext(browser, lang, { theme: "Light" });
	const page = await ctx.newPage();
	if (extra.clock) await page.clock.install({ time: new Date() });
	await page.goto(`${BASE}/desk`, { waitUntil: "load" });
	await page.waitForFunction(() => window.frappe && frappe.boot && frappe.boot.ins && document.querySelector(".body-sidebar-container, .layout-main-section, .main-section"), null, { timeout: 60000 });
	await page.waitForTimeout(1500);
	if (lang === "ar") await page.evaluate((m) => Object.assign(frappe._messages, m), PROPOSED_AR);
	return { ctx, page };
}

try {
	admin = await adminRequest(browser);
	await ensureUsers(admin);
	original = (await (await admin.request.get(SETTINGS)).json()).data;
	rec.out.data.original = Object.fromEntries(KEYS.map((k) => [k, original[k]]));

	// 1. Disabled (the shipped default): nothing appears, offline included.
	{
		const { ctx, page } = await open("en");
		rec.out.data.boot_disabled = await boot(page);
		rec.check("disabled: boot keys are false", rec.out.data.boot_disabled.ins.idle_warning === false && rec.out.data.boot_disabled.ins.connection_banner === false, JSON.stringify(rec.out.data.boot_disabled));
		await ctx.setOffline(true); await page.waitForTimeout(800);
		rec.check("disabled: no banner when offline", (await bannerInfo(page, "offline")) === null);
		await ctx.setOffline(false); await ctx.close();
	}

	// 2. Enable both, idle minutes 1.
	let res = await admin.request.put(SETTINGS, { data: { enable_idle_warning: 1, idle_warning_minutes: 1, enable_connection_banner: 1 } });
	rec.check("settings saved", res.ok(), String(res.status()));

	for (const lang of ["en", "ar"]) {
		// 3. Connection banner.
		{
			const { ctx, page } = await open(lang);
			const b = await boot(page); rec.out.data[`boot_${lang}`] = b;
			rec.check(`${lang}: boot keys enabled, idle_minutes 1`, b.ins.idle_warning && b.ins.connection_banner && b.ins.idle_minutes === 1, JSON.stringify(b));
			rec.check(`${lang}: no banner while online`, (await bannerInfo(page, "offline")) === null);
			await ctx.setOffline(true); await page.waitForTimeout(800);
			const off = await bannerInfo(page, "offline"); rec.out.data[`offline_${lang}`] = off;
			rec.check(`${lang}: offline banner (first child of body, role status, one banner)`, off && off.firstChild && off.role === "status" && off.count === 1 && !!off.text, JSON.stringify(off));
			rec.check(`${lang}: offline text is in the user language`, lang === "ar" ? /[؀-ۿ]/.test(off.text) : /offline/i.test(off.text), off && off.text);
			await page.screenshot({ path: join(shots, `b2-offline-${lang}.png`) });
			await page.evaluate(() => window.dispatchEvent(new Event("offline"))); await page.waitForTimeout(200);
			rec.check(`${lang}: a repeated offline event adds no second banner`, (await bannerInfo(page, "offline")).count === 1);
			await ctx.setOffline(false); await page.waitForTimeout(800);
			const back = await bannerInfo(page, "offline"); rec.out.data[`online_${lang}`] = back;
			rec.check(`${lang}: online shows "connection is back"`, back && back.text && back.text.length > 0 && back.text !== off.text, back && back.text);
			await page.screenshot({ path: join(shots, `b2-online-${lang}.png`) });
			await page.waitForTimeout(4600);
			rec.check(`${lang}: the banner is removed after the confirmation`, (await bannerInfo(page, "offline")) === null);
			// Realtime: core exposes frappe.realtime.socket when socket.io is configured.
			const rt = await page.evaluate(() => ({ hasRealtime: !!(frappe.realtime), hasSocket: !!(frappe.realtime && frappe.realtime.socket), disabled: !!(frappe.realtime && frappe.realtime.disabled) }));
			rec.out.data[`realtime_${lang}`] = rt;
			if (rt.hasSocket) {
				await page.evaluate(() => frappe.realtime.socket.emit && 0);
			}
			// Simulated socket events on a stand-in socket attached through the same hook (page-change).
			await page.evaluate(() => {
				const handlers = {};
				frappe.realtime.socket = { on(name, fn) { handlers[name] = fn; }, off() {}, emit() {} };
				window.__fakeSocket = handlers;
				jQuery(document).trigger("page-change");
			});
			await page.evaluate(() => window.__fakeSocket.disconnect("transport close")); await page.waitForTimeout(300);
			const down = await bannerInfo(page, "offline"); rec.out.data[`socket_down_${lang}`] = down;
			rec.check(`${lang}: realtime disconnect shows the banner`, down && down.text && down.firstChild, down && down.text);
			await page.screenshot({ path: join(shots, `b2-realtime-${lang}.png`) });
			await page.evaluate(() => window.__fakeSocket.connect()); await page.waitForTimeout(300);
			const up = await bannerInfo(page, "offline");
			rec.check(`${lang}: realtime connect shows the confirmation`, up && up.text !== down.text, up && up.text);
			await ctx.close();
		}
		// 4. Idle warning with a fake clock.
		{
			const { ctx, page } = await open(lang, { clock: true });
			const requests = [];
			page.on("request", (r) => { if (r.url().includes("get_logged_user")) requests.push(r.method()); });
			rec.check(`${lang}: idle, no banner at start`, (await bannerInfo(page, "idle")) === null);
			await page.clock.fastForward(50 * 1000);
			rec.check(`${lang}: no banner after 50 s`, (await bannerInfo(page, "idle")) === null);
			await page.mouse.move(100, 100); await page.mouse.move(140, 160);
			await page.clock.fastForward(50 * 1000);
			rec.check(`${lang}: input resets the idle clock (still none 50 s after input)`, (await bannerInfo(page, "idle")) === null);
			await page.clock.fastForward(20 * 1000); await page.waitForTimeout(300);
			const warn = await bannerInfo(page, "idle"); rec.out.data[`idle_${lang}`] = warn;
			rec.check(`${lang}: warning after 70 s without input (alertdialog, labelled, focus on the action)`, warn && warn.role === "alertdialog" && warn.labelOk && warn.firstChild && warn.focusOnButton && /btn-sm/.test(warn.buttonClass), JSON.stringify(warn));
			rec.check(`${lang}: idle text and action in the user language`, lang === "ar" ? /[؀-ۿ]/.test(warn.text) && /[؀-ۿ]/.test(warn.button) : /inactive/i.test(warn.text) && warn.button === "Stay signed in", `${warn.text} | ${warn.button}`);
			await page.screenshot({ path: join(shots, `b2-idle-${lang}.png`) });
			await page.mouse.move(300, 300);
			rec.check(`${lang}: input does not dismiss the warning`, (await bannerInfo(page, "idle")) !== null);
			// Failure path: the call fails, the warning stays with a retry message.
			await page.route("**/api/method/frappe.auth.get_logged_user*", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
			await page.click(".ins-banner-action"); await page.waitForTimeout(800);
			const failed = await bannerInfo(page, "idle"); rec.out.data[`idle_failed_${lang}`] = failed;
			rec.check(`${lang}: a failed refresh keeps the warning with a retry message`, failed && failed.text !== warn.text, failed && failed.text);
			await page.unroute("**/api/method/frappe.auth.get_logged_user*");
			await page.click(".ins-banner-action"); await page.waitForTimeout(1200);
			rec.check(`${lang}: Stay signed in made one authenticated GET per press (2 presses)`, requests.length >= 2 && requests.every((m) => m === "GET"), JSON.stringify(requests));
			rec.check(`${lang}: the warning is dismissed after a successful refresh`, (await bannerInfo(page, "idle")) === null);
			await page.clock.fastForward(50 * 1000);
			rec.check(`${lang}: the idle clock restarted (none 50 s later)`, (await bannerInfo(page, "idle")) === null);
			await page.clock.fastForward(20 * 1000); await page.waitForTimeout(300);
			rec.check(`${lang}: warns again after another idle period`, (await bannerInfo(page, "idle")) !== null);
			await ctx.close();
		}
	}
} finally {
	if (admin && original) {
		const res = await admin.request.put(SETTINGS, { data: Object.fromEntries(KEYS.map((k) => [k, original[k]])) });
		const now = (await (await admin.request.get(SETTINGS)).json()).data;
		rec.out.data.restored = { status: res.status(), values: Object.fromEntries(KEYS.map((k) => [k, now[k]])) };
		rec.check("settings restored to the original values", KEYS.every((k) => now[k] === original[k]), JSON.stringify(rec.out.data.restored));
	}
	rec.save();
	await browser.close();
}
