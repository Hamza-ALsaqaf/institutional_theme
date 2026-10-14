// Embedded-list status badges on v16.52.0: the real Role form (Documents tab, core) and a table built with the Work Order column definitions
// (erpnext v16.50.0 work_order.js:1431 and :1482) because a Work Order cannot be inserted on PostgreSQL here (ERPNext AmbiguousColumn "idx").
import fs from "node:fs";
import { chromium, BENCH, DESK, OUT, login, setUser } from "./lib.mjs";
const ver = "16.52.0";
const base = BENCH[ver];
const P = DESK[ver];
const dir = `${OUT}/shots/${ver}-after`;
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 800 }, locale: "en-US" })).newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 160)));
await login(page, base);
await page.goto(base + P + "/todo");
await page.waitForTimeout(1500);
const probe = [];
const style = (sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].slice(0, 8).map((e) => {
	const c = getComputedStyle(e);
	const q = getComputedStyle(e, "::before");
	return { text: e.textContent.trim().slice(0, 20), theme: e.dataset.theme || null, bg: c.backgroundColor, color: c.color, border: c.borderColor, before: { w: q.width, h: q.height, bg: q.backgroundImage.slice(0, 30) + "|" + q.backgroundColor, radius: q.borderRadius } };
}), sel);
try {
	for (const lang of ["en", "ar"]) for (const mode of ["Light", "Dark"]) {
		await setUser(page, { desk_theme: mode, language: lang });
		const key = `${lang}-${mode.toLowerCase()}`;
		await page.goto(base + P + "/role/System%20Manager");
		await page.waitForSelector(".form-layout", { timeout: 40000 });
		await page.waitForTimeout(2500);
		await page.evaluate(() => { const t = [...document.querySelectorAll(".form-tabs .nav-link")].find((e) => /document/i.test(e.textContent) || /مستند/.test(e.textContent)); if (t) t.click(); });
		await page.waitForSelector(".embedded-list-table .es-badge", { timeout: 30000 }).catch(() => {});
		await page.waitForTimeout(1500);
		await page.screenshot({ path: `${dir}/${key}-role-embedded.png` });
		probe.push({ key, screen: "role-embedded", badges: await style(".embedded-list-table td > .es-badge") });
		// Work Order column definitions on core's EmbeddedList
		await page.evaluate(async () => {
			await frappe.require("embedded_list.bundle.js");
			await frappe.model.with_doctype("Job Card");
			const host = document.createElement("div");
			host.id = "ins-probe-embedded";
			host.style.cssText = "position:fixed;inset-block-start:70px;" + (document.documentElement.dir === "rtl" ? "left:20px;right:340px;" : "left:320px;right:20px;") + "background:var(--card-bg);z-index:1000;padding:12px;border:1px solid var(--border-color)";
			document.body.appendChild(host);
			const rows = [
				{ name: "PO-1", operation: "Cut", status: "Open", docstatus: 0 }, { name: "PO-2", operation: "Cut", status: "Work In Progress", docstatus: 1 },
				{ name: "PO-3", operation: "Cut", status: "Completed", docstatus: 1 }, { name: "PO-4", operation: "Cut", status: "Cancelled", docstatus: 2 },
			];
			class L extends frappe.ui.EmbeddedList { get_data() { return Promise.resolve(rows); } }
			new L({
				wrapper: host, title: "Job Card and Stock Entry statuses (probe)",
				columns: [
					{ label: "Job Card", fieldname: "name" },
					{ label: "Status", render: (row) => { const [label, color] = frappe.get_indicator(row, "Job Card") || [row.status, "gray"]; return frappe.ui.badge.html({ label, theme: color }); } },
					{ label: "Entry", render: (row) => frappe.ui.badge.html({ label: { 0: __("Draft"), 1: __("Submitted"), 2: __("Cancelled") }[row.docstatus], theme: { 0: "gray", 1: "green", 2: "red" }[row.docstatus] }) },
				],
			}).refresh();
		});
		await page.waitForSelector("#ins-probe-embedded .es-badge", { timeout: 20000 });
		await page.waitForTimeout(800);
		await page.screenshot({ path: `${dir}/${key}-workorder-style.png`, clip: { x: 0, y: 50, width: 1280, height: 330 } });
		probe.push({ key, screen: "workorder-style", badges: await style("#ins-probe-embedded td > .es-badge") });
	}
} finally {
	await page.goto(base + P + "/todo").catch(() => {});
	await page.waitForTimeout(1000);
	console.log("restore", await setUser(page, { desk_theme: "Light", language: "en" }));
	await b.close();
}
fs.writeFileSync(`${dir}/probe-embedded.json`, JSON.stringify(probe, null, 1));
console.log("done", probe.length);
