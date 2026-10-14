import { chromium } from "/opt/pw-node/node_modules/playwright-core/index.mjs";
const BASE = "http://midad.test:8000";
const browser = await chromium.launch();
const c = await browser.newContext({ baseURL: BASE, locale: "en-US" });
await c.request.post("/api/method/login", { form: { usr: "Administrator", pwd: "admin" } });
const p = await c.newPage();
const reqs = [];
p.on("request", (r) => { if (/get_logged_user/.test(r.url())) reqs.push(r.method() + " " + r.url()); });
await p.goto(BASE + "/desk/customer/new");
await p.waitForSelector("[data-fieldname=customer_name]", { timeout: 40000 });
await p.waitForTimeout(2500);
const out = { idleEnabled: await p.evaluate(() => frappe.boot.ins.idle_warning) };
await p.focus("input[data-fieldname=customer_name]");
await p.waitForSelector("[data-ins-banner=idle]", { timeout: 90000 });
out.shown = await p.evaluate(() => { const b = document.querySelector("[data-ins-banner=idle]"); return { role: b.getAttribute("role"), text: b.textContent, active: document.activeElement.className }; });
// Esc pressed while the button has focus
await p.keyboard.press("Escape");
await p.waitForFunction(() => !document.querySelector("[data-ins-banner=idle]"), null, { timeout: 10000 });
out.afterEsc = await p.evaluate(() => ({ bannerGone: !document.querySelector("[data-ins-banner=idle]"), activeField: document.activeElement.getAttribute("data-fieldname") }));
out.requestsAfterEsc = reqs.slice();
// the button path still works, for comparison
await p.waitForSelector("[data-ins-banner=idle]", { timeout: 90000 });
await p.click("[data-ins-banner=idle] button");
await p.waitForFunction(() => !document.querySelector("[data-ins-banner=idle]"), null, { timeout: 10000 });
out.afterButton = await p.evaluate(() => ({ activeField: document.activeElement.getAttribute("data-fieldname") }));
out.requestsTotal = reqs.length;
console.log(JSON.stringify(out, null, 1));
await browser.close();
