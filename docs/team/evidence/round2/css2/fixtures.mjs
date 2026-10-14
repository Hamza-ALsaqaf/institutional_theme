import { admin } from "./lib.mjs";
const { browser, api } = await admin();
const r = await api.get("/api/resource/ToDo?limit_page_length=5&filters=" + encodeURIComponent('[["description","like","css2-proof%"]]'));
const have = (await r.json()).data.length;
for (let i = have; i < 6; i++) {
	const x = await api.post("/api/resource/ToDo", { data: { description: `css2-proof task ${i + 1}: review the quarterly summary`, priority: ["Low", "Medium", "High"][i % 3], status: i % 2 ? "Open" : "Closed", date: "2026-11-0" + (i + 1) } });
	console.log(x.status());
}
await browser.close();
