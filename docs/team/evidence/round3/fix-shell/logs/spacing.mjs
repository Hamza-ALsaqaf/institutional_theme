import { chromium, login, BASE } from "./lib.mjs";
const b = await chromium.launch({ args: ["--no-sandbox"] });
for (const [lang, variantBlock] of [["en", false], ["ar", false], ["en", true]]) {
	const { page } = await login(b, lang, variantBlock ? { block: "**/assets/institutional_theme/**" } : {});
	await page.goto(BASE + "/desk/user");
	await page.waitForSelector(".frappe-list", { timeout: 30000 });
	await page.waitForTimeout(2500);
	console.log(lang, variantBlock ? "core" : "themed", JSON.stringify(await page.evaluate(() => {
		const a = document.querySelector('a[href$="desk"]'); const r = a.getBoundingClientRect();
		const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
		const others = [...document.querySelectorAll("a[href], button, input, select, textarea, [tabindex]")].filter((e) => e !== a && e.offsetParent && !a.contains(e)).map((e) => { const q = e.getBoundingClientRect(); const dx = Math.max(q.left - cx, 0, cx - q.right), dy = Math.max(q.top - cy, 0, cy - q.bottom); return { d: Math.hypot(dx, dy), w: q.width, h: q.height, text: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 20), tag: e.tagName }; }).sort((x, y) => x.d - y.d).slice(0, 3);
		return { box: [Math.round(r.width), Math.round(r.height)], nearest: others, circleIntersects: others.some((o) => o.d < 12) };
	})));
}
await b.close();
