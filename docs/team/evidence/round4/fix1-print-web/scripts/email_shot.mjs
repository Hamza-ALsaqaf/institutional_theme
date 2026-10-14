// Screenshots of the rendered email HTML files (Chrome), en and ar. usage: node email_shot.mjs <dir with email-en.html and email-ar.html>
import { createRequire } from "node:module";
import path from "node:path";
const req = createRequire(new URL("../../../../../../tests/browser/package.json", import.meta.url));
const { chromium } = req("playwright-core");
const dir = path.resolve(process.argv[2]);
const browser = await chromium.launch();
for (const lang of ["en", "ar"]) {
	const page = await (await browser.newContext({ viewport: { width: 760, height: 620 } })).newPage();
	await page.goto(`file://${dir}/email-${lang}.html`);
	await page.screenshot({ path: `${dir}/email-${lang}.png` });
}
await browser.close();
