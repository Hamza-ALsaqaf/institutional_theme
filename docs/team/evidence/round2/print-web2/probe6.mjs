import { launch, BASE } from "./lib.mjs";
const b = await launch(); const ctx = await b.newContext(); await ctx.request.post(`${BASE}/api/method/login`, {form:{usr:`ins-p2-en@midad.test`, pwd:"P2-Visit-Pass-2026!"}});
const r = await ctx.request.get(BASE+"/update-profile"); const t = await r.text(); const m = t.match(/<pre[\s\S]*?<\/pre>|class="view-error"[\s\S]{0,1500}/); console.log(r.status(), (m||[t.slice(0,300)])[0].replace(/<[^>]+>/g," ").replace(/\s+/g," ").slice(0,900));
await b.close();
