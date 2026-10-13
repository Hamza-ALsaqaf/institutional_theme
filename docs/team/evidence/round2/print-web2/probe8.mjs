import { launch, BASE } from "./lib.mjs";
const b = await launch(); const ctx = await b.newContext(); await ctx.request.post(`${BASE}/api/method/login`, {form:{usr:`Administrator`, pwd:"admin"}});
for (const p of ["/address","/issues","/tasks","/request-data","/update-profile/Administrator"]) { const r = await ctx.request.get(BASE+p); console.log(p, r.status()); }
await b.close();
