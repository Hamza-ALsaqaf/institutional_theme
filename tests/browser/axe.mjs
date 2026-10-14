// axe-core scan of the P0 desk screens and the login pages: Arabic and English, Light and Dark, with the theme
// ("themed") and with every /assets/institutional_theme/ request blocked ("core", the stock look). A violation
// that also occurs in "core" on the same target comes from core markup; one that does not is caused by the theme.
//
//   cd tests/browser && NODE_PATH=/opt/pw-node/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node axe.mjs [options]
//
//   --variant=themed|core|both   default both
//   --only=en-light,ar-dark      language-mode pairs, default all four
//   --screens=list,form          screen names, default all
//   --out=<dir>                  default docs/team/evidence/round3/axe
//   --summarize                  only rebuild summary.md and classified.json from the JSON files in --out
//
// Test users axe-<lang>-<mode>@midad.test are created (or updated) through the REST API as Administrator; the
// Administrator's own language and theme are never changed. Output per run: run-<variant>-<lang>-<mode>.json.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const req = createRequire(path.join(here, "package.json"));
const BASE = process.env.INS_BASE || "http://localhost:8000";
const PASSWORD = "Mdd#Test2026x";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const arg = (n, d = "") => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const OUT = path.resolve(arg("out", path.join(root, "docs/team/evidence/round3/axe")));
const variants = arg("variant", "both") === "both" ? ["themed", "core"] : [arg("variant")];
const pairs = (arg("only") ? arg("only").split(",") : ["en-light", "en-dark", "ar-light", "ar-dark"]);
const only = arg("screens") ? arg("screens").split(",") : null;
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- screens
const settle = (page, ms = 1200) => page.waitForTimeout(ms);
const desk = (name, route, wait, extra = {}) => ({ name, route, wait, ...extra });
const screens = [
	desk("desktop", "/desk", ".desktop-container, .layout-main, #body"),
	desk("workspace", "/desk/build", ".layout-main-section"),
	desk("workspace-cards", "/desk/invoicing", ".number-widget-box, .widget.chart-widget, .layout-main-section"),
	desk("list", "/desk/user", ".frappe-list .result, .list-row-container"),
	desk("list-selected", "/desk/user", ".list-row-container", {
		action: async (page) => {
			await page.locator(".list-row-container .list-row-checkbox").first().check({ force: true });
			await settle(page, 600);
		},
	}),
	desk("list-filter", "/desk/user", ".list-row-container", {
		action: async (page) => {
			await page.locator(".filter-selector .filter-button, .filter-button").first().click();
			await page.waitForSelector(".filter-popover.show, .filter-popover", { timeout: 10000 });
			await settle(page, 600);
		},
		include: ".filter-popover",
	}),
	desk("form", (u) => `/desk/user/${encodeURIComponent(u)}`, ".form-layout, .layout-main-section"),
	desk("form-new", "/desk/user/new", ".form-layout"),
	desk("form-invalid", "/desk/user/new", ".form-layout", {
		action: async (page) => {
			const input = page.locator('[data-fieldname="email"] input').first();
			await input.fill("not-an-email");
			await input.blur();
			await settle(page, 800);
		},
	}),
	desk("form-child-table", "/desk/notification/new", ".form-layout", {
		action: async (page) => {
			await page.evaluate(() => {
				if (cur_frm && cur_frm.fields_dict.recipients) cur_frm.add_child("recipients");
				cur_frm.refresh_field("recipients");
			});
			await settle(page, 800);
		},
	}),
	// The child-table row editor (`.form-in-grid`, grid_row_form.js) is a form of its own under a row; the screen above
	// only adds a row, so its controls were never scanned.
	desk("form-row-editor", "/desk/notification/new", ".form-layout", {
		action: async (page) => {
			await page.evaluate(() => {
				cur_frm.add_child("recipients");
				cur_frm.refresh_field("recipients");
			});
			await settle(page, 700);
			await page.locator(".form-grid .grid-row .btn-open-row").first().click();
			await page.waitForSelector(".form-in-grid .frappe-control input, .form-in-grid .frappe-control select", { timeout: 10000 });
			await settle(page, 1200);
		},
	}),
	desk("datepicker", "/desk/todo/new", ".form-layout", {
		action: async (page) => {
			await page.locator('[data-fieldname="date"] input').first().click();
			await page.waitForSelector(".datepicker.active", { timeout: 10000 });
			await settle(page, 500);
		},
		include: ".datepicker.active",
	}),
	desk("report-view", "/desk/user/view/report", ".datatable, .dt-scrollable"),
	desk("query-report", "/desk/query-report/General%20Ledger", ".page-form, .report-wrapper, .layout-main-section"),
	desk("search", "/desk/user", ".frappe-list", {
		action: async (page) => {
			await page.keyboard.press("Control+k");
			await page.waitForSelector("#navbar-search", { timeout: 10000 });
			await page.fill("#navbar-search", "user");
			await settle(page, 1200);
		},
		include: ".modal.show",
	}),
	desk("notifications", "/desk/user", ".frappe-list", {
		action: async (page) => {
			await page.evaluate(() => document.querySelector(".sidebar-notification")?.click());
			// v16.52.0 opens a `.sidebar-panel-notifications` panel, 16.32.0 a `.dropdown-notifications` dropdown.
			await page.waitForSelector(".dropdown-notifications:not(.hidden), .sidebar-panel-notifications:not(.hidden)", { timeout: 10000 }).catch(() => {});
			await settle(page, 1000);
		},
		include: ".dropdown-notifications, .sidebar-panel-notifications",
	}),
	desk("dialog", "/desk/user", ".frappe-list", {
		action: async (page) => {
			await page.evaluate(() => {
				new frappe.ui.Dialog({
					title: "Confirm",
					fields: [
						{ fieldtype: "Data", label: "Reference", fieldname: "ref", reqd: 1 },
						{ fieldtype: "Select", label: "Kind", fieldname: "kind", options: "A\nB" },
					],
					primary_action_label: "Submit",
					primary_action() {},
				}).show();
			});
			await page.waitForSelector(".modal.show", { timeout: 10000 });
			await settle(page, 700);
		},
		include: ".modal.show",
	}),
	desk("msgprint", "/desk/user", ".frappe-list", {
		action: async (page) => {
			await page.evaluate(() => frappe.msgprint({ title: "Notice", message: "Message box body text", indicator: "orange" }));
			await page.waitForSelector(".modal.show", { timeout: 10000 });
			await settle(page, 700);
		},
		include: ".modal.show",
	}),
	desk("toast", "/desk/user", ".frappe-list", {
		action: async (page) => {
			await page.evaluate(() => {
				frappe.show_alert({ message: "Saved", indicator: "green" }, 60);
				frappe.show_alert({ message: "Check this value", indicator: "orange" }, 60);
			});
			// v16.52.0 renders `.es-toast` inside `.es-toast-container`, 16.32.0 `.alert` inside `#alert-container`.
			await page.waitForSelector("#alert-container .alert, .es-toast-container .es-toast", { timeout: 10000 });
			await settle(page, 600);
		},
		include: "#alert-container, .es-toast-container",
	}),
	desk("freeze", "/desk/user", ".frappe-list", {
		action: async (page) => {
			await page.evaluate(() => frappe.dom.freeze("Working"));
			await page.waitForSelector("#freeze", { timeout: 10000 });
			await settle(page, 600);
		},
		include: "#freeze",
	}),
	desk("appearance", "/desk/ins-appearance", ".ins-appearance"),
	// Login pages: logged out, always light (the website bundle has no dark tokens).
	{ name: "login", guest: true, route: "/login", wait: "#login_email" },
	{ name: "forgot-password", guest: true, route: "/login#forgot", wait: ".for-forgot:visible, .form-forgot:visible, #forgot_email" },
	{ name: "error-404", guest: true, route: "/this-page-does-not-exist-axe", wait: "body" },
];

// ---------------------------------------------------------------- helpers
// For a colour-contrast node that axe could not decide (gradient, overlap, obscured), measure it: hide every glyph, take
// a screenshot of the element's box, and compare the text colour (alpha composited over each pixel) with every pixel
// that is painted behind it. Reports the worst and the 5th-percentile ratio over the box, WCAG 2.x relative luminance.
async function measureContrast(page, target) {
	if (target.includes(" >> ")) return { error: "frame or shadow target" };
	const info = await page.evaluate((sel) => {
		const el = document.querySelector(sel);
		if (!el) return null;
		el.scrollIntoView({ block: "center", inline: "nearest" });
		const cs = getComputedStyle(el);
		const r = el.getBoundingClientRect();
		return { color: cs.color, rect: { x: r.x, y: r.y, width: r.width, height: r.height }, text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40) };
	}, target);
	if (!info) return { error: "element not found" };
	const clip = { x: Math.max(0, info.rect.x), y: Math.max(0, info.rect.y), width: Math.min(info.rect.width, 600), height: Math.min(info.rect.height, 120) };
	if (clip.width < 1 || clip.height < 1) return { error: "empty box", text: info.text };
	// Transitions are switched off for the whole measurement: a colour that fades back after the glyphs are restored would read as transparent.
	if (!(await page.evaluate(() => !!document.getElementById("axe-measure-still")))) {
		const still = await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
		await still.evaluate((e) => (e.id = "axe-measure-still"));
	}
	const hide = await page.addStyleTag({ content: "*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}" });
	let png;
	try { png = await page.screenshot({ clip, animations: "disabled" }); } finally { await hide.evaluate((e) => e.remove()); }
	const out = await page.evaluate(async ({ b64, color }) => {
		const img = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
		const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext("2d"); g.drawImage(img, 0, 0);
		const px = g.getImageData(0, 0, img.width, img.height).data;
		const m = color.match(/[\d.]+/g).map(Number); const fa = m.length > 3 ? m[3] : 1;
		const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
		const lum = (r, g2, b) => 0.2126 * lin(r) + 0.7152 * lin(g2) + 0.0722 * lin(b);
		const ratios = [];
		for (let i = 0; i < px.length; i += 4) {
			const bgl = [px[i], px[i + 1], px[i + 2]];
			const f = [0, 1, 2].map((k) => m[k] * fa + bgl[k] * (1 - fa));
			const L1 = lum(...f), L2 = lum(...bgl);
			ratios.push((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05));
		}
		ratios.sort((a, b) => a - b);
		const distinct = new Set(); for (let i = 0; i < px.length; i += 4) distinct.add(px[i] + "," + px[i + 1] + "," + px[i + 2]);
		return { n: ratios.length, min: +ratios[0].toFixed(2), p5: +ratios[Math.floor(ratios.length * 0.05)].toFixed(2), median: +ratios[Math.floor(ratios.length / 2)].toFixed(2), distinctBackgroundColours: distinct.size, fg: color };
	}, { b64: png.toString("base64"), color: info.color });
	return { ...out, text: info.text };
}

const { chromium } = req("playwright-core");
const AxeBuilder = req("@axe-core/playwright").default || req("@axe-core/playwright").AxeBuilder;
const userOf = (lang, mode) => `axe-${lang}-${mode}@midad.test`;

async function ensureUsers(browser) {
	const ctx = await browser.newContext({ locale: "en-US" });
	const page = await ctx.newPage();
	await page.goto(`${BASE}/login`);
	await page.fill("#login_email", "Administrator");
	await page.fill("#login_password", "admin");
	await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.press("#login_password", "Enter")]);
	await page.waitForFunction(() => window.frappe && frappe.csrf_token && frappe.csrf_token !== "{{ csrf_token }}", null, { timeout: 30000 });
	const log = await page.evaluate(async ({ users, password }) => {
		const out = [];
		const h = { "Content-Type": "application/json", "X-Frappe-CSRF-Token": frappe.csrf_token };
		for (const u of users) {
			const got = await fetch(`/api/resource/User/${encodeURIComponent(u.email)}`, { headers: h });
			const body = { language: u.language, desk_theme: u.desk_theme, enabled: 1 };
			if (got.status === 200) {
				const r = await fetch(`/api/resource/User/${encodeURIComponent(u.email)}`, { method: "PUT", headers: h, body: JSON.stringify({ ...body, new_password: password }) });
				out.push(`${u.email} updated ${r.status}`);
			} else {
				const r = await fetch("/api/resource/User", {
					method: "POST", headers: h,
					body: JSON.stringify({ ...body, email: u.email, first_name: "Axe", last_name: u.tag, send_welcome_email: 0, new_password: password, roles: [{ role: "System Manager" }] }),
				});
				out.push(`${u.email} created ${r.status}`);
			}
		}
		return out;
	}, { users: pairs.map((p) => { const [lang, mode] = p.split("-"); return { email: userOf(lang, mode), tag: p, language: lang, desk_theme: mode === "dark" ? "Dark" : "Light" }; }), password: PASSWORD });
	console.log(log.join("\n"));
	await ctx.close();
}

const trim = (s, n) => (s ? String(s).replace(/\s+/g, " ").slice(0, n) : s);
function shape(r) {
	return {
		violations: r.violations.map((v) => ({
			id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
			nodes: v.nodes.map((n) => {
				const c = [...(n.any || []), ...(n.all || []), ...(n.none || [])].find((x) => x.id === "color-contrast");
				return {
					target: n.target.join(" >> "), html: trim(n.html, 220), summary: trim(n.failureSummary, 320),
					contrast: c && c.data ? { fg: c.data.fgColor, bg: c.data.bgColor, ratio: c.data.contrastRatio, expected: c.data.expectedContrastRatio, fontSize: c.data.fontSize, fontWeight: c.data.fontWeight } : undefined,
				};
			}),
		})),
		incomplete: Object.fromEntries(r.incomplete.map((v) => [v.id, v.nodes.length])),
		incompleteNodes: Object.fromEntries(r.incomplete.map((v) => [v.id, v.nodes.map((n) => {
			const check = [...(n.any || []), ...(n.all || []), ...(n.none || [])][0];
			const d = (check && check.data) || {};
			return { target: n.target.join(" >> "), html: trim(n.html, 200), key: d.messageKey || undefined, message: trim(check && check.message, 200), axeContrast: d.contrastRatio, fg: d.fgColor, bg: d.bgColor, fontSize: d.fontSize, fontWeight: d.fontWeight };
		})])),
		passes: r.passes.length,
	};
}

async function runOne(browser, variant, lang, mode) {
	const file = path.join(OUT, `run-${variant}-${lang}-${mode}.json`);
	const result = { variant, lang, mode, base: BASE, axe: req("axe-core/package.json").version, tags: TAGS, started: new Date().toISOString(), screens: {} };
	let currentScreen = "(login)";
	const mk = async (guest) => {
		const ctx = await browser.newContext({
			viewport: { width: 1280, height: 800 }, locale: lang === "ar" ? "ar-SA" : "en-US", reducedMotion: "reduce",
			extraHTTPHeaders: { "Accept-Language": lang === "ar" ? "ar" : "en" },
		});
		if (variant === "core") await ctx.route("**/assets/institutional_theme/**", (r) => r.abort());
		const page = await ctx.newPage();
		page.on("pageerror", (e) => (result.pageErrorDetails ||= []).push({ screen: currentScreen, message: trim(e.message, 160), name: e.name, stack: trim(e.stack, 400) }));
		page.on("pageerror", (e) => (result.pageErrors ||= []).push(trim(e.message, 160)));
		if (!guest) {
			await page.goto(`${BASE}/login`);
			await page.fill("#login_email", userOf(lang, mode));
			await page.fill("#login_password", PASSWORD);
			await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.press("#login_password", "Enter")]);
		}
		return { ctx, page };
	};
	let { ctx: gctx, page: gpage } = await mk(false);
	let guestSession = null;
	for (const s of screens) {
		if (only && !only.includes(s.name)) continue;
		if (s.guest && mode === "dark") continue; // the website pages are always light
		currentScreen = s.name;
		let page = gpage;
		if (s.guest) { guestSession ||= await mk(true); page = guestSession.page; }
		try {
			await page.goto(BASE + (typeof s.route === "function" ? s.route(userOf(lang, mode)) : s.route));
			await page.waitForSelector(s.wait, { timeout: 30000, state: "attached" });
			await settle(page, 1500);
			if (s.action) await s.action(page);
			const meta = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme || null, dir: document.documentElement.dir, lang: document.documentElement.lang, url: location.pathname + location.hash, forgotDisplay: document.querySelector(".for-forgot") ? getComputedStyle(document.querySelector(".for-forgot")).display : null, insStyles: [...document.styleSheets].filter((x) => (x.href || "").includes("institutional_theme")).map((x) => x.href.split("/").pop()) }));
			let b = new AxeBuilder({ page }).withTags(TAGS);
			if (s.include) b = b.include(s.include);
			const res = shape(await b.analyze());
			if (arg("measure") !== "no") {
				for (const n of (res.incompleteNodes["color-contrast"] || [])) {
					try { n.measured = await measureContrast(page, n.target); } catch (e) { n.measured = { error: trim(e.message.split("\n")[0], 120) }; }
				}
			}
			result.screens[s.name] = { meta, ...res };
			const n = result.screens[s.name].violations.reduce((a, v) => a + v.nodes.length, 0);
			console.log(`${variant} ${lang}-${mode} ${s.name}: ${result.screens[s.name].violations.length} rules, ${n} nodes (theme=${meta.theme}, dir=${meta.dir}, ins sheets=${meta.insStyles.length})`);
		} catch (e) {
			result.screens[s.name] = { error: trim(e.message.split("\n")[0], 200) };
			console.log(`FAIL ${variant} ${lang}-${mode} ${s.name}: ${result.screens[s.name].error}`);
		}
	}
	await gctx.close();
	if (guestSession) await guestSession.ctx.close();
	result.finished = new Date().toISOString();
	fs.writeFileSync(file, JSON.stringify(result, null, 1));
}

// ---------------------------------------------------------------- incomplete results
// axe reports what it could not decide as "incomplete". Each node is listed with the reason axe gives (`key`), whether the
// same node is also incomplete with the theme blocked, and, for colour contrast, the measured ratio (measureContrast).
function incompleteSection(runs, norm) {
	const nodes = [];
	for (const r of runs) for (const [sn, s] of Object.entries(r.screens)) for (const [rule, list] of Object.entries(s.incompleteNodes || {})) for (const n of list) nodes.push({ variant: r.variant, lang: r.lang, mode: r.mode, screen: sn, rule, ...n });
	if (!nodes.length) return "";
	const k = (x) => [x.lang, x.mode, x.screen, x.rule, norm(x.target)].join("\u0001");
	const coreSet = new Set(nodes.filter((x) => x.variant === "core").map(k));
	const themed = nodes.filter((x) => x.variant === "themed").map((x) => ({ ...x, alsoInCore: coreSet.size ? coreSet.has(k(x)) : null }));
	const px = (f) => { const m = /\((\d+(?:\.\d+)?)px\)/.exec(f || ""); return m ? Number(m[1]) : 16; };
	const required = (x) => (px(x.fontSize) >= 24 || (px(x.fontSize) >= 18.66 && Number(x.fontWeight) >= 700) ? 3 : 4.5);
	for (const x of themed) if (x.rule === "color-contrast") {
		x.required = required(x);
		const m = x.measured;
		x.verdict = !m ? "not measured" : m.error ? `not measurable (${m.error})` : m.min >= x.required ? "passes at every pixel" : m.p5 >= x.required ? "passes except under 5% of pixels" : "FAILS";
	}
	fs.writeFileSync(path.join(OUT, "incomplete.json"), JSON.stringify(themed, null, 1));
	const tally = (list, f) => { const m = new Map(); for (const x of list) m.set(f(x), (m.get(f(x)) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
	let md = `\n## Incomplete results (themed runs): ${themed.length} nodes\n\n| rule | nodes | also incomplete with the theme blocked | reasons (axe messageKey) |\n|---|---|---|---|\n`;
	for (const [rule, n] of tally(themed, (x) => x.rule)) {
		const list = themed.filter((x) => x.rule === rule);
		const also = coreSet.size ? list.filter((x) => x.alsoInCore).length : "n/a";
		md += `| ${rule} | ${n} | ${also} | ${tally(list, (x) => x.key || "-").map(([a, b]) => `${a}: ${b}`).join(", ")} |\n`;
	}
	const cc = themed.filter((x) => x.rule === "color-contrast");
	if (cc.length && cc.some((x) => x.measured)) {
		md += `\n### Colour-contrast incompletes, measured (${cc.length} nodes)\n\n| verdict | nodes |\n|---|---|\n${tally(cc, (x) => x.verdict).map(([a, b]) => `| ${a} | ${b} |`).join("\n")}\n\n| lang-mode | screen | reason | text | colour | required | measured min / p5 / median | verdict | selector |\n|---|---|---|---|---|---|---|---|---|\n`;
		md += cc.map((x) => `| ${x.lang}-${x.mode} | ${x.screen} | ${x.key || "-"} | ${(x.measured && x.measured.text || "").replace(/\|/g, "/")} | ${x.measured && x.measured.fg || x.fg || "-"} | ${x.required} | ${x.measured && x.measured.min !== undefined ? `${x.measured.min} / ${x.measured.p5} / ${x.measured.median}` : "-"} | ${x.verdict} | \`${norm(x.target).replace(/\|/g, "\\|")}\` |`).join("\n") + "\n";
	}
	return md;
}

// ---------------------------------------------------------------- summary
function summarize() {
	const runs = fs.readdirSync(OUT).filter((f) => /^run-(themed|core)-.*\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")));
	// Data-dependent attribute values (user names, timestamps, record ids) differ between runs: compare without them.
	const norm = (t) => t.replace(/\[(data-name|data-timestamp|data-id|data-doctype|title|href\$|href\^|aria-label)=("[^"]*"|'[^']*')\]/g, "[$1]").replace(/\[data-(name|id)\]/g, "[data-$1]");
	const key = (lang, mode, screen, rule, target) => [lang, mode, screen, rule, norm(target)].join("\u0001");
	const core = new Map();
	for (const r of runs.filter((x) => x.variant === "core")) for (const [sn, s] of Object.entries(r.screens)) for (const v of s.violations || []) for (const n of v.nodes) core.set(key(r.lang, r.mode, sn, v.id, n.target), n);
	const coreRule = new Set([...core.keys()].map((k) => k.split("\u0001").filter((_, i) => i !== 4).join("\u0001")));
	const themedKeys = new Set();
	for (const r of runs.filter((x) => x.variant === "themed")) for (const [sn, s] of Object.entries(r.screens)) for (const v of s.violations || []) for (const n of v.nodes) themedKeys.add(key(r.lang, r.mode, sn, v.id, n.target));
	const fixed = [...core.entries()].filter(([k]) => !themedKeys.has(k)).map(([k, n]) => { const [lang, mode, screen, rule] = k.split("\u0001"); return { lang, mode, screen, rule, target: n.target, contrast: n.contrast }; });
	const rows = [];
	for (const r of runs.filter((x) => x.variant === "themed")) for (const [sn, s] of Object.entries(r.screens)) for (const v of s.violations || []) for (const n of v.nodes) {
		const c = core.get(key(r.lang, r.mode, sn, v.id, n.target));
		let cls = "theme";
		if (c) cls = "core";
		else if (coreRule.has(key(r.lang, r.mode, sn, v.id, ""))) cls = "core-rule-other-target";
		rows.push({ lang: r.lang, mode: r.mode, screen: sn, rule: v.id, impact: v.impact, help: v.help, target: n.target, html: n.html, contrast: n.contrast, core: c ? { contrast: c.contrast } : undefined, cls, worse: !!(c && c.contrast && n.contrast && n.contrast.ratio < c.contrast.ratio - 0.05) });
	}
	const coverage = runs.map((r) => ({ variant: r.variant, lang: r.lang, mode: r.mode, screens: Object.keys(r.screens).length, errors: Object.entries(r.screens).filter(([, s]) => s.error).map(([n, s]) => `${n}: ${s.error}`) }));
	fs.writeFileSync(path.join(OUT, "classified.json"), JSON.stringify({ rows, fixedByTheme: fixed, coverage }, null, 1));
	const group = (list) => {
		const m = new Map();
		for (const x of list) {
			const g = m.get(x.rule) || { rule: x.rule, impact: x.impact, count: 0, screens: new Set(), modes: new Set(), sample: x.target };
			g.count++; g.screens.add(x.screen); g.modes.add(`${x.lang}-${x.mode}`); m.set(x.rule, g);
		}
		return [...m.values()].sort((a, b) => b.count - a.count);
	};
	const table = (list) => ["| rule | impact | nodes | screens | lang-mode | sample selector |", "|---|---|---|---|---|---|", ...group(list).map((g) => `| ${g.rule} | ${g.impact} | ${g.count} | ${[...g.screens].join(", ")} | ${[...g.modes].join(", ")} | \`${g.sample.replace(/\|/g, "\\|")}\` |`)].join("\n");
	const themeRows = rows.filter((x) => x.cls === "theme"), coreRows = rows.filter((x) => x.cls !== "theme");
	let md = `# axe-core summary (generated by tests/browser/axe.mjs --summarize)\n\nWCAG tags ${TAGS.join(", ")}; axe-core ${runs[0]?.axe}. A node is "core" when the same rule fires on the same selector, screen, language and mode with every /assets/institutional_theme/ request blocked; otherwise "theme".\n\n`;
	md += `## Coverage\n\n| variant | lang-mode | screens scanned | errors |\n|---|---|---|---|\n${coverage.map((c) => `| ${c.variant} | ${c.lang}-${c.mode} | ${c.screens} | ${c.errors.join("; ") || "none"} |`).join("\n")}\n\n`;
	const worse = coreRows.filter((x) => x.worse);
	md += `## Present in both, theme colours worse than core (contrast ratio lower by more than 0.05): ${worse.length} nodes\n\n${worse.length ? table(worse) : "none"}\n\n## Present only with the theme blocked (the theme removes them): ${fixed.length} nodes\n\n${fixed.length ? table(fixed.map((x) => ({ ...x, impact: "-" }))) : "none"}\n\n`;
	md += `## All violations (themed runs): ${rows.length} nodes\n\n${table(rows)}\n\n## Caused by the theme: ${themeRows.length} nodes\n\n${table(themeRows)}\n\n## Core markup (also present with the theme blocked): ${coreRows.length} nodes\n\n${table(coreRows)}\n`;
	// Colour contrast detail for the css-engineer: one row per foreground/background pair and mode (themed runs).
	const cc = new Map();
	for (const x of rows.filter((r) => r.rule === "color-contrast" && r.contrast)) {
		const k = [x.mode, x.contrast.fg, x.contrast.bg, x.contrast.ratio, x.contrast.expected, x.contrast.fontSize].join(" | ");
		const g = cc.get(k) || { k, n: 0, langs: new Set(), screens: new Set(), sel: new Set(), cls: new Set(), core: new Set() };
		g.n++; g.langs.add(x.lang); g.screens.add(x.screen); g.cls.add(x.cls); if (g.sel.size < 3) g.sel.add(norm(x.target));
		if (x.core && x.core.contrast) g.core.add(`${x.core.contrast.fg} on ${x.core.contrast.bg} = ${x.core.contrast.ratio}`);
		cc.set(k, g);
	}
	md += `\n## Colour contrast detail, themed runs (mode | foreground | background | ratio | required | font size)\n\n| pair | nodes | langs | screens | class | same node in core | sample selectors |\n|---|---|---|---|---|---|---|\n`;
	md += [...cc.values()].sort((a, b) => b.n - a.n).map((g) => `| ${g.k} | ${g.n} | ${[...g.langs].join(",")} | ${[...g.screens].join(", ")} | ${[...g.cls].join(",")} | ${[...g.core].slice(0, 2).join("; ") || "-"} | ${[...g.sel].map((t) => `\`${t.replace(/\|/g, "\\|")}\``).join("<br>")} |`).join("\n") + "\n";
	md += incompleteSection(runs, norm);
	fs.writeFileSync(path.join(OUT, "summary.md"), md);
	console.log(`summary: ${rows.length} nodes, theme ${themeRows.length}, core ${coreRows.length}`);
}

if (process.argv.includes("--summarize")) summarize();
else {
	const browser = await chromium.launch({ args: ["--no-sandbox"] });
	await ensureUsers(browser);
	for (const variant of variants) for (const p of pairs) { const [lang, mode] = p.split("-"); await runOne(browser, variant, lang, mode); }
	await browser.close();
	summarize();
}
