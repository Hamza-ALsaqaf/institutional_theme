// Field errors on a real form (a11y finding 3.3.1 / 4.1.2): a required field emptied sets has-error in core,
// the theme must set aria-invalid="true" on its input and remove it when the value is back.
// NODE_PATH=/opt/pw-node/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node fe_errors.mjs
import { launch, adminRequest, ensureUsers, userContext, recorder, shots, BASE } from "./lib.mjs";
import { join } from "node:path";

const rec = recorder("fe_errors");
const browser = await launch();
const admin = await adminRequest(browser);
await ensureUsers(admin);
const snap = (page) => page.accessibility ? page.accessibility.snapshot({ interestingOnly: false }) : null;
function find(node, pred, out = []) {
	if (!node) return out;
	if (pred(node)) out.push(node);
	(node.children || []).forEach((c) => find(c, pred, out));
	return out;
}
try {
	for (const lang of ["en", "ar"]) {
		const ctx = await userContext(browser, lang, { theme: "Light" });
		const page = await ctx.newPage();
		await page.goto(`${BASE}/desk/customer/new`, { waitUntil: "networkidle" });
		await page.waitForSelector('[data-fieldname="customer_name"] input', { state: "visible", timeout: 30000 });
		await page.waitForTimeout(1500);
		const input = page.locator('[data-fieldname="customer_name"] input');
		const state = () => page.evaluate(() => {
			const w = document.querySelector('[data-fieldname="customer_name"]');
			const i = w.querySelector("input");
			return { hasError: w.classList.contains("has-error"), ariaInvalid: i.getAttribute("aria-invalid"), describedby: i.getAttribute("aria-describedby") };
		});
		rec.out.data[`${lang}_initial`] = await state();
		rec.check(`${lang}: no aria-invalid on load`, rec.out.data[`${lang}_initial`].ariaInvalid === null, JSON.stringify(rec.out.data[`${lang}_initial`]));
		// Save with the required Customer Name empty: core sets has-error (the form-level validation path).
		await page.keyboard.press("Control+s");
		await page.waitForTimeout(1500);
		const bad = await state();
		rec.out.data[`${lang}_after_save`] = bad;
		rec.check(`${lang}: core has-error and aria-invalid="true" after Save with a required field empty`, bad.hasError && bad.ariaInvalid === "true", JSON.stringify(bad));
		const invalids = await page.evaluate(() => Array.from(document.querySelectorAll('[aria-invalid="true"]')).map((e) => e.closest("[data-fieldname]")?.getAttribute("data-fieldname")));
		const errors = await page.evaluate(() => Array.from(document.querySelectorAll(".frappe-control.has-error")).map((e) => e.getAttribute("data-fieldname")));
		rec.out.data[`${lang}_save_fields`] = { ariaInvalidFields: invalids, hasErrorFields: errors };
		rec.check(`${lang}: every has-error control with an input is aria-invalid, and nothing else is`, JSON.stringify(invalids.sort()) === JSON.stringify(errors.sort()), JSON.stringify(rec.out.data[`${lang}_save_fields`]));
		// The accessibility tree (CDP; page.accessibility was removed from Playwright).
		const cdp = await ctx.newCDPSession(page);
		await cdp.send("Accessibility.enable");
		const { nodes } = await cdp.send("Accessibility.getFullAXTree");
		const obj = (await cdp.send("Runtime.evaluate", { expression: 'document.querySelector(\'[data-fieldname="customer_name"] input\')' })).result.objectId;
		const { node: dom } = await cdp.send("DOM.describeNode", { objectId: obj });
		const ax = nodes.find((n) => n.backendDOMNodeId === dom.backendNodeId);
		const props = ax ? Object.fromEntries((ax.properties || []).map((p) => [p.name, p.value && p.value.value])) : null;
		rec.out.data[`${lang}_ax_invalid`] = { role: ax && ax.role && ax.role.value, name: ax && ax.name && ax.name.value, properties: props };
		rec.check(`${lang}: the accessibility tree reports the textbox invalid`, props && (props.invalid === "true" || props.invalid === true), JSON.stringify(rec.out.data[`${lang}_ax_invalid`]));
		await page.screenshot({ path: join(shots, `fe-error-${lang}.png`) });
		// Fix the value: core clears has-error, the theme must clear aria-invalid.
		await input.fill("Fix1 Field Error Customer");
		await input.blur();
		await page.waitForTimeout(500);
		const ok = await state();
		rec.out.data[`${lang}_filled`] = ok;
		rec.check(`${lang}: aria-invalid removed when the value is back`, !ok.hasError && ok.ariaInvalid === null, JSON.stringify(ok));
		await page.screenshot({ path: join(shots, `fe-save-${lang}.png`) });
		await ctx.close();
	}
} finally {
	rec.save();
	await browser.close();
}
