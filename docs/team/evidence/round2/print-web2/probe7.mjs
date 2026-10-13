import { launch, BASE } from "./lib.mjs";
const b = await launch(); const ctx = await b.newContext(); await ctx.request.post(`${BASE}/api/method/login`, {form:{usr:`ins-p2-en@midad.test`, pwd:"P2-Visit-Pass-2026!"}});
const r = await ctx.request.get(BASE+"/update-profile/ins-p2-en@midad.test"); const t = await r.text(); const i=t.indexOf("view-error"); console.log(r.status(), t.slice(i-200,i+1500).replace(/\s+/g," "));
await b.close();
