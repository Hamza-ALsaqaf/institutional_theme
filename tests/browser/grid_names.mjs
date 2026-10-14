// Accessible names of child-table checkboxes (shell/grid_names.js), English and Arabic, on a real Journal Entry form.
// For each language: a baseline page with the theme's shell bundle blocked (core as shipped), then the themed page
// after load, after Add Row, after deleting a row, and after inserting a row above (which renumbers rows).
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node grid_names.mjs [--base URL] [--out DIR]
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const base = arg("--base", "http://localhost:8000");
const out = resolve(arg("--out", "docs/team/evidence/round3/grid-names"));
mkdirSync(out, { recursive: true });
const checks = [];
const log = [];
const check = (name, ok, detail = "") => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); };
const expected = {
	en: { all: "Select all rows", row: (n) => `Select row ${n}` },
	ar: { all: "تحديد جميع الصفوف", row: (n) => `تحديد الصف ${n}` },
};

let headers = {};
async function must(request, method, path, data) {
	const options = { headers };
	if (data !== undefined) options.data = data;
	const response = await request[method](`${base}${path}`, options);
	if (!response.ok()) throw new Error(`${method} ${path}: ${response.status()} ${(await response.text()).slice(0, 300)}`);
	return response;
}

// Names as the browser computes them: aria-label of every grid checkbox, in DOM order, header first.
const names = (page) => page.evaluate(() => [...document.querySelectorAll("[data-fieldname='accounts'] .form-grid .grid-row-check")].map((c) => ({
	header: !!c.closest(".grid-heading-row"),
	idx: c.closest(".grid-row").getAttribute("data-idx"),
	label: c.getAttribute("aria-label"),
})));
const settle = (page) => page.waitForTimeout(400);

async function openForm(browser, lang, blockShell) {
	const email = `grid-${lang}@midad.test`;
	const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: lang === "ar" ? "ar-SA" : "en-US" });
	if (blockShell) await context.route(/ins_shell\.bundle\./, (route) => route.abort());
	await must(context.request, "post", "/api/method/login", { usr: email, pwd: "Ins-Grid-2026!" });
	const page = await context.newPage();
	await page.goto(`${base}/desk/journal-entry/new`, { waitUntil: "networkidle" });
	await page.waitForFunction(() => window.cur_frm && cur_frm.doc && cur_frm.doc.doctype === "Journal Entry"
		&& (cur_frm.doc.accounts || []).length >= 1 && document.querySelectorAll("[data-fieldname='accounts'] .form-grid .grid-body .grid-row[data-idx]").length >= 1,
	null, { timeout: 90000 });
	await settle(page);
	return { context, page };
}

const browser = await chromium.launch();
try {
	const admin = await browser.newContext();
	await must(admin.request, "post", "/api/method/login", { usr: "Administrator", pwd: "admin" });
	const bootstrap = await admin.newPage();
	await bootstrap.goto(`${base}/desk`, { waitUntil: "networkidle" });
	headers = { "X-Frappe-CSRF-Token": await bootstrap.evaluate(() => frappe.csrf_token) };
	for (const lang of ["en", "ar"]) {
		const email = `grid-${lang}@midad.test`;
		const found = await admin.request.get(`${base}/api/resource/User/${encodeURIComponent(email)}`, { headers });
		if (!found.ok()) {
			await must(admin.request, "post", "/api/resource/User", { doctype: "User", email, first_name: "Grid", language: lang, send_welcome_email: 0,
				new_password: "Ins-Grid-2026!", roles: [{ role: "System Manager" }, { role: "Accounts Manager" }, { role: "Accounts User" }] });
		}
	}

	for (const lang of ["en", "ar"]) {
		const tag = `[${lang}]`;
		const want = expected[lang];

		// Baseline: core without the shell bundle.
		{
			const { context, page } = await openForm(browser, lang, true);
			const before = await names(page);
			check(`${tag} baseline has grid checkboxes`, before.length >= 2, `${before.length} found`);
			check(`${tag} baseline: core gives them no name`, before.every((c) => c.label === null));
			const snap = await page.locator("[data-fieldname='accounts'] .form-grid").first().ariaSnapshot();
			writeFileSync(join(out, `${lang}-0-core-baseline.aria.yml`), snap + "\n");
			await context.close();
		}

		const { context, page } = await openForm(browser, lang, false);
		const grid = page.locator("[data-fieldname='accounts'] .form-grid").first();
		const assertNames = async (step) => {
			await settle(page);
			const now = await names(page);
			const header = now.filter((c) => c.header);
			const rows = now.filter((c) => !c.header);
			check(`${tag} ${step}: header named`, header.length === 1 && header[0].label === want.all, JSON.stringify(header));
			check(`${tag} ${step}: every row named by its number`, rows.length > 0 && rows.length === new Set(rows.map((c) => c.idx)).size && rows.every((c) => c.label === want.row(c.idx)),
				JSON.stringify(rows.map((c) => [c.idx, c.label])));
			check(`${tag} ${step}: row numbers are 1..n`, rows.every((c, i) => c.idx === String(i + 1)), rows.map((c) => c.idx).join(","));
			writeFileSync(join(out, `${lang}-${step.split(" ")[0]}.aria.yml`), (await grid.ariaSnapshot()) + "\n");
			return rows.length;
		};

		const initial = await assertNames("1-load");
		check(`${tag} new Journal Entry starts with one row`, initial === 1, `${initial}`);

		await page.locator("[data-fieldname='accounts'] .grid-add-row").first().click();
		const afterAdd = await assertNames("2-add-row");
		check(`${tag} Add Row adds one row`, afterAdd === initial + 1, `${initial} -> ${afterAdd}`);

		await page.locator("[data-fieldname='accounts'] .grid-add-row").first().click();
		await assertNames("3-add-row-again");

		// Delete the first row: tick its checkbox, press Delete.
		await page.locator("[data-fieldname='accounts'] .form-grid .grid-body .grid-row[data-idx='1'] .grid-row-check").check();
		await page.locator("[data-fieldname='accounts'] .grid-remove-rows").first().click();
		const afterDelete = await assertNames("4-delete-row");
		check(`${tag} deleting one row leaves one fewer`, afterDelete === afterAdd, `${afterAdd + 1} -> ${afterDelete}`);

		// Insert above the first row: every following row is renumbered.
		await page.locator("[data-fieldname='accounts'] .form-grid .grid-body .grid-row[data-idx='1'] .btn-open-row").first().click();
		await page.locator("[data-fieldname='accounts'] .grid-insert-row:visible").first().click();
		await page.waitForTimeout(600);
		await page.locator("[data-fieldname='accounts'] .grid-collapse-row:visible").first().click();
		await page.waitForTimeout(600);
		await assertNames("5-insert-above");

		// Drag the first row below the last: another renumbering path (SortableJS).
		const handle = page.locator("[data-fieldname='accounts'] .form-grid .grid-body .grid-row[data-idx='1'] .row-index").first();
		const target = page.locator("[data-fieldname='accounts'] .form-grid .grid-body .grid-row").last();
		const before = await page.locator("[data-fieldname='accounts'] .form-grid .grid-body .grid-row").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-name")));
		// Raw mouse events: in Arabic the onboarding widget overlaps the grid and would fail Playwright's hit test.
		const from = await handle.boundingBox();
		const to = await target.boundingBox();
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
		await page.mouse.down();
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 10, { steps: 5 });
		await page.mouse.move(to.x + to.width / 2, to.y + to.height - 4, { steps: 15 });
		await page.mouse.up();
		await page.waitForTimeout(600);
		const after = await page.locator("[data-fieldname='accounts'] .form-grid .grid-body .grid-row").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-name")));
		const moved = JSON.stringify(before) !== JSON.stringify(after);
		log.push(`${lang} drag changed order: ${moved}`);
		check(`${tag} drag reorder ran (order changed)`, moved, moved ? "" : "order unchanged, drag not exercised");
		await assertNames("6-reorder");

		await grid.screenshot({ path: join(out, `${lang}-grid.png`) });
		await context.close();
	}
} finally {
	await browser.close();
}
writeFileSync(join(out, "grid_names.json"), JSON.stringify(checks, null, 2));
process.exit(checks.every((c) => c.ok) ? 0 : 1);
