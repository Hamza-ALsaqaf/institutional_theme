// Shared helpers of the backend round-2 browser checks. Run with:
//   NODE_PATH=/opt/pw-node/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node <script>.mjs
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("/opt/pw-node/");
export const { chromium } = require("playwright-core");
export const here = dirname(fileURLToPath(import.meta.url));
export const shots = join(here, "shots");
mkdirSync(shots, { recursive: true });
export const SITE = "midad.test";
export const BASE = `http://${SITE}:8000`;
export const PASSWORD = "Be-R2-Pass-2026!";
export const users = { en: "be-r2-en@midad.test", ar: "be-r2-ar@midad.test" };

export const launch = () =>
	chromium.launch({ args: ["--no-sandbox", "--no-proxy-server", `--host-resolver-rules=MAP ${SITE} 127.0.0.1`] });

export async function adminRequest(browser) {
	const ctx = await browser.newContext({ baseURL: BASE });
	const res = await ctx.request.post(`${BASE}/api/method/login`, { form: { usr: "Administrator", pwd: "admin" } });
	if (!res.ok()) throw new Error("admin login failed " + res.status());
	return ctx;
}

export async function ensureUsers(admin) {
	for (const [lang, email] of Object.entries(users)) {
		const exists = await admin.request.get(`${BASE}/api/resource/User/${encodeURIComponent(email)}`);
		if (!exists.ok()) {
			const res = await admin.request.post(`${BASE}/api/resource/User`, {
				data: { email, first_name: `BE R2 ${lang}`, language: lang, send_welcome_email: 0, new_password: PASSWORD,
					roles: [{ role: "System Manager" }] },
			});
			if (!res.ok()) throw new Error("create user " + email + " " + res.status() + await res.text());
		}
	}
}

export async function userContext(browser, lang, { viewport = { width: 1280, height: 800 }, theme } = {}) {
	const ctx = await browser.newContext({ viewport, baseURL: BASE, locale: lang === "ar" ? "ar-SA" : "en-US" });
	const res = await ctx.request.post(`${BASE}/api/method/login`, { form: { usr: users[lang], pwd: PASSWORD } });
	if (!res.ok()) throw new Error("login failed " + users[lang] + " " + res.status());
	if (theme) {
		await ctx.request.post(`${BASE}/api/method/frappe.core.doctype.user.user.switch_theme`, { form: { theme } });
	}
	return ctx;
}

export function recorder(name) {
	const checks = [];
	const out = { name, checks, data: {} };
	return {
		out,
		check(label, ok, detail = "") {
			checks.push({ label, ok: !!ok, detail });
			console.log(`${ok ? "PASS" : "FAIL"} ${label} ${detail}`);
		},
		save() {
			writeFileSync(join(here, `${name}.json`), JSON.stringify(out, null, 2));
		},
	};
}
