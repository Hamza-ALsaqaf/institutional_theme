import { chromium } from "/opt/pw-node/node_modules/playwright-core/index.mjs";
const BASE = "http://midad.test:8000";
const browser = await chromium.launch();
const out = {};
for (const lang of [process.argv[2]]) {
	const c = await browser.newContext({ baseURL: BASE, locale: "en-US", viewport: { width: 1280, height: 900 } });
	await c.request.post("/api/method/login", { form: { usr: "Administrator", pwd: "admin" } });
	const p = await c.newPage();
	const errors = [];
	p.on("console", (m) => { if (/Institutional Theme/.test(m.text())) errors.push(m.text()); });
	for (const dt of (process.argv[3] || "customer,sales-invoice").split(",")) {
		await p.goto(`${BASE}/desk/${dt}/new`);
		await p.waitForSelector(".form-layout .frappe-control input, .form-layout .frappe-control textarea", { timeout: 40000 });
		await p.waitForTimeout(3000);
		const cdp = await c.newCDPSession(p);
		await cdp.send("Accessibility.enable");
		const tree = (await cdp.send("Accessibility.getFullAXTree")).nodes;
		const dom = await p.evaluate(() => {
			const res = [];
			document.querySelectorAll(".form-layout .frappe-control").forEach((w) => {
				const lab = w.querySelector(".control-label");
				const ins = [...w.querySelectorAll("input:not([type=hidden]), textarea, select")].filter((i) => i.closest(".frappe-control") === w && !i.closest(".form-grid"));
				const chk = w.querySelector(".checkbox label");
				ins.forEach((i) => res.push({
					fieldname: i.getAttribute("data-fieldname"), type: i.getAttribute("data-fieldtype") || i.type,
					visible: !!(i.offsetParent), label: (lab ? lab.innerText : chk ? chk.innerText : "").trim().replace(/\s+/g, " "),
					id: i.id, lb: i.getAttribute("aria-labelledby"), desc: i.getAttribute("aria-describedby"),
				}));
			});
			return res;
		});
		// map via backend DOM node ids is heavy: compare by role+name from the AX tree instead
		const named = tree.filter((n) => ["textbox", "combobox", "spinbutton", "searchbox", "checkbox"].includes(n.role?.value) && !n.ignored);
		const rows = dom.filter((d) => d.visible);
		const names = named.map((n) => `${n.role.value}:${n.name?.value || ""}`);
		const unnamed = named.filter((n) => !(n.name?.value || "").trim()).length;
		const mismatch = rows.filter((r) => r.type !== "Check" && r.type !== "checkbox" && r.label && !named.some((n) => (n.name?.value || "").replace(/\s*\*$/, "").replace(/\s+/g, " ").trim() === r.label.replace(/\s+/g, " ").trim()));
		out[`${lang}/${dt}`] = { visibleInputs: rows.length, axControls: named.length, unnamedInAX: unnamed, labelNotInAX: mismatch.map((m) => `${m.fieldname}|${m.type}|${m.label}`), types: [...new Set(rows.map((r) => r.type))], unnamedDom: await p.evaluate(() => [...document.querySelectorAll('.form-layout input[type=checkbox]')].filter((i) => !i.getAttribute('aria-labelledby') && !i.closest('label')?.textContent.trim() && !i.getAttribute('aria-label')).map((i) => i.className + ' in ' + (i.closest('.grid-heading-row, .grid-row, .frappe-control')?.className || '')).slice(0, 5)), sample: names.slice(0, 40), duplicateIds: rows.filter((r) => r.id).length };
		await p.screenshot({ path: `form-${lang}-${dt}.png` });
	}
	out[`${lang}/consoleWarnings`] = errors;
	await c.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
