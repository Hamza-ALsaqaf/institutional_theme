import { launch, BASE } from "./lib.mjs";
const b = await launch(); const page = await b.newPage({viewport:{width:1100,height:800}});
const cs = (sel, props) => page.evaluate(([s,p]) => { const e=document.querySelector(s); if(!e) return null; const c=getComputedStyle(e); return Object.fromEntries(p.map(k=>[k,c[k]])); }, [sel, props]);
for (const [url, sels] of [["/visitor-request/new", [".web-form-container .form-control",".web-form-container textarea",".web-form-container select",".web-form-container .btn-primary",".web-form-container .control-label",".web-form-container .web-form-title","footer .web-footer, .web-footer",".navbar"]],["/ins-p2-about",["main a","code","h1","h2","table.table","table th",".btn-default",".form-control","blockquote",".navbar a",".navbar-brand",".page-footer, footer"]]]) {
  await page.goto(BASE+url+"?_lang=en",{waitUntil:"networkidle"});
  console.log("==", url);
  for (const s of sels) console.log(s, JSON.stringify(await cs(s,["color","backgroundColor","borderTopColor","borderTopWidth","borderRadius","textDecorationLine","outlineStyle","fontSize","letterSpacing","minHeight","height"])));
}
await b.close();
