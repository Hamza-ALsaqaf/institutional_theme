import { chromium, BENCH, OUT } from "./lib.mjs";
const EMAILS = { short: "jane.doe@example.com", long: "very.long.mailbox.name.for.overflow.test@subdomain.department.example.com" };
const out = {};
const b = await chromium.launch({ args: ["--no-sandbox"] });
for (const which of ["32","52"]) for (const lang of ["en","ar"]) for (const [vw, vh] of [[1366,800],[360,740]]) {
  const ctx = await b.newContext({ locale: lang==="ar"?"ar":"en-US", viewport: { width: vw, height: vh } });
  const page = await ctx.newPage();
  await page.goto(`${BENCH[which]}/login?_lang=${lang}`, { waitUntil: "networkidle" });
  await page.waitForSelector("#login_email");
  for (const [kind, val] of Object.entries(EMAILS)) {
    await page.fill("#login_email", val);
    await page.fill("#login_password", "secret-pass");
    for (const caret of ["end","start"]) {
      await page.focus("#login_email");
      await page.keyboard.press(caret==="end"?"End":"Home");
      const m = await page.evaluate(() => {
        const e = document.querySelector("#login_email"); const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        const f = e.closest(".email-field"); const ic = f.querySelector(".field-icon");
        let iconRect, iconKind;
        if (ic) { const q = ic.getBoundingClientRect(); iconRect=[q.left,q.right]; iconKind="svg"; }
        else { // ::before mask, positioned at inline-start of field; compute from field box and pseudo style
          const ps = getComputedStyle(f, "::before"); const fr = f.getBoundingClientRect();
          const w = parseFloat(ps.width); const rtl = getComputedStyle(f).direction==="rtl";
          const insetS = parseFloat(ps.insetInlineStart)||parseFloat(ps.left)||parseFloat(ps.right);
          iconKind="::before"; iconRect = rtl ? [fr.right - parseFloat(ps.right) - w, fr.right - parseFloat(ps.right)] : [fr.left + parseFloat(ps.left), fr.left + parseFloat(ps.left)+w];
        }
        const pl=parseFloat(cs.paddingLeft), pr=parseFloat(cs.paddingRight), bl=parseFloat(cs.borderLeftWidth), br=parseFloat(cs.borderRightWidth);
        const content=[r.left+bl+pl, r.right-br-pr];
        return { dirPage: getComputedStyle(document.documentElement).direction, inputDir: cs.direction, ta: cs.textAlign, pl, pr, content, iconRect, iconKind, scrollW: e.scrollWidth, clientW: e.clientWidth, overlap: !(content[1] <= iconRect[0] || content[0] >= iconRect[1]) };
      });
      const key = `${which}-${lang}-${vw}-${kind}-${caret}`;
      out[key] = m;
      if (caret==="end" || kind==="long") {
        const f = await page.$(".email-field"); const bb = await f.boundingBox();
        await page.screenshot({ path: OUT + `login-${key}.png`, clip: { x: Math.max(0,bb.x-20), y: Math.max(0,bb.y-70), width: bb.width+40, height: bb.height+140 } });
      }
    }
  }
  await ctx.close();
}
await b.close();
import { writeFileSync } from "node:fs";
writeFileSync(OUT + "login-data.json", JSON.stringify(out, null, 1));
for (const [k,v] of Object.entries(out)) console.log(k, JSON.stringify({ta:v.ta,pl:v.pl,pr:v.pr,content:v.content.map(Math.round),icon:v.iconRect.map(Math.round),kind:v.iconKind,sw:v.scrollW,cw:v.clientW,overlap:v.overlap}));
