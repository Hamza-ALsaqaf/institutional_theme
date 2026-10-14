import { chromium, BENCH, login, OUT } from "./lib.mjs";
import { HELPERS } from "./measure.mjs";
import { writeFileSync } from "node:fs";
const [which, user, lang] = process.argv.slice(2);
const base = BENCH[which];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ locale: lang==="ar"?"ar":"en-US", viewport: { width: 1366, height: 768 }, reducedMotion: "reduce", deviceScaleFactor: 3 });
const page = await ctx.newPage();
await login(page, base, user, "Rev4-pass-9X!q");
await page.goto(base + "/desk/todo"); await page.waitForTimeout(3500); await page.evaluate(HELPERS);
const targets = { dockitem: '.dock .dock-item:not(.active)', allapps: '.dock a.shell-header', sbmenu: 'button[aria-label="Sidebar Menu"]', dropicon: '.body-sidebar .drop-icon', sbitem: '.body-sidebar .standard-sidebar-item:not(.active-sidebar) .item-anchor', pill: '.es-pill[data-state=inactive]', primary: '.primary-action', subtle: '.menu-more-button', refresh: '.page-actions .es-button.icon-btn:not(.menu-more-button)' };
const out = {};
for (const [k, s] of Object.entries(targets)) {
  const el = await page.$(s); if (!el) { out[k]='missing'; continue; }
  await el.evaluate(e=>e.focus()); await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab"); await page.waitForTimeout(350);
  const m = await el.evaluate((e)=>{ const c=getComputedStyle(e); const r=e.getBoundingClientRect(); let p=e.parentElement; const clips=[]; while(p && p!==document.body){ const pc=getComputedStyle(p); if(/(hidden|auto|scroll|clip)/.test(pc.overflow+pc.overflowX+pc.overflowY)){ const pr=p.getBoundingClientRect(); clips.push({cls:String(p.className).slice(0,30), ov:pc.overflow, dTop:Math.round(r.top-pr.top), dBot:Math.round(pr.bottom-r.bottom), dL:Math.round(r.left-pr.left), dR:Math.round(pr.right-r.right)}); } p=p.parentElement; } return { active:e===document.activeElement, fv:e.matches(':focus-visible'), outline:c.outlineStyle+' '+c.outlineWidth+' '+c.outlineColor+' off '+c.outlineOffset, rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)], clips: clips.slice(0,3), ring: __nt(c.outlineColor, e.parentElement), }; });
  out[k]=m; const r=m.rect; await page.screenshot({ path: OUT+`ring-${which}-${lang}-${k}.png`, clip:{x:Math.max(0,r[0]-12),y:Math.max(0,r[1]-12),width:r[2]+24,height:r[3]+24} });
}
console.log(JSON.stringify(out,null,0));
await b.close();
