import { combos, launch, ready } from "./lib.mjs";
for (const c of [combos[0], combos[2]]) {
const { browser, page } = await launch(c);
await ready(page, "/desk/todo");
console.log(c.lang, JSON.stringify(await page.evaluate(() => ({links:[...document.querySelectorAll("link[rel=stylesheet],style")].map(l=>l.href?l.href.replace(location.origin,""):"style:"+(l.id||l.textContent.length)), html:document.documentElement.outerHTML.slice(0,260)})),null,1));
await browser.close(); }
