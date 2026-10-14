import { chromium, BENCH, login, setUser } from "./lib.mjs";
import fs from "node:fs";
const ver = process.argv[2]; const densities = process.argv[3].split(",");
const only = process.argv[4] || "";
const base = BENCH[ver]; const P = ver === "16.32.0" ? "/app" : "/desk";
const OUT = `/home/runner/work/institutional_theme/institutional_theme/docs/team/evidence/round4/p0/${ver}`;
fs.mkdirSync(OUT, { recursive: true });
const screens = [
 { name: "desktop", route: P, wait: "body" },
 { name: "workspace", route: P + "/build", wait: ".layout-main-section" },
 { name: "list", route: P + "/user", wait: ".frappe-list .result, .list-row-container" },
 { name: "form", route: P + "/user/Administrator", wait: ".form-layout" },
 { name: "report", route: P + "/user/view/report", wait: ".datatable, .dt-scrollable" },
 { name: "dialog", route: P + "/user", wait: ".frappe-list", action: async (page) => {
   await page.evaluate(() => { new frappe.ui.Dialog({ title: "Confirm", fields: [{ fieldtype: "Data", label: "Reference", fieldname: "ref" }, { fieldtype: "Select", label: "Kind", fieldname: "kind", options: "A\nB" }], primary_action_label: "Submit", primary_action() {} }).show(); });
   await page.waitForSelector(".modal.show", { timeout: 10000 }); await page.waitForTimeout(600); } },
];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: "en-US" });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 160)));
await login(page, base);
const report = [];
try {
for (const lang of ["en", "ar"]) for (const mode of ["Light", "Dark"]) {
  if (only && only !== `${lang}-${mode}`) continue;
  await page.goto(base + P + "/todo"); await page.waitForTimeout(1500);
  await setUser(page, base, { desk_theme: mode, language: lang });
  for (const d of densities) for (const s of screens) {
    try {
      await page.goto(base + s.route); await page.waitForSelector(s.wait, { timeout: 30000 }); await page.waitForTimeout(2500);
      await page.evaluate((d) => document.documentElement.setAttribute("data-ins-density", d), d);
      if (s.action) await s.action(page);
      await page.waitForTimeout(400);
      const info = await page.evaluate(() => { const h = document.documentElement; return { dir: h.dir, theme: h.dataset.theme, lang: h.lang, hscroll: document.documentElement.scrollWidth > innerWidth + 1, path: location.pathname };});
      // clipped text: elements with overflow hidden whose scrollWidth > clientWidth and text-overflow not ellipsis
      const clipped = await page.evaluate(() => [...document.querySelectorAll("button,.btn,label,.control-label,.sidebar-item-label,.standard-sidebar-label,.list-row .level-item,.page-title .title-text,.nav-link,.dropdown-item,h1,h2,h3,th,.dt-cell__content")].filter(e => { const c = getComputedStyle(e); return e.offsetParent && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 2 && c.overflowX !== "visible" && c.textOverflow !== "ellipsis"; }).slice(0, 5).map(e => e.className + ":" + e.textContent.trim().slice(0, 30)));
      await page.screenshot({ path: `${OUT}/${lang}-${mode.toLowerCase()}-${d}-${s.name}.png` });
      report.push({ lang, mode, d, screen: s.name, ...info, clipped });
    } catch (e) { report.push({ lang, mode, d, screen: s.name, fail: e.message.split("\n")[0] }); }
  }
}
} finally {
await page.goto(base + P + "/todo").catch(()=>{}); await page.waitForTimeout(1500);
console.log("restore", await setUser(page, base, { desk_theme: "Light", language: "en" }));
try{await b.close();}catch(e){console.log("close",e.message.slice(0,80))}
}
fs.writeFileSync(`${OUT}/../checks-${ver}.json`, JSON.stringify(report, null, 1));
console.log(report.filter(r => r.fail || (r.clipped && r.clipped.length) || r.hscroll || (r.lang==="ar" && r.dir!=="rtl")).map(r => JSON.stringify(r)).join("\n"));
