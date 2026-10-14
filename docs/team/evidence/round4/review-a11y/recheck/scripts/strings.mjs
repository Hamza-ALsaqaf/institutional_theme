import { chromium, BENCH, login, OUT, PWD } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const [which, user, lang] = process.argv.slice(2);
const base = BENCH[which]; const tag=`${which}-${lang}`;
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ locale: lang==="ar"?"ar":"en-US", viewport: { width: 1366, height: 800 }, reducedMotion: "reduce" });
const page = await ctx.newPage();
await login(page, base, user, PWD);
const res = {};
await page.goto(base + "/desk/todo"); await page.waitForSelector(".list-row-container"); await page.waitForTimeout(3500);
res.htmlLang = await page.evaluate(()=>[document.documentElement.lang, document.documentElement.dir, frappe.boot.lang]);
res.listNames = await page.evaluate(()=>{ const n=(e)=>e? (e.getAttribute('aria-label')||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,60):null;
  return { navBreadcrumb:[...document.querySelectorAll('nav[aria-label], [aria-label][class*=breadcrumb], .navbar-breadcrumbs')].map(e=>e.getAttribute('aria-label')),
   sidebarMenuBtn:[...document.querySelectorAll('.sidebar-header button, button.drop-icon')].map(n),
   allApps:[...document.querySelectorAll('.dock a, .dock button, .dock-items a')].map(n).filter(Boolean).slice(0,8),
   collapse:[...document.querySelectorAll('[aria-label]')].map(e=>e.getAttribute('aria-label')).filter(l=>/Collapse|طي|Expand|توسيع|Sidebar|الشريط|apps|التطبيقات|Breadcrumb|مسار/i.test(l)) }; });
// open form for Last Edited By
await page.goto(base + "/desk/todo"); await page.waitForTimeout(2000);
await (await page.$('.list-row .list-subject a')).click(); await page.waitForTimeout(3500);
res.formSidebar = await page.evaluate(()=>[...document.querySelectorAll('.form-sidebar .sidebar-meta-details, .form-sidebar .form-sidebar-stats, .form-sidebar')].map(e=>e.innerText.replace(/\s+/g,' ').slice(0,400)).slice(0,2));
res.lastEdited = await page.evaluate(()=>[...document.querySelectorAll('.form-sidebar *')].filter(e=>e.children.length===0 && /Edited|تعديل|آخر/.test(e.textContent)).map(e=>e.parentElement.innerText.replace(/\s+/g,' ').slice(0,120)));
res.crumbLabels = await page.evaluate(()=>[...document.querySelectorAll('[aria-label]')].map(e=>e.tagName+':'+e.getAttribute('aria-label')).filter(x=>!/^(INPUT|SELECT)/.test(x)).slice(0,60));
const sb = await page.$('.form-sidebar'); if (sb) { const bb=await sb.boundingBox(); if (bb) await page.screenshot({ path: OUT+`strings-formsidebar-${tag}.png`, clip:{x:bb.x-10,y:Math.max(0,bb.y-10),width:Math.min(bb.width+20,400),height:Math.min(bb.height+20,400)} }); }
await page.screenshot({ path: OUT+`strings-form-${tag}.png` });
// grid Collapse: Notification form w/ row editor
await page.goto(base + "/desk/notification/new"); await page.waitForSelector(".form-layout"); await page.waitForTimeout(2500);
await page.evaluate(() => { cur_frm.add_child("recipients"); cur_frm.refresh_field("recipients"); }); await page.waitForTimeout(600);
await page.locator(".form-grid .grid-row .btn-open-row").first().click(); await page.waitForTimeout(800);
res.collapseGrid = await page.evaluate(()=>[...document.querySelectorAll('.grid-collapse-row')].map(e=>e.getAttribute('aria-label')));
res.collapseSidebar = null;
await page.screenshot({ path: OUT+`strings-grid-${tag}.png` });
// Sidebar collapse chevrons (Collapse {0})
await page.goto(base + "/desk/todo"); await page.waitForTimeout(2500);
res.expandCollapse = await page.evaluate(()=>[...document.querySelectorAll('.body-sidebar button.drop-icon, .item-anchor button')].map(e=>e.getAttribute('aria-label')).filter(Boolean).slice(0,6));
// the "Collapse" bare string: look where __("Collapse") is used: sidebar-header collapse / dock
res.bareCollapse = await page.evaluate(()=>{ const out=[]; for (const e of document.querySelectorAll('[aria-label],[title],[data-original-title]')) { for (const a of ['aria-label','title','data-original-title']) { const v=e.getAttribute(a); if (v && /^(Collapse|طي)$/.test(v.trim())) out.push(e.tagName+'.'+String(e.className).slice(0,30)+' '+a+'='+v); } } return out; });
// translation dictionary check
res.dict = await page.evaluate(()=>({ breadcrumb: __('Breadcrumb'), sidebarMenu: __('Sidebar Menu'), allApps: __('All apps'), lastEditedBy: __('Last Edited By {0}', ['X']), lastEditedYou: __('Last Edited By You'), collapse: __('Collapse'), collapseRow: __('Collapse', null, 'Row editor'), addAttachment: __('Add attachment'), collapse0: __('Collapse {0}', ['X']) }));
writeFileSync(OUT+`strings-${tag}.json`, JSON.stringify(res,null,1));
await b.close(); console.log(tag,'done');
