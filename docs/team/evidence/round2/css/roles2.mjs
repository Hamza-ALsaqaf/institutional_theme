// Gives the two no-role test users only Desk User so the desk opens but restricted doctypes do not.
import { admin } from "./lib.mjs";
const { browser, api } = await admin();
for (const u of ["css-r2-norole-ar@midad.test", "css-r2-norole-en@midad.test"]) {
	const r = await api.put(`/api/resource/User/${encodeURIComponent(u)}`, { data: { roles: [{ role: "Desk User" }] } });
	console.log(u, r.status());
}
await browser.close();
