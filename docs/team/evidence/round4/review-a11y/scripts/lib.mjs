import { createRequire } from "node:module";
const req = createRequire("/home/runner/work/institutional_theme/institutional_theme/tests/browser/package.json");
export const { chromium } = req("playwright-core");
export const BENCH = { "32": "http://midad.test:8000", "52": "http://midad52.test:8001" };
export const OUT = "/home/runner/work/institutional_theme/institutional_theme/docs/team/evidence/round4/review-a11y/";
export async function login(page, base, usr="Administrator", pwd="admin") {
  await page.goto(base + "/login");
  await page.fill("#login_email", usr);
  await page.fill("#login_password", pwd);
  await Promise.all([page.waitForURL(/\/app|\/desk/, { timeout: 60000 }), page.press("#login_password","Enter")]);
}
export async function api(page, method, path, body) {
  return page.evaluate(async ([method, path, body]) => {
    const r = await fetch(path, { method, headers: { "Content-Type": "application/json", "X-Frappe-CSRF-Token": window.frappe && frappe.csrf_token }, body: body ? JSON.stringify(body) : undefined });
    return { s: r.status, t: (await r.text()).slice(0, 300) };
  }, [method, path, body]);
}
