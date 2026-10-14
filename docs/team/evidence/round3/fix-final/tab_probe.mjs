// Negative control: (1) click tab B and return to tab A through scroll_to_field (Tab.set_active); (2) synthetic: call Bootstrap's own
// $(button).tab("show") on a tab (the only path where Bootstrap writes aria-selected; it does not move the panes) and then
// call layout.tabs[0].set_active() directly. Prints aria-selected vs .active. Usage: node tab_probe.mjs <label>
import { createRequire } from "node:module";
const req = createRequire("/home/runner/work/institutional_theme/institutional_theme/tests/browser/package.json");
const { chromium } = req("playwright-core");
const BASE = "http://localhost:8000", PW = "Mdd#Test2026x", lang = "en";
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ locale: "en-US", extraHTTPHeaders: { "Accept-Language": lang }, reducedMotion: "reduce" });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`); await page.fill("#login_email", `g-${lang}-light@midad.test`); await page.fill("#login_password", PW);
await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.click(".btn-login")]);
await page.goto(`${BASE}/desk/user/${encodeURIComponent(`g-${lang}-light@midad.test`)}`); await page.waitForSelector("#form-tabs", { state: "attached" }); await page.waitForTimeout(2500);
const state = () => page.evaluate(() => [...document.querySelectorAll("#form-tabs > li > button[role='tab']")].map((x) => `${x.textContent.trim()}:sel=${x.getAttribute("aria-selected")}:active=${x.classList.contains("active")}`));
console.log(process.argv[2], "initial ", JSON.stringify(await state()));
await page.locator("#form-tabs > li:not(.hide) > button[role='tab']").nth(1).click(); await page.waitForTimeout(500);
console.log(process.argv[2], "click B ", JSON.stringify(await state()));
await page.evaluate(() => cur_frm.scroll_to_field("first_name", false)); await page.waitForTimeout(500);
console.log(process.argv[2], "set_active A", JSON.stringify(await state()));
await page.evaluate(() => $("#form-tabs > li:not(.hide) > button[role='tab']").eq(2).tab("show")); await page.waitForTimeout(500);
console.log(process.argv[2], "bootstrap tab(show) C", JSON.stringify(await state()));
await page.evaluate(() => cur_frm.layout.tabs[0].set_active()); await page.waitForTimeout(500);
console.log(process.argv[2], "set_active A (direct)", JSON.stringify(await state()));
await b.close();
