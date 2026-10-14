import { combos, launch, ready } from "./lib.mjs";
const { browser, page } = await launch(combos[0], { hasTouch: true, isMobile: true, viewport: { width: 800, height: 900 } });
await ready(page, "/desk/todo");
console.log(await page.evaluate(() => { const l = document.querySelector(".like-action").getBoundingClientRect(); const c=document.querySelector(".list-row-checkbox").getBoundingClientRect(); return { coarse: matchMedia("(pointer: coarse)").matches, tm: getComputedStyle(document.documentElement).getPropertyValue("--ins-target-min"), like: [l.width, l.height], cb:[c.width,c.height] }; }));
await page.screenshot({ path: "coarse-en-list.png" });
await browser.close();
