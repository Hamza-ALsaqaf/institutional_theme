// Round 4 login evidence: screenshots, computed colours and contrast of the sign-in pages.
//
//   NODE_PATH=/opt/pw-node/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
//     node capture_login.mjs <label> <base-url> <host-to-map> <out-dir>
//
// For each of English and Arabic it loads /login (`?_lang=`), shoots it, opens #forgot and shoots it,
// then loads /update-password (key-less, shows the form markup) and reads computed styles. The primary
// button, the "Forgot password?" link, the labels, the field icon (pseudo-element) and the focus ring
// are read with getComputedStyle; contrast is computed with the WCAG 2.x relative-luminance formula.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
let playwright;
try {
	playwright = require("playwright");
} catch {
	playwright = require("playwright-core");
}
const { chromium } = playwright;

const [label, base, hostMap, outDir] = process.argv.slice(2);
if (!label || !base || !outDir) {
	console.error("usage: capture_login.mjs <label> <base-url> <host:port-mapped-host> <out-dir>");
	process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const host = new URL(base).hostname;
const browser = await chromium.launch({
	args: ["--no-sandbox", "--no-proxy-server", `--host-resolver-rules=MAP ${host} 127.0.0.1`],
});

function parse(c) {
	const m = c.match(/rgba?\(([^)]+)\)/);
	if (!m) return null;
	const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
	return { r, g, b, a };
}
function lum({ r, g, b }) {
	const f = (v) => {
		v /= 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg, bg) {
	const a = lum(parse(fg));
	const b = lum(parse(bg));
	return ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2);
}

const report = { label, base, pages: {} };

for (const lang of ["en", "ar"]) {
	const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, locale: lang === "ar" ? "ar" : "en-US" });
	const page = await ctx.newPage();
	await page.goto(`${base}/login?_lang=${lang}`, { waitUntil: "networkidle" });
	await page.waitForSelector("#login_email");
	await page.screenshot({ path: path.join(outDir, `${label}-login-${lang}.png`), fullPage: true });

	const login = await page.evaluate(() => {
		const cs = (el, p, pseudo) => (el ? getComputedStyle(el, pseudo)[p] : null);
		const btn = document.querySelector(".for-login .page-card-actions button[type=submit]");
		const link = document.querySelector('.for-login a[href="#forgot"]');
		const label = document.querySelector(".for-login label[for=login_email]");
		const email = document.querySelector("#login_email");
		const card = document.querySelector(".for-login .page-card");
		const eye = document.querySelector(".for-login .ins-reveal");
		const field = document.querySelector(".for-login .email-field");
		return {
			dir: document.documentElement.dir,
			lang: document.documentElement.lang,
			button: { class: btn && btn.className, bg: cs(btn, "backgroundColor"), color: cs(btn, "color"), height: cs(btn, "height"), radius: cs(btn, "borderRadius") },
			link: { color: cs(link, "color"), size: cs(link, "fontSize"), align: cs(link && link.parentElement, "textAlign"), bg: cs(card, "backgroundColor") },
			label: { color: cs(label, "color") },
			inputBorder: cs(email, "borderTopColor"),
			cardBg: cs(card, "backgroundColor"),
			fieldIconBefore: { content: cs(field, "content", "::before"), bg: cs(field, "backgroundColor", "::before"), w: cs(field, "width", "::before"), inlineStart: cs(field, "insetInlineStart", "::before") },
			fieldIconSvg: !!document.querySelector(".for-login .email-field > .field-icon"),
			revealButton: !!eye,
			revealInput: eye ? eye.getAttribute("aria-label") : null,
			masthead: !!document.querySelector(".ins-masthead"),
			trustFooter: !!document.querySelector(".ins-trust"),
			buttonCountEsButton: document.querySelectorAll(".for-login .es-button").length,
		};
	});

	// focus ring on the email input and the button
	await page.focus("#login_email");
	login.focusInput = await page.evaluate(() => {
		const s = getComputedStyle(document.querySelector("#login_email"));
		return { outline: s.outlineStyle + " " + s.outlineWidth + " " + s.outlineColor, border: s.borderTopColor };
	});
	await page.keyboard.press("Tab");
	await page.keyboard.press("Tab");
	await page.keyboard.press("Tab");
	login.focusAfterTabs = await page.evaluate(() => {
		const a = document.activeElement;
		const s = getComputedStyle(a);
		return { tag: a.tagName, id: a.id, cls: a.className, outline: s.outlineStyle + " " + s.outlineWidth + " " + s.outlineColor };
	});
	await page.screenshot({ path: path.join(outDir, `${label}-login-${lang}-focus.png`), fullPage: true });

	if (login.button.bg) login.button.contrast = ratio(login.button.color, login.button.bg);
	if (login.link.color) login.link.contrast = ratio(login.link.color, login.link.bg);
	if (login.label.color) login.label.contrast = ratio(login.label.color, login.cardBg);

	// forgot password
	await page.goto(`${base}/login?_lang=${lang}#forgot`, { waitUntil: "networkidle" });
	await page.evaluate(() => {
		const a = document.querySelector('.for-login a[href="#forgot"]');
		if (a && getComputedStyle(document.querySelector(".for-forgot")).display === "none") a.click();
	});
	await page.waitForSelector("#forgot_email", { state: "visible" });
	await page.screenshot({ path: path.join(outDir, `${label}-forgot-${lang}.png`), fullPage: true });
	const forgot = await page.evaluate(() => {
		const btn = document.querySelector(".btn-forgot");
		const s = getComputedStyle(btn);
		const back = document.querySelector('.for-forgot a[href="#login"]');
		const field = document.querySelector(".for-forgot .email-field");
		return {
			button: { disabled: btn.disabled, bg: s.backgroundColor, color: s.color, border: s.borderTopStyle + " " + s.borderTopColor, height: s.height },
			back: { color: getComputedStyle(back).color, bg: getComputedStyle(document.querySelector(".for-forgot .page-card")).backgroundColor },
			fieldIconBefore: getComputedStyle(field, "::before").content,
		};
	});
	await page.fill("#forgot_email", "name@example.com");
	await page.waitForTimeout(500);
	forgot.enabled = await page.evaluate(() => {
		const s = getComputedStyle(document.querySelector(".btn-forgot"));
		return { disabled: document.querySelector(".btn-forgot").disabled, bg: s.backgroundColor, color: s.color };
	});
	forgot.back.contrast = ratio(forgot.back.color, forgot.back.bg);
	if (forgot.enabled.bg) forgot.enabled.contrast = ratio(forgot.enabled.color, forgot.enabled.bg);
	await page.screenshot({ path: path.join(outDir, `${label}-forgot-${lang}-filled.png`), fullPage: true });

	// 2FA step markup (the card empties and core injects this; shot of the injected form)
	await page.goto(`${base}/login?_lang=${lang}`, { waitUntil: "networkidle" });
	const twofa = await page.evaluate(() => {
		const host = document.querySelector(".for-login .login-content");
		host.innerHTML = `<div id="twofactor_div"><form class="form-verify"><div class="page-card-head p-0"><span class="indicator blue">Verification</span></div><div id="otp_div"></div><input type="text" id="login_token" autocomplete="off" class="form-control" placeholder="Verification Code"><button class="es-button w-full mt-3" data-variant="solid" id="verify_token">Verify</button></form></div>`;
		const s = getComputedStyle(document.querySelector("#verify_token"));
		return { bg: s.backgroundColor, color: s.color, height: s.height };
	});
	twofa.contrast = ratio(twofa.color, twofa.bg);
	await page.screenshot({ path: path.join(outDir, `${label}-2fa-${lang}.png`), fullPage: true });

	// update-password page
	const resp = await page.goto(`${base}/update-password?_lang=${lang}`, { waitUntil: "networkidle" });
	let update = { status: resp && resp.status() };
	if (await page.$("#new_password")) {
		update = { ...update, ...(await page.evaluate(() => {
			const b = getComputedStyle(document.querySelector("#update"));
			const indEl = document.querySelector(".password-strength-indicator");
			const ind = indEl ? getComputedStyle(indEl) : null;
			return { button: { bg: b.backgroundColor, color: b.color, disabled: document.querySelector("#update").disabled }, indicatorColor: ind ? ind.color : null, reveals: document.querySelectorAll(".ins-reveal").length };
		})) };
		await page.screenshot({ path: path.join(outDir, `${label}-update-password-${lang}.png`), fullPage: true });
	}

	report.pages[lang] = { login, forgot, twofa, update };
	await ctx.close();
}
writeFileSync(path.join(outDir, `${label}-measurements.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
