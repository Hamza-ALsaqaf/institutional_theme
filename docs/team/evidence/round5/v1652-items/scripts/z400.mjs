// 400% zoom stand-in: 320 CSS px wide at device scale factor 4. List rows: is every status badge inside the clipping container?
// usage: node z400.mjs <version> <tag>
import fs from "node:fs";
import { chromium, BENCH, DESK, OUT, login, setUser } from "./lib.mjs";
const ver = process.argv[2];
const tag = process.argv[3] || "after";
const base = BENCH[ver];
const P = DESK[ver];
const dir = `${OUT}/shots/z400-${ver}-${tag}`;
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 4, locale: "en-US" });
const page = await ctx.newPage();
await login(page, base);
await page.goto(base + P + "/todo");
await page.waitForTimeout(1500);
const rows = [];
try {
	for (const lang of ["en", "ar"]) for (const mode of ["Light", "Dark"]) {
		await setUser(page, { desk_theme: mode, language: lang });
		for (const [name, route] of [["todo", "/todo"], ["slip", "/ins-probe-slip"]]) {
			await page.goto(base + P + route);
			await page.waitForSelector(".list-row", { timeout: 40000 });
			await page.waitForTimeout(2500);
			const m = await page.evaluate(() => {
				const c = document.querySelector(".result-container");
				const cr = c.getBoundingClientRect();
				const cs = getComputedStyle(c);
				const badges = [...document.querySelectorAll(".list-row-container .list-row:not(.list-row-head) .indicator-pill, .list-row-container .list-row:not(.list-row-head) .es-badge")].filter((e) => e.offsetParent).map((e) => {
					const r = e.getBoundingClientRect();
					return { text: e.textContent.trim().slice(0, 14), left: Math.round(r.left), right: Math.round(r.right), clipped: r.right > cr.right + 1 || r.left < cr.left - 1 };
				});
				return { overflowX: cs.overflowX, scrollWidth: c.scrollWidth, clientWidth: c.clientWidth, cLeft: Math.round(cr.left), cRight: Math.round(cr.right), pageOverflow: document.documentElement.scrollWidth - innerWidth, badges };
			});
			rows.push({ lang, mode, name, ...m });
			if (lang === "en" || mode === "Light") await page.screenshot({ path: `${dir}/${lang}-${mode.toLowerCase()}-${name}.png` });
		}
	}
} finally {
	await page.goto(base + P + "/todo").catch(() => {});
	await page.waitForTimeout(800);
	console.log("restore", await setUser(page, { desk_theme: "Light", language: "en" }));
	await b.close();
}
fs.writeFileSync(`${dir}/probe.json`, JSON.stringify(rows, null, 1));
for (const r of rows) console.log(r.lang, r.mode, r.name, r.overflowX, `${r.scrollWidth}/${r.clientWidth}`, "page", r.pageOverflow, "clipped:", r.badges.filter((x) => x.clipped).length + "/" + r.badges.length);
