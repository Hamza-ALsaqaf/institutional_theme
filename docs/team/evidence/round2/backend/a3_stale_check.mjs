import { launch, adminRequest, userContext, BASE } from "/home/runner/work/institutional_theme/institutional_theme/docs/team/evidence/round2/backend/lib.mjs";
const DOC = "Institutional%20Theme%20Settings";
const browser = await launch();
const admin = await adminRequest(browser);
const ctx = await userContext(browser, "en", { theme: "Light" });
const link = async () => { const t = await (await ctx.request.get(`${BASE}/desk/ins-appearance`)).text(); return ([...t.matchAll(/<link[^>]+href="([^"]*ins_fonts_[^"]*)"/g)].map((m) => m[1].split("/").pop().split(".")[0])).join(",") || "none"; };
let bad = 0, n = 0;
for (let i = 0; i < 12; i++) {
	for (const want of ["Noto", "Tajawal", "IBM Plex"]) {
		await admin.request.put(`${BASE}/api/resource/${DOC}/${DOC}`, { data: { font_pairing: want } });
		const exp = want === "Noto" ? "ins_fonts_noto" : want === "Tajawal" ? "ins_fonts_tajawal" : "none";
		const got = [await link(), await link(), await link()];
		n++;
		if (got.some((g) => g !== exp)) { bad++; console.log("STALE", want, got); }
	}
}
console.log({ n, bad });
await browser.close();
