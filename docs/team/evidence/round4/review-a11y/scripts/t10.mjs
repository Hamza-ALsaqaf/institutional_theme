import { chromium, BENCH, login, OUT } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const [which, user] = process.argv.slice(2);
const base = BENCH[which];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ locale: "ar", viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
const page = await ctx.newPage();
await login(page, base, user, "Rev4-pass-9X!q");
const res = {};
for (const [n, path] of [["desktop","/desk"],["list","/desk/todo"],["form","/desk/todo/new"],["report","/desk/user/view/report"],["workspace","/desk/build"]]) {
  await page.goto(base + path); await page.waitForTimeout(3500);
  res[n] = await page.evaluate(() => { const ar=/[؀-ۿ]/; const bad={}, w={}, st={}; let total=0; for (const e of document.querySelectorAll('body *')) { let t=''; for (const x of e.childNodes) if (x.nodeType===3) t+=x.textContent; if(!ar.test(t)) continue; const cs=getComputedStyle(e); if(cs.display==='none') continue; total++; const ls=cs.letterSpacing; if (ls!=='normal' && parseFloat(ls)!==0) { const k=ls+' '+e.tagName+'.'+String(e.className).slice(0,30); bad[k]=(bad[k]||0)+1; } w[cs.fontWeight]=(w[cs.fontWeight]||0)+1; if (cs.fontStyle!=='normal') st[cs.fontStyle]=(st[cs.fontStyle]||0)+1; if (cs.textTransform!=='none') st['tt:'+cs.textTransform]=(st['tt:'+cs.textTransform]||0)+1; } return { total, bad, weights:w, style:st, dir:document.documentElement.dir, ff: getComputedStyle(document.body).fontFamily }; });
}
console.log(JSON.stringify(res,null,1));
await b.close();
