// Regression check: at 1280 px the sidebar (rail on v16.52.0, panel on 16.32.0) keeps visibility visible and its controls stay focusable.
import fs from "node:fs";
import { chromium, BENCH, DESK, login } from "./lib.mjs";
const res = {};
const b = await chromium.launch({ args: ["--no-sandbox"] });
for (const ver of ["16.32.0", "16.52.0"]) {
	const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
	await login(page, BENCH[ver]);
	await page.goto(BENCH[ver] + DESK[ver] + "/todo", { timeout: 90000 }); await page.waitForTimeout(4000);
	res[ver] = await page.evaluate(() => { const c = document.querySelector(".body-sidebar-container"); const kids = c ? [...c.querySelectorAll(".body-sidebar > *")] : []; return { expanded: c && c.classList.contains("expanded"), vis: kids.map((e) => getComputedStyle(e).visibility), firstLink: (() => { const a = c && c.querySelector(".body-sidebar a, .body-sidebar button"); return a ? a.checkVisibility({ visibilityProperty: true }) : null; })() }; });
	await page.close();
}
await b.close();
fs.writeFileSync("desktop-rail.json", JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
