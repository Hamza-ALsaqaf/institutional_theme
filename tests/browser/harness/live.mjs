// Shared helpers for tests that drive the live bench desk (real core CSS, real DOM).
// Compiles ins_desk with the bench's Sass, optionally injects it, logs in over the REST API.
import { chromium } from "playwright-core";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repo = resolve(here, "../../..");
export const bench = process.env.BENCH || "/home/user/frappe-bench";
export const BASE = process.env.BASE_URL || "http://localhost:8000";
export const SITE = "midad.test";
export const PASSWORD = "Shell-Test-9172";

export function compileDesk(outDir) {
	mkdirSync(outDir, { recursive: true });
	const sass = createRequire(import.meta.url)(join(bench, "apps/frappe/node_modules/sass"));
	const warnings = [];
	const r = sass.renderSync({
		file: join(repo, "institutional_theme/public/scss/ins_desk.bundle.scss"), quietDeps: true,
		includePaths: (process.env.INS_SASS_LOAD_PATH || "").split(":").filter(Boolean),
		logger: { warn: (m) => warnings.push(m), debug: (m) => warnings.push(m) },
	});
	const ltr = join(outDir, "ins_desk.css"), rtl = join(outDir, "ins_desk.rtl.css");
	writeFileSync(ltr, r.css);
	execFileSync("node", [join(bench, "apps/frappe/node_modules/rtlcss/bin/rtlcss.js"), ltr, rtl], { stdio: "ignore" });
	return { css: r.css.toString(), rtlCss: readFileSync(rtl, "utf8"), warnings, bytes: r.css.length };
}

export const launch = () => chromium.launch({ args: ["--no-sandbox", "--no-proxy-server", `--host-resolver-rules=MAP ${SITE} 127.0.0.1`] });

// One logged-in context per test user. Host header selects the site; the cookie jar is the context's.
export async function userContext(browser, user, { lang, viewport = { width: 1366, height: 768 } }) {
	const ctx = await browser.newContext({ viewport, locale: lang === "ar" ? "ar" : "en-US", baseURL: `http://${SITE}:8000` });
	const res = await ctx.request.post(`http://${SITE}:8000/api/method/login`, { form: { usr: user, pwd: PASSWORD } });
	if (!res.ok()) throw new Error(`login failed for ${user}: ${res.status()}`);
	return ctx;
}

export async function injectTheme(page, theme, rtl) {
	await page.addStyleTag({ content: rtl ? theme.rtlCss : theme.css });
}
export async function setDensity(page, density) {
	await page.evaluate((d) => document.documentElement.setAttribute("data-ins-density", d), density);
}
