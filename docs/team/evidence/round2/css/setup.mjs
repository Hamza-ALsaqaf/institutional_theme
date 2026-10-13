// Creates the css-r2 users and fictional records over REST as Administrator.
import { admin, combos, PW } from "./lib.mjs";
const { browser, api } = await admin();
const post = async (dt, doc) => {
	const r = await api.post(`/api/resource/${dt}`, { data: doc });
	console.log(dt, doc.name || doc.email || doc.subject || "", r.status());
	return r;
};
for (const c of combos) {
	await post("User", { email: c.user, first_name: "CssR2", last_name: c.lang + c.mode, language: c.lang, desk_theme: c.mode === "dark" ? "Dark" : "Light", send_welcome_email: 0, new_password: PW, enabled: 1, roles: [{ role: "System Manager" }] });
}
// A user without roles for the 403 check.
await post("User", { email: "css-r2-norole-ar@midad.test", first_name: "CssR2", last_name: "norole", language: "ar", desk_theme: "Light", send_welcome_email: 0, new_password: PW, enabled: 1, user_type: "System User" });
await post("User", { email: "css-r2-norole-en@midad.test", first_name: "CssR2", last_name: "norole", language: "en", desk_theme: "Dark", send_welcome_email: 0, new_password: PW, enabled: 1, user_type: "System User" });
const d = new Date(); const ymd = (o) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + o); return x.toISOString().slice(0, 10); };
const day = (o) => ymd(o);
await post("Event", { subject: "CssR2 Planning review", starts_on: day(0) + " 09:00:00", ends_on: day(0) + " 10:30:00", event_type: "Public", status: "Open", color: "#cb2929" });
await post("Event", { subject: "CssR2 Budget workshop", starts_on: day(1) + " 11:00:00", ends_on: day(1) + " 12:00:00", event_type: "Public", status: "Open", color: "#29cd42" });
await post("Event", { subject: "CssR2 Site visit", starts_on: day(2) + " 08:00:00", ends_on: day(2) + " 09:00:00", event_type: "Public", status: "Open" });
const pr = await post("Project", { project_name: "CssR2 Archive Digitisation", status: "Open", expected_start_date: day(-3), expected_end_date: day(20) });
const pj = (await pr.json()).data?.name;
console.log("project", pj);
const t = [["CssR2 Survey", -3, 2], ["CssR2 Scan batch", 3, 10], ["CssR2 Review", 11, 18]];
for (const [s, a, b] of t) await post("Task", { subject: s, project: pj, status: "Open", exp_start_date: day(a), exp_end_date: day(b) });
await browser.close();
