import fs from "node:fs";
import { FULLY_VISIBLE } from "./visible.mjs";
import { chromium, BENCH, login } from "./lib.mjs";
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await b.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2 })).newPage();
await login(page, BENCH["16.52.0"]);
await page.goto(BENCH["16.52.0"] + "/desk/todo", { timeout: 90000 }); await page.waitForSelector(".list-row", { timeout: 60000 }); await page.waitForTimeout(3000);
const R = ".layout-main-section .frappe-list .result-container .list-row-container:not(:has(.list-row-head)) .list-row .level-left";

const src = fs.readFileSync("/home/runner/work/institutional_theme/institutional_theme/institutional_theme/public/scss/desk/_list.scss", "utf8");
const P2 = "html:root[dir] " + R;
const variants = {
 a: `${P2} { white-space: normal; }`,
 b: `${P2} { white-space: normal; } ${P2} .list-row-col { white-space: nowrap; }`,
 c: `${P2} { white-space: normal; } ${P2} .mobile-layout .list-row-col { flex: 0 0 auto; overflow: visible; }`,
 d: `${R} { white-space: normal; } ${R} .mobile-layout .list-row-col.ellipsis { flex: 0 0 auto; overflow: visible; }`,
};
for (const [k, css] of Object.entries(variants)) {
	const h = css ? await page.addStyleTag({ content: css }) : null;
	await page.waitForTimeout(300);
	const m = await page.evaluate((src) => { const vis = eval(src); return [...document.querySelectorAll(".list-row-container:not(:has(.list-row-head)) .list-row")].map((r) => {
		const d = [...r.querySelectorAll(".level-left .mobile-layout a, .level-left .mobile-layout .list-row-col")].filter((e) => /\d{2}-\d{2}-\d{4}/.test(e.textContent) && !e.querySelector("a, .list-row-col"))[0];
		return d ? (vis(d) ? true : d.tagName + "." + d.className + ":" + JSON.stringify(d.textContent.trim()) + JSON.stringify(document.createRange().getBoundingClientRect())) : "nodate"; }); }, FULLY_VISIBLE);
	console.log(k, JSON.stringify(m));
	if (false) console.log(await page.evaluate(() => { const r = document.querySelector(".list-row-container:not(:has(.list-row-head)) .list-row"); const d = [...r.querySelectorAll(".mobile-layout a")].pop(); const rg = document.createRange(); rg.selectNodeContents(d); const t = rg.getBoundingClientRect(); const o = [`text ${Math.round(t.left)}-${Math.round(t.right)} y${Math.round(t.top)}-${Math.round(t.bottom)}`]; for (let p = d; p && !p.classList.contains("result-container"); p = p.parentElement) { const c = getComputedStyle(p), q = p.getBoundingClientRect(); if (c.overflowX !== "visible" || c.overflowY !== "visible") o.push(`${p.className.slice(0,30)} ov=${c.overflowX}/${c.overflowY} ${Math.round(q.left)}-${Math.round(q.right)} y${Math.round(q.top)}-${Math.round(q.bottom)}`); } return o.join("\n"); }));
	await page.screenshot({ path: `/tmp/fix3-${k}.png`, clip: { x: 0, y: 180, width: 320, height: 300 } });
	if (h) await h.evaluate((e) => e.remove());
}
await b.close();
