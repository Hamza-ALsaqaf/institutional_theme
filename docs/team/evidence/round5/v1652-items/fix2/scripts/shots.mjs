// Fix round 2: side panel (Draft, Submitted, Cancelled) after the observer rewrite, Kanban dot, and the neutral embedded list; en/ar, Light/Dark. Same script as ../../scripts/shots.mjs, output in fix2/.
// usage: node shots.mjs <16.32.0|16.52.0> [before|after]
import fs from "node:fs";
import { chromium, BENCH, DESK, OUT, login, setUser } from "./lib.mjs";
const ver = process.argv[2];
const tag = process.argv[3] || "after";
const base = BENCH[ver];
const P = DESK[ver];
const dir = `${OUT}/fix2/${ver}-${tag}`;
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 800 }, locale: "en-US" })).newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 160)));
page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 160)); });
await login(page, base);
await page.goto(base + P + "/todo");
await page.waitForTimeout(1500);
const probe = [];
const style = (sel) => page.evaluate((sel) => {
	return [...document.querySelectorAll(sel)].slice(0, 6).map((e) => {
		const c = getComputedStyle(e);
		const q = getComputedStyle(e, "::before");
		const svg = e.querySelector("svg");
		return {
			text: e.textContent.trim().slice(0, 20), theme: e.dataset.theme || null, filter: e.dataset.filter || e.dataset.insFilter || null,
			bg: c.backgroundColor, color: c.color, border: c.borderColor, w: Math.round(e.getBoundingClientRect().width),
			before: { w: q.width, h: q.height, content: q.content, bg: q.backgroundImage.slice(0, 40) + "|" + q.backgroundColor, radius: q.borderRadius, borderTop: q.borderTopWidth },
			svg: svg ? getComputedStyle(svg).display : null,
		};
	});
}, sel);
try {
	for (const lang of ["en", "ar"]) for (const mode of ["Light", "Dark"]) {
		await setUser(page, { desk_theme: mode, language: lang });
		const key = `${lang}-${mode.toLowerCase()}`;
		// Kanban v1
		await page.goto(base + P + "/todo/view/kanban/Ins%20Probe%20Board");
		await page.waitForSelector(".kanban-column-title", { state: "attached", timeout: 40000 }).catch(async (e) => { await page.screenshot({ path: "/tmp/fail.png" }); console.log(page.url()); throw e; });
		await page.waitForTimeout(2500);
		await page.screenshot({ path: `${dir}/${key}-kanban.png`, clip: { x: 0, y: 0, width: 1280, height: 420 } });
		const dots = ver === "16.32.0" ? ".kanban-column-title .kanban-col-dot" : ".kanban-column-title > .es-badge";
		probe.push({ key, screen: "kanban", dots: await style(dots) });
		if (ver !== "16.32.0") {
			await page.goto(base + P + "/todo/view/kanban/Ins%20Probe%20Board%20V2");
			await page.waitForTimeout(6000);
			await page.screenshot({ path: `${dir}/${key}-kanban-v2.png`, clip: { x: 0, y: 0, width: 1280, height: 420 } });
			probe.push({ key, screen: "kanban-v2", badges: await style(".kanban-column .es-badge, .kanban-column-header .es-badge") });
		}
		// Side panel (16.52.0 only) and list
		await page.goto(base + P + "/ins-probe-slip");
		await page.waitForSelector(".list-row", { timeout: 30000 });
		await page.waitForTimeout(2000);
		const listSel = ver === "16.32.0" ? ".list-row .indicator-pill" : ".list-row .es-badge";
		probe.push({ key, screen: "list", badges: await style(listSel) });
		if (ver !== "16.32.0") {
			for (const [name, st] of [["1", "draft"], ["2", "submitted"], ["3", "cancelled"]]) {
				await page.evaluate(async (n) => { await frappe.require("side_panel.bundle.js"); frappe.ui.get_side_panel().open("Ins Probe Slip", n); }, name);
				await page.waitForSelector(".side-panel-indicator .es-badge", { timeout: 20000 });
				await page.waitForTimeout(1200);
				await page.screenshot({ path: `${dir}/${key}-sidepanel-${st}.png` });
				probe.push({ key, screen: "side-" + st, badges: await style(".side-panel-indicator .es-badge") });
			}
		} else {
			await page.screenshot({ path: `${dir}/${key}-list.png` });
		}
	}
} finally {
	await page.goto(base + P + "/todo").catch(() => {});
	await page.waitForTimeout(1000);
	console.log("restore", await setUser(page, { desk_theme: "Light", language: "en" }));
	await b.close();
}
fs.writeFileSync(`${dir}/probe.json`, JSON.stringify(probe, null, 1));
console.log("done", probe.length);
