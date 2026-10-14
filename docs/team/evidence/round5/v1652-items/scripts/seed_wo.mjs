// Fictional Work Order with a BOM, operation, workstation and Job Cards, so the embedded-list status badges can be captured (ERPNext only).
import { chromium, BENCH, login, api } from "./lib.mjs";
const ver = process.argv[2];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await b.newContext()).newPage();
await login(page, BENCH[ver]);
await page.waitForTimeout(1500);
const log = (k, r) => console.log(k, r.status, JSON.stringify(r.json).slice(0, 300));
const co = (await api(page, "GET", "/api/resource/Company?fields=" + encodeURIComponent('["name","abbr","default_currency"]'))).json.data[0];
console.log(JSON.stringify(co));
const whs = (await api(page, "GET", "/api/resource/Warehouse?filters=" + encodeURIComponent(JSON.stringify({ company: co.name, is_group: 0 })) + "&fields=" + encodeURIComponent('["name"]'))).json.data;
console.log(JSON.stringify(whs));
const wh = whs[0].name;
const mk = async (dt, name, doc) => {
	const ex = await api(page, "GET", `/api/resource/${dt}/${encodeURIComponent(name)}`);
	if (ex.status === 200) return ex.json.data;
	const r = await api(page, "POST", `/api/resource/${dt}`, doc);
	log(dt, r);
	return r.json && r.json.data;
};
await mk("Item", "Probe Part", { item_code: "Probe Part", item_name: "Probe Part", item_group: "All Item Groups", stock_uom: "Nos", is_stock_item: 1 });
await mk("Item", "Probe Raw", { item_code: "Probe Raw", item_name: "Probe Raw", item_group: "All Item Groups", stock_uom: "Nos", is_stock_item: 1 });
await mk("Operation", "Probe Cut", { name: "Probe Cut" });
await mk("Workstation", "Probe Bench", { workstation_name: "Probe Bench", hour_rate: 10 });
let bom = (await api(page, "GET", "/api/resource/BOM?filters=" + encodeURIComponent(JSON.stringify({ item: "Probe Part" })))).json.data[0];
if (!bom) {
	const r = await api(page, "POST", "/api/resource/BOM", { item: "Probe Part", quantity: 1, company: co.name, with_operations: 1, currency: co.default_currency, items: [{ item_code: "Probe Raw", qty: 1 }], operations: [{ operation: "Probe Cut", workstation: "Probe Bench", time_in_mins: 10, hour_rate: 10 }] });
	log("bom", r);
	bom = r.json.data;
	log("bom submit", await api(page, "POST", "/api/method/frappe.client.submit", { doc: bom }));
}
const w = (await api(page, "GET", "/api/resource/Work Order?filters=" + encodeURIComponent(JSON.stringify({ production_item: "Probe Part" })))).json.data;
if (!w.length) {
	const r = await api(page, "POST", "/api/resource/Work Order", { production_item: "Probe Part", bom_no: bom.name, qty: 2, company: co.name, wip_warehouse: wh, fg_warehouse: wh, source_warehouse: wh, use_multi_level_bom: 0, skip_transfer: 1 });
	log("wo", r);
	if (r.json.data) log("wo submit", await api(page, "POST", "/api/method/frappe.client.submit", { doc: r.json.data }));
}
console.log("WO", JSON.stringify((await api(page, "GET", "/api/resource/Work Order?fields=" + encodeURIComponent('["name","docstatus","status"]'))).json));
console.log("JC", JSON.stringify((await api(page, "GET", "/api/resource/Job Card?fields=" + encodeURIComponent('["name","docstatus","status","work_order"]'))).json));
await b.close();
