// Skeleton: core's own list_view.show_skeleton() on a loaded list (network throttling did not hold the skeleton visible), computed colours + screenshots.
import { combos, launch, ready } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const out = [];
for (const c of combos) {
	const { browser, page } = await launch(c);
	await ready(page, "/desk/task/view/list");
	await page.waitForSelector(".list-row", { timeout: 15000 }).catch(() => {});
	await page.evaluate(() => cur_list.show_skeleton());
	await page.waitForTimeout(500);
	const info = await page.evaluate(() => { const b = document.querySelector(".list-skeleton-box"); const s = getComputedStyle(b); const bg = getComputedStyle(document.body).backgroundColor; return { visible: b.offsetParent !== null, box: s.backgroundColor, radius: s.borderRadius, anim: s.animationName, pageBg: bg }; });
	out.push({ ...c, ...info });
	await page.screenshot({ path: `${c.lang}-${c.mode}-state-skeleton.png` });
	await browser.close();
}
writeFileSync("skeleton-computed.json", JSON.stringify(out, null, 1));
for (const o of out) console.log(JSON.stringify(o));
