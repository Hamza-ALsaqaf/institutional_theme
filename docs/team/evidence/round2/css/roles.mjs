// Adds ERPNext roles to the css-r2 admin users so Task, Account and Project open.
import { admin, combos } from "./lib.mjs";
const { browser, api } = await admin();
for (const c of combos) {
	const r = await api.put(`/api/resource/User/${encodeURIComponent(c.user)}`, { data: { roles: ["System Manager", "Projects Manager", "Projects User", "Accounts Manager", "Accounts User", "Sales Manager", "Desk User"].map((role) => ({ role })) } });
	console.log(c.user, r.status(), (await r.text()).slice(0, 120));
}
await browser.close();
