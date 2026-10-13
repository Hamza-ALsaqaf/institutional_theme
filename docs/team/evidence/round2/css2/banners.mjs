import { combos, launch, ready } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const out = {};
for (const c of combos) for (const kind of ["offline", "idle"]) {
	const { browser, page } = await launch(c);
	await ready(page, "/desk/todo");
	const key = `${c.lang}-${c.mode}-${kind}`;
	await page.evaluate((kind) => {
		const d = document.createElement("div");
		d.className = "ins-banner"; d.dataset.insBanner = kind; d.setAttribute("role", kind === "idle" ? "alertdialog" : "status");
		const t = document.createElement("span"); t.className = "ins-banner-text"; t.id = "bt";
		const ar = document.documentElement.lang === "ar";
		t.textContent = kind === "offline" ? (ar ? "لا يوجد اتصال بالخادم. سيُعاد الاتصال تلقائيا." : "You are offline. Changes will sync when the connection returns.") : (ar ? "ستنتهي جلستك قريبا بسبب عدم النشاط." : "Your session will end soon because of inactivity.");
		d.append(t);
		if (kind === "idle") { d.setAttribute("aria-labelledby", "bt"); const b = document.createElement("button"); b.className = "btn btn-sm btn-default ins-banner-action"; b.textContent = ar ? "ابقَ متصلا" : "Stay signed in"; d.append(b); }
		document.body.prepend(d);
	}, kind);
	await page.waitForTimeout(700);
	out[key] = await page.evaluate(() => {
		const d = document.querySelector(".ins-banner");
		const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
		const s = getComputedStyle(d);
		return { banner: r(".ins-banner"), sidebar: r(".body-sidebar"), main: r(".main-section"), docH: document.documentElement.scrollHeight, bg: s.backgroundColor, color: s.color, bar: s.borderInlineStartColor, pos: s.position, scrollY };
	});
	await page.screenshot({ path: `banner-${key}.png` });
	await browser.close();
}
writeFileSync("banners.json", JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([k, v]) => k + " " + JSON.stringify(v.banner) + JSON.stringify(v.sidebar) + JSON.stringify(v.main) + " " + v.docH + " " + v.bg + " " + v.color).join("\n"));
