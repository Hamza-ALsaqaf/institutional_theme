import { combos, launch, ready } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const tag = process.argv[2] || "before";
const screens = { list: "/desk/todo", form: "/desk/todo/new", home: "/desk/home" };
const out = {}; const under = {};
for (const c of combos.filter(c => c.mode === "light")) {
	const { browser, page } = await launch(c, { viewport: { width: 1280, height: 800 } });
	for (const dens of ["comfortable", "compact"]) for (const [sn, path] of Object.entries(screens)) {
		await ready(page, path);
		await page.evaluate((d) => document.documentElement.setAttribute("data-ins-density", d), dens);
		await page.waitForTimeout(300);
		const r = await page.evaluate(() => {
			const sel = "button, a[href], input:not([type=hidden]), select, textarea, [role=button], [tabindex='0'], .list-row-checkbox, .like-action, .assign-to, .dropdown-toggle, .sidebar-item-container .item-anchor";
			const res = [];
			for (const e of document.querySelectorAll(sel)) {
				const s = getComputedStyle(e); if (s.visibility === "hidden" || s.display === "none") continue;
				const b = e.getBoundingClientRect(); if (!b.width || !b.height) continue;
				if (b.right < 0 || b.left > innerWidth || b.bottom < 0 || b.top > innerHeight) continue;
				if (e.closest(".modal:not(.show), [hidden], .hidden, .sr-only")) continue;
				if (b.width < 24 || b.height < 24) res.push({ el: e.tagName.toLowerCase() + "." + String(e.className).trim().split(/\s+/).slice(0, 3).join("."), w: +b.width.toFixed(1), h: +b.height.toFixed(1), txt: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 20), inline: s.display === "inline" });
			}
			return res;
		});
		out[`${c.lang}-${dens}-${sn}`] = r;
	}
	await browser.close();
}
writeFileSync(`target-${tag}.json`, JSON.stringify(out, null, 1));
const agg = {};
for (const [k, v] of Object.entries(out)) for (const x of v) { const key = x.el + " " + x.w + "x" + x.h; (agg[key] ||= new Set()).add(k.split("-").slice(1).join("-")); }
for (const [k, v] of Object.entries(agg)) console.log(k, [...v].join(","));
