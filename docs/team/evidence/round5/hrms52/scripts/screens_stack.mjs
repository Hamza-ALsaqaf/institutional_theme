// HRMS desk pages under the theme: screenshots plus computed-style checks, Light/Dark x ar/en x comfortable/compact.
// Frappe 16.52 renders status pills as .es-badge (16.32.0: .indicator-pill); both are checked.
// Checks per page: text contrast, light surfaces in Dark, indicator-pill legibility, sidebar side (RTL mirroring), horizontal overflow.
// Usage: NODE_PATH=/opt/pw-node/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node hrms_screens.mjs [--out DIR] [--base URL] [--only ar-dark]
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const base = arg("--base", "http://localhost:8000");
const out = resolve(arg("--out", join(here, "../../docs/team/evidence/round3/hrms-screens")));
const only = arg("--only", "");
const PWD = "Ins-Hrms-2026!";
mkdirSync(join(out, "shots"), { recursive: true });

const post = async (request, path, data, form) => {
	const r = await request.post(`${base}${path}`, form ? { form } : { data });
	if (!r.ok()) throw new Error(`${path}: ${r.status()} ${(await r.text()).slice(0, 300)}`);
	return r;
};
const first = async (request, doctype) => {
	const r = await request.get(`${base}/api/resource/${encodeURIComponent(doctype)}?limit_page_length=1&fields=["name"]&order_by=creation asc`);
	const rows = r.ok() ? (await r.json()).data : [];
	return rows.length ? rows[0].name : null;
};

// The in-page audit. Returns plain JSON.
const audit = () => {
	const parse = (c) => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : [0, 0, 0, 0]; };
	const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
	const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
	const over = (top, bottom) => { const a = top[3] ?? 1; return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)); };
	const bgOf = (el) => { // composite ancestors' backgrounds, ignoring background images
		const chain = [];
		for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.length === 3) c.push(1); chain.push(c); if (c[3] === 1) break; }
		let acc = [255, 255, 255]; for (const c of chain.reverse()) acc = over(c, acc); return acc;
	};
	const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 1 && r.height > 1 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0.05; };
	const sel = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + [...el.classList].slice(0, 3).map((c) => "." + c).join("");
	const lowContrast = [];
	const seen = new Set();
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
	let checked = 0;
	for (let t = walker.nextNode(); t; t = walker.nextNode()) {
		if (!t.textContent.trim()) continue;
		const el = t.parentElement; if (!el || seen.has(el) || !visible(el) || el.closest("svg, script, style, .hidden, [hidden]")) continue;
		seen.add(el);
		const s = getComputedStyle(el);
		const fg = parse(s.color); const a = fg[3] ?? 1;
		const bg = bgOf(el);
		const fgc = a < 1 ? over(fg, bg) : fg.slice(0, 3);
		const r = ratio(fgc, bg); checked++;
		const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && +s.fontWeight >= 700);
		if (r < (large ? 3 : 4.5) && !el.closest("[disabled], .disabled, .text-muted-ignore")) lowContrast.push({ chain: [el.parentElement, el.parentElement?.parentElement, el.closest("[data-fieldname]")].filter(Boolean).map(sel), disabled: !!el.closest("select, input, [disabled]")?.disabled, sel: sel(el), text: t.textContent.trim().slice(0, 30), ratio: +r.toFixed(2), fg: s.color, bg: `rgb(${bg.map(Math.round)})` });
	}
	const theme = document.documentElement.getAttribute("data-theme");
	const lightSurfaces = [];
	if (theme === "dark") for (const el of document.querySelectorAll("body *")) {
		if (!visible(el)) continue;
		const r = el.getBoundingClientRect(); if (r.width * r.height < 900) continue;
		const c = parse(getComputedStyle(el).backgroundColor); if ((c[3] ?? 1) < 0.5) continue;
		if (lum(c) > 0.8) lightSurfaces.push({ sel: sel(el), bg: getComputedStyle(el).backgroundColor, w: Math.round(r.width), h: Math.round(r.height) });
	}
	const pills = [...document.querySelectorAll(".indicator-pill, .indicator, .es-badge")].filter(visible).slice(0, 40).map((el) => {
		const s = getComputedStyle(el); const bg = bgOf(el); const fg = parse(s.color).slice(0, 3);
		return { sel: sel(el), text: el.textContent.trim().slice(0, 24), ratio: +ratio(fg, bg).toFixed(2), bg: `rgb(${bg.map(Math.round)})`, fg: s.color };
	});
	const side = document.querySelector(".body-sidebar-container .body-sidebar, .body-sidebar, .layout-side-section");
	const sideRect = side && visible(side) ? side.getBoundingClientRect() : null;
	const de = document.documentElement;
	const hrmsNodes = {};
	for (const q of [".node-card", ".node-group", ".node-card.collapsed", ".circular-progress", ".feedback-summary-section .ratings-pill", ".node-card.active", ".node-card.active .btn-edit-node", ".node-card.active-path", ".hierarchy-edge, #arrows path, .hierarchy svg path"]) {
		const el = document.querySelector(q); if (el) { const cs = getComputedStyle(el); hrmsNodes[q] = { bg: cs.backgroundColor, color: cs.color, border: cs.borderBlockEndColor, stroke: cs.stroke }; }
	}
	return { hrmsNodes,
		dir: de.dir, theme, bodyBg: getComputedStyle(document.body).backgroundColor,
		overflowX: de.scrollWidth - de.clientWidth,
		sidebarSide: sideRect ? (sideRect.left + sideRect.width / 2 < innerWidth / 2 ? "left" : "right") : "none",
		textChecked: checked, lowContrast: lowContrast.slice(0, 15), lowContrastCount: lowContrast.length,
		lightSurfaces: lightSurfaces.slice(0, 15), lightSurfaceCount: lightSurfaces.length,
		pills,
		pillFails: pills.filter((p) => p.ratio < 4.5).length,
	};
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const results = [];
try {
	const admin = await browser.newContext();
	await post(admin.request, "/api/method/login", null, { usr: "Administrator", pwd: "admin" });
	const records = {
		employee: await first(admin.request, "Employee"), leave: await first(admin.request, "Leave Application"),
		slip: await first(admin.request, "Salary Slip"), appraisal: await first(admin.request, "Appraisal"),
	};
	const enc = encodeURIComponent;
	const pages = [
		["employee-list", "/app/employee"], ["employee-form", records.employee && `/app/employee/${enc(records.employee)}`],
		["leave-list", "/app/leave-application"], ["leave-form", records.leave && `/app/leave-application/${enc(records.leave)}`],
		["slip-list", "/app/salary-slip"], ["slip-form", records.slip && `/app/salary-slip/${enc(records.slip)}`],
		["workspace-leaves", "/app/leaves"], ["workspace-payroll", "/app/payroll"],
		["org-chart", "/app/organizational-chart"],
	].filter(([, url]) => url);
	for (const lang of ["ar", "en"]) for (const mode of ["Light", "Dark"]) {
		const combo = `${lang}-${mode.toLowerCase()}`; if (only && only !== combo) continue;
		const email = `hrms-${combo}@midad.test`;
		const exists = await admin.request.get(`${base}/api/resource/User/${encodeURIComponent(email)}`);
		if (!exists.ok()) await post(admin.request, "/api/resource/User", { email, first_name: "Hrms", language: lang, send_welcome_email: 0,
			new_password: PWD, roles: ["System Manager", "HR Manager", "HR User", "Leave Approver", "Employee"].map((role) => ({ role })) });
		const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: lang === "ar" ? "ar" : "en-US" });
		await post(ctx.request, "/api/method/login", null, { usr: email, pwd: PWD });
		await post(ctx.request, "/api/method/frappe.core.doctype.user.user.switch_theme", null, { theme: mode });
		const page = await ctx.newPage();
		const errors = []; let cur = "start"; page.on("pageerror", (e) => errors.push(cur + " :: " + String(e).slice(0, 100) + " @ " + (e.stack || "").split("\n").slice(1, 4).map((s) => s.trim().replace(/https?:\/\/[^/]+/, "")).join(" | ")));
		for (const [name, url] of pages) { cur = name;
			await page.goto(`${base}${url}`, { waitUntil: "networkidle" }).catch(() => {});
			await page.waitForTimeout(1200);
			// HRMS 16.20.1 get_leave_details fails on PostgreSQL (GROUP BY error) and opens a "server error" dialog. It is kept as evidence
			// for the dialog's own styling, then closed so the form behind it is audited.
			if (await page.locator(".modal.show").count()) {
				const data = await page.evaluate(audit);
				await page.screenshot({ path: join(out, `shots/${name}-dialog-${combo}.png`) });
				results.push({ page: `${name}-server-error-dialog`, url, combo, density: "comfortable", shot: `shots/${name}-dialog-${combo}.png`, ...data });
				await page.keyboard.press("Escape"); await page.waitForTimeout(500);
				if (await page.locator(".modal.show").count()) await page.locator(".modal.show .btn-modal-close").first().click().catch(() => {});
				await page.waitForTimeout(500);
			}
			for (const density of ["comfortable", "compact"]) {
				await page.evaluate((d) => document.documentElement.setAttribute("data-ins-density", d), density);
				await page.waitForTimeout(250);
				const data = await page.evaluate(audit);
				const shot = `shots/${name}-${combo}-${density}.png`;
				await page.screenshot({ path: join(out, shot) });
				results.push({ page: name, url, combo, density, shot, title: await page.title(), ...data });
			}
		}
		// Org chart: selected node and the narrow (mobile) layout, the states where HRMS's own rules paint (hierarchy_chart.scss).
		await page.setViewportSize({ width: 1366, height: 768 });
		await page.goto(`${base}/app/organizational-chart`, { waitUntil: "networkidle" }).catch(() => {});
		await page.waitForTimeout(1200);
		await page.locator(".node-card").first().click().catch(() => {});
		await page.waitForTimeout(800);
		for (const [name, vw] of [["org-chart-selected", 1366], ["org-chart-narrow", 390]]) {
			if (vw !== 1366) { await page.setViewportSize({ width: vw, height: 800 }); await page.goto(`${base}/app/organizational-chart`, { waitUntil: "networkidle" }).catch(() => {}); await page.waitForTimeout(1500); }
			const data = await page.evaluate(audit);
			await page.screenshot({ path: join(out, `shots/${name}-${combo}.png`) });
			results.push({ page: name, url: "/app/organizational-chart", combo, density: "comfortable", shot: `shots/${name}-${combo}.png`, ...data });
		}
		if (errors.length) results.push({ page: "(page errors)", combo, errors });
		await ctx.close();
	}
} finally { await browser.close(); }
writeFileSync(join(out, "hrms_screens.json"), JSON.stringify(results, null, 2));
for (const r of results) if (r.page) console.log(`${r.combo} ${r.density} ${r.page}: dir=${r.dir} overflow=${r.overflowX} side=${r.sidebarSide} lowContrast=${r.lowContrastCount}/${r.textChecked} lightSurf=${r.lightSurfaceCount} pillFail=${r.pillFails}/${r.pills?.length}`);
