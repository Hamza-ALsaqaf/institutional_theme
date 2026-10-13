// Calendar block events: screenshots and computed contrast of chip text on chip background, 4 combos.
import { combos, launch, ready } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return ((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const out = [];
for (const c of combos) {
	const { browser, page } = await launch(c);
	await ready(page, "/desk/event/view/calendar/default");
	await page.waitForSelector(".fc-event", { timeout: 20000 }).catch(() => console.log("no event"));
	await page.waitForTimeout(800);
	const r = await page.evaluate(() => [...document.querySelectorAll(".fc-event")].slice(0, 6).map((e) => {
		const m = e.querySelector(".fc-event-main") || e; const cs = getComputedStyle(e), ms = getComputedStyle(m);
		return { cls: e.className, text: e.textContent.trim().slice(0, 30), bg: cs.backgroundColor, fg: ms.color, inline: e.getAttribute("style"), borderStyle: cs.borderInlineStartStyle, borderW: cs.borderInlineStartWidth, borderC: cs.borderInlineStartColor, dataTheme: document.documentElement.dataset.theme };
	}));
	r.forEach((x) => { x.contrast = cr(x.fg, x.bg); });
	out.push({ ...c, events: r });
	await page.screenshot({ path: `${c.lang}-${c.mode}-calendar.png` });
	await browser.close();
}
writeFileSync("calendar-computed.json", JSON.stringify(out, null, 1));
for (const o of out) console.log(o.lang, o.mode, o.events.map((e) => `${e.cls.includes("dot") ? "dot" : "blk"} ${e.contrast} ${e.bg}/${e.fg} ${e.borderStyle} ${e.borderW}`).join(" | "));
