import { launch, BASE } from "./lib.mjs";
const b = await launch();
for (const lang of ["en","ar"]) {
 const ctx = await b.newContext({ baseURL: BASE, viewport:{width:1100,height:800}});
 const page = await ctx.newPage();
 const res = await page.goto(`${BASE}/me?_lang=${lang}`, {waitUntil:"networkidle"});
 const header = res.headers()["x-frappe-request-id"];
 const ref = await page.locator(".ins-reference code").first().textContent().catch(()=>null);
 console.log(lang, res.status(), header, ref, ref===header);
 await page.screenshot({path:`shots/a1-403-${lang}.png`});
}
await b.close();
