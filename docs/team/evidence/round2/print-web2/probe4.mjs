import { launch, BASE } from "./lib.mjs";
const b = await launch(); const ctx = await b.newContext({viewport:{width:1100,height:800}}); await ctx.request.post(`${BASE}/api/method/login`, {form:{usr:`ins-p2-ar@midad.test`, pwd:"P2-Visit-Pass-2026!"}});
const page = await ctx.newPage(); await page.goto(BASE+"/orders",{waitUntil:"networkidle"});
console.log(await page.evaluate(()=>[...document.querySelectorAll(".avatar-frame")].map(e=>e.outerHTML+" "+getComputedStyle(e).backgroundColor+" "+getComputedStyle(e).color).join("\n")));
for(let i=0;i<8;i++){await page.keyboard.press("Tab"); console.log(await page.evaluate(()=>{const e=document.activeElement;const c=getComputedStyle(e);return e.outerHTML.slice(0,140)+" | "+c.outlineWidth+" "+c.outlineStyle+" "+c.boxShadow}))}
await b.close();
