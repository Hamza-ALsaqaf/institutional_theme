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
await page.goto(base + "/desk/todo"); await page.waitForTimeout(3500); await page.evaluate(HELPERS);
// toasts per type
res.toasts = [];
for (const ind of ["green","red","orange","blue"]) {
  await page.evaluate((ind)=>{ document.querySelectorAll('.es-toast').forEach(e=>e.remove()); frappe.show_alert({message:'Message '+ind, indicator:ind}, 60); }, ind);
  await page.waitForTimeout(700);
  res.toasts.push(await page.evaluate((ind) => { const t=document.querySelector('.es-toast'); if(!t) return {ind, none:true}; const ic=t.querySelector('svg'); const cs=getComputedStyle(t); const ics=getComputedStyle(ic); const color=ics.color, stroke=ics.stroke; return { ind, type:t.dataset.type, text: __text(t.querySelector('.es-toast__message')), iconColor: color, iconStroke: stroke, iconColorNt: __nt(color,t), iconStrokeNt: __nt(stroke==='none'?color:stroke,t), tbg: cs.backgroundColor, border: cs.borderTopColor, closeBtn: (()=>{const c=t.querySelector('.es-toast__close'); const r=c.getBoundingClientRect(); return {w:Math.round(r.width),h:Math.round(r.height), nt: __nt(getComputedStyle(c.querySelector('svg')).stroke, t), label:c.getAttribute('aria-label')}; })() }; }, ind));
}
await page.screenshot({ path: OUT + `toast-blue-${tag}.png`, clip:{x:900,y:660,width:466,height:108} });
await page.evaluate(()=>document.querySelectorAll('.es-toast').forEach(e=>e.remove()));
// menu
await page.getByRole('button', {name: /^(Menu|القائمة|الخيارات)/}).first().click().catch(e=>console.log('menu click', e.message.slice(0,80)));
await page.waitForTimeout(700);
res.menu = await page.evaluate(() => { const m=document.querySelector('.es-menu, [role=menu]'); if(!m) return null; const items=[...m.querySelectorAll('[role=menuitem], .es-menu__item')].slice(0,5); const cs=getComputedStyle(m); return { cls:m.className, bg:cs.backgroundColor, border:cs.borderTopColor+' '+cs.borderTopWidth, radius:cs.borderTopLeftRadius, shadow:cs.boxShadow.slice(0,60), items: items.map(i=>{ const c=getComputedStyle(i); const r=i.getBoundingClientRect(); return { txt:i.textContent.trim().slice(0,20), ...__text(i), h:Math.round(r.height), fw:c.fontWeight, hl:i.getAttribute('data-highlighted'), ls:c.letterSpacing }; }) }; });
await page.keyboard.press("ArrowDown"); await page.waitForTimeout(250);
res.menuKb = await page.evaluate(() => { const m=document.querySelector('.es-menu, [role=menu]'); if(!m) return null; const h=m.querySelector('[data-highlighted]'); const a=document.activeElement; const cs=h?getComputedStyle(h):null; return { active:a.className.slice(0,50)+'|'+a.getAttribute('role'), fvActive:a.matches(':focus-visible'), hl: h? { txt:h.textContent.trim().slice(0,20), ...__text(h), outline:cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor+' off '+cs.outlineOffset, isActive:h===a, bgc:cs.backgroundColor }:null, actOutline: (()=>{const c=getComputedStyle(a); return c.outlineStyle+' '+c.outlineWidth+' '+c.outlineColor+' off '+c.outlineOffset+' bg '+c.backgroundColor;})() }; });
await page.screenshot({ path: OUT + `menu-${tag}.png` });
// danger menu item? destructive entries (Delete)
res.menuAll = await page.evaluate(() => [...document.querySelectorAll('.es-menu [role=menuitem], .es-menu .es-menu__item')].map(i=>({t:i.textContent.trim().slice(0,22), th:i.dataset.theme||null, ...__text(i), ic: i.querySelector('svg')? (()=>{const s=getComputedStyle(i.querySelector('svg')); return {stroke:s.stroke, color:s.color};})():null })));
writeFileSync(`<out>/t5-${tag}.json`, JSON.stringify(res,null,1));
await b.close();
