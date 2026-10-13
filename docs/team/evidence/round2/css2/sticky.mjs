import { combos, launch, ready } from "./lib.mjs";
const { browser, page } = await launch(combos[0]);
await ready(page, "/desk/user");
const r = await page.evaluate(async () => { const m=document.querySelector(".main-section"); const f=document.createElement("div"); f.style.height="3000px"; m.appendChild(f); m.scrollTop=300; await new Promise(r=>setTimeout(r,300)); return {st:m.scrollTop, head:document.querySelector(".page-head").getBoundingClientRect().top}; });
console.log(JSON.stringify(r)); await browser.close();
