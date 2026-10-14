import { launch, BASE } from "./lib.mjs";
const b = await launch(); const ctx = await b.newContext({viewport:{width:1100,height:800}}); await ctx.request.post(`${BASE}/api/method/login`, {form:{usr:`ins-p2-ar@midad.test`, pwd:"P2-Visit-Pass-2026!"}});
const page = await ctx.newPage(); await page.goto(BASE+"/orders",{waitUntil:"networkidle"});
for(let i=0;i<3;i++) await page.keyboard.press("Tab");
console.log(await page.evaluate(()=>{const e=document.activeElement; const out=[e.outerHTML.slice(0,200), "visible:"+(e.getBoundingClientRect().width), "match:"+e.matches(":focus-visible"), e.parentElement.className, "ancestors "+[...(function*(n){for(;n;n=n.parentElement)yield n.tagName+"."+n.className.toString().slice(0,25)})(e)].join(" < ")];
 for (const s of document.styleSheets){try{for(const r of s.cssRules){ if(r.style && r.style.outline!==undefined && /outline/.test(r.cssText) && r.selectorText && (()=>{try{return e.matches(r.selectorText.replace(/:focus-visible|:focus/g,""))}catch(x){return false}})()) out.push((s.href||"inline").split("/").pop()+" :: "+r.cssText.slice(0,160))}}catch(x){}} return out.join("\n")}));
await b.close();
