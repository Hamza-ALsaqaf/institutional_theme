import { chromium, BENCH, OUT } from "./lib.mjs";
const b = await chromium.launch({ args: ["--no-sandbox"] });
for (const which of ["32","52"]) for (const lang of ["ar"]) for (const hash of ["forgot","signup","login-with-email-link"]) {
  const ctx = await b.newContext({ locale: "ar", viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BENCH[which]}/login?_lang=${lang}#${hash}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const res = await page.evaluate(() => [...document.querySelectorAll(".email-field")].filter(f=>f.offsetParent).map(f => {
    const e = f.querySelector("input"); const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
    const ic = f.querySelector(".field-icon"); const ps = getComputedStyle(f,"::before"); const fr=f.getBoundingClientRect();
    const w=parseFloat(ps.width);
    const iconRect = ic ? [ic.getBoundingClientRect().left, ic.getBoundingClientRect().right] : (getComputedStyle(f).direction==="rtl" ? [fr.right-parseFloat(ps.right)-w, fr.right-parseFloat(ps.right)] : [fr.left+parseFloat(ps.left), fr.left+parseFloat(ps.left)+w]);
    const content=[r.left+parseFloat(cs.borderLeftWidth)+parseFloat(cs.paddingLeft), r.right-parseFloat(cs.borderRightWidth)-parseFloat(cs.paddingRight)];
    return { id: e.id, dir: cs.direction, pl: cs.paddingLeft, pr: cs.paddingRight, content, iconRect, overlap: !(content[1] <= iconRect[0] || content[0] >= iconRect[1]) };
  }));
  console.log(which, hash, JSON.stringify(res));
  if (res.length) { const el = await page.$(".email-field:visible, .email-field"); }
  await page.screenshot({ path: OUT + `login-forms-${which}-${hash}.png`, clip: {x:400,y:100,width:566,height:560} });
  await ctx.close();
}
await b.close();
