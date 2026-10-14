import { chromium, BENCH, login, OUT, PWD } from "./lib.mjs";
import { HELPERS } from "./measure.mjs";
import { writeFileSync } from "node:fs";
const [which, user, lang, mode] = process.argv.slice(2);
const base = BENCH[which];
const tag = `${which}-${lang}-${mode}`;
const b = await chromium.launch({ args: ["--no-sandbox"] });
const res = {};
async function open(ctxOpts, path="/desk/todo") {
  const ctx = await b.newContext({ locale: lang==="ar"?"ar":"en-US", viewport: { width: 1366, height: 768 }, reducedMotion: "reduce", ...ctxOpts });
  const page = await ctx.newPage();
  await login(page, base, user, PWD);
  await page.goto(base + path); await page.waitForSelector(".list-row-container", {timeout:30000}); await page.waitForTimeout(3000); await page.evaluate(HELPERS);
  return [ctx, page];
}
const SIZES = () => { const q=(s)=>{ const e=[...document.querySelectorAll(s)].find(x=>x.getBoundingClientRect().width>0); if(!e) return null; const r=e.getBoundingClientRect(); return Math.round(r.width*10)/10+'x'+Math.round(r.height*10)/10; };
  return { primary:q('.primary-action'), menu:q('.menu-more-button'), btn:q('.page-head .btn-default, .page-head .es-button:not(.primary-action)'), pill:q('.list-paging-area .es-pill'), dock:q('.dock .dock-item'), crumb:q('.es-breadcrumbs__item:is(a,button)'), input:q('.standard-filter-section input, .frappe-control input'), btnAny:q('.btn.btn-sm, .btn-default'), coarse: matchMedia('(pointer: coarse)').matches, density:document.documentElement.getAttribute('data-ins-density') }; };
// ---- comfortable, compact, coarse
let [ctx, page] = await open({});
res.heights = { comfortable: await page.evaluate(SIZES) };
await page.evaluate(()=>document.documentElement.setAttribute('data-ins-density','compact')); await page.waitForTimeout(300);
res.heights.compact = await page.evaluate(SIZES);
await page.screenshot({ path: OUT + `heights-compact-${tag}.png` });
await page.evaluate(()=>document.documentElement.setAttribute('data-ins-density','comfortable')); await page.waitForTimeout(300);

// ---- pills (52)
res.pills = await page.evaluate(() => {
  const on=document.querySelector('.list-paging-area .es-pill[data-state=active]'); const off=document.querySelector('.list-paging-area .es-pill[data-state=inactive]'); if(!on) return null;
  const c=getComputedStyle(on), d=getComputedStyle(off); const par=on.parentElement;
  const ring = c.boxShadow; const m = ring.match(/rgba?\([^)]*\)/); const ringCol = m? m[0]:null;
  const fillOn = __bg(on), fillOff=__bg(off), ctr=__bg(par);
  const ringC = ringCol? __over(__p(ringCol), fillOn):null; // ring drawn inside the pill: over the pill fill (own fill = what the ring is adjacent to inside)
  return { on:{ fw:c.fontWeight, shadow:ring, bg:c.backgroundColor, fill:__rgb(fillOn), text:__text(on) }, off:{ fw:d.fontWeight, shadow:d.boxShadow, fill:__rgb(fillOff), text:__text(off) }, container:{bg:__rgb(ctr), border:getComputedStyle(par).borderTopColor+' '+getComputedStyle(par).borderTopWidth},
   ringVsOwnFill: ringCol? +__ratio(__p(ringCol), fillOn).toFixed(2):null, ringVsInactiveFill: ringCol? +__ratio(__p(ringCol), fillOff).toFixed(2):null, ringVsContainer: ringCol? +__ratio(__p(ringCol), ctr).toFixed(2):null,
   fillOnVsOff: +__ratio(fillOn,fillOff).toFixed(2), textOnVsOff: null, minH: c.minBlockSize, h: on.getBoundingClientRect().height };
});
const pr = await page.$('.list-paging-area .es-tab-buttons'); if (pr) { const bb=await pr.boundingBox(); await page.screenshot({ path: OUT+`pills-${tag}.png`, clip:{x:Math.max(0,bb.x-20),y:bb.y-14,width:bb.width+40,height:bb.height+28}, scale:'css' }); }

// ---- disabled .es-button clones (52) and .btn (32)
res.disabled = await page.evaluate(() => {
  const out={}; const host=document.querySelector('.page-container, .layout-main-section')||document.body;
  const mk=(srcSel,key)=>{ const s=document.querySelector(srcSel); if(!s) return; const c=s.cloneNode(true); c.disabled=true; c.id='rc-'+key; c.removeAttribute('data-ins-action'); s.parentElement.appendChild(c); const cs=getComputedStyle(c); const bg=__bg(c.parentElement);
    const fillBg=__p(cs.backgroundColor); const comp=__over(fillBg, bg); const fg=__over(__p(cs.color), comp);
    out[key]={ cls:c.className, color:cs.color, bg:cs.backgroundColor, text:+__ratio(fg,comp).toFixed(2), border:cs.borderTopStyle+' '+cs.borderTopWidth+' '+cs.borderTopColor, borderVsBg: cs.borderTopStyle==='none'?null:+__ratio(__over(__p(cs.borderTopColor),comp),comp).toFixed(2), borderVsPage:+__ratio(__over(__p(cs.borderTopColor),comp),bg).toFixed(2), fillVsPage:+__ratio(comp,bg).toFixed(2), h:c.getBoundingClientRect().height, w:c.getBoundingClientRect().width, cursor:cs.cursor, opacity:cs.opacity, variant:c.dataset.variant }; };
  mk('.primary-action','solid'); mk('.menu-more-button','subtle'); mk('.page-head .btn-default','btnDefault');
  return out; });
// make them visible on a screenshot
await page.evaluate(()=>{ const a=document.getElementById('rc-solid'); const b=document.getElementById('rc-subtle'); [a,b].forEach(e=>e&&e.scrollIntoView({block:'center'})); });
const ph = await page.$('.page-head'); if (ph) { const bb=await ph.boundingBox(); await page.screenshot({ path: OUT+`disabled-${tag}.png`, clip:{x:bb.x,y:bb.y,width:bb.width,height:Math.min(bb.height,120)} }); }
await page.evaluate(()=>document.querySelectorAll('[id^=rc-]').forEach(e=>e.remove()));

// ---- toast
res.toasts=[];
for (const ind of ["green","red","orange","blue"]) {
  await page.evaluate((ind)=>{ document.querySelectorAll('.es-toast, .desk-alert').forEach(e=>e.remove()); frappe.show_alert({message:'Message '+ind, indicator:ind}, 60); }, ind);
  await page.waitForTimeout(700);
  res.toasts.push(await page.evaluate((ind) => { const t=document.querySelector('.es-toast, .desk-alert'); if(!t) return {ind, none:true}; const ic=t.querySelector('svg'); if(!ic) return {ind, cls:t.className, noSvg:true}; const ics=getComputedStyle(ic); const tcs=getComputedStyle(t);
    return { ind, cls:t.className.slice(0,30), type:t.dataset.type, iconColor:ics.color, iconStroke:ics.stroke, strokeEqColor: ics.color===ics.stroke, strokeVsToast: __nt(ics.stroke==='none'?ics.color:ics.stroke, t), colorVsToast:__nt(ics.color,t) }; }, ind));
  if (ind==="red") await page.screenshot({ path: OUT+`toast-${tag}.png`, clip:{x:0,y:560,width:520,height:208} });
}
await page.evaluate(()=>document.querySelectorAll('.es-toast, .desk-alert').forEach(e=>e.remove()));
await ctx.close();

// ---- coarse
[ctx, page] = await open({ viewport:{width:900,height:800}, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
res.heights.coarse = await page.evaluate(SIZES);
await page.screenshot({ path: OUT+`heights-coarse-${tag}.png` });
await page.evaluate(()=>document.documentElement.setAttribute('data-ins-density','compact')); await page.waitForTimeout(300);
res.heights.coarseCompact = await page.evaluate(SIZES);
await ctx.close();
writeFileSync(OUT+`desk-${tag}.json`, JSON.stringify(res,null,1));
await b.close();
console.log(tag, "done");
