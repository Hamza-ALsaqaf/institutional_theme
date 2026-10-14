import { chromium, BENCH, login, OUT, PWD } from "./lib.mjs";
const b = await chromium.launch({ args: ["--no-sandbox"] });
for (const [w, mobile] of [["52",true],["52",false],["32",true]]) {
 const ctx = await b.newContext({ viewport:{width:900,height:800}, isMobile:mobile, hasTouch:mobile, reducedMotion:"reduce" });
 const p = await ctx.newPage(); await login(p, BENCH[w], "rev4rcen@example.com", PWD);
 await p.goto(BENCH[w]+"/desk/todo"); await p.waitForSelector(".list-row-container"); await p.waitForTimeout(3500);
 const r = await p.evaluate(()=>{ const row=document.querySelectorAll('.list-row-container')[1]; return [...row.querySelectorAll('.es-badge, .indicator-pill')].map(e=>{const x=e.getBoundingClientRect(); const lr=row.querySelector('.level-right')?.getBoundingClientRect(); return {t:e.textContent.trim(), l:Math.round(x.left), r:Math.round(x.right), w:Math.round(x.width), levelRightLeft: lr&&Math.round(lr.left), clientW:e.clientWidth, scrollW:e.scrollWidth}; }); });
 console.log(w, mobile?"coarse":"fine", JSON.stringify(r));
 await p.screenshot({path: OUT+`w900-${w}-${mobile?"coarse":"fine"}.png`}); await ctx.close(); }
await b.close();
