import { combos, launch, ready } from "./lib.mjs";
const { browser, page } = await launch(combos[2]);
await ready(page, "/desk/todo");
console.log(await page.evaluate(() => document.querySelector(".list-row .list-subject").outerHTML)); console.log(await page.evaluate(() => { document.querySelectorAll(".list-row .level-item.bold").forEach(e=>e.classList.remove("bold")); const a = document.querySelector(".list-row .list-subject a"); const o = []; for (let e = a; e && !e.classList.contains("list-row-container"); e = e.parentElement) o.push(e.tagName + "." + e.className + " fw=" + getComputedStyle(e).fontWeight); return o; }));
await browser.close();
