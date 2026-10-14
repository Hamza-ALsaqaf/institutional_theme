import { chromium, BENCH, login, OUT } from "./lib.mjs";
const [which, user, lang] = process.argv.slice(2);
const base = BENCH[which];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ locale: lang==="ar"?"ar":"en-US", viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
const page = await ctx.newPage();
await login(page, base, user, "Rev4-pass-9X!q");
const res={};
for (const [n,p] of [["desktop","/desk"],["list","/desk/todo"],["form","/desk/todo/new"],["workspace","/desk/build"],["report","/desk/user/view/report"]]) {
  await page.goto(base + p); await page.waitForTimeout(3500);
  res[n] = await page.evaluate(() => { const o={}; for (const e of document.querySelectorAll('body *')) { const cs=getComputedStyle(e); if (cs.display==='none'||cs.visibility==='hidden') continue; let t=''; for (const x of e.childNodes) if (x.nodeType===3) t+=x.textContent; t=t.trim(); if(!t) continue; const midad=/^"?Midad/.test(cs.fontFamily); if (!midad || cs.fontWeight==='420' || !['400','500','600'].includes(cs.fontWeight)) { const k=cs.fontWeight+' '+cs.fontFamily.slice(0,28)+' | '+e.tagName+'.'+String(e.className).slice(0,34); o[k]=(o[k]||[]); if(o[k].length<2) o[k].push(t.slice(0,18)); } } return o; });
}
console.log(JSON.stringify(res,null,1));
await b.close();
