import { chromium } from "playwright-core";
const base = "http://localhost:8002";
const routes = ["/app/employee","/app/employee/HR-EMP-00001","/app/leave-application","/app/leave-application/HR-LAP-2026-00001","/app/salary-slip","/app/leaves","/app/payroll","/app/organizational-chart"];
const b = await chromium.launch({ args: ["--no-sandbox"] });
for (const block of [false, true]) for (const lang of ["en-US", "ar"]) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, locale: lang });
  if (block) await ctx.route(/institutional_theme\/dist|ins_(desk|shell|web)/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(`${base}/login`);
  await page.fill("#login_email", "Administrator"); await page.fill("#login_password", "admin");
  await Promise.all([page.waitForURL(/\/app|\/desk/), page.press("#login_password", "Enter")]);
  let cur = "";
  page.on("pageerror", (e) => console.log(`  [${block ? "NO-THEME" : "theme"} ${lang}] ${cur}: ${String(e).slice(0, 90)} @ ${(e.stack || "").split("\n").slice(1, 3).map(s => s.trim().replace(/https?:\/\/[^/]+/, "")).join(" | ")}`));
  for (const r of routes) { cur = r; await page.goto(base + r, { waitUntil: "networkidle" }).catch(() => {}); await page.waitForTimeout(1500); }
  const linked = await page.evaluate(() => [...document.querySelectorAll("link[rel=stylesheet]")].filter(l => /ins_|institutional/.test(l.href)).length);
  console.log(`done ${block ? "NO-THEME" : "theme"} ${lang}: ins stylesheets linked at end = ${linked}`);
  await ctx.close();
}
await b.close();
