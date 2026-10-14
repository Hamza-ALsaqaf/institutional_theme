import { combos, launch, ready } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const out = {};
for (const c of combos.filter(c => c.mode === "light")) {
	const { browser, page } = await launch(c, { reducedMotion: "reduce", hasTouch: false });
	await ready(page, "/desk/todo");
	await page.evaluate(() => { frappe.show_alert({ message: "Toast", indicator: "green" }, 30); const d = new frappe.ui.Dialog({ title: "D", primary_action_label: "S", primary_action() {} }); d.show();
		const s = document.createElement("div"); s.className = "freeze-row"; s.innerHTML = '<div class="list-row-col"></div>'; s.id="sk"; document.body.append(s);
		const k = document.createElement("div"); k.className = "skeleton-card"; document.body.append(k); });
	await page.waitForTimeout(800);
	out[c.lang] = await page.evaluate(() => {
		const q = (s) => document.querySelector(s); const g = (n, s) => { const e = q(s); if (!e) return [n, "missing"]; const c = getComputedStyle(e); return [n, c.transitionDuration, c.animationDuration, c.animationName]; };
		const all = [...document.querySelectorAll("*")].map(e => getComputedStyle(e)); const maxT = Math.max(...all.map(c => Math.max(...c.transitionDuration.split(",").map(parseFloat)))); const maxA = Math.max(...all.map(c => Math.max(...c.animationDuration.split(",").map(parseFloat))));
		return { rows: [g("button", ".btn-primary"), g("dropdown-menu", ".dropdown-menu"), g("modal", ".modal"), g("modal-dialog", ".modal-dialog"), g("toast", ".desk-alert"), g("skeleton-row", "#sk .list-row-col"), g("skeleton-card", ".skeleton-card"), g("backdrop", ".modal-backdrop")], maxTransitionS: maxT, maxAnimationS: maxA, mm: matchMedia("(prefers-reduced-motion: reduce)").matches };
	});
	await browser.close();
}
writeFileSync("motion.json", JSON.stringify(out, null, 1)); console.log(JSON.stringify(out));
