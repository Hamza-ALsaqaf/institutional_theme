// Item 4 (second part): error reference ID with "monitor": 1; the footer reference equals the X-Frappe-Request-Id header.
// /message?id=... is core's own mechanism for an error message with a status code (frappe/www/message.py).
// /me as Guest is the core 403 (NotPermittedPage) page.
import { launch, recorder, shots, BASE } from "./lib.mjs";
import { join } from "node:path";

const rec = recorder("a4b_error_reference");
const browser = await launch();
try {
	for (const lang of ["en", "ar"]) {
		const ctx = await browser.newContext({ baseURL: BASE, locale: lang === "ar" ? "ar-SA" : "en-US", viewport: { width: 1100, height: 800 } });
		const page = await ctx.newPage();
		for (const [name, path] of [["message-500", "/message?id=ins-r2-500&_lang=" + lang], ["forbidden-403", "/me?_lang=" + lang]]) {
			const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
			const key = `${name}-${lang}`;
			const header = res.headers()["x-frappe-request-id"];
			const ref = await page.locator(".ins-reference code").first().textContent().catch(() => null);
			const time = await page.locator(".ins-trust").first().innerText().catch(() => "");
			rec.out.data[key] = { status: res.status(), header, reference: ref, footer: time, dir: await page.evaluate(() => document.documentElement.dir) };
			rec.check(`${key}: reference equals the response header`, ref && ref === header, `${ref} vs ${header}`);
			await page.screenshot({ path: join(shots, `a4b-${key}.png`) });
		}
		await ctx.close();
	}
} finally {
	rec.save();
	await browser.close();
}
