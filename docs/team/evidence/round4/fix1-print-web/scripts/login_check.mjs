// usage: node login_check.mjs <base-url> <out-dir>
// Computed styles of the login card and email field in en (ltr) and ar (rtl), screenshots, and the N6 robustness probe
// (a utility class is placed before `for-login` and the card rules must still apply).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/home/runner/work/institutional_theme/institutional_theme/tests/browser/");
const { chromium } = require("playwright-core");
const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const host = new URL(base).hostname;
const browser = await chromium.launch({ args: ["--no-sandbox", "--no-proxy-server", `--host-resolver-rules=MAP ${host} 127.0.0.1`] });
const res = {};
for (const lang of ["en", "ar"]) {
	const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 }, locale: lang });
	const page = await ctx.newPage();
	await page.goto(`${base}/login?_lang=${lang}`, { waitUntil: "networkidle" });
	const read = () => page.evaluate(() => {
		const cs = (el) => getComputedStyle(el);
		const card = document.querySelector(".page-card");
		const email = document.querySelector("#login_email");
		const pw = document.querySelector("#login_password");
		return {
			dir: document.documentElement.dir,
			cardBorderTop: cs(card).borderTopWidth + " " + cs(card).borderTopColor,
			cardRadius: cs(card).borderTopLeftRadius,
			wrapperClass: card.closest("[class*='for-']")?.className,
			emailPadStart: cs(email).paddingInlineStart, emailPadEnd: cs(email).paddingInlineEnd,
			pwPadStart: cs(pw).paddingInlineStart, pwPadEnd: cs(pw).paddingInlineEnd,
			hasFieldIcon: !!document.querySelector(".email-field > .field-icon"),
		};
	});
	res[lang] = await read();
	await page.screenshot({ path: `${out}/login-${lang}.png` });
	if (lang === "en") {
		// N6: put a utility class before the section class on every wrapper.
		await page.evaluate(() => document.querySelectorAll("[class*='for-']").forEach((e) => { e.className = "flex flex-col " + e.className; }));
		res.en_with_extra_class_before = await read();
		await page.screenshot({ path: `${out}/login-en-extra-class.png` });
	}
	await ctx.close();
}
writeFileSync(`${out}/login-computed.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
await browser.close();
