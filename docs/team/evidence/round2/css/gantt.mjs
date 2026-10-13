// Gantt of the fictional project's tasks: bar fill/stroke computed, screenshots, 4 combos.
import { combos, launch, ready } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const out = [];
for (const c of combos) {
	const { browser, page } = await launch(c);
	await ready(page, "/desk/task/view/gantt?project=PROJ-0001");
	await page.waitForSelector(".gantt .bar", { timeout: 20000 }).catch(() => console.log("no bar"));
	await page.waitForTimeout(800);
	const info = await page.evaluate(() => [...document.querySelectorAll(".gantt .bar-wrapper")].map((w) => { const b = w.querySelector(".bar"), p = w.querySelector(".bar-progress"); const s = getComputedStyle(b); return { fill: s.fill, stroke: s.stroke, progress: p ? getComputedStyle(p).fill : null, label: w.querySelector(".bar-label")?.textContent, labelFill: getComputedStyle(w.querySelector(".bar-label") || b).fill }; }));
	out.push({ ...c, bars: info, theme: await page.evaluate(() => document.documentElement.dataset.theme) });
	await page.screenshot({ path: `${c.lang}-${c.mode}-gantt.png` });
	await browser.close();
}
writeFileSync("gantt-computed.json", JSON.stringify(out, null, 1));
for (const o of out) console.log(o.lang, o.mode, o.bars.length, JSON.stringify(o.bars[0]));
