import { combos, launch, ready } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const screens = { home: "/desk", workspace: "/desk/home", list: "/desk/todo", form: "/desk/todo/new", report: "/desk/query-report/Permitted Documents For User" , dialog: "/desk/todo" };
const sizes = { z200: [640, 400, 2], z400: [320, 200, 4] };
const out = {};
for (const c of combos.filter(c => c.mode === "light")) for (const [zn, [w, h, f]] of Object.entries(sizes)) {
	const { browser, page } = await launch(c, { viewport: { width: w, height: h }, deviceScaleFactor: f });
	for (const [sn, path] of Object.entries(screens)) {
		await ready(page, path);
		if (sn === "dialog") { await page.evaluate(() => { const d = new frappe.ui.Dialog({ title: "Dialog", fields: [{ fieldname: "a", fieldtype: "Data", label: "Name" }, { fieldname: "b", fieldtype: "Select", label: "Kind", options: "A\nB" }], primary_action_label: "Save", primary_action() {} }); d.show(); }); await page.waitForTimeout(800); }
		const r = await page.evaluate(() => {
			const de = document.documentElement, vw = de.clientWidth;
			const wide = [];
			for (const e of document.querySelectorAll("body *")) { const b = e.getBoundingClientRect(); if (b.width && b.right > vw + 1 && !e.closest(".dt-scrollable,.datatable,.result,.modal-dialog:not(.x)") && getComputedStyle(e).position !== "fixed") { wide.push(e.tagName + "." + String(e.className).slice(0, 40) + ":" + Math.round(b.right)); if (wide.length > 6) break; } }
			return { vw, docSW: de.scrollWidth, bodySW: document.body.scrollWidth, over: de.scrollWidth > vw, wide };
		});
		out[`${c.lang}-${zn}-${sn}`] = r;
		await page.screenshot({ path: `reflow-${c.lang}-${zn}-${sn}.png` });
	}
	await browser.close();
}
writeFileSync("reflow.json", JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) console.log(k, v.vw, v.docSW, v.over ? "OVER" : "ok", v.wide.slice(0,3).join(" | "));
