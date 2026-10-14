import { combos, launch, ready } from "./lib.mjs";
const { browser, page } = await launch(combos[0]);
await ready(page, "/desk/todo");
console.log(JSON.stringify(await page.evaluate(() => {
 const res=[]; for (const ss of document.styleSheets) { let rules; try { rules=ss.cssRules } catch(e){continue}
  for (const r of rules) if (r.selectorText && /^(body|html)\b|\bbody\b/.test(r.selectorText) && /padding/.test(r.cssText) && /(^|,)\s*(html[^,]*)?body\s*(\{|,)/.test(r.selectorText+"{")) res.push((ss.href||"inline").slice(-40)+" :: "+r.cssText.slice(0,200)); }
 return {res, html: document.documentElement.outerHTML.slice(0,300), tag: document.body.className, kids:[...document.body.children].map(e=>e.tagName+"."+e.className)};
}),null,1));
await browser.close();
