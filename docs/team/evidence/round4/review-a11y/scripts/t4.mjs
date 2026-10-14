import { chromium, BENCH, login, OUT } from "./lib.mjs";
import { HELPERS } from "./measure.mjs";
import { writeFileSync } from "node:fs";
const [which, user, lang, mode] = process.argv.slice(2);
const base = BENCH[which];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ locale: lang==="ar"?"ar":"en-US", viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
const page = await ctx.newPage();
await login(page, base, user, "Rev4-pass-9X!q");
const tag = `${which}-${lang}-${mode}`;
const res = {};
const weights = async (name) => { res["weights_"+name] = await page.evaluate(() => { const m={}; for (const e of document.querySelectorAll('body *')) { if (!e.childNodes.length) continue; let hasText=false; for (const n of e.childNodes) if (n.nodeType===3 && n.textContent.trim()) {hasText=true;break;} if(!hasText) continue; const cs=getComputedStyle(e); if (cs.display==='none'||cs.visibility==='hidden') continue; const k=cs.fontWeight; m[k]=(m[k]||0)+1; } return m; }); };
await page.goto(base + "/desk/todo"); await page.waitForTimeout(3500); await page.evaluate(HELPERS);
await weights("list");
res.fontFamily = await page.evaluate(()=>getComputedStyle(document.body).fontFamily);
// open a ToDo doc
const first = await page.$('.list-row .list-subject a'); 
await first.click(); await page.waitForTimeout(3000); await page.evaluate(HELPERS);
await weights("form");
res.formUrl = page.url();
res.crumbs = await page.evaluate(() => [...document.querySelectorAll('.navbar-breadcrumbs .es-breadcrumbs__item, .navbar-breadcrumbs a')].map(e=>{ const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return { tag:e.tagName, txt:e.textContent.trim().slice(0,24), w:Math.round(r.width), h:Math.round(r.height), x:Math.round(r.left), ...__text(e), fs:cs.fontSize, fw:cs.fontWeight, ls:cs.letterSpacing, disp:cs.display }; }));
res.crumbBefore = await page.evaluate(() => [...document.querySelectorAll('.es-breadcrumbs li + li')].map(li=>{ const b=getComputedStyle(li,'::before'); return { content:b.content, color:b.color, ml:b.marginInlineStart, mr:b.marginInlineEnd, tf:b.transform, nt: __nt(b.color, li) }; }));
res.pageIndicator = await page.evaluate(() => { const e=document.querySelector('.es-badge.page-indicator-pill:not(.hide)'); if(!e) return null; const cs=getComputedStyle(e); const bf=getComputedStyle(e,'::before'); return { txt:e.textContent.trim(), th:e.dataset.theme, ...__text(e), before: bf.content+' '+bf.width+'x'+bf.height, ls:cs.letterSpacing }; });
// keyboard through crumbs: focus first crumb
await page.evaluate(()=>{ const e=document.querySelector('.es-breadcrumbs__item:is(a,button)'); if(e) e.focus(); });
await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab"); await page.waitForTimeout(150);
res.crumbFocus = await page.evaluate(() => { const e=document.activeElement; const cs=getComputedStyle(e); const ol=e.closest('ol'); const r=e.getBoundingClientRect(); const cr=ol.getBoundingClientRect(); return { el:e.className.slice(0,50)+' '+e.textContent.trim().slice(0,15), fv:e.matches(':focus-visible'), outline: cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor+' off '+cs.outlineOffset, rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)], olRect:[Math.round(cr.left),Math.round(cr.top),Math.round(cr.width),Math.round(cr.height)], olOverflow:getComputedStyle(ol).overflow, navOverflow:getComputedStyle(ol.closest('nav')||ol).overflow }; });
await page.screenshot({ path: OUT + `form-crumb-focus-${tag}.png`, clip:{x:0,y:0,width:1366,height:120} });
// sticky page head over focused element? skip
// menu open
await page.click('.menu-more-button').catch(()=>{}); await page.waitForTimeout(600);
res.menu = await page.evaluate(() => { const m=document.querySelector('.es-menu'); if(!m) return null; const items=[...m.querySelectorAll('.es-menu__item')].slice(0,4); const cs=getComputedStyle(m); return { bg:cs.backgroundColor, border:cs.borderTopColor+' '+cs.borderTopWidth, radius:cs.borderTopLeftRadius, items: items.map(i=>{ const c=getComputedStyle(i); const r=i.getBoundingClientRect(); return { txt:i.textContent.trim().slice(0,20), ...__text(i), h:Math.round(r.height), fw:c.fontWeight, hl:i.getAttribute('data-highlighted'), role:i.getAttribute('role'), ls:c.letterSpacing }; }) }; });
await page.keyboard.press("ArrowDown"); await page.waitForTimeout(200);
res.menuKb = await page.evaluate(() => { const m=document.querySelector('.es-menu'); if(!m) return null; const h=m.querySelector('[data-highlighted]'); const a=document.activeElement; if(!h) return {active:a.className.slice(0,40), note:'no data-highlighted'}; const cs=getComputedStyle(h); return { txt:h.textContent.trim().slice(0,20), ...__text(h), outline:cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor+' off '+cs.outlineOffset, fv:h.matches(':focus-visible'), isActive: h===a, boxShadow:cs.boxShadow }; });
await page.screenshot({ path: OUT + `menu-${tag}.png` });
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
// toast
await page.evaluate(()=>{ frappe.show_alert({message:'Saved successfully', indicator:'green'}, 30); });
await page.waitForTimeout(800);
res.toast = await page.evaluate(() => { const t=document.querySelector('.es-toast'); if(!t) return null; const cs=getComputedStyle(t); const msg=t.querySelector('[class*=message], span, div'); const ic=t.querySelector('svg'); return { bg:cs.backgroundColor, ...__text(t), border:cs.borderTopColor, icon: ic? { stroke:getComputedStyle(ic).stroke, color:getComputedStyle(ic).color, nt: __nt(getComputedStyle(ic).stroke!=='none'?getComputedStyle(ic).stroke:getComputedStyle(ic).color, t) }:null, role:t.getAttribute('role'), live:t.getAttribute('aria-live')||(t.parentElement&&t.parentElement.getAttribute('aria-live')), html:t.outerHTML.slice(0,400) }; });
await page.screenshot({ path: OUT + `toast-${tag}.png` });
writeFileSync(`<out>/t4-${tag}.json`, JSON.stringify(res,null,1));
await b.close();
