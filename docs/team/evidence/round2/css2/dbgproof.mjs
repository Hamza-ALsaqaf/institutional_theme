import { chromium } from "/opt/pw-node/node_modules/playwright-core/index.mjs";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await page.goto("file:///home/runner/work/institutional_theme/institutional_theme/docs/proof/midad-proof.html");
await page.waitForTimeout(800);
console.log(await page.evaluate(async () => { await document.fonts.ready; const fam = getComputedStyle(document.querySelector(".page-head .title-text")).fontFamily; return { fam, fonts: [...document.fonts].map(f => f.family + ":" + f.weight + ":" + f.status).slice(0, 12), body: getComputedStyle(document.body).fontFamily, varsans: getComputedStyle(document.documentElement).getPropertyValue("--ins-font-sans") }; }));
await page.evaluate(() => window.__proofApply({ screen: "report" }));
console.log(await page.evaluate(() => [...document.querySelectorAll(".dt-row-header, .dt-header, .dt-scrollable, .dt-row-0")].map(e => { const b = e.getBoundingClientRect(); const c = getComputedStyle(e); return [e.className, Math.round(b.top), Math.round(b.height), c.position, c.display, c.overflow]; })));
await browser.close();
