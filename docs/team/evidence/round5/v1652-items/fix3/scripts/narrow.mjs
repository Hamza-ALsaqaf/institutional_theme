// Round-5 a11y fix round 1 probes at 320 CSS px, device scale 4: subject ellipsis, row focus ring inside the clip, closed-sidebar tab order.
// usage: node narrow.mjs <16.32.0|16.52.0> <before|after>
import fs from "node:fs";
import { FULLY_VISIBLE } from "./visible.mjs";
import { chromium, BENCH, DESK, login, setUser, api } from "./lib.mjs";
const ver = process.argv[2], tag = process.argv[3] || "after";
// optional third argument: a SCSS file whose last @media block is injected as CSS (used while the shared dist must not be rebuilt)
const injectFile = process.argv[4];
const base = BENCH[ver], P = DESK[ver];
const dir = `/home/runner/work/institutional_theme/institutional_theme/docs/team/evidence/round5/v1652-items/fix3/${ver}-${tag}`;
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await b.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 4, locale: "en-US", hasTouch: false })).newPage();
await login(page, base);
await page.goto(base + P + "/todo"); await page.waitForTimeout(1500);
for (const d of ["Probe task with a deliberately long description that cannot fit in a narrow row at four hundred percent zoom", "مهمة تجريبية بوصف طويل جدا لا يتسع في الصف الضيق عند التكبير"]) {
	const ex = await api(page, "GET", `/api/resource/ToDo?filters=${encodeURIComponent(JSON.stringify({ description: d }))}`);
	if (!ex.json.data.length) await api(page, "POST", "/api/resource/ToDo", { description: d, status: "Open" });
}
const out = [];
if (injectFile) { const src = fs.readFileSync(injectFile, "utf8"); const css = src.slice(src.lastIndexOf("@media (max-width: 576px)")).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"); page.on("load", () => {}); globalThis.__css = css; }
const inject = async () => { if (globalThis.__css) await page.addStyleTag({ content: globalThis.__css }); };
const state = () => page.evaluate(() => {
	const a = document.activeElement; if (!a) return null;
	const cs = getComputedStyle(a), r = a.getBoundingClientRect();
	const c = document.querySelector(".result-container"), cr = c ? c.getBoundingClientRect() : null;
	let op = 1, el = a; while (el) { op *= parseFloat(getComputedStyle(el).opacity); el = el.parentElement; }
	return { tag: a.tagName.toLowerCase(), cls: String(a.className).slice(0, 40), name: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 25),
		visible: a.checkVisibility ? a.checkVisibility({ visibilityProperty: true, opacityProperty: true }) : null, effOpacity: op, visibility: cs.visibility,
		outline: `${cs.outlineStyle} ${cs.outlineWidth} off ${cs.outlineOffset}`, left: Math.round(r.left), right: Math.round(r.right),
		ringClip: cr && a.classList.contains("list-row-container") ? (r.left < cr.left - 0.5 || r.right > cr.right + 0.5) : null };
});
try {
	for (const lang of ["en", "ar"]) for (const mode of ["Light", "Dark"]) {
		await setUser(page, { desk_theme: mode, language: lang });
		const key = `${lang}-${mode.toLowerCase()}`;
		await page.goto(base + P + "/todo", { timeout: 90000 });
		await page.waitForSelector(".list-row", { timeout: 60000 }); await inject(); await page.waitForTimeout(2500);
		const dates = await page.evaluate((src) => { const vis = eval(src); return [...document.querySelectorAll(".list-row-container:not(:has(.list-row-head)) .list-row")].map((r) => { const d = [...r.querySelectorAll(".level-left .mobile-layout a")].filter((e) => /[0-9]{2}-[0-9]{2}-[0-9]{4}/.test(e.textContent))[0]; const rr = d && d.getClientRects()[0]; return { found: !!d, width: rr ? Math.round(rr.width) : 0, fullyVisible: d ? vis(d) : false }; }); }, FULLY_VISIBLE);
		const subj = await page.evaluate(() => [...document.querySelectorAll(".list-row-container:not(:has(.list-row-head)) .list-subject a")].map((a) => {
			const cs = getComputedStyle(a), r = a.getBoundingClientRect(), cr = document.querySelector(".result-container").getBoundingClientRect();
			const trunc = a.scrollWidth > a.clientWidth;
			return { text: a.textContent.trim().slice(0, 30), trunc, textOverflow: cs.textOverflow, overflow: cs.overflowX, inside: r.right <= cr.right + 0.5 && r.left >= cr.left - 0.5, ok: !trunc || cs.textOverflow === "ellipsis" };
		}));
		await page.screenshot({ path: `${dir}/${key}-todo.png` });
		// keyboard: first stops from the top of the page
		await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
		const tabs = [];
		for (let i = 0; i < 16; i++) { await page.keyboard.press("Tab"); await page.waitForTimeout(250); tabs.push(await state()); }
		const rows = tabs.filter((t) => t && t.cls.includes("list-row-container"));
		const firstInvisibleBeforeRow = (() => { const idx = tabs.findIndex((t) => t && t.cls.includes("list-row-container")); return tabs.slice(0, idx < 0 ? 16 : idx).filter((t) => t && t.visible === false).length; })();
		if (rows.length) await page.screenshot({ path: `${dir}/${key}-row-focus.png` });
		// sidebar: open from the navbar toggle and tab into it
		let opened = null;
		await page.evaluate(() => { document.activeElement && document.activeElement.blur(); });
		const toggled = await page.evaluate(() => { const t = document.querySelector(".sidebar-toggle-btn, .navbar-brand, .sidebar-toggle-icon, [data-original-title*='idebar'], .toggle-sidebar"); if (t) { t.click(); return t.className; } return null; });
		await page.waitForTimeout(800);
		opened = await page.evaluate(() => { const c = document.querySelector(".body-sidebar-container"); const first = c && c.querySelector(".body-sidebar a, .body-sidebar button"); return { expanded: !!c && c.classList.contains("expanded"), firstVisible: first ? first.checkVisibility({ visibilityProperty: true, opacityProperty: true }) : null, childVis: c ? [...c.querySelectorAll(".body-sidebar > *")].slice(0, 3).map((e) => getComputedStyle(e).visibility) : [] }; });
		if (opened.expanded) await page.screenshot({ path: `${dir}/${key}-sidebar-open.png` });
		out.push({ key, dates, subj, tabs, rowStops: rows.length, rowRingClip: rows.filter((r) => r.ringClip).length, invisibleStopsBeforeFirstRow: firstInvisibleBeforeRow, toggled, opened });
	}
} finally {
	await page.goto(base + P + "/todo").catch(() => {}); await page.waitForTimeout(800);
	console.log("restore", await setUser(page, { desk_theme: "Light", language: "en" }));
	await b.close();
}
fs.writeFileSync(`${dir}/probe.json`, JSON.stringify(out, null, 1));
for (const o of out) console.log(o.key, "dates visible:", o.dates.filter((d) => d.fullyVisible && d.width > 0).length + "/" + o.dates.length, "subjects bad:", o.subj.filter((s) => !s.ok).length + "/" + o.subj.length, "trunc:", o.subj.filter((s) => s.trunc).length, "rowStops", o.rowStops, "ringClip", o.rowRingClip, "invisibleBeforeFirstRow", o.invisibleStopsBeforeFirstRow, "first stop", o.tabs[0] && `${o.tabs[0].name}|visible=${o.tabs[0].visible}`, "open", JSON.stringify(o.opened));
