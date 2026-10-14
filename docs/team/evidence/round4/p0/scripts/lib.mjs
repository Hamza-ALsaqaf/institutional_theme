import { createRequire } from "node:module";
const req = createRequire("/home/runner/work/institutional_theme/institutional_theme/tests/browser/package.json");
export const { chromium } = req("playwright-core");
export const BENCH = { "16.32.0": "http://midad.test:8000", "16.52.0": "http://midad52.test:8001" };
export async function login(page, base) {
  await page.goto(base + "/login");
  await page.fill("#login_email", "Administrator");
  await page.fill("#login_password", "admin");
  await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.press("#login_password","Enter")]);
}
export async function setUser(page, base, vals) {
  return page.evaluate(async ([base, vals]) => {
    const t = (await (await fetch("/api/method/frappe.auth.get_logged_user")).json());
    const tok = window.frappe && frappe.csrf_token;
    const r = await fetch("/api/resource/User/Administrator", { method: "PUT", headers: { "Content-Type": "application/json", "X-Frappe-CSRF-Token": tok }, body: JSON.stringify(vals) });
    return r.status;
  }, [base, vals]);
}
