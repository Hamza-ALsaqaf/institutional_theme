import { combos, PW, BASE } from "./lib.mjs";
import { chromium } from "/opt/pw-node/node_modules/playwright-core/index.mjs";
const browser = await chromium.launch();
for (const c of combos) {
	const ctx = await browser.newContext({ baseURL: BASE });
	await ctx.request.post("/api/method/login", { form: { usr: c.user, pwd: PW } });
	const r = await ctx.request.get("/api/resource/ToDo?limit_page_length=20&fields=[\"name\"]");
	const have = (await r.json()).data?.length ?? 0;
	for (let i = have; i < 6; i++) {
		const x = await ctx.request.post("/api/resource/ToDo", { data: { description: `Review the quarterly summary, part ${i + 1}`, priority: ["Low", "Medium", "High"][i % 3], status: i % 2 ? "Open" : "Closed", date: "2026-11-0" + (i + 1) } });
		if (!x.ok()) console.log(c.user, x.status(), (await x.text()).slice(0, 200));
	}
	console.log(c.user, have);
}
await browser.close();
