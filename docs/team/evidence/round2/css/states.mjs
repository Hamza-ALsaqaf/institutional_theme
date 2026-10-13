// P1 states on the real build: toast, date picker, autocomplete, tooltip, bulk actions, skeleton, 403. 4 combos each (403 uses the no-role users).
import { combos, launch, ready, BASE } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const only = process.argv[2];
const out = {};
const note = (c, k, v) => { (out[`${c.lang}-${c.mode}`] ||= {})[k] = v; };
for (const c of combos) {
	const { browser, page } = await launch(c);
	const shot = (n) => page.screenshot({ path: `${c.lang}-${c.mode}-state-${n}.png` });
	// toast
	if (!only || only === "toast") {
		await ready(page, "/desk/task/view/list");
		await page.evaluate(() => frappe.show_alert({ message: __("Saved"), indicator: "green" }, 60));
		await page.evaluate(() => frappe.show_alert({ message: __("Something needs attention"), indicator: "red" }, 60));
		await page.waitForTimeout(600);
		note(c, "toast", await page.evaluate(() => { const e = document.querySelector(".desk-alert"); if (!e) return null; const s = getComputedStyle(e); return { bg: s.backgroundColor, color: s.color, border: s.borderColor, shadow: s.boxShadow.slice(0, 40) }; }));
		await shot("toast");
		// bulk actions: tick two rows
		await page.waitForSelector(".list-row-checkbox", { timeout: 15000 }).catch(() => {});
		await page.locator(".list-row-checkbox").nth(0).check({ force: true }).catch(() => {});
		await page.locator(".list-row-checkbox").nth(1).check({ force: true }).catch(() => {});
		await page.waitForTimeout(600);
		note(c, "bulk", await page.evaluate(() => { const e = document.querySelector(".list-row-head, .list-row-head .level-item"); return { checked: document.querySelectorAll(".list-row-checkbox:checked").length, actionsVisible: !!document.querySelector(".actions-btn-group:not(.hide), .actions-btn-group") }; }));
		await shot("bulk");
	}
	// date picker, autocomplete
	await ready(page, "/desk/event/new");
	await page.waitForSelector('.frappe-control[data-fieldname="starts_on"] input', { timeout: 20000 });
	await page.locator('.frappe-control[data-fieldname="starts_on"] input').click();
	await page.waitForSelector(".datepicker.active", { timeout: 8000 }).catch(() => console.log("no datepicker"));
	await page.waitForTimeout(500);
	note(c, "datepicker", await page.evaluate(() => { const d = document.querySelector(".datepicker.active"); if (!d) return null; const s = getComputedStyle(d); const cur = d.querySelector(".datepicker--cell.-current-"); const sel = d.querySelector(".datepicker--cell.-selected-"); return { bg: s.backgroundColor, color: s.color, today: cur ? getComputedStyle(cur).color : null, selected: sel ? getComputedStyle(sel).backgroundColor : null }; }));
	await shot("datepicker");
	await page.keyboard.press("Escape");
	await ready(page, "/desk/task/new");
	await page.locator('.frappe-control[data-fieldname="project"] input').click();
	await page.locator('.frappe-control[data-fieldname="project"] input').fill("CssR2");
	await page.waitForSelector(".awesomplete ul:not([hidden]) li", { timeout: 10000 }).catch(() => console.log("no awesomplete"));
	await page.waitForTimeout(500);
	note(c, "autocomplete", await page.evaluate(() => { const u = document.querySelector(".awesomplete ul:not([hidden])"); if (!u) return null; const s = getComputedStyle(u); const li = u.querySelector("li"); return { bg: s.backgroundColor, color: li ? getComputedStyle(li).color : null, border: s.borderColor, items: u.querySelectorAll("li").length }; }));
	await shot("autocomplete");
	// tooltip
	await page.keyboard.press("Escape");
	await page.evaluate(() => { const b = document.querySelector(".page-actions .btn, .primary-action"); window.__t = b; $(b).attr("data-original-title", "").tooltip({ title: __("Save"), trigger: "manual", placement: "bottom" }).tooltip("show"); });
	await page.waitForTimeout(500);
	note(c, "tooltip", await page.evaluate(() => { const t = document.querySelector(".tooltip .tooltip-inner"); if (!t) return null; const s = getComputedStyle(t); return { bg: s.backgroundColor, color: s.color }; }));
	await shot("tooltip");
	await browser.close();
}
// skeleton (throttled response) and 403 (no-role users)
for (const c of combos) {
	const { browser, page } = await launch(c);
	await page.route("**/api/method/frappe.desk.reportview.get*", async (r) => { await new Promise((x) => setTimeout(x, 6000)); r.continue(); });
	await page.goto(BASE + "/desk/task/view/list", { waitUntil: "domcontentloaded" });
	await page.waitForSelector(".skeleton, [class*='skeleton']", { timeout: 15000 }).catch(() => console.log("no skeleton", c.user));
	await page.waitForTimeout(700);
	note(c, "skeleton", await page.evaluate(() => { const e = document.querySelector("[class*='skeleton']"); if (!e) return null; const s = getComputedStyle(e); return { cls: e.className, bg: s.backgroundColor, bgImage: s.backgroundImage.slice(0, 120), anim: s.animationName }; }));
	await page.screenshot({ path: `${c.lang}-${c.mode}-state-skeleton.png` });
	await browser.close();
}
for (const c of [{ lang: "ar", mode: "light", user: "css-r2-norole-ar@midad.test" }, { lang: "en", mode: "dark", user: "css-r2-norole-en@midad.test" }, { lang: "en", mode: "light", user: "css-r2-norole-en@midad.test" }, { lang: "ar", mode: "dark", user: "css-r2-norole-ar@midad.test" }]) {
	const { browser, page } = await launch(c);
	await ready(page, "/desk/user/view/list");
	await page.waitForTimeout(1500);
	note(c, "forbidden", await page.evaluate(() => ({ dialog: !!document.querySelector(".msgprint-dialog, .modal.show"), text: (document.querySelector(".modal.show .modal-body, .page-container:not([style*='none'])")?.textContent || "").trim().slice(0, 120), theme: document.documentElement.dataset.theme })));
	await page.screenshot({ path: `${c.lang}-${c.mode}-state-403.png` });
	await browser.close();
}
writeFileSync("states-computed.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out).slice(0, 1500));
