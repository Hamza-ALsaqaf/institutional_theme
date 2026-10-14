import { createRequire } from "node:module";
import fs from "node:fs";
const REPO = "/home/runner/work/institutional_theme/institutional_theme";
const req = createRequire(REPO + "/tests/browser/package.json");
const { chromium } = req("playwright-core");
const OUT = REPO + "/docs/team/evidence/round3/axe-fixes-css/shots";
fs.mkdirSync(OUT, { recursive: true });
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
const b = await chromium.launch({ args: ["--no-sandbox"] });
const rows = [];
for (const [lang, mode] of [["en","light"],["en","dark"],["ar","light"],["ar","dark"]]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: lang === "ar" ? "ar-SA" : "en-US", reducedMotion: "reduce", extraHTTPHeaders: { "Accept-Language": lang } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:8000/login");
  await page.fill("#login_email", `axe-${lang}-${mode}@midad.test`);
  await page.fill("#login_password", "Mdd#Test2026x");
  await Promise.all([page.waitForURL(/\/app|\/desk/), page.click(".btn-login")]);
  const tag = `${lang}-${mode}`;
  const push = (name, fg, bg, min = 4.5) => { const r = ratio(rgb(fg), rgb(bg)); rows.push({ tag, name, fg, bg, ratio: r, pass: r >= min }); };
  // datepicker
  await page.goto("http://localhost:8000/desk/todo/new");
  await page.waitForSelector('[data-fieldname="date"] input');
  await page.waitForTimeout(1500);
  await page.locator('[data-fieldname="date"] input').first().click();
  await page.waitForSelector(".datepicker.active");
  await page.waitForTimeout(500);
  const dp = await page.evaluate(() => { const g = (s) => { const e = document.querySelector(s); return e && getComputedStyle(e).color; }; return { other: g(".datepicker--cell-day.-other-month-"), nav: g(".datepicker--nav-title i"), bg: getComputedStyle(document.querySelector(".datepicker")).backgroundColor }; });
  push("datepicker other-month day", dp.other, dp.bg); push("datepicker nav-title icon", dp.nav, dp.bg);
  await (await page.$(".datepicker.active")).screenshot({ path: `${OUT}/datepicker-${tag}.png` });
  // hljs
  const h = await page.evaluate(async () => {
    await frappe.require("syntax_highlighting.bundle.js");
    const box = document.createElement("div"); box.className = "help-box"; box.id = "ins-hljs-probe";
    box.style.cssText = "position:fixed;inset-block-start:60px;inset-inline-start:20px;z-index:99999;padding:8px;background:var(--ins-surface-raised)";
    box.innerHTML = '<code class="language-python">def f(x):\n    # note\n    return "a" + str(12)  </code>';
    document.body.appendChild(box);
    box.querySelectorAll("code").forEach((c) => { hljs.highlightElement(c); c.style.display = "inline"; });
    const code = box.querySelector("code"); const bg = getComputedStyle(code).backgroundColor;
    return { bg, toks: [...box.querySelectorAll("[class^=hljs-]")].map((e) => ({ c: e.className, color: getComputedStyle(e).color })), base: getComputedStyle(code).color };
  });
  push("hljs base", h.base, h.bg);
  const seen = new Set();
  for (const t of h.toks) if (!seen.has(t.c)) { seen.add(t.c); push(t.c, t.color, h.bg); }
  await (await page.$("#ins-hljs-probe")).screenshot({ path: `${OUT}/hljs-${tag}.png` });
  // onboarding badge
  const o = await page.evaluate(async () => {
    await frappe.require("user_onboarding.bundle.js");
    const w = document.createElement("div"); w.id = "ins-onb-probe"; w.style.cssText = "position:fixed;inset-block-start:120px;inset-inline-start:20px;z-index:99999;width:360px;background:var(--ins-surface-raised)";
    document.body.appendChild(w);
    new frappe.ui.UserOnboarding({ title: "Probe", wrapper: w, steps: [{ title: "A", is_complete: 1 }, { title: "B", is_complete: 0 }] });
    await new Promise((r) => setTimeout(r, 600));
    const e = document.querySelector(".onb-progress-badge"); const c = document.querySelector(".onb-progress-badge-complete");
    return { e: e && [getComputedStyle(e).color, getComputedStyle(e).backgroundColor], c: c && [getComputedStyle(c).color, getComputedStyle(c).backgroundColor] };
  });
  if (o.e) push("onb-progress-badge", o.e[0], o.e[1]); else rows.push({ tag, name: "onb-progress-badge", note: "not rendered" });
  const bd = await page.evaluate(() => { const e = document.querySelector(".onb-progress-badge"); if (!e) return null; const r = e.closest(".onb-panel, .onb-container, [class*=onb]")?.getBoundingClientRect() || e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  if (bd) await page.screenshot({ path: `${OUT}/onboarding-${tag}.png`, clip: { x: Math.max(0, bd[0] - 10), y: Math.max(0, bd[1] - 10), width: Math.min(420, bd[2] + 20), height: Math.min(260, bd[3] + 20) } });
  // desktop
  await page.goto("http://localhost:8000/desk");
  await page.waitForSelector(".folder-icon .icons > .desktop-icon", { timeout: 20000 });
  await page.waitForTimeout(1500);
  const d = await page.evaluate(() => { const a = [...document.querySelectorAll(".folder-icon .icons > .desktop-icon")]; const f = document.querySelector(".folder-icon"); const ic = a[0].querySelector(".icon-container").getBoundingClientRect(); return { n: a.length, min: Math.min(...a.map((x) => Math.min(x.getBoundingClientRect().width, x.getBoundingClientRect().height))), iconW: ic.width, iconH: ic.height, folder: [f.getBoundingClientRect().width, f.getBoundingClientRect().height] }; });
  rows.push({ tag, name: "folder thumbnail anchors", n: d.n, minSide: d.min, thumb: [d.iconW, d.iconH], folder: d.folder, pass: d.min >= 24 });
  await page.locator(".folder-icon:visible").first().screenshot({ path: `${OUT}/desktop-folder-${tag}.png` });
  // timeline
  await page.goto(`http://localhost:8000/desk/user/axe-${lang}-${mode}@midad.test`);
  await page.waitForSelector(".timeline-item .timeline-content > a", { timeout: 30000 });
  await page.waitForTimeout(1000);
  const t = await page.evaluate(() => { const a = document.querySelector(".timeline-item .timeline-content > a"); const cs = getComputedStyle(a); const bg = getComputedStyle(a.parentElement.closest(".frappe-card, .timeline-item")).backgroundColor; return { deco: cs.textDecorationLine, color: cs.color, parent: getComputedStyle(a.parentElement).color, bg }; });
  rows.push({ tag, name: "timeline link", deco: t.deco, color: t.color, parent: t.parent, pass: t.deco.includes("underline") });
  await (await page.$(".timeline-item .timeline-content")).screenshot({ path: `${OUT}/timeline-${tag}.png` });
  await ctx.close();
}
await b.close();
fs.writeFileSync(OUT + "/../verify.json", JSON.stringify(rows, null, 1));
for (const r of rows) console.log(JSON.stringify(r));
