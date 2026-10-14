import { chromium, BENCH, login, OUT, PWD } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const [which, user, lang, mode] = process.argv.slice(2);
const base = BENCH[which]; const tag=`${which}-${lang}-${mode}`;
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ locale: lang==="ar"?"ar":"en-US", viewport: { width: 1366, height: 768 }, reducedMotion: "reduce", forcedColors: "active", deviceScaleFactor: 2, colorScheme: mode==="dark"?"dark":"light" });
const page = await ctx.newPage();
await login(page, base, user, PWD);
await page.goto(base + "/desk/todo"); await page.waitForSelector(".list-row-container"); await page.waitForTimeout(3500);
const S = (sel, nth=0)=> page.evaluate(([sel,nth])=>{ const e=document.querySelectorAll(sel)[nth]; if(!e) return null; const cs=getComputedStyle(e); const bf=getComputedStyle(e,'::before'); const r=e.getBoundingClientRect(); return { rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)], color:cs.color, bg:cs.backgroundColor, border:cs.borderTopStyle+' '+cs.borderTopWidth+' '+cs.borderTopColor, outline:cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor+' off '+cs.outlineOffset, shadow:cs.boxShadow, fca:cs.forcedColorAdjust, fw:cs.fontWeight, before:{content:bf.content, bg:bf.backgroundColor, w:bf.width, h:bf.height, fca:bf.forcedColorAdjust, disp:bf.display} }; }, [sel,nth]);
const res = {};
res.sbActive = await S(".body-sidebar .standard-sidebar-item.active-sidebar");
res.sbPlain = await S(".body-sidebar .standard-sidebar-item:not(.active-sidebar)", 1);
res.dockActive = await S(".dock .dock-item.active");
res.dockPlain = await S(".dock .dock-item:not(.active)");
res.pillActive = await S(".list-paging-area .es-pill[data-state=active]");
res.pillInactive = await S(".list-paging-area .es-pill[data-state=inactive]");
res.ariaCurrent = await page.evaluate(()=>[...document.querySelectorAll('[aria-current]')].map(e=>e.tagName+'.'+String(e.className).slice(0,30)+'='+e.getAttribute('aria-current')));
res.ariaChecked = await page.evaluate(()=>[...document.querySelectorAll('.es-pill')].map(e=>e.getAttribute('aria-checked')));
// focus on active sidebar anchor: single ring?
const a = await page.$(".body-sidebar .standard-sidebar-item.active-sidebar .item-anchor, .body-sidebar .standard-sidebar-item.active-sidebar a");
if (a) { await a.focus(); await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab"); await page.waitForTimeout(400); res.sbActiveFocused = await S(".body-sidebar .standard-sidebar-item.active-sidebar"); res.sbAnchorFocused = await page.evaluate(()=>{ const e=document.activeElement; const cs=getComputedStyle(e); return {tag:e.tagName, cls:String(e.className).slice(0,40), outline:cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor+' off '+cs.outlineOffset, fv:e.matches(':focus-visible')}; }); }
const clip = async (sel, name, pad=24, nth=0) => { const e = (await page.$$(sel))[nth]; if(!e) return; await e.evaluate(x=>x.scrollIntoView({block:'center'})); const bb = await e.boundingBox(); if(!bb) return; await page.screenshot({ path: OUT+`forced-${name}-${tag}.png`, clip:{x:Math.max(0,bb.x-pad),y:Math.max(0,bb.y-pad),width:Math.min(bb.width+pad*2, 1366),height:bb.height+pad*2} }); };
await page.mouse.move(700,500);
await page.screenshot({ path: OUT+`forced-page-${tag}.png` });
await page.evaluate(()=>document.activeElement&&document.activeElement.blur());
const sb = await page.$(".body-sidebar"); if (sb) { const bb=await sb.boundingBox(); await page.screenshot({ path: OUT+`forced-sidebar-${tag}.png`, clip:{x:bb.x,y:bb.y,width:Math.min(bb.width,300),height:Math.min(bb.height,420)} }); }
const dk = await page.$(".dock"); if (dk) { const bb=await dk.boundingBox(); await page.screenshot({ path: OUT+`forced-dock-${tag}.png`, clip:{x:bb.x-6,y:bb.y-6,width:bb.width+12,height:Math.min(bb.height+12,300)} }); }
writeFileSync(OUT+`forced-${tag}.json`, JSON.stringify(res,null,1));
res.pillsVisible = await page.evaluate(()=>{const e=document.querySelector(".list-paging-area .es-tab-buttons"); if(!e) return 'none'; const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return [r.width,r.height,cs.display,cs.visibility, e.closest('.list-paging-area')&&getComputedStyle(e.closest('.list-paging-area')).display];});
writeFileSync(OUT+`forced-${tag}.json`, JSON.stringify(res,null,1));
await clip(".list-paging-area .es-tab-buttons", "pills", 16);
await b.close(); console.log(tag,'done');
