// Item 3: Noto and Tajawal pairings in the desk, ar and en. Sets the site pairing as Administrator
// (REST, the settings doctype) and restores the original value at the end.
import { launch, adminRequest, ensureUsers, userContext, recorder, shots, BASE } from "./lib.mjs";
import { join } from "node:path";

const rec = recorder("a3_fonts");
const DOC = "Institutional%20Theme%20Settings";
const browser = await launch();
let admin, original;
try {
	admin = await adminRequest(browser);
	await ensureUsers(admin);
	const current = await (await admin.request.get(`${BASE}/api/resource/${DOC}/${DOC}`)).json();
	original = current.data.font_pairing;
	rec.out.data.originalPairing = original;
	const setPairing = async (value) => {
		const res = await admin.request.put(`${BASE}/api/resource/${DOC}/${DOC}`, { data: { font_pairing: value } });
		if (!res.ok()) throw new Error("save pairing " + value + " " + res.status() + " " + (await res.text()).slice(0, 300));
	};
	const expectations = {
		Noto: { link: "ins_fonts_noto", arabic: "Midad Noto Sans Arabic", latin: "Midad Noto Sans" },
		Tajawal: { link: "ins_fonts_tajawal", arabic: "Midad Tajawal", latin: "Midad Tajawal Latin" },
	};
	for (const pairing of ["Noto", "Tajawal"]) {
		await setPairing(pairing);
		for (const lang of ["en", "ar"]) {
			const ctx = await userContext(browser, lang, { theme: "Light" });
			const page = await ctx.newPage();
			await page.goto(`${BASE}/desk/ins-appearance`, { waitUntil: "networkidle" });
			await page.waitForSelector(".ins-appearance fieldset");
			const info = await page.evaluate(async () => {
				const ask = (family, sample) => document.fonts.check(`16px "${family}"`, sample);
				await document.fonts.ready;
				const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href"));
				const faces = [...document.fonts].map((f) => `${f.family}|${f.weight}|${f.status}`);
				const h1 = document.querySelector(".ins-appearance h1");
				return {
					lang: document.documentElement.lang, dir: document.documentElement.dir,
					links: links.filter((h) => /ins_(fonts|desk|palette)/.test(h)),
					bodyFont: getComputedStyle(document.body).fontFamily,
					h1Font: h1 ? getComputedStyle(h1).fontFamily : null,
					varSans: getComputedStyle(document.documentElement).getPropertyValue("--ins-font-sans").trim(),
					loaded: faces.filter((f) => f.endsWith("|loaded")),
					declared: faces.length,
				};
			});
			const want = expectations[pairing];
			const key = `${pairing}-${lang}`;
			rec.out.data[key] = info;
			rec.check(`${key}: font bundle link present`, info.links.some((h) => h.includes(want.link)), info.links.join(" "));
			rec.check(`${key}: only the selected pairing is linked`,
				info.links.filter((h) => /ins_fonts_/.test(h)).length === 1);
			rec.check(`${key}: computed font-family starts with the private family`,
				info.bodyFont.startsWith(`"${want.arabic}"`) || info.bodyFont.startsWith(`"${want.latin}"`), info.bodyFont);
			const family = lang === "ar" ? want.arabic : want.latin;
			rec.check(`${key}: ${family} loaded in document.fonts`, info.loaded.some((f) => f.startsWith(family + "|")), info.loaded.join("; "));
			await page.screenshot({ path: join(shots, `a3-${pairing.toLowerCase()}-${lang}.png`) });
			await ctx.close();
		}
	}
} finally {
	if (admin && original) {
		const res = await admin.request.put(`${BASE}/api/resource/${DOC}/${DOC}`, { data: { font_pairing: original } });
		rec.out.data.restoredStatus = res.status();
		const after = await (await admin.request.get(`${BASE}/api/resource/${DOC}/${DOC}`)).json();
		rec.out.data.pairingAfterRestore = after.data.font_pairing;
		console.log("restored pairing:", after.data.font_pairing);
	}
	rec.save();
	await browser.close();
}
