import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
const req = createRequire("/home/runner/work/institutional_theme/institutional_theme/tests/browser/package.json");
const { chromium } = req("playwright-core");
const D = "/home/runner/work/institutional_theme/institutional_theme/docs/team/evidence/round4/fix2-login/";
const b = await chromium.launch({ args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 700, height: 600 } });
for (const f of readdirSync(D).filter(f => /^(32|52)-email-.*\.html$/.test(f))) {
  await p.setContent(readFileSync(D + f, "utf8")); await p.waitForTimeout(200);
  const m = await p.evaluate(() => { const e = document.querySelector(".email-ignore, .callout-warning"); if (!e) return null; const c = getComputedStyle(e); return { l: c.borderLeftWidth, r: c.borderRightWidth, text: e.textContent.trim().slice(0, 50) }; });
  console.log(f, JSON.stringify(m));
  await p.screenshot({ path: D + f.replace(".html", ".png"), fullPage: true });
}
await b.close();
