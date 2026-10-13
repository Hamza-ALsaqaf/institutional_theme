import { combos, launch, ready } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const { browser, page } = await launch(combos[0]);
await ready(page, "/desk/todo/view/report");
await page.waitForTimeout(6000); console.log(page.url(), await page.evaluate(() => document.querySelector(".main-section")?.innerText.slice(0,300)));
await page.waitForTimeout(1500);
const r = await page.evaluate(() => {
	const dt = document.querySelector(".datatable"); const c = dt.cloneNode(true);
	c.querySelectorAll("svg").forEach(s => s.innerHTML = "");
	const rows = [...c.querySelectorAll(".dt-scrollable .dt-row")];
	return { n: rows.length, scrollable: c.querySelector(".dt-scrollable")?.outerHTML.slice(0, 200), row0: rows[0]?.outerHTML.replace(/\s*\n\s*/g, "\n").slice(0, 3000),
		header: getComputedStyle(dt.querySelector(".dt-row-header")).height, rowStyle: dt.querySelector(".dt-scrollable .dt-row")?.getAttribute("style"), cellH: getComputedStyle(dt.querySelector(".dt-scrollable .dt-cell")).height,
		dtattrs: dt.outerHTML.slice(0, 140), wrapper: dt.parentElement.className + "|" + dt.parentElement.parentElement.className };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
