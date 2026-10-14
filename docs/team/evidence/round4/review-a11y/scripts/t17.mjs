import { chromium, BENCH, login, OUT } from "./lib.mjs";
import { HELPERS } from "./measure.mjs";
import { writeFileSync } from "node:fs";
const [which, user, lang, mode] = process.argv.slice(2);
const base = BENCH[which];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ locale: lang==="ar"?"ar":"en-US", viewport: { width: 1366, height: 768 }, reducedMotion: "reduce", deviceScaleFactor: 2 });
const page = await ctx.newPage();
await login(page, base, user, "Rev4-pass-9X!q");
const res = {}; const tag=`${which}-${lang}-${mode}`;
await page.goto(base + "/desk/todo"); await page.waitForTimeout(3500); await page.evaluate(HELPERS);
const rowM = (state) => page.evaluate((state)=>{ const r=document.querySelectorAll('.list-row-container')[1]; const row=r.querySelector('.list-row'); const subj=r.querySelector('.list-subject a, .list-subject'); const badge=r.querySelector('.es-badge'); return { state, rowBg: __rgb(__bg(row)), subj: __text(subj), badge: badge? __text(badge):null }; }, state);
res.row_normal = await rowM('normal');
const row2 = (await page.$$('.list-row-container'))[1];
await row2.hover(); await page.waitForTimeout(250); res.row_hover = await rowM('hover');
await page.mouse.move(2,2);
await (await row2.$('.list-row-checkbox')).click(); await page.waitForTimeout(250); await page.mouse.move(2,2); res.row_selected = await rowM('selected');
await page.screenshot({ path: OUT+`rowsel-${tag}.png`, clip:{x:290,y:150,width:1070,height:230} });
await (await row2.$('.list-row-checkbox')).click();
// checkbox ring/state: checked vs unchecked box: border, fill
res.checkbox = await page.evaluate(()=>{ const c=document.querySelector('.list-row-checkbox'); const cs=getComputedStyle(c); return { checked:c.checked, bg:cs.backgroundColor, border:cs.borderTopColor+' '+cs.borderTopWidth, nt:__nt(cs.borderTopColor, c.closest('.list-row')), w:Math.round(c.getBoundingClientRect().width) }; });
// pill focus ring
const pill = await page.$('.list-paging-area .es-pill[data-state=inactive]');
await pill.evaluate(e=>e.focus()); await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab"); await page.waitForTimeout(350);
res.pillFocus = await pill.evaluate(e=>{ const c=getComputedStyle(e); const r=e.getBoundingClientRect(); return { active:document.activeElement===e, fv:e.matches(':focus-visible'), outline:c.outlineStyle+' '+c.outlineWidth+' '+c.outlineColor+' off '+c.outlineOffset, role:e.getAttribute('role'), checked:e.getAttribute('aria-checked'), rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)], ring:__nt(c.outlineColor, e.parentElement) }; });
let r=res.pillFocus.rect; await page.screenshot({ path: OUT+`pillfocus-${tag}.png`, clip:{x:Math.max(0,r[0]-30),y:r[1]-12,width:r[2]+160,height:r[3]+24} });
res.pillAttrs = await page.evaluate(()=>[...document.querySelectorAll('.list-paging-area .es-pill')].map(e=>({t:e.textContent.trim(), role:e.getAttribute('role'), checked:e.getAttribute('aria-checked'), state:e.dataset.state, fw:getComputedStyle(e).fontWeight, shadow:getComputedStyle(e).boxShadow, ul:getComputedStyle(e).textDecorationLine})));
// sidebar active weight
res.sbWeights = await page.evaluate(()=>{ const a=document.querySelector('.body-sidebar .standard-sidebar-item.active-sidebar .sidebar-item-label, .body-sidebar .standard-sidebar-item.active-sidebar .item-anchor'); const p=[...document.querySelectorAll('.body-sidebar .standard-sidebar-item:not(.active-sidebar) .sidebar-item-label')][2]; return { active: a&&{fw:getComputedStyle(a).fontWeight, txt:a.textContent.trim().slice(0,16), ariaCur:a.closest('.standard-sidebar-item').getAttribute('aria-current')||a.closest('a')?.getAttribute('aria-current')}, plain: p&&{fw:getComputedStyle(p).fontWeight}, anyAriaCurrent: document.querySelectorAll('[aria-current]').length }; });
// badge filterable focusable?
res.badgeFocus = await page.evaluate(()=>{ const e=document.querySelector('.es-badge.filterable'); return { tabindex:e.getAttribute('tabindex'), role:e.getAttribute('role'), tag:e.tagName, cursor:getComputedStyle(e).cursor }; });
// tags on form
await page.goto(base + "/desk/todo"); await page.waitForTimeout(2500);
await (await page.$('.list-row .list-subject a')).click(); await page.waitForTimeout(3000); await page.evaluate(HELPERS);
res.tags = await page.evaluate(()=>[...document.querySelectorAll('.form-tag, .es-badge.form-tag')].slice(0,3).map(e=>({txt:e.textContent.trim().slice(0,12), th:e.dataset.theme, ...__text(e)})));
writeFileSync(`<out>/t17-${tag}.json`, JSON.stringify(res,null,1));
await b.close();
