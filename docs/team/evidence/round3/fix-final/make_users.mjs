// Creates or updates the Light users g-en-light@midad.test and g-ar-light@midad.test (System Manager). Usage: node make_users.mjs
import { createRequire } from "node:module";
const req = createRequire("/home/runner/work/institutional_theme/institutional_theme/tests/browser/package.json");
const { chromium } = req("playwright-core");
const BASE = "http://localhost:8000", PW = "Mdd#Test2026x";
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ locale: "en-US" }); const p = await ctx.newPage();
await p.goto(`${BASE}/login`); await p.fill("#login_email", "Administrator"); await p.fill("#login_password", "admin");
await Promise.all([p.waitForURL(/\/app|\/desk/), p.click(".btn-login")]);
await p.waitForFunction(() => window.frappe && frappe.csrf_token && frappe.csrf_token !== "{{ csrf_token }}");
const out = await p.evaluate(async (PW) => {
	const h = { "Content-Type": "application/json", "X-Frappe-CSRF-Token": frappe.csrf_token }; const res = {};
	for (const l of ["en", "ar"]) { const email = `g-${l}-light@midad.test`; const body = { language: l, desk_theme: "Light", enabled: 1 };
		const g = await fetch(`/api/resource/User/${encodeURIComponent(email)}`, { headers: h });
		const r = g.status === 200 ? await fetch(`/api/resource/User/${encodeURIComponent(email)}`, { method: "PUT", headers: h, body: JSON.stringify({ ...body, new_password: PW }) })
			: await fetch("/api/resource/User", { method: "POST", headers: h, body: JSON.stringify({ ...body, email, first_name: "G", last_name: l, send_welcome_email: 0, new_password: PW, roles: [{ role: "System Manager" }] }) });
		res[email] = r.status + " " + (await r.text()).slice(0, 300); }
	return res; }, PW);
console.log(JSON.stringify(out)); await b.close();
