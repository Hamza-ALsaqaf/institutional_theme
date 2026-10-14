import { launch, BASE } from "./lib.mjs";
const b = await launch(); const page = await b.newPage({viewport:{width:1100,height:800}});
await page.goto(BASE+"/visitor-request/new?_lang=en",{waitUntil:"networkidle"});
console.log(await page.evaluate(()=>{ const out=[]; document.querySelectorAll(".web-form-wrapper .form-control, .web-form-wrapper textarea").forEach(e=>{const c=getComputedStyle(e);out.push(e.tagName+"."+e.className+" h="+c.height+" bg="+c.backgroundColor+" bw="+c.borderTopWidth+" rows="+e.rows+" style="+e.getAttribute("style"))}); return out.join("\n")}));
await page.goto(BASE+"/ins-p2-about?_lang=en",{waitUntil:"networkidle"});
console.log(await page.evaluate(()=>document.body.outerHTML.replace(/\s+/g," ").slice(0,1800)));
await b.close();
