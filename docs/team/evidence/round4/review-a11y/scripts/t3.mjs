import { chromium, BENCH, login, OUT } from "./lib.mjs";
import { HELPERS } from "./measure.mjs";
const [which, user, lang, mode] = process.argv.slice(2);
const base = BENCH[which];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ locale: lang==="ar"?"ar":"en-US", viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
const page = await ctx.newPage();
await login(page, base, user, "Rev4-pass-9X!q");
await page.goto(base + "/desk/todo");
await page.waitForTimeout(3500);
await page.evaluate(HELPERS);
const tag = `${which}-${lang}-${mode}`;
const res = {};
const pick = async (name, sel, fn) => { try { res[name] = await page.evaluate(fn, sel); } catch (e) { res[name] = "ERR " + e.message.slice(0,100); } };
// text and bg for an element
const T = (sel) => `(() => { const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const t=__text(e); const cs=getComputedStyle(e); return {...t, border: cs.borderTopColor+' '+cs.borderTopWidth, bgc: cs.backgroundColor, outline: cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor+' off '+cs.outlineOffset}; })()`;
const stateMeasure = async (name, sel) => {
  const out = {};
  out.normal = await page.evaluate(T(sel));
  await page.hover(sel).catch(()=>{}); await page.waitForTimeout(250);
  out.hover = await page.evaluate(T(sel));
  await page.mouse.move(5, 400);
  await page.focus(sel).catch(()=>{});
  // keyboard focus-visible: press Shift+Tab then Tab
  await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab"); await page.waitForTimeout(150);
  const matched = await page.evaluate((s)=>document.activeElement.matches(s) && document.activeElement.matches(':focus-visible'), sel);
  out.focusVisible = matched;
  out.focus = await page.evaluate(T(sel));
  await page.evaluate(()=>document.activeElement.blur());
  res[name] = out;
};
await stateMeasure("primary", ".primary-action");
await stateMeasure("viewSwitcher", ".page-actions .es-button.ellipsis");
await stateMeasure("menuMore", ".menu-more-button");
// primary ring colour vs page bg
res.primaryRing = await page.evaluate(() => { const e=document.querySelector('.primary-action'); e.focus(); const cs=getComputedStyle(e); const col=cs.outlineColor; const page=document.querySelector('.page-head')||document.body; return { outline: cs.outlineStyle+' '+cs.outlineWidth+' '+col+' off '+cs.outlineOffset, vsPage: __nt(col, page), vsBtn: __nt(col, e) }; });
// glyph on primary
res.primaryGlyph = await page.evaluate(() => { const e=document.querySelector('.primary-action svg'); if(!e) return null; const cs=getComputedStyle(e); const btn=document.querySelector('.primary-action'); return { stroke: cs.stroke, fill: cs.fill, color: cs.color, nt: __nt(cs.stroke, btn) }; });
// Disabled clones
res.disabled = await page.evaluate(() => { const out={}; for (const [k,sel] of [['solid','.primary-action'],['subtle','.menu-more-button']]) { const src=document.querySelector(sel); const c=src.cloneNode(true); c.disabled=true; c.setAttribute('disabled',''); c.classList.remove('hide'); src.parentElement.appendChild(c); const t=__text(c); const cs=getComputedStyle(c); out[k]={...t, opacity: cs.opacity, bgc: cs.backgroundColor, color: cs.color, border: cs.borderTopColor, cursor: cs.cursor}; c.remove(); } return out; });
// Badges: all real ones
res.badges = await page.evaluate(() => [...document.querySelectorAll('.es-badge')].filter(e=>e.textContent.trim()).slice(0,12).map(e => { const t=__text(e); const cs=getComputedStyle(e); const bf=getComputedStyle(e,'::before'); return { txt:e.textContent.trim(), th:e.dataset.theme||null, ...t, border: cs.borderTopStyle+' '+cs.borderTopWidth+' '+cs.borderTopColor, borderVsBg: __nt(cs.borderTopColor, e.parentElement), before: bf.content+' '+bf.width+'x'+bf.height+' bg='+bf.backgroundImage.slice(0,60)+' bc='+bf.borderTopColor+' bs='+bf.borderTopStyle, h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width), ls: cs.letterSpacing, fw: cs.fontWeight, fs: cs.fontSize }; }));
// Sidebar
await stateMeasure("sbActive", ".body-sidebar .standard-sidebar-item.active-sidebar .item-anchor");
res.sbActiveItem = await page.evaluate(T(".body-sidebar .standard-sidebar-item.active-sidebar"));
res.sbActiveBefore = await page.evaluate(() => { const e=document.querySelector('.body-sidebar .standard-sidebar-item.active-sidebar'); if(!e) return null; const b=getComputedStyle(e,'::before'); return { bg:b.backgroundColor, w:b.width, content:b.content, nt: __nt(b.backgroundColor, e), shadow: getComputedStyle(e).boxShadow }; });
res.sbItems = await page.evaluate(() => [...document.querySelectorAll('.body-sidebar .standard-sidebar-item:not(.active-sidebar)')].slice(0,3).map(e => { const a=e.querySelector('.item-anchor')||e; return { txt:a.textContent.trim().slice(0,20), ...__text(a), fw:getComputedStyle(a).fontWeight, h: Math.round(e.getBoundingClientRect().height) }; }));
// sidebar hover on a non-active item
const hov = await page.$(".body-sidebar .standard-sidebar-item:not(.active-sidebar) .item-anchor");
if (hov) { await hov.hover(); await page.waitForTimeout(250); res.sbHover = await page.evaluate(() => { const items=[...document.querySelectorAll('.body-sidebar .standard-sidebar-item:not(.active-sidebar)')]; const e=items.find(i=>i.matches(':hover'))||items[0]; const a=e.querySelector('.item-anchor')||e; return { itemBg: getComputedStyle(e).backgroundColor, anchorBg:getComputedStyle(a).backgroundColor, ...__text(a)}; }); await page.mouse.move(5,400); }
// Dock
res.dock = await page.evaluate(() => { const act=document.querySelector('.dock .dock-item.active'); const plain=[...document.querySelectorAll('.dock .dock-item:not(.active)')][0]; const m=(e)=>{ if(!e) return null; const svg=e.querySelector('svg'); const cs=svg?getComputedStyle(svg):null; return { cls:e.className, ...__text(e), svgColor: cs?cs.color:null, svgStroke: cs?cs.stroke:null, svgNt: cs? __nt(cs.stroke!=='none'?cs.stroke:cs.color, e):null, w:Math.round(e.getBoundingClientRect().width), h:Math.round(e.getBoundingClientRect().height), shadow:getComputedStyle(e).boxShadow }; }; const b= act? getComputedStyle(act,'::before'):null; return { active:m(act), plain:m(plain), before: b?{bg:b.backgroundColor, w:b.width, nt:__nt(b.backgroundColor, act)}:null }; });
// Dock keyboard ring
res.dockFocus = await page.evaluate(() => { const e=document.querySelector('.dock .dock-item:not(.active)'); e.focus(); return null; });
await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab"); await page.waitForTimeout(100);
res.dockFocus = await page.evaluate(() => { const e=document.activeElement; const cs=getComputedStyle(e); return { cls:e.className.slice(0,50), fv:e.matches(':focus-visible'), outline: cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor+' off '+cs.outlineOffset, ring: __nt(cs.outlineColor, document.querySelector('.dock')) }; });
// Breadcrumbs / page title
res.crumbs = await page.evaluate(() => [...document.querySelectorAll('.navbar-breadcrumbs .es-breadcrumbs__item, .navbar-breadcrumbs a')].map(e=>{ const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return { tag:e.tagName, txt:e.textContent.trim().slice(0,20), w:Math.round(r.width), h:Math.round(r.height), ...__text(e), fs:cs.fontSize, fw:cs.fontWeight, ls:cs.letterSpacing, ov:getComputedStyle(e.closest('ol,ul')||e).overflow }; }));
// pills (paging)
res.pills = await page.evaluate(() => [...document.querySelectorAll('.list-paging-area .es-pill')].map(e=>{ const r=e.getBoundingClientRect(); return { txt:e.textContent.trim(), state:e.dataset.state, w:Math.round(r.width), h:Math.round(r.height), ...__text(e), fw:getComputedStyle(e).fontWeight }; }));
console.log(JSON.stringify(res, null, 1));
await page.screenshot({ path: OUT + `list-${tag}.png` });
await b.close();
