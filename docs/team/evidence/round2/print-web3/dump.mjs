// usage: node dump.mjs <outdir>   Full computed-style dump (every property, every element) of the website pages.
import { launch, BASE } from "../print-web2/lib.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const b = await launch();
const pages = [["login","/login"],["login-forgot","/login#forgot"],["update-password","/update-password?key=abc"],["twofa","/login"],["404","/ins-no-such-page"],["403","/me"],["about","/ins-p2-about"],["webform","/visitor-request/new"],["home","/"]];
const dump = () => {
  const props = [...getComputedStyle(document.documentElement)].filter(p => !p.startsWith("--"));
  const rows = {};
  const els = [document.documentElement, ...document.body.querySelectorAll("*")];
  els.forEach((e, i) => {
    if (["SCRIPT","STYLE","NOSCRIPT"].includes(e.tagName)) return;
    const cs = getComputedStyle(e); const o = {};
    for (const p of props) o[p] = cs.getPropertyValue(p);
    const hide = cs.display === "none";
    // layout-dependent values of hidden elements are "auto"; keep as is
    rows[`${i}:${e.tagName}#${e.id}.${String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className).trim().replace(/\s+/g,".")}`] = o;
  });
  return rows;
};
for (const lang of ["en","ar"]) {
  const ctx = await b.newContext({ baseURL: BASE, viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  for (const [n, p] of pages) {
    const sep = p.includes("?") ? "&" : "?";
    const [path, hash] = p.split("#");
    await page.goto(`${BASE}${path}${path.includes("?")?"&":"?"}_lang=${lang}${hash?"#"+hash:""}`, { waitUntil: "networkidle" });
    if (n === "twofa") { await page.evaluate(() => continue_otp_app(true)); await page.waitForTimeout(300); }
    if (n === "login-forgot") await page.evaluate(() => { document.querySelector("a.forgot-password-message, .forgot-password-message a")?.click(); });
    await page.waitForTimeout(500);
    const rows = await page.evaluate(dump);
    writeFileSync(`${out}/${lang}-${n}.json`, JSON.stringify(rows));
    console.log(lang, n, Object.keys(rows).length, "elements", page.url(), await page.title());
  }
  await ctx.close();
}
await b.close();
