import { chromium, BENCH, OUT } from "./lib.mjs";
const b = await chromium.launch({ args: ["--no-sandbox"] });
for (const w of ["32","52"]) { const ctx = await b.newContext({ colorScheme:"dark", viewport:{width:1366,height:800} }); const p = await ctx.newPage(); await p.goto(BENCH[w]+"/login",{waitUntil:"networkidle"});
 console.log(w, await p.evaluate(()=>[getComputedStyle(document.documentElement).colorScheme, getComputedStyle(document.body).backgroundColor]));
 await p.screenshot({path: OUT+`login-dark-${w}.png`}); await ctx.close(); }
await b.close();
