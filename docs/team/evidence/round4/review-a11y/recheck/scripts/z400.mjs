import { chromium, BENCH, login, OUT, PWD } from "./lib.mjs";
const [which, user, lang] = process.argv.slice(2);
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ locale: lang==="ar"?"ar":"en-US", viewport:{width:320,height:256}, deviceScaleFactor:4, reducedMotion:"reduce" });
const page = await ctx.newPage(); await login(page, BENCH[which], user, PWD);
await page.goto(BENCH[which]+"/desk/todo"); await page.waitForSelector(".list-row-container"); await page.waitForTimeout(3500);
console.log(which, lang, JSON.stringify(await page.evaluate(()=>{ const rc=document.querySelector('.result-container'); const bd=document.querySelector('.list-row-container .es-badge, .list-row-container .indicator-pill'); const r=bd.getBoundingClientRect(); const c=rc.getBoundingClientRect(); return { badge:[Math.round(r.left),Math.round(r.right)], container:[Math.round(c.left),Math.round(c.right)], ox:getComputedStyle(rc).overflowX, sw:rc.scrollWidth, cw:rc.clientWidth, docsw:document.documentElement.scrollWidth }; })));
await page.screenshot({ path: OUT+`z400-${which}-${lang}-list.png` });
await b.close();
