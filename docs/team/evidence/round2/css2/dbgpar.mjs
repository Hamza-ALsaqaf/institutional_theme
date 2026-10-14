import { combos, launch, ready } from "./lib.mjs";
const { browser, page } = await launch(combos[0]);
await ready(page, "/desk/todo");
console.log(await page.evaluate(() => { const a = document.querySelector(".list-row a.ellipsis"); const s = getComputedStyle(a); return { html: a.outerHTML.slice(0, 200), parent: a.parentElement.outerHTML.slice(0, 120), fw: s.fontWeight, pfw: getComputedStyle(a.parentElement).fontWeight, ppfw: getComputedStyle(a.parentElement.parentElement).fontWeight }; }));
await ready(page, "/desk/todo/view/report");
console.log(await page.evaluate(() => { const rows = [...document.querySelectorAll(".dt-row-header")]; return rows.map(r => r.parentElement.className + "|" + r.className + "|" + getComputedStyle(r.querySelector(".dt-cell")).borderBottomWidth + "|" + r.querySelector(".dt-cell").className); }));
await browser.close();
