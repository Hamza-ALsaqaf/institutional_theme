import { chromium, BENCH, login, OUT } from "./lib.mjs";
import { HELPERS } from "./measure.mjs";
const [which, user, lang] = process.argv.slice(2);
const base = BENCH[which];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ locale: lang==="ar"?"ar":"en-US", viewport: { width: 1366, height: 768 }, reducedMotion: "reduce", deviceScaleFactor: 3 });
const page = await ctx.newPage();
await login(page, base, user, "Rev4-pass-9X!q");
await page.goto(base + "/desk/todo"); await page.waitForTimeout(3500); await page.evaluate(HELPERS);
console.log(JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('[aria-current]')].map(e=>e.tagName+'.'+String(e.className).slice(0,40)+'='+e.getAttribute('aria-current')+' '+e.textContent.trim().slice(0,14)))));
const act = await page.$('.list-paging-area .es-pill[data-state=active]');
console.log('tabindex', await page.evaluate(()=>[...document.querySelectorAll('.list-paging-area .es-pill')].map(e=>e.tabIndex)));
await act.focus(); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(500);
const m = await page.evaluate(()=>{ const e=document.activeElement; const c=getComputedStyle(e); const r=e.getBoundingClientRect(); return { cls:String(e.className).slice(0,30), txt:e.textContent.trim(), fv:e.matches(':focus-visible'), outline:c.outlineStyle+' '+c.outlineWidth+' '+c.outlineColor+' off '+c.outlineOffset, rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)], checked:e.getAttribute('aria-checked'), par: (()=>{const p=e.parentElement.getBoundingClientRect(); return [Math.round(p.left),Math.round(p.top),Math.round(p.width),Math.round(p.height)];})(), parOv:getComputedStyle(e.parentElement).overflow }; });
console.log(JSON.stringify(m));
await page.screenshot({ path: OUT+`pillring-${which}-${lang}.png`, clip:{x:Math.max(0,m.rect[0]-60),y:m.rect[1]-14,width:m.rect[2]+220,height:m.rect[3]+28} });
// restore page size
await page.evaluate(()=>{ const e=document.querySelector('.list-paging-area .es-pill'); e&&e.click(); });
await b.close();
