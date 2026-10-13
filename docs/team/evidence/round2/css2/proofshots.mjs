import { chromium } from "/opt/pw-node/node_modules/playwright-core/index.mjs";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const reqs = []; page.on("request", r => { if (!r.url().startsWith("file:") && !r.url().startsWith("data:") && !r.url().startsWith("about:")) reqs.push(r.url()); });
const errs = []; page.on("pageerror", e => errs.push(String(e))); page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
await page.goto("file:///home/runner/work/institutional_theme/institutional_theme/docs/proof/midad-proof.html");
await page.waitForTimeout(800);
for (const [screen, lang, mode] of [["list","en","light"],["list","ar","dark"],["form","ar","light"],["form","en","dark"],["report","en","light"],["report","ar","dark"],["dialog","en","dark"],["dialog","ar","light"],["login","en","light"],["login","ar","light"]]) {
	await page.evaluate(([s,l,m]) => window.__proofApply({ screen: s, lang: l, mode: m }), [screen, lang, mode]);
	await page.waitForTimeout(500);
	await page.screenshot({ path: `proof/proof-${screen}-${lang}-${mode}.png` });
}
console.log("requests", [...new Set(reqs.map(u => u.split("?")[0]))].slice(0, 20), "errors", errs.slice(0, 5));
await browser.close();
