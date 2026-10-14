// Shared helpers for the round-5 v16.52.0 item captures (Playwright, logs in as the test Administrator).
import { createRequire } from "node:module";
const req = createRequire("/opt/pw-node/package.json");
export const { chromium } = req("playwright-core");
export const BENCH = { "16.32.0": "http://midad.test:8000", "16.52.0": "http://midad52.test:8001" };
export const DESK = { "16.32.0": "/app", "16.52.0": "/desk" };
export const OUT = "/home/runner/work/institutional_theme/institutional_theme/docs/team/evidence/round5/v1652-items";
export async function login(page, base) {
	await page.goto(base + "/login");
	await page.fill("#login_email", "Administrator");
	await page.fill("#login_password", "admin");
	await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.press("#login_password", "Enter")]);
}
export async function api(page, method, path, body) {
	return page.evaluate(async ([method, path, body]) => {
		const r = await fetch(path, {
			method,
			headers: { "Content-Type": "application/json", "X-Frappe-CSRF-Token": window.frappe && frappe.csrf_token },
			body: body ? JSON.stringify(body) : undefined,
		});
		let j = null;
		try { j = await r.json(); } catch (e) {}
		return { status: r.status, json: j };
	}, [method, path, body]);
}
export async function setUser(page, vals) {
	return (await api(page, "PUT", "/api/resource/User/Administrator", vals)).status;
}
