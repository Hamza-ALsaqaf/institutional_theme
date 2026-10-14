import { createRequire } from "node:module";
const req = createRequire("/home/runner/work/institutional_theme/institutional_theme/tests/browser/package.json");
const { chromium } = req("playwright-core");
const BENCH = { "32": "http://midad.test:8000", "52": "http://midad52.test:8001" };
const OUT = "/home/runner/work/institutional_theme/institutional_theme/docs/team/evidence/round4/fix2-login/";
const b = await chromium.launch({ args: ["--no-sandbox"] });
const EMAIL = "a.very.long.address.for.testing@example.com";
for (const which of ["32", "52"]) for (const lang of ["en", "ar"]) {
  const ctx = await b.newContext({ locale: lang === "ar" ? "ar" : "en-US", viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BENCH[which]}/login?_lang=${lang}`, { waitUntil: "networkidle" });
  await page.fill("#login_email", EMAIL);
  await page.fill("#login_password", "secret-pass");
  await page.evaluate(() => document.activeElement.blur());
  const r = await page.evaluate(() => {
    const e = document.querySelector("#login_email"), cs = getComputedStyle(e);
    const f = e.closest(".email-field"), fr = f.getBoundingClientRect(), er = e.getBoundingClientRect();
    const svg = f.querySelector(":scope > .field-icon");
    let icon;
    if (svg) { const q = svg.getBoundingClientRect(); icon = [q.left, q.right, "svg"]; }
    else { const p = getComputedStyle(f, "::before"); const w = parseFloat(p.width), ins = parseFloat(getComputedStyle(f).direction === "rtl" ? p.right : p.left); icon = getComputedStyle(f).direction === "rtl" ? [fr.right - ins - w, fr.right - ins, "::before"] : [fr.left + ins, fr.left + ins + w, "::before"]; }
    const c = document.createElement("canvas").getContext("2d"); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const tw = c.measureText(e.value).width;
    const cl = er.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft), cr = er.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
    const end = cs.textAlign === "end" || cs.textAlign === "right";
    const tl = end ? cr - tw : cl, tr = end ? cr : cl + tw;
    return { dirPage: document.documentElement.dir, inputDir: cs.direction, ta: cs.textAlign, padL: cs.paddingLeft, padR: cs.paddingRight, text: [Math.round(tl), Math.round(tr)], icon: icon.slice(0,2).map(Math.round), iconKind: icon[2], contentBox: [Math.round(cl), Math.round(cr)], textWidth: Math.round(tw) };
  });
  r.overlap = !(r.text[1] <= r.icon[0] || r.text[0] >= r.icon[1]);
  console.log(which, lang, JSON.stringify(r));
  const fr = await page.evaluate(() => { const q = document.querySelector("#login_email").closest(".page-card").getBoundingClientRect(); return [q.x, q.y, q.width, q.height]; });
  await page.screenshot({ path: OUT + `login-filled-${which}-${lang}.png`, clip: { x: fr[0], y: fr[1], width: fr[2], height: Math.min(fr[3], 380) } });
  await ctx.close();
}
await b.close();
