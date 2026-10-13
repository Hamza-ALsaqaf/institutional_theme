import { combos, launch, ready } from "./lib.mjs";
const { browser, page } = await launch(combos[0]);
await ready(page, "/desk/todo/new");
console.log(await page.evaluate(() => { const l = document.querySelector('.frappe-control[data-fieldname="status"] .control-label'); const hits=[]; for (const ss of document.styleSheets) { let rules; try { rules = ss.cssRules } catch(e){continue} for (const r of rules) { if (r.selectorText && r.style && /padding/.test(r.cssText) && l.matches(r.selectorText.split(",").find(x=>{try{return l.matches(x)}catch(e){return false}})||"__none__")) hits.push(r.cssText.slice(0,160)); } } return {cls:l.className, pr:getComputedStyle(l).paddingRight, outer:l.outerHTML, hits}; }));
await browser.close();
