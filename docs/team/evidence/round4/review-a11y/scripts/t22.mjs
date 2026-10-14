import { chromium, BENCH, login } from "./lib.mjs";
const [which, w] = process.argv.slice(2);
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ locale: "en-US", viewport: { width: +w, height: 400 }, reducedMotion: "reduce" });
const page = await ctx.newPage();
await login(page, BENCH[which]);
await page.goto(BENCH[which] + "/desk/todo"); await page.waitForTimeout(3500);
console.log(which, w, JSON.stringify(await page.evaluate(()=>{ const e=document.querySelector('.list-row-container .list-row .level-right'); const c=getComputedStyle(e); const res=document.querySelector('.result-container'); const rc=getComputedStyle(res); return { pos:c.position, insE:c.insetInlineEnd, right:c.right, left:c.left, z:c.zIndex, display:c.display, flex:c.flex, minW:c.minWidth, bg:c.backgroundColor, resOv:rc.overflowX, resScrollW:res.scrollWidth, resClientW:res.clientWidth, scrollLeft:res.scrollLeft }; })));
await b.close();
