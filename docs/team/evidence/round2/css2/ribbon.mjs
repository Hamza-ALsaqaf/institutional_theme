import { combos, launch, ready } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const out = {};
for (const c of combos.filter(c => c.mode === "light")) {
	const { browser, ctx, page } = await launch(c);
	await ready(page, "/desk/todo");
	out[c.lang] = await page.evaluate(() => {
		const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
		return { ribbon: r(".ins-env-ribbon"), sidebar: r(".body-sidebar"), main: r(".main-section"), pagehead: r(".page-head"), sbtop: r(".body-sidebar .body-sidebar-top, .body-sidebar > *"), sbpad: getComputedStyle(document.querySelector(".body-sidebar")).paddingBlockStart, navbar: r(".navbar"), body: r("body"), docH: document.documentElement.scrollHeight, winH: innerHeight, scrollY, bodyPad: getComputedStyle(document.body).paddingBlockStart };
	});
	await page.screenshot({ path: `${process.argv[2] || "."}/ribbon-${c.lang}-light${process.argv[3] || ""}.png` });
	await browser.close();
}
writeFileSync(`${process.argv[2] || "."}/ribbon${process.argv[3] || ""}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
