// Accessible-name attributes written by shell/a11y_names.js, checked on the live desk in English and Arabic
// (Light): attribute values, the accessibility tree (Playwright ariaSnapshot) and the cost of the observer.
// Users axe-<lang>-light@midad.test come from axe.mjs.
//
//   cd tests/browser && PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH=/opt/pw-node/node_modules node a11y_attrs.mjs [--out DIR]
//
// Output: results.md (PASS/FAIL per check), <lang>-<screen>.aria.yml snapshots, timing.json.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(path.join(here, "package.json"));
const { chromium } = req("playwright-core");
const BASE = process.env.INS_BASE || "http://localhost:8000";
const PASSWORD = "Mdd#Test2026x";
const argv = process.argv.slice(2);
const OUT = path.resolve(argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : path.join(here, "../../docs/team/evidence/round3/a11y-attrs"));
fs.mkdirSync(OUT, { recursive: true });

const T = {
	en: { menu: "Menu", close: "Close", home: "Home", all: "Select all rows", row: (n) => `Select row ${n}`, pick: (t) => `Select ${t}`, field: "Field", cond: "Condition", value: "Value",
		collapse: (n) => `Collapse ${n}`, expand: (n) => `Expand ${n}`, top: "Scroll to top", assign: "Assign", attach: "Add Attachment", share: "Share", tags: "Add Tags", match: "Match type", minimize: "Minimize", desc: "Description" },
	ar: { menu: "الخيارات", close: "أغلق", home: "الصفحة الرئيسية", all: "تحديد جميع الصفوف", row: (n) => `تحديد الصف ${n}`, pick: (t) => `حدد ${t}`, field: "حقل", cond: "الشرط", value: "القيمة",
		collapse: (n) => `طيّ ${n}`, expand: (n) => `توسيع ${n}`, top: "العودة إلى الأعلى", assign: "عين", attach: "إضافة مرفق", share: "مشاركة", tags: "إضافة وسوم", match: "نوع المطابقة", minimize: "تصغير", desc: "وصف" },
};

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail: String(detail).slice(0, 240) }); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${ok ? "" : detail}`); };
const settle = (page, ms = 900) => page.waitForTimeout(ms);
const attr = (page, selector, name, nth = 0) => page.evaluate(({ selector, name, nth }) => { const e = document.querySelectorAll(selector)[nth]; return e ? e.getAttribute(name) : undefined; }, { selector, name, nth });
const count = (page, selector) => page.evaluate((s) => document.querySelectorAll(s).length, selector);
const labels = (page, selector, name = "aria-label") => page.evaluate(({ selector, name }) => [...document.querySelectorAll(selector)].map((e) => e.getAttribute(name)), { selector, name });

async function login(browser, lang, blockShell = false) {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: lang === "ar" ? "ar-SA" : "en-US", extraHTTPHeaders: { "Accept-Language": lang }, reducedMotion: "reduce" });
	if (blockShell) await ctx.route(/ins_shell\.bundle\./, (r) => r.abort());
	const page = await ctx.newPage();
	page.on("console", (m) => { if (/Institutional Theme/.test(m.text())) check(`console warning from the theme: ${m.text().slice(0, 100)}`, false); });
	await page.goto(`${BASE}/login`);
	await page.fill("#login_email", `axe-${lang}-light@midad.test`);
	await page.fill("#login_password", PASSWORD);
	await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.click(".btn-login")]);
	return { ctx, page };
}

async function open(page, route, wait) {
	await page.goto(BASE + route);
	await page.waitForSelector(wait, { timeout: 30000, state: "attached" });
	await settle(page, 2200);
}

async function snap(page, lang, screen, selector) {
	try {
		const text = await page.locator(selector).first().ariaSnapshot();
		fs.writeFileSync(path.join(OUT, `${lang}-${screen}.aria.yml`), text + "\n");
		return text;
	} catch (e) {
		check(`[${lang}] aria snapshot ${screen}`, false, e.message.split("\n")[0]);
		return "";
	}
}

async function run(browser, lang) {
	const t = T[lang];
	const tag = `[${lang}]`;
	const { ctx, page } = await login(browser, lang);
	const user = `axe-${lang}-light@midad.test`;

	// ---- list view
	await open(page, "/desk/user", ".list-row-container .list-row-checkbox");
	const rows = await labels(page, ".list-row-checkbox");
	const names = await labels(page, ".list-row-checkbox", "data-name");
	const full = await page.evaluate(() => [...document.querySelectorAll(".list-row-checkbox")].map((c) => { const a = c.closest(".list-subject").querySelector("a[data-name]"); return a.getAttribute("title") || a.textContent.trim(); }));
	check(`${tag} list: every row checkbox is named`, rows.length > 0 && rows.every(Boolean), JSON.stringify(rows));
	check(`${tag} list: name is "Select" + row title + document name`, rows.every((r, i) => r === t.pick(full[i] === names[i] ? names[i] : `${full[i]} (${names[i]})`)), JSON.stringify(rows.slice(0, 3)));
	check(`${tag} list: row names are unique`, new Set(rows).size === rows.length, "");
	check(`${tag} list: select-all keeps core's title and gets no aria-label`, (await attr(page, ".list-check-all", "aria-label")) === null && !!(await attr(page, ".list-check-all", "title")), "");
	check(`${tag} list: breadcrumb home link`, (await attr(page, ".navbar-breadcrumbs > li:first-child > a", "aria-label")) === t.home, await attr(page, ".navbar-breadcrumbs > li:first-child > a", "aria-label"));
	check(`${tag} list: sidebar logo is decorative`, (await attr(page, ".sidebar-header .header-logo > img", "alt")) === "", String(await attr(page, ".sidebar-header .header-logo > img", "alt")));
	check(`${tag} list: sidebar header button`, (await attr(page, ".sidebar-header > button.drop-icon", "aria-label")) === t.menu, "");
	const reload = await page.evaluate(() => { const b = document.querySelector(".page-icon-group .icon-btn"); return b && [b.getAttribute("aria-label"), b.getAttribute("data-original-title")]; });
	check(`${tag} list: reload button named from its tooltip`, reload && reload[0] && reload[0] === reload[1], JSON.stringify(reload));
	const toggles = await page.evaluate(() => [...document.querySelectorAll(".item-anchor > .sidebar-item-control > button.drop-icon")].map((b) => [b.getAttribute("aria-label"), b.closest(".item-anchor").querySelector(".sidebar-item-label").textContent.trim(), b.getAttribute("data-state")]));
	check(`${tag} list: sidebar section toggles named`, toggles.length > 0 && toggles.every(([l, n]) => l === t.collapse(n) || l === t.expand(n)), JSON.stringify(toggles.slice(0, 3)));
	await snap(page, lang, "list-rows", ".frappe-list .result");

	// filter popover
	await page.locator(".filter-selector .filter-button, .filter-button").first().click();
	await page.waitForSelector(".filter-popover .filter-box", { timeout: 10000 });
	await settle(page, 700);
	check(`${tag} filter: field input`, (await attr(page, ".filter-box .fieldname-select-area input", "aria-label")) === t.field, "");
	check(`${tag} filter: condition select`, (await attr(page, ".filter-box select.condition", "aria-label")) === t.cond, String(await attr(page, ".filter-box select.condition", "aria-label")));
	// choose the field the way a user does: type, then pick the first suggestion
	await page.locator(".filter-box .fieldname-select-area input").first().fill("enab");
	await settle(page, 600);
	await page.keyboard.press("ArrowDown");
	await page.keyboard.press("Enter");
	await settle(page, 900);
	const value = await page.evaluate(() => { const c = document.querySelector(".filter-box .filter-field input:not([type=hidden]), .filter-box .filter-field select"); return c && [c.tagName, c.getAttribute("aria-label")]; });
	check(`${tag} filter: value control named`, value && value[1] === t.value, JSON.stringify(value));
	await snap(page, lang, "filter-popover", ".filter-popover .filter-box");
	await page.keyboard.press("Escape");

	// ---- form with tabs
	await open(page, `/desk/user/${encodeURIComponent(user)}`, "#form-tabs");
	const roles = await labels(page, "#form-tabs > li", "role");
	check(`${tag} form: every tab item is role=presentation`, roles.length >= 3 && roles.every((r) => r === "presentation"), JSON.stringify(roles));
	check(`${tag} form: tab buttons keep role=tab`, (await count(page, "#form-tabs > li > button[role='tab']")) === roles.length, "");
	const nav = await labels(page, ".page-icon-group .prev-doc, .page-icon-group .next-doc");
	check(`${tag} form: previous/next named from tooltips`, nav.length === 2 && nav.every(Boolean), JSON.stringify(nav));
	const side = await page.evaluate(() => ({
		assign: document.querySelector(".add-assignment-btn")?.getAttribute("aria-label"),
		attach: document.querySelector(".add-attachment-btn")?.getAttribute("aria-label"),
		share: document.querySelector(".share-doc-btn")?.getAttribute("aria-label"),
		tags: document.querySelector(".add-tags-btn")?.getAttribute("aria-label"),
		top: document.querySelector(".scroll-to-top")?.getAttribute("aria-label"),
		edit: [...document.querySelectorAll(".form-sidebar button.icon-btn[data-original-title]")].map((b) => [b.getAttribute("aria-label"), b.getAttribute("data-original-title")]),
	}));
	check(`${tag} form: Assign / Add Attachment / Share / Add Tags / Scroll to top`, side.assign === t.assign && side.attach === t.attach && side.share === t.share && side.tags === t.tags && side.top === t.top, JSON.stringify(side));
	check(`${tag} form: sidebar tooltip buttons copy their tooltip`, side.edit.length > 0 && side.edit.every(([l, o]) => l && l === o), JSON.stringify(side.edit));
	await snap(page, lang, "form-tabs", ".form-tabs-list");
	await snap(page, lang, "form-sidebar", ".layout-side-section");

	// ---- report view (datatable)
	await open(page, "/desk/user/view/report", ".datatable .dt-scrollable");
	const head = await attr(page, ".dt-row-header input[type='checkbox']", "aria-label");
	check(`${tag} report: header checkbox`, head === t.all, String(head));
	const dtRows = await page.evaluate(() => [...document.querySelectorAll(".dt-row:not(.dt-row-header) .dt-cell input[type='checkbox']")].map((c) => [c.getAttribute("aria-label"), c.closest(".dt-cell").getAttribute("data-row-index")]));
	check(`${tag} report: row checkboxes numbered from data-row-index`, dtRows.length > 0 && dtRows.every(([l, i]) => l === t.row(Number(i) + 1)), JSON.stringify(dtRows.slice(0, 3)));
	await snap(page, lang, "report-view", ".datatable .dt-header");

	// virtual scrolling: DocType has hundreds of rows; labels must follow the recycled rows
	await open(page, "/desk/doctype/view/report", ".datatable .dt-scrollable");
	const scrolled = await page.evaluate(async () => {
		const sc = document.querySelector(".datatable .dt-scrollable");
		const read = () => [...document.querySelectorAll(".dt-row:not(.dt-row-header) .dt-cell input[type='checkbox']")].map((c) => [c.getAttribute("aria-label"), c.closest(".dt-cell").getAttribute("data-row-index")]);
		const wait = () => new Promise((r) => setTimeout(r, 700));
		const out = { before: read().length, steps: [] };
		for (const top of [1500, 4000, 800]) { sc.scrollTop = top; sc.dispatchEvent(new Event("scroll")); await wait(); out.steps.push({ top, rows: read() }); }
		return out;
	});
	const bad = scrolled.steps.flatMap((s) => s.rows.filter(([l, i]) => !l || !/\d+/.test(l) || !l.includes(String(Number(i) + 1))));
	check(`${tag} report: after scrolling, every visible row checkbox is named with its current row number`, scrolled.steps.every((s) => s.rows.length > 0) && bad.length === 0, JSON.stringify({ steps: scrolled.steps.map((s) => [s.top, s.rows.length, s.rows[0]]), bad: bad.slice(0, 3) }));

	// ---- dialog
	await open(page, "/desk/user", ".list-row-container");
	await page.evaluate(() => {
		new frappe.ui.Dialog({ title: "Confirm", fields: [
			{ fieldtype: "Data", label: "Reference", fieldname: "ref", reqd: 1 },
			{ fieldtype: "Select", label: "Kind", fieldname: "kind", options: "A\nB" },
		], primary_action_label: "Submit", primary_action() {} }).show();
	});
	await page.waitForSelector(".modal.show", { timeout: 10000 });
	await settle(page, 800);
	const dlg = await page.evaluate(() => ["ref", "kind"].map((f) => { const c = document.querySelector(`.modal.show [data-fieldname='${f}']`).querySelector("input,select"); const l = c.getAttribute("aria-labelledby"); return [f, l && document.getElementById(l)?.textContent.trim()]; }));
	check(`${tag} dialog: Data and Select controls labelled by their visible label`, dlg.every(([, text]) => text && text.length > 0), JSON.stringify(dlg));
	check(`${tag} dialog: close button`, (await attr(page, ".modal.show .btn-modal-close", "aria-label")) === t.close, "");
	await snap(page, lang, "dialog", ".modal.show .modal-content");
	// late insertion and the no-overwrite rule on a node added after load
	const late = await page.evaluate(async () => {
		const host = document.querySelector(".modal.show .modal-actions");
		const mk = (cls, label) => { const b = document.createElement("button"); b.className = cls; if (label) b.setAttribute("aria-label", label); b.innerHTML = '<svg class="icon"><use href="#icon-x"></use></svg>'; host.appendChild(b); return b; };
		const a = mk("scroll-to-top");
		const b = mk("scroll-to-top", "Custom name");
		const c = mk("unknown-class");
		// a dialog-style control that already carries its own name
		const wrap = document.createElement("div");
		wrap.className = "frappe-control";
		wrap.innerHTML = '<label class="control-label">Own</label><input class="form-control" aria-label="Set by an administrator"><label class="control-label">x</label>';
		document.querySelector(".modal.show .modal-body").appendChild(wrap);
		await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		const out = [a, b, c].map((x) => x.getAttribute("aria-label"));
		const input = wrap.querySelector("input");
		out.push(input.getAttribute("aria-label"), input.getAttribute("aria-labelledby"));
		[a, b, c, wrap].forEach((x) => x.remove());
		return out;
	});
	check(`${tag} late insertion: named, a name already set is kept (button and dialog control), unknown button left alone`, late[0] && late[1] === "Custom name" && late[2] === null && late[3] === "Set by an administrator" && late[4] === null, JSON.stringify(late));
	await page.keyboard.press("Escape");

	// ---- workspace: sidebar toggles, chart menu, onboarding panel, description button
	await open(page, "/desk/invoicing", ".layout-main-section");
	await settle(page, 2000);
	const toggle = page.locator(".item-anchor > .sidebar-item-control > button.drop-icon").first();
	if (await toggle.count()) {
		const before = await toggle.getAttribute("aria-label");
		const name = await toggle.evaluate((b) => b.closest(".item-anchor").querySelector(".sidebar-item-label").textContent.trim());
		await toggle.evaluate((b) => b.click());
		await settle(page, 600);
		const after = await toggle.getAttribute("aria-label");
		check(`${tag} workspace: toggle label follows the state`, before !== after && [t.collapse(name), t.expand(name)].includes(before) && [t.collapse(name), t.expand(name)].includes(after), `${before} -> ${after}`);
		await toggle.evaluate((b) => b.click());
		await settle(page, 400);
	} else check(`${tag} workspace: sidebar toggle present`, false, "none found");
	const ws = await page.evaluate(() => ({
		chart: [...document.querySelectorAll(".chart-menu")].map((b) => b.getAttribute("aria-label")),
		onb: [...document.querySelectorAll(".onb-header-actions > button")].map((b) => b.getAttribute("aria-label")),
	}));
	check(`${tag} workspace: chart menu button`, ws.chart.length > 0 && ws.chart.every((l) => l === t.menu), JSON.stringify(ws));
	if (ws.onb.length) check(`${tag} workspace: onboarding panel buttons`, ws.onb[0] === t.minimize && ws.onb[1] === t.close, JSON.stringify(ws.onb));
	await open(page, "/desk/build", ".layout-main-section");
	await settle(page, 1500);
	const desc = await labels(page, ".card-description-btn");
	if (desc.length) check(`${tag} workspace: description button`, desc.every((l) => l === t.desc), JSON.stringify(desc));
	const wsMenu = await page.evaluate(() => { const b = document.querySelector(".page-icon-group > button:not(.btn-default)"); return b && b.getAttribute("aria-label"); });
	check(`${tag} workspace: page menu (ellipsis) button`, wsMenu === t.menu, String(wsMenu));
	await snap(page, lang, "workspace-sidebar", ".body-sidebar");

	await ctx.close();
}

async function timing(browser) {
	const rows = [];
	for (const blocked of [true, false, true, false]) {
		const { ctx, page } = await login(browser, "en", blocked);
		await open(page, "/desk/user", ".list-row-container");
		const ms = await page.evaluate(async () => {
			const host = document.createElement("div");
			document.body.appendChild(host);
			const t0 = performance.now();
			let html = "";
			for (let i = 0; i < 1500; i++) html += `<div class="list-row"><div class="list-subject"><input class="list-row-checkbox" type="checkbox" data-name="r${i}"><a data-name="r${i}" title="Row ${i}">Row ${i}</a></div><button class="btn icon-btn" title="t${i}"><svg class="icon"></svg></button><span>cell</span><span>cell</span><span>cell</span></div>`;
			host.innerHTML = html;
			const t1 = performance.now();
			await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
			const t2 = performance.now();
			const named = host.querySelectorAll("[aria-label]").length;
			host.remove();
			return { insertMs: +(t1 - t0).toFixed(1), toSecondFrameMs: +(t2 - t0).toFixed(1), named };
		});
		rows.push({ shellBlocked: blocked, ...ms });
		await ctx.close();
	}
	return rows;
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
	for (const lang of ["en", "ar"]) await run(browser, lang);
	const t = await timing(browser);
	fs.writeFileSync(path.join(OUT, "timing.json"), JSON.stringify(t, null, 1) + "\n");
	console.log(JSON.stringify(t));
} finally {
	await browser.close();
}
const failed = results.filter((r) => !r.ok);
const md = `# a11y attribute checks (generated by tests/browser/a11y_attrs.mjs)\n\n${results.length} checks, ${failed.length} failed.\n\n| result | check | detail |\n|---|---|---|\n${results.map((r) => `| ${r.ok ? "PASS" : "FAIL"} | ${r.name.replace(/\|/g, "\\|")} | ${r.ok ? "" : r.detail.replace(/\|/g, "\\|")} |`).join("\n")}\n`;
fs.writeFileSync(path.join(OUT, "results.md"), md);
process.exit(failed.length ? 1 : 0);
