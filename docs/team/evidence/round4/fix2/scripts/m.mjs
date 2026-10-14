import { chromium, BENCH, login } from "/home/runner/work/institutional_theme/institutional_theme/docs/team/evidence/round4/review-a11y/scripts/lib.mjs";
import { writeFileSync } from "node:fs";
const OUT = "/home/runner/work/institutional_theme/institutional_theme/docs/team/evidence/round4/fix2/";
const [which, lang, theme] = process.argv.slice(2);
const base = BENCH[which], u = `fx2${lang}${theme}@example.com`;
const b = await chromium.launch({ args: ["--no-sandbox"] });
const H = `window.__c = (()=>{ const lum=(c)=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])};
 const p=(s)=>{const m=s.match(/[\\d.]+/g).map(Number);return {r:m[0],g:m[1],b:m[2],a:m[3]??1}};
 const bgOf=(e)=>{let layers=[];for(let n=e;n;n=n.parentElement){const c=p(getComputedStyle(n).backgroundColor);if(c.a>0)layers.push(c);if(c.a===1)break}let acc={r:255,g:255,b:255};for(const c of layers.reverse()){acc={r:acc.r*(1-c.a)+c.r*c.a,g:acc.g*(1-c.a)+c.g*c.a,b:acc.b*(1-c.a)+c.b*c.a}}return [acc.r,acc.g,acc.b]};
 const ratio=(a,b)=>{const x=lum(a),y=lum(b);return +(((Math.max(x,y)+.05)/(Math.min(x,y)+.05))).toFixed(2)};
 return {p,bgOf,ratio,rgb:(s)=>{const c=p(s);return [c.r,c.g,c.b]}} })();`;
async function session(opts) {
  const ctx = await b.newContext({ locale: lang==="ar"?"ar":"en-US", viewport: { width: 1366, height: 768 }, reducedMotion: "reduce", ...opts });
  const page = await ctx.newPage();
  await login(page, base, u, "Fx2-pass-9X!q");
  await page.goto(base + "/desk/todo"); await page.waitForTimeout(4000); await page.evaluate(H);
  return [ctx, page];
}
const res = { which, lang, theme };
// ---- normal
let [ctx, page] = await session({});
res.mode = await page.evaluate(() => document.documentElement.dataset.theme);
res.heights = await page.evaluate(() => { const r=(s)=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); return `${Math.round(b.width*10)/10}x${Math.round(b.height*10)/10}`}; return { primary:r(".primary-action"), menu:r(".menu-more-button"), pill:r(".list-paging-area .es-pill"), btn:r(".page-head .btn"), input:r(".standard-filter-section input, .frappe-control input") }; });
if (which==="52") {
  res.pills = await page.evaluate(() => { const a=document.querySelector(".list-paging-area .es-pill[data-state=active]"), i=document.querySelector(".list-paging-area .es-pill[data-state=inactive]"); const cs=getComputedStyle(a), ci=getComputedStyle(i); const bg=window.__c.bgOf(a.parentElement); const ring=window.__c.rgb(cs.boxShadow.match(/rgb[a]?\([^)]*\)/)[0]);
    return { activeShadow:cs.boxShadow, activeWeight:cs.fontWeight, inactiveWeight:ci.fontWeight, inactiveShadow:ci.boxShadow, ringVsRail:window.__c.ratio(ring,bg), ringVsActiveFill:window.__c.ratio(ring,window.__c.rgb(cs.backgroundColor)), railBg:bg, activeBg:cs.backgroundColor, text:window.__c.ratio(window.__c.rgb(cs.color), window.__c.rgb(cs.backgroundColor)) }; });
  const pg = await page.$(".list-paging-area"); if (pg) { await pg.scrollIntoViewIfNeeded(); await page.screenshot({ path: OUT + `pills-${which}-${lang}-${theme}.png`, clip: await pg.boundingBox().then(b=>({x:Math.max(0,b.x-8),y:Math.max(0,b.y-8),width:Math.min(1366,b.width+16),height:b.height+16})) }); }
  // toasts
  res.toasts = [];
  for (const ind of ["blue","green","orange","red"]) {
    await page.evaluate((i)=>frappe.show_alert({message:'Toast '+i, indicator:i}, 60), ind); await page.waitForTimeout(500);
    res.toasts.push(await page.evaluate((i) => { const t=[...document.querySelectorAll(".es-toast")].pop(); const s=t.querySelector(":scope > svg"); const cs=getComputedStyle(s); const bg=window.__c.bgOf(t); return { ind:i, type:t.dataset.type, stroke:cs.stroke, color:cs.color, strokeContrast: window.__c.ratio(window.__c.rgb(cs.stroke), bg) }; }, ind));
  }
  await page.screenshot({ path: OUT + `toast-${which}-${lang}-${theme}.png`, clip:{x:lang==="ar"?0:866,y:420,width:500,height:348} });
  await page.evaluate(()=>document.querySelectorAll('.es-toast').forEach(e=>e.remove()));
  // disabled clones
  res.disabled = await page.evaluate(() => { const out={}; const host=document.querySelector(".page-head .page-actions")||document.body;
    for (const [k,sel] of [["solid",".primary-action"],["subtle",".menu-more-button"]]) { const o=document.querySelector(sel); const c=o.cloneNode(true); c.disabled=true; c.id="dz-"+k; o.after(c); const cs=getComputedStyle(c); const bg=window.__c.bgOf(c); out[k]={ border:cs.borderTopStyle+" "+cs.borderTopWidth+" "+cs.borderTopColor, bg:cs.backgroundColor, color:cs.color, textContrast:window.__c.ratio(window.__c.rgb(cs.color), window.__c.rgb(cs.backgroundColor)), borderVsPage:window.__c.ratio(window.__c.rgb(cs.borderTopColor), bg), h:c.getBoundingClientRect().height }; }
    return out; });
  const pa = await page.$(".page-head .page-actions"); await page.screenshot({ path: OUT + `disabled-${which}-${lang}-${theme}.png`, clip: await pa.boundingBox().then(b=>({x:Math.max(0,b.x-12),y:Math.max(0,b.y-12),width:Math.min(600,b.width+24),height:b.height+24})) });
}
await ctx.close();
// ---- forced colours
[ctx, page] = await session({ forcedColors: "active" });
const F = (sel)=> page.evaluate((sel)=>{ const e=document.querySelector(sel); if(!e) return null; const cs=getComputedStyle(e), bf=getComputedStyle(e,'::before'); return { color:cs.color, bg:cs.backgroundColor, border:cs.borderTopStyle+' '+cs.borderTopWidth+' '+cs.borderTopColor, outline:cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor, before:{bg:bf.backgroundColor,w:bf.width} }; }, sel);
res.forced = { sbActive: await F(".body-sidebar .standard-sidebar-item.active-sidebar"), sbPlain: await F(".body-sidebar .standard-sidebar-item:not(.active-sidebar)") };
if (which==="52") { res.forced.dockActive = await F(".dock .dock-item.active"); res.forced.dockPlain = await F(".dock .dock-item:not(.active)"); res.forced.pillActive = await F(".list-paging-area .es-pill[data-state=active]"); res.forced.pillIdle = await F(".list-paging-area .es-pill[data-state=inactive]"); }
await page.screenshot({ path: OUT + `forced-${which}-${lang}-${theme}.png` });
await ctx.close();
// ---- coarse pointer
[ctx, page] = await session({ hasTouch: true, isMobile: true, viewport: { width: 820, height: 900 } });
res.coarse = await page.evaluate(() => { const r=(s)=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}`}; return { coarse:matchMedia("(pointer: coarse)").matches, primary:r(".primary-action"), menu:r(".menu-more-button"), pill:r(".list-paging-area .es-pill"), input:r(".frappe-control input, .standard-filter-section input") }; });
await page.screenshot({ path: OUT + `touch-${which}-${lang}-${theme}.png` });
await ctx.close();
// ---- 420 (16.32.0 form Discard + sidebar shortcut)
[ctx, page] = await session({});
await page.goto(base + "/desk/todo/new"); await page.waitForTimeout(4000);
res.weights = await page.evaluate(() => { const w=(s)=>{const e=document.querySelector(s); return e?getComputedStyle(e).fontWeight:null}; return { discard:w(".discard-button, .btn-outline"), kbd:w(".keyboard-shortcut"), menuShortcut:w(".menu-item-shortcut") }; });
await ctx.close(); await b.close();
writeFileSync(`/tmp/fx2/res-${which}-${lang}-${theme}.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
