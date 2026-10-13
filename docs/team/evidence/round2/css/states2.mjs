// Second pass for P1 states that need different triggers: skeleton (delayed list call), 403 inside the desk, Link autocomplete, tooltip.
import { combos, launch, ready, BASE } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const out = {};
const note = (c, k, v) => { (out[`${c.lang}-${c.mode}`] ||= {})[k] = v; };
const which = process.argv[2] || "all";
for (const c of combos) {
	if (which === "all" || which === "ac") {
		const { browser, page } = await launch(c);
		await ready(page, "/desk/todo/new");
		const inp = page.locator('.frappe-control[data-fieldname="allocated_to"] input');
		await inp.click(); await inp.fill("css-r2");
		await page.waitForSelector(".awesomplete ul:not([hidden]) li", { timeout: 10000 }).catch(() => console.log("no awesomplete", c.user));
		await page.waitForTimeout(500);
		note(c, "autocomplete", await page.evaluate(() => { const u = document.querySelector(".awesomplete ul:not([hidden])"); if (!u) return null; const s = getComputedStyle(u); const li = u.querySelector("li"); return { bg: s.backgroundColor, color: li ? getComputedStyle(li).color : null, border: s.borderColor, items: u.querySelectorAll("li").length }; }));
		await page.screenshot({ path: `${c.lang}-${c.mode}-state-autocomplete.png` });
		await page.keyboard.press("Escape");
		await page.evaluate(() => { const b = [...document.querySelectorAll(".page-actions .btn, .primary-action, .navbar-brand")].find((e) => e.offsetParent); $(b).tooltip({ title: __("Save"), trigger: "manual", placement: "bottom" }).tooltip("show"); });
		await page.waitForTimeout(500);
		note(c, "tooltip", await page.evaluate(() => { const t = document.querySelector(".tooltip .tooltip-inner"); if (!t) return null; const s = getComputedStyle(t); const a = getComputedStyle(document.querySelector(".tooltip")); return { bg: s.backgroundColor, color: s.color, opacity: a.opacity }; }));
		await page.screenshot({ path: `${c.lang}-${c.mode}-state-tooltip.png` });
		await browser.close();
	}
	if (which === "all" || which === "sk") {
		const { browser, page } = await launch(c);
		await ready(page, "/desk/todo");
		await page.route(/reportview\.get|frappe\.desk\.listview|get_list/, async (r) => { await new Promise((x) => setTimeout(x, 8000)); r.continue(); });
		await page.evaluate(() => frappe.set_route("List", "Task", "List"));
		await page.waitForTimeout(1200);
		note(c, "skeleton", await page.evaluate(() => { const e = document.querySelector(".list-skeleton"); if (!e) return null; const kids = [...e.querySelectorAll("*")].filter((x) => getComputedStyle(x).backgroundImage !== "none" || getComputedStyle(x).animationName !== "none").slice(0, 2).map((x) => ({ cls: x.className, bg: getComputedStyle(x).backgroundColor, img: getComputedStyle(x).backgroundImage.slice(0, 100), anim: getComputedStyle(x).animationName })); return { visible: e.offsetParent !== null, kids }; }));
		await page.screenshot({ path: `${c.lang}-${c.mode}-state-skeleton.png` });
		await browser.close();
	}
}
if (which === "all" || which === "403") for (const c of [{ lang: "ar", mode: "light", user: "css-r2-norole-ar@midad.test" }, { lang: "en", mode: "dark", user: "css-r2-norole-en@midad.test" }]) {
	const { browser, page } = await launch(c);
	await ready(page, "/desk/task/view/list");
	await page.waitForTimeout(2500);
	note(c, "forbidden", await page.evaluate(() => ({ url: location.pathname, theme: document.documentElement.dataset.theme, modal: (document.querySelector(".modal.show")?.textContent || "").trim().slice(0, 100), page: (document.querySelector(".page-container:not([style*='none'])")?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120) })));
	await page.screenshot({ path: `${c.lang}-${c.mode}-state-403.png` });
	await browser.close();
}
writeFileSync("states2-computed.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out).slice(0, 2500));
