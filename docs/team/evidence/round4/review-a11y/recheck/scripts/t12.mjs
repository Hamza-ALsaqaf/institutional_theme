import { chromium, BENCH, login, OUT, PWD } from "./lib.mjs";
const [which, user, lang] = process.argv.slice(2);
const base = BENCH[which];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ locale: lang==="ar"?"ar":"en-US", viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
const page = await ctx.newPage();
await login(page, base, user, PWD);
await page.goto(base + "/desk/todo"); await page.waitForTimeout(3500);
await page.evaluate(()=>{ document.body.focus(); window.scrollTo(0,0); });
const desc = () => page.evaluate(()=>{ const e=document.activeElement; if(!e||e===document.body) return 'BODY'; const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); const name=(e.getAttribute('aria-label')||e.textContent||e.placeholder||e.title||'').trim().replace(/\s+/g,' ').slice(0,22); return `${e.tagName.toLowerCase()}[${name}] x=${Math.round(r.left+r.width/2)} y=${Math.round(r.top+r.height/2)} ring=${cs.outlineStyle==='none'?'NONE':cs.outlineWidth+' off '+cs.outlineOffset} fv=${e.matches(':focus-visible')}`; });
const fwd=[]; for (let i=0;i<34;i++){ await page.keyboard.press("Tab"); await page.waitForTimeout(250); fwd.push(await desc()); }
console.log("FORWARD\n"+fwd.join("\n"));
const back=[]; for (let i=0;i<8;i++){ await page.keyboard.press("Shift+Tab"); await page.waitForTimeout(250); back.push(await desc()); }
console.log("BACKWARD\n"+back.join("\n"));
await b.close();
