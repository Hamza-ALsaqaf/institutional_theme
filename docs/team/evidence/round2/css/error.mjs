// Required field left empty after save: screenshots, computed styles of the icon, 4 combos (+ forced colours when FORCED=1).
import { combos, launch, ready } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const forced = process.env.FORCED === "1";
const out = [];
for (const c of combos) {
	const { browser, page } = await launch(c);
	if (forced) await page.emulateMedia({ forcedColors: "active" });
	await ready(page, "/desk/task/new");
	await page.waitForSelector('[data-fieldname="subject"] input', { timeout: 20000 });
	await page.keyboard.press("Control+s");
	await page.waitForSelector(".frappe-control.has-error", { timeout: 10000 }).catch(() => console.log("no error class"));
	await page.waitForTimeout(800);
	await page.keyboard.press("Escape");
	await page.waitForTimeout(600);
	const info = await page.evaluate(() => {
		const w = document.querySelector('[data-fieldname="subject"]'); const i = w.querySelector("input"); const ci = w.querySelector(".control-input");
		const a = getComputedStyle(ci, "::after"), is = getComputedStyle(i); const ir = i.getBoundingClientRect(), cr = ci.getBoundingClientRect();
		return { cls: w.className, after: { content: a.content, bg: a.backgroundColor, w: a.width, h: a.height, end: a.insetInlineEnd, mask: a.maskImage.slice(0, 30), fca: a.forcedColorAdjust }, input: { padEnd: is.paddingInlineEnd, padStart: is.paddingInlineStart, borderStartW: is.borderInlineStartWidth, borderColor: is.borderTopColor, dir: is.direction }, controlInputWidth: cr.width, inputWidth: ir.width };
	});
	out.push({ ...c, forced, ...info });
	await page.focus('[data-fieldname="subject"] input');
	await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
	const box = await page.locator('.frappe-control[data-fieldname="subject"]').first().boundingBox();
	await page.screenshot({ path: `${c.lang}-${c.mode}-${forced ? "forced-" : ""}error.png`, clip: { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 20), width: Math.min(1280 - Math.max(0, box.x - 40), box.width + 80), height: 160 } });
	await browser.close();
}
writeFileSync(`error-computed${forced ? "-forced" : ""}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out[0]), JSON.stringify(out[2].after));
