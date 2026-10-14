import { launch, BASE } from "./lib.mjs";
const tag = process.argv[2] || "before";
const b = await launch();
const guest = [["about","/ins-p2-about"],["about-ar-page","/ins-p2-about-ar"],["visitor-request","/visitor-request/new"],["contact","/contact"],["home","/"],["login-redirect","/orders"]];
for (const lang of ["en","ar"]) {
  const ctx = await b.newContext({ baseURL: BASE, viewport:{width:1100,height:800}});
  const page = await ctx.newPage();
  for (const [n,p] of guest) {
    const res = await page.goto(`${BASE}${p}${p.includes("?")?"&":"?"}_lang=${lang}`, {waitUntil:"networkidle"});
    console.log(lang, n, res.status(), await page.evaluate(()=>document.documentElement.dir));
    await page.screenshot({path:`shots/p2-${tag}-guest-${n}-${lang}.png`, fullPage:true});
  }
  // submit the guest form: validation error state, then success page
  await page.goto(`${BASE}/visitor-request/new?_lang=${lang}`, {waitUntil:"networkidle"});
  await page.click(".submit-btn"); await page.waitForTimeout(800);
  await page.screenshot({path:`shots/p2-${tag}-guest-visitor-request-invalid-${lang}.png`, fullPage:true});
  await page.keyboard.press("Escape"); await page.waitForTimeout(500);
  await page.focus("textarea"); await page.waitForTimeout(300);
  await page.screenshot({path:`shots/p2-${tag}-guest-visitor-request-focus-${lang}.png`, clip:{x:150,y:250,width:800,height:400}});
  await page.fill("textarea", lang==="ar" ? "أحتاج إلى نسخة من الإشعار." : "I need a copy of the notice.");
  await page.click(".submit-btn"); await page.waitForTimeout(2500);
  console.log(lang, "after submit", page.url());
  await page.screenshot({path:`shots/p2-${tag}-guest-visitor-request-success-${lang}.png`, fullPage:true});
  await ctx.close();
  const c2 = await b.newContext({ baseURL: BASE, viewport:{width:1100,height:800}});
  const r = await c2.request.post(`${BASE}/api/method/login`, {form:{usr:`ins-p2-${lang}@midad.test`, pwd:"P2-Visit-Pass-2026!"}});
  console.log("login", r.status());
  const pg = await c2.newPage();
  for (const [n,p] of [["me","/me"],["update-profile",`/update-profile/ins-p2-${lang}@midad.test`],["orders","/orders"],["quotations","/quotations"],["my-requests","/my-requests"],["my-requests-new","/my-requests/new"],["contact-user","/contact"]]) {
    const res = await pg.goto(`${BASE}${p}`, {waitUntil:"networkidle"});
    console.log(lang, "user", n, res.status());
    await pg.screenshot({path:`shots/p2-${tag}-user-${n}-${lang}.png`, fullPage:true});
  }
  await c2.close();
}
await b.close();
