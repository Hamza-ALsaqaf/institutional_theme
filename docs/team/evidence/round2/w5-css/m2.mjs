import { combos, launch, ready } from "./lib.mjs";
const { browser, page } = await launch(combos[0], { reducedMotion: "reduce" });
await ready(page, "/desk/todo");
await page.evaluate(() => { new frappe.ui.Dialog({ title: "D" }).show(); }); await page.waitForTimeout(800);
console.log(await page.evaluate(() => [...document.querySelectorAll("*")].filter(e => parseFloat(getComputedStyle(e).transitionDuration) > 0.001).map(e => e.tagName + "." + e.className + " " + getComputedStyle(e).transitionDuration + " " + getComputedStyle(e).transitionProperty)));
await browser.close();
