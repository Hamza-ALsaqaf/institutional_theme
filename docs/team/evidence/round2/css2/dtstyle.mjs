import { combos, launch, ready } from "./lib.mjs";
const { browser, page } = await launch(combos[0]);
await ready(page, "/desk/todo/view/report");
await page.waitForSelector(".dt-row", { timeout: 20000 }).catch(() => {});
console.log(await page.evaluate(() => { const o=[]; for (const s of document.styleSheets) { try { for (const r of s.cssRules) if (r.selectorText && r.selectorText.includes("dt-instance")) o.push(r.cssText.slice(0,200)); } catch(e){} } return o.join("\n")+"\nSTYLE:"+[...document.querySelectorAll("style")].filter(s=>s.textContent.includes("dt-instance")).map(s=>s.textContent.slice(0,1500)).join("|"); }));
await browser.close();
