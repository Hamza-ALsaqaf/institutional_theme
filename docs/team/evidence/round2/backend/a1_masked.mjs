// Item 1: a masked field on a real form. Customer.tax_id gets a Property Setter `mask = 1` on the test site
// (Frappe 16.32 model/meta.py:199 get_masked_fields: a field with mask is masked for a user with no role that
// has the `mask` permission at the field's permlevel). The setter and the record are deleted at the end.
import { launch, adminRequest, ensureUsers, userContext, recorder, shots, BASE, users } from "./lib.mjs";
import { join } from "node:path";

const rec = recorder("a1_masked");
const browser = await launch();
let admin, setter, customer;
const api = (path) => `${BASE}/api/resource/${path}`;
try {
	admin = await adminRequest(browser);
	await ensureUsers(admin);
	// Customer is a Sales doctype: the test users also get "Sales User" (read/write; no `mask` permission).
	for (const email of Object.values(users)) {
		const user = (await (await admin.request.get(api(`User/${encodeURIComponent(email)}`))).json()).data;
		if (!user.roles.some((r) => r.role === "Sales User")) {
			const put = await admin.request.put(api(`User/${encodeURIComponent(email)}`), { data: { roles: [...user.roles.map((r) => ({ role: r.role })), { role: "Sales User" }] } });
			rec.out.data[`rolePut-${email}`] = put.status();
		}
	}
	let res = await admin.request.post(api("Property Setter"), { data: {
		doctype_or_field: "DocField", doc_type: "Customer", field_name: "tax_id", property: "mask", value: "1", property_type: "Check" } });
	if (!res.ok()) throw new Error("setter " + res.status() + (await res.text()).slice(0, 400));
	setter = (await res.json()).data.name;
	rec.out.data.propertySetter = setter;
	const first = async (doctype) => (await (await admin.request.get(api(`${doctype}?filters=[["is_group","=",0]]&limit_page_length=1`))).json()).data[0].name;
	const group = await first("Customer Group"), territory = await first("Territory");
	res = await admin.request.post(api("Customer"), { data: { customer_name: "BE R2 Masked Customer", customer_type: "Company",
		tax_id: "TAX-4412-X", customer_group: group, territory } });
	if (!res.ok()) throw new Error("customer " + res.status() + (await res.text()).slice(0, 400));
	customer = (await res.json()).data.name;
	rec.out.data.customer = customer;

	for (const lang of ["en", "ar"]) {
		const ctx = await userContext(browser, lang, { theme: "Light" });
		const page = await ctx.newPage();
		await page.goto(`${BASE}/desk/customer/${encodeURIComponent(customer)}`, { waitUntil: "networkidle" });
		await page.waitForTimeout(1500);
		rec.out.data[`${lang}_debug`] = await page.evaluate(() => ({ url: location.href, frm: typeof cur_frm !== "undefined" && cur_frm ? cur_frm.doctype + "/" + cur_frm.docname : null,
			hasField: typeof cur_frm !== "undefined" && cur_frm ? !!cur_frm.fields_dict.tax_id : null, masked: typeof cur_frm !== "undefined" && cur_frm ? cur_frm.meta.masked_fields : null,
			body: document.body.innerText.slice(0, 300) }));
		console.log(JSON.stringify(rec.out.data[`${lang}_debug`]));
		await page.screenshot({ path: join(shots, `a1-debug-${lang}.png`) });
		await page.waitForSelector('[data-fieldname="tax_id"]', { state: "attached", timeout: 30000 });
		// The field sits in a tab of the Customer form: core's own scroll_to_field opens the tab.
		await page.evaluate(() => cur_frm.scroll_to_field("tax_id"));
		await page.waitForSelector('[data-fieldname="tax_id"]', { state: "visible", timeout: 30000 });
		await page.waitForTimeout(800);
		const info = await page.evaluate(() => {
			const wrapper = document.querySelector('[data-fieldname="tax_id"]');
			const control = wrapper && wrapper.querySelector("input, textarea, select");
			const reason = wrapper && wrapper.querySelector(".ins-masked-reason");
			const describedBy = control && control.getAttribute("aria-describedby");
			const target = describedBy && document.getElementById(describedBy);
			const cs = reason && getComputedStyle(reason);
			return {
				metaMasked: frappe.boot && cur_frm ? cur_frm.meta.masked_fields : null,
				markerAttr: wrapper && wrapper.getAttribute("data-ins-masked"),
				controlValue: control && control.value,
				controlReadOnly: control && (control.readOnly || control.disabled),
				reasonText: reason && reason.textContent,
				reasonId: reason && reason.id,
				ariaDescribedby: describedBy,
				linkResolves: !!target && target === reason,
				reasonDisplay: cs && { display: cs.display, color: cs.color, fontSize: cs.fontSize },
				reasonCount: wrapper ? wrapper.querySelectorAll(".ins-masked-reason").length : 0,
				lang: document.documentElement.lang,
				controlHidden: control ? !!control.closest(".hide, [hidden]") || getComputedStyle(control).display === "none" || control.offsetParent === null : null,
				staticValue: (wrapper.querySelector(".control-value") || {}).textContent || null,
				staticValueVisible: !!wrapper.querySelector(".control-value") && wrapper.querySelector(".control-value").offsetParent !== null,
				staticValueDescribedby: (wrapper.querySelector(".control-value") || { getAttribute() {} }).getAttribute("aria-describedby"),
			};
		});
		rec.out.data[lang] = info;
		rec.check(`${lang}: tax_id is in meta.masked_fields`, Array.isArray(info.metaMasked) && info.metaMasked.includes("tax_id"), JSON.stringify(info.metaMasked));
		rec.check(`${lang}: the value is the core placeholder, not the real one`, info.controlValue && info.controlValue !== "TAX-4412-X", info.controlValue);
		rec.check(`${lang}: marker attribute and reason element`, info.markerAttr === "1" && !!info.reasonText && info.reasonCount === 1, info.reasonText);
		rec.check(`${lang}: aria-describedby resolves to the reason`, info.linkResolves, info.ariaDescribedby);
		rec.check(`${lang}: reason text in the user language`, lang === "ar" ? /[؀-ۿ]/.test(info.reasonText || "") : info.reasonText === "Hidden for your role", info.reasonText);
		// Idempotence: a second form-refresh must not add a second reason or change the id.
		const again = await page.evaluate(() => {
			cur_frm.refresh();
			const wrapper = document.querySelector('[data-fieldname="tax_id"]');
			return { count: wrapper.querySelectorAll(".ins-masked-reason").length, id: wrapper.querySelector(".ins-masked-reason").id };
		});
		rec.out.data[`${lang}_afterRefresh`] = again;
		rec.check(`${lang}: refresh is idempotent`, again.count === 1 && again.id === info.reasonId, JSON.stringify(again));
		const wrapperLocator = page.locator('.frappe-control[data-fieldname="tax_id"]');
		await wrapperLocator.scrollIntoViewIfNeeded();
		rec.out.data[`${lang}_ariaSnapshot`] = await wrapperLocator.ariaSnapshot();
		await page.screenshot({ path: join(shots, `a1-masked-${lang}.png`) });
		await ctx.close();
	}
} finally {
	if (admin) {
		if (customer) rec.out.data.customerDeleted = (await admin.request.delete(api(`Customer/${encodeURIComponent(customer)}`))).status();
		if (setter) rec.out.data.setterDeleted = (await admin.request.delete(api(`Property Setter/${encodeURIComponent(setter)}`))).status();
	}
	rec.save();
	await browser.close();
}
