import { createRequire } from "node:module";
const req = createRequire("/home/runner/work/institutional_theme/institutional_theme/tests/browser/package.json");
export const { chromium } = req("playwright-core");
export const BENCH = { "32": "http://midad.test:8000", "52": "http://midad52.test:8001" };
export const OUT = "/home/runner/work/institutional_theme/institutional_theme/docs/team/evidence/round4/review-a11y/recheck/";
export const PWD = "Rev4-pass-9X!q";
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
export function lum([r,g,b]) { const f=c=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)}; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); }
export function cr(a,b){ const la=lum(a), lb=lum(b); const [h,l]=la>lb?[la,lb]:[lb,la]; return +((h+0.05)/(l+0.05)).toFixed(2); }
export function parse(c){ const m=c.match(/[\d.]+/g).map(Number); return m; }
export function over(fg,bg){ const a=fg[3]??1; return [0,1,2].map(i=>Math.round(fg[i]*a+bg[i]*(1-a))); }
