// Action tagging and status attributes on real forms, in English and Arabic (ADR 0008).
// Builds its own fixtures through the REST API as Administrator: a submittable doctype ("Ins Action Test")
// and a second one with a two-step workflow ("Ins Action Flow"). Both are custom doctypes on the test site.
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node actions.mjs [--base URL] [--out DIR]
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const base = arg("--base", "http://localhost:8000");
const out = resolve(arg("--out", "docs/team/evidence/phase3/runtime"));
mkdirSync(out, { recursive: true });
const checks = [];
const check = (name, ok, detail = "") => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); };
const permissions = [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, amend: 1 }];

// Once a session has loaded the desk, core wants its CSRF token on every write.
let headers = {};
async function send(request, method, path, data) {
	const options = { headers };
	if (data !== undefined) options.data = data;
	return request[method](`${base}${path}`, options);
}
async function must(request, method, path, data) {
	const response = await send(request, method, path, data);
	if (!response.ok()) throw new Error(`${method} ${path}: ${response.status()} ${(await response.text()).slice(0, 300)}`);
	return (await response.json()).data ?? (await response.json());
}
async function ensure(request, doctype, name, doc) {
	const found = await send(request, "get", `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
	if (!found.ok()) await must(request, "post", `/api/resource/${encodeURIComponent(doctype)}`, { doctype, ...doc });
}

async function fixtures(request) {
	for (const name of ["Ins Action Test", "Ins Action Flow"]) {
		await ensure(request, "DocType", name, { name, module: "Custom", custom: 1, is_submittable: 1, autoname: "hash",
			fields: [{ fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1 }], permissions });
	}
	for (const state of ["Ins Pending", "Ins Approved", "Ins Rejected"]) {
		await ensure(request, "Workflow State", state, { workflow_state_name: state });
	}
	for (const action of ["Ins Approve", "Ins Reject"]) {
		await ensure(request, "Workflow Action Master", action, { workflow_action_name: action });
	}
	await ensure(request, "Workflow", "Ins Action Flow", {
		workflow_name: "Ins Action Flow", document_type: "Ins Action Flow", is_active: 1, workflow_state_field: "workflow_state",
		states: [
			{ state: "Ins Pending", doc_status: "0", allow_edit: "System Manager" },
			{ state: "Ins Approved", doc_status: "1", allow_edit: "System Manager" },
			{ state: "Ins Rejected", doc_status: "0", allow_edit: "System Manager" },
		],
		transitions: [
			{ state: "Ins Pending", action: "Ins Approve", next_state: "Ins Approved", allowed: "System Manager" },
			{ state: "Ins Pending", action: "Ins Reject", next_state: "Ins Rejected", allowed: "System Manager" },
		],
	});
}

const browser = await chromium.launch();
try {
	const adminContext = await browser.newContext();
	await must(adminContext.request, "post", "/api/method/login", { usr: "Administrator", pwd: "admin" });
	await fixtures(adminContext.request);
	for (const lang of ["en", "ar"]) {
		const tag = `[${lang}]`;
		const email = `act-${lang}@midad.test`;
		await ensure(adminContext.request, "User", email, { email, first_name: "Actions", language: lang, send_welcome_email: 0,
			new_password: "Ins-Acts-2026!", roles: [{ role: "System Manager" }] });
		const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: lang === "ar" ? "ar-SA" : "en-US" });
		await must(context.request, "post", "/api/method/login", { usr: email, pwd: "Ins-Acts-2026!" });
		const page = await context.newPage();
		await page.goto(`${base}/desk`, { waitUntil: "networkidle" });
		headers = { "X-Frappe-CSRF-Token": await page.evaluate(() => frappe.csrf_token) };
		const desk = (doctype, name) => `${base}/desk/${doctype.toLowerCase().replaceAll(" ", "-")}/${name}`;
		const tagged = (value) => page.locator(`.page-head [data-ins-action="${value}"]:visible, .page-head [data-ins-action="${value}"]`).count();
		const wrapperAttr = (name) => page.evaluate((n) => document.querySelector(".page-container:not([style*='display: none'])")?.getAttribute(n)
			?? [...document.querySelectorAll("[data-ins-docstatus]")].find((e) => e.offsetParent)?.getAttribute(n), name);

		// Submittable, no workflow: Submit, Cancel, Amend and Delete in their own states only.
		const created = await must(context.request, "post", "/api/resource/Ins%20Action%20Test", { title: `Action ${lang}` });
		await page.goto(desk("Ins Action Test", created.name), { waitUntil: "networkidle" });
		await page.waitForSelector(".page-head");
		await page.waitForTimeout(500);
		check(`${tag} docstatus 0 attribute`, (await wrapperAttr("data-ins-docstatus")) === "0");
		check(`${tag} Submit tagged in draft`, (await tagged("submit")) === 1);
		check(`${tag} Delete tagged in draft`, (await tagged("delete")) === 1);
		check(`${tag} Cancel and Amend not tagged in draft`, (await tagged("cancel")) === 0 && (await tagged("amend")) === 0);

		await must(context.request, "post", "/api/method/frappe.client.submit", { doc: created });
		await page.reload({ waitUntil: "networkidle" });
		await page.waitForTimeout(500);
		check(`${tag} docstatus 1 attribute`, (await wrapperAttr("data-ins-docstatus")) === "1");
		check(`${tag} Cancel tagged when submitted`, (await tagged("cancel")) === 1);
		check(`${tag} Submit and Delete not tagged when submitted`, (await tagged("submit")) === 0 && (await tagged("delete")) === 0);

		await must(context.request, "post", "/api/method/frappe.client.cancel", { doctype: "Ins Action Test", name: created.name });
		await page.reload({ waitUntil: "networkidle" });
		await page.waitForTimeout(800);
		check(`${tag} docstatus 2 attribute`, (await wrapperAttr("data-ins-docstatus")) === "2");
		check(`${tag} Amend tagged when cancelled`, (await tagged("amend")) === 1);
		check(`${tag} Cancel not tagged when cancelled`, (await tagged("cancel")) === 0);

		// Workflow: Approve and Reject in the Actions menu.
		const flow = await must(context.request, "post", "/api/resource/Ins%20Action%20Flow", { title: `Flow ${lang}` });
		await page.goto(desk("Ins Action Flow", flow.name), { waitUntil: "networkidle" });
		await page.waitForTimeout(800);
		check(`${tag} workflow Approve tagged`, (await tagged("approve")) === 1);
		check(`${tag} workflow Reject tagged`, (await tagged("reject")) === 1);

		// A new document is marked, and the attributes are the only change (no extra ribbon element in production).
		await page.goto(`${base}/desk/ins-action-test/new`, { waitUntil: "networkidle" });
		await page.waitForTimeout(500);
		check(`${tag} data-ins-new on a new form`, (await wrapperAttr("data-ins-new")) === "1");
		check(`${tag} no ribbon in production`, (await page.$(".ins-env-ribbon")) === null);
		await context.close();
	}
} finally {
	await browser.close();
}
writeFileSync(join(out, "actions.json"), JSON.stringify(checks, null, 2));
process.exit(checks.every((c) => c.ok) ? 0 : 1);
