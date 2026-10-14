// Item 4: environment ribbon ("training"), ar/en x Light/Dark, accessible text. Needs ins_environment in site_config.
import { launch, adminRequest, ensureUsers, userContext, recorder, shots, BASE } from "./lib.mjs";
import { join } from "node:path";

const rec = recorder("a4_ribbon");
const browser = await launch();
try {
	await ensureUsers(await adminRequest(browser));
	for (const lang of ["en", "ar"]) {
		for (const theme of ["Light", "Dark"]) {
			const ctx = await userContext(browser, lang, { theme });
			const page = await ctx.newPage();
			await page.goto(`${BASE}/desk/ins-appearance`, { waitUntil: "networkidle" });
			await page.waitForSelector(".ins-appearance fieldset");
			const key = `${lang}-${theme.toLowerCase()}`;
			const ribbon = page.locator("body > .ins-env-ribbon");
			const count = await ribbon.count();
			const info = { count };
			if (count) {
				info.text = await ribbon.textContent();
				info.role = await ribbon.getAttribute("role");
				info.ariaSnapshot = await ribbon.ariaSnapshot();
				info.rootAttr = await page.evaluate(() => document.documentElement.getAttribute("data-ins-environment"));
				info.mode = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
				info.dir = await page.evaluate(() => document.documentElement.dir);
				info.boot = await page.evaluate(() => frappe.boot.ins.environment);
				info.style = await ribbon.evaluate((n) => {
					const s = getComputedStyle(n);
					const b = n.getBoundingClientRect();
					return { position: s.position, color: s.color, background: s.backgroundColor, fontFamily: s.fontFamily,
						fontSize: s.fontSize, zIndex: s.zIndex, top: Math.round(b.top), height: Math.round(b.height), width: Math.round(b.width) };
				});
				info.pagePaddingTop = await page.evaluate(() => getComputedStyle(document.body).paddingBlockStart);
			}
			rec.out.data[key] = info;
			rec.check(`${key}: exactly one ribbon`, count === 1);
			rec.check(`${key}: translated text`, lang === "ar" ? /[؀-ۿ]/.test(info.text || "") : info.text === "Training", info.text);
			rec.check(`${key}: role note, text in the accessibility tree`, info.role === "note" && (info.ariaSnapshot || "").includes(info.text), info.ariaSnapshot);
			await page.screenshot({ path: join(shots, `a4-ribbon-${key}.png`) });
			await ctx.close();
		}
	}
} finally {
	rec.save();
	await browser.close();
}
