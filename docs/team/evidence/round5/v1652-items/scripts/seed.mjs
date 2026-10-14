// Creates fictional records: three ToDos, a Kanban board on ToDo status, a submittable probe DocType with draft, submitted and cancelled documents.
import { chromium, BENCH, login, api } from "./lib.mjs";
const ver = process.argv[2];
const base = BENCH[ver];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await b.newContext()).newPage();
await login(page, base);
await page.waitForTimeout(1500);
const log = (k, r) => console.log(k, r.status, JSON.stringify(r.json).slice(0, 160));
for (const [desc, status] of [["Probe task one", "Open"], ["Probe task two", "Closed"], ["Probe task three", "Cancelled"]]) {
	const ex = await api(page, "GET", `/api/resource/ToDo?filters=${encodeURIComponent(JSON.stringify({ description: desc }))}`);
	if (!ex.json.data.length) log("todo " + desc, await api(page, "POST", "/api/resource/ToDo", { description: desc, status }));
}
const board = await api(page, "GET", "/api/resource/Kanban Board/Ins Probe Board");
if (board.status !== 200) log("board", await api(page, "POST", "/api/method/frappe.desk.doctype.kanban_board.kanban_board.quick_kanban_board", { doctype: "ToDo", board_name: "Ins Probe Board", field_name: "status" }));
if (ver !== "16.32.0") {
	log("v1", await api(page, "PUT", "/api/resource/Kanban Board/Ins Probe Board", { use_kanban_v2: 0 }));
	if ((await api(page, "GET", "/api/resource/Kanban Board/Ins Probe Board V2")).status !== 200)
		log("board2", await api(page, "POST", "/api/method/frappe.desk.doctype.kanban_board.kanban_board.quick_kanban_board", { doctype: "ToDo", board_name: "Ins Probe Board V2", field_name: "status" }));
}
for (const [col, ind] of [["Open", "Orange"], ["Closed", "Green"], ["Cancelled", "Red"]])
	log("indicator " + col, await api(page, "POST", "/api/method/frappe.desk.doctype.kanban_board.kanban_board.set_indicator", { board_name: "Ins Probe Board", column_name: col, indicator: ind }));
const dt = await api(page, "GET", "/api/resource/DocType/Ins Probe Slip");
if (dt.status !== 200)
	log("doctype", await api(page, "POST", "/api/resource/DocType", {
		name: "Ins Probe Slip", module: "Custom", custom: 1, is_submittable: 1, naming_rule: "Autoincrement", autoname: "autoincrement",
		fields: [{ fieldname: "title", fieldtype: "Data", label: "Title", in_list_view: 1, reqd: 1 }],
		permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, amend: 1 }],
	}));
const have = await api(page, "GET", "/api/resource/Ins Probe Slip?fields=" + encodeURIComponent('["name","title","docstatus"]'));
console.log("slips", JSON.stringify(have.json));
if (have.status === 200 && !have.json.data.length) {
	for (const [title, target] of [["Probe slip draft", 0], ["Probe slip submitted", 1], ["Probe slip cancelled", 2]]) {
		const r = await api(page, "POST", "/api/resource/Ins Probe Slip", { title });
		log("slip " + title, r);
		if (target >= 1) {
			const doc = r.json.data;
			const s = await api(page, "POST", "/api/method/frappe.client.submit", { doc });
			log(" submit", s);
			if (target === 2) log(" cancel", await api(page, "POST", "/api/method/frappe.client.cancel", { doctype: "Ins Probe Slip", name: doc.name }));
		}
	}
}
await b.close();
