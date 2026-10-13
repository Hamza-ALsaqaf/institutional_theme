import { open, goto } from "./lib.mjs";
const { browser, page } = await open("css-form-en-light@midad.test");
await goto(page, "/app/event/new");
const out = await page.evaluate(() => {
	const q = (s) => [...document.querySelectorAll(s)].slice(0, 1).map((e) => e.outerHTML.slice(0, 900));
	return { attrs: document.documentElement.outerHTML.slice(0, 200), link: q('.frappe-control[data-fieldtype="Link"]'), select: q('.frappe-control[data-fieldtype="Select"]'), check: q('.frappe-control[data-fieldtype="Check"]'), date: q('.frappe-control[data-fieldtype="Date"]'), title: q(".title-area"), tabs: q(".form-tabs-list"), section: q(".form-section"), sidebar: q(".form-sidebar").map(s=>s.slice(0,600)) };
});
console.log(JSON.stringify(out, null, 1));
await page.screenshot({ path: "/tmp/claude-0/-home-user-institutional-theme/320119fb-6481-5ed3-8a0e-2775f36069f4/scratchpad/base.png" });
await browser.close();
