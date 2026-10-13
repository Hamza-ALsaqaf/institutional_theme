// Generic screenshot: node shot.mjs <route> <name> [selector-to-wait]. Runs all four combos, saves <lang>-<mode>-<name>.png.
import { combos, launch, ready } from "./lib.mjs";
const [route, name, sel] = process.argv.slice(2);
for (const c of combos) {
	const { browser, page } = await launch(c);
	await ready(page, route);
	if (sel) await page.waitForSelector(sel, { timeout: 15000 }).catch(() => console.log("no", sel));
	await page.waitForTimeout(500);
	await page.screenshot({ path: `${c.lang}-${c.mode}-${name}.png` });
	console.log("ok", c.lang, c.mode, name);
	await browser.close();
}
