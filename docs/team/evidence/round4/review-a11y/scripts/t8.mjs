import { chromium, BENCH, login, OUT } from "./lib.mjs";
import { HELPERS } from "./measure.mjs";
import { writeFileSync } from "node:fs";
const [which, user, lang] = process.argv.slice(2);
const base = BENCH[which];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const res = {};
for (const [name, vp, dsf, mobile] of [["z200",{width:640,height:400},2,false],["z400",{width:320,height:256},4,false],["touch",{width:390,height:844},3,true]]) {
  const ctx = await b.newContext({ locale: lang==="ar"?"ar":"en-US", viewport: vp, deviceScaleFactor: dsf, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await login(page, base, user, "Rev4-pass-9X!q");
  const r = {};
  for (const [pn, path] of [["list","/desk/todo"],["form","/desk/todo/new"]]) {
    await page.goto(base + path); await page.waitForTimeout(3500); await page.evaluate(HELPERS);
    r[pn] = await page.evaluate(() => { const bs=[...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, [role=button], .es-pill, .es-badge.filterable')].filter(e=>{const rr=e.getBoundingClientRect(); const cs=getComputedStyle(e); return rr.width>0&&rr.height>0&&cs.visibility!=='hidden'&&rr.right>0&&rr.left<innerWidth&&rr.bottom>0&&rr.top<innerHeight;}); const small=bs.filter(e=>{const r=e.getBoundingClientRect(); return r.width<24||r.height<24;}).map(e=>{const r=e.getBoundingClientRect(); return e.tagName+'.'+String(e.className).slice(0,30)+' '+Math.round(r.width)+'x'+Math.round(r.height);}); const coarse=matchMedia('(pointer: coarse)').matches; const sizes={}; for (const [k,s] of [['primary','.primary-action'],['menu','.menu-more-button'],['pill','.es-pill'],['dock','.dock .dock-item'],['crumb','.es-breadcrumbs__item:is(a,button)'],['input','.frappe-control input, .standard-filter-section input']]) { const e=[...document.querySelectorAll(s)].find(x=>x.getBoundingClientRect().width>0); if(e){const r=e.getBoundingClientRect(); sizes[k]=Math.round(r.width)+'x'+Math.round(r.height);} } return { sw:document.documentElement.scrollWidth, iw:innerWidth, coarse, nControls:bs.length, small, sizes, fs: getComputedStyle(document.querySelector('input.input-with-feedback, .frappe-control input')||document.body).fontSize }; });
    await page.screenshot({ path: OUT + `${name}-${which}-${lang}-${pn}.png` });
  }
  // tab through 25 stops on the form, is focused element covered by sticky head?
  const cov=[]; for (let i=0;i<25;i++){ await page.keyboard.press("Tab"); cov.push(await page.evaluate(()=>{ const e=document.activeElement; if(!e||e===document.body) return null; const r=e.getBoundingClientRect(); if(r.width===0) return null; const pts=[[0.5,0.5],[0.1,0.1],[0.9,0.9]]; let hidden=0; for(const [x,y] of pts){ const t=document.elementFromPoint(r.left+r.width*x, r.top+r.height*y); if(t && !(e===t||e.contains(t)||t.contains(e))) hidden++; } return hidden===3 ? (e.tagName+'.'+String(e.className).slice(0,30)+' covered by '+document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.className.slice(0,30)) : null; })); }
  r.covered = cov.filter(Boolean);
  res[name]=r; await ctx.close();
}
writeFileSync(`<out>/t8-${which}-${lang}.json`, JSON.stringify(res,null,1));
await b.close();
