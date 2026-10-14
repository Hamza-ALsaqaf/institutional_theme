import { createRequire } from "node:module";
const R = "/home/runner/work/institutional_theme/institutional_theme";
const req = createRequire(R + "/tests/browser/package.json");
const { chromium } = req("playwright-core");
const b = await chromium.launch({ args: ["--no-sandbox"] });
for (const [lang, mode] of [["en","light"],["en","dark"],["ar","light"],["ar","dark"]]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: lang === "ar" ? "ar-SA" : "en-US", reducedMotion: "reduce", extraHTTPHeaders: { "Accept-Language": lang } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:8000/login");
  await page.fill("#login_email", `axe-${lang}-${mode}@midad.test`); await page.fill("#login_password", "Mdd#Test2026x");
  await Promise.all([page.waitForURL(/\/app|\/desk/), page.click(".btn-login")]);
  await page.goto(`http://localhost:8000/desk/user/axe-${lang}-${mode}@midad.test`);
  const a = page.locator(".timeline-item .timeline-content:has(> a)").first();
  await a.waitFor({ timeout: 40000 }); await page.waitForTimeout(800);
  await a.screenshot({ path: `${R}/docs/team/evidence/round3/axe-fixes-css/shots/timeline-${lang}-${mode}.png` });
  await ctx.close();
}
await b.close();
