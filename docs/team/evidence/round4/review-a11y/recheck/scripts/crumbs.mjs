import { chromium, BENCH, login, OUT, PWD } from "./lib.mjs";
const b = await chromium.launch({ args: ["--no-sandbox"] });
for (const [name, opts] of [["fine",{viewport:{width:1366,height:800}}],["coarse",{viewport:{width:1366,height:800},hasTouch:true,isMobile:false}]]) {
 const ctx = await b.newContext({ ...opts, reducedMotion:"reduce" });
 const p = await ctx.newPage(); await login(p, BENCH["52"], "rev4rcen@example.com", PWD);
 await p.goto(BENCH["52"]+"/desk/todo/new"); await p.waitForSelector(".form-layout"); await p.waitForTimeout(3000);
 console.log(name, await p.evaluate(()=>({coarse:matchMedia('(pointer: coarse)').matches, crumbs:[...document.querySelectorAll('.es-breadcrumbs__item')].map(e=>{const r=e.getBoundingClientRect(); return e.tagName+' '+Math.round(r.width)+'x'+Math.round(r.height);}), dock:[...document.querySelectorAll('.dock-item')].slice(0,2).map(e=>{const r=e.getBoundingClientRect(); return Math.round(r.width)+'x'+Math.round(r.height);}), primary:(()=>{const r=document.querySelector('.primary-action')?.getBoundingClientRect(); return r&&Math.round(r.width)+'x'+Math.round(r.height)})(), toastClose:null })));
 await ctx.close(); }
await b.close();
