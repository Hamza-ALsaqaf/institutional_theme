import { combos, launch, ready } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const out = {};
for (const c of [combos[0], combos[2]]) {
	const { browser, page } = await launch(c);
	await ready(page, "/desk/todo");
	await page.evaluate(() => { const d = document.createElement("div"); d.className = "ins-banner"; d.dataset.insBanner = "offline"; d.setAttribute("role", "status"); const t = document.createElement("span"); t.className = "ins-banner-text"; t.textContent = document.documentElement.lang === "ar" ? "لا يوجد اتصال بالخادم." : "You are offline."; d.append(t); document.body.prepend(d); });
	await page.waitForTimeout(700);
	const r = (s) => page.evaluate((s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }, s);
	out[c.lang + "-ribbon+banner"] = { ribbon: await r(".ins-env-ribbon"), banner: await r(".ins-banner"), sidebar: await r(".body-sidebar"), main: await r(".main-section"), pagehead: await r(".page-head"), docH: await page.evaluate(() => document.documentElement.scrollHeight) };
	await page.screenshot({ path: `banner-ribbon-${c.lang}-light.png` });
	await page.emulateMedia({ forcedColors: "active" });
	out[c.lang + "-forced"] = await page.evaluate(() => { const s = getComputedStyle(document.querySelector(".ins-banner")); return { forced: matchMedia("(forced-colors: active)").matches, bg: s.backgroundColor, color: s.color, barStyle: s.borderInlineStartStyle, barW: s.borderInlineStartWidth, barColor: s.borderInlineStartColor }; });
	await page.screenshot({ path: `banner-forced-${c.lang}.png` });
	await browser.close();
}
writeFileSync("banner_ribbon.json", JSON.stringify(out, null, 1)); console.log(JSON.stringify(out));
