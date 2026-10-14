// Forced colours (emulateMedia forcedColors active): list, form focus ring, checked checkbox, appearance page; computed styles + screenshots.
import { combos, launch, ready } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const out = [];
for (const c of combos.filter((x) => (x.lang === "en" && x.mode === "light") || (x.lang === "ar" && x.mode === "dark"))) {
	const { browser, page } = await launch(c);
	await page.emulateMedia({ forcedColors: "active" });
	const r = { ...c, media: null };
	await ready(page, "/desk/task/view/list");
	await page.waitForSelector(".list-row", { timeout: 15000 }).catch(() => {});
	r.media = await page.evaluate(() => matchMedia("(forced-colors: active)").matches);
	await page.locator(".list-row-checkbox").first().check({ force: true });
	await page.locator(".list-row-checkbox").nth(1).focus();
	await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab");
	r.list = await page.evaluate(() => { const cb = document.querySelector(".list-row-checkbox:checked"); const f = document.activeElement; const fs = getComputedStyle(f); const cs = getComputedStyle(cb); const row = document.querySelector(".list-row"); return { checkedAppearance: cs.appearance, checkedBg: cs.backgroundColor, checkedBorder: cs.borderTopColor + " " + cs.borderTopWidth, checkedBgImage: cs.backgroundImage.slice(0, 60), focusTag: f.tagName + "." + f.className, focusOutline: fs.outlineStyle + " " + fs.outlineWidth + " " + fs.outlineColor, rowBorder: getComputedStyle(row).borderBlockEndColor + " " + getComputedStyle(row).borderBlockEndStyle }; });
	await page.screenshot({ path: `${c.lang}-${c.mode}-forced-list.png` });
	await ready(page, "/desk/ins-appearance");
	await page.waitForSelector(".ins-appearance", { timeout: 15000 });
	await page.locator(".ins-appearance-option input").nth(1).focus(); await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab");
	r.appearance = await page.evaluate(() => { const f = document.activeElement; const fs = getComputedStyle(f); const sel = document.querySelector(".ins-appearance-option:has(input:checked)"); const ss = getComputedStyle(sel); const dot = document.querySelector(".ins-swatch-dot"); const ds = getComputedStyle(dot); const mk = document.querySelector(".ins-selected"); return { focusOutline: fs.outlineStyle + " " + fs.outlineWidth + " " + fs.outlineColor, checkedOptionBorder: ss.borderTopColor + " " + ss.borderTopStyle + " " + ss.borderTopWidth, checkedOptionBg: ss.backgroundColor, swatchBg: ds.backgroundColor, swatchBorder: ds.borderTopColor, selectedMarkerColor: mk ? getComputedStyle(mk).color : null, selectedMarkerText: mk?.textContent }; });
	await page.screenshot({ path: `${c.lang}-${c.mode}-forced-appearance.png` });
	out.push(r);
	await browser.close();
}
writeFileSync("forced-computed.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
