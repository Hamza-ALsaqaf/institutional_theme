// Computed-style assertions for the shell, list, report, overlay and appearance rules. Run from tests/browser: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node ../../docs/team/evidence/phase3/css-shell/assert.mjs
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const req = createRequire("/home/runner/work/institutional_theme/institutional_theme/tests/browser/package.json");
const { chromium } = req("playwright-core");
const root = "/home/runner/work/institutional_theme/institutional_theme";
const bench = "/home/user/frappe-bench/apps/frappe/node_modules";
const scss = `${root}/institutional_theme/public/scss`;
execFileSync("node", [`${bench}/sass/sass.js`, "--no-source-map", `--load-path=${scss}`, `--load-path=${bench}`, `${scss}/ins_desk.bundle.scss`, "/tmp/css-shell-assert.css"], { stdio: "inherit" });
const css = fs.readFileSync("/tmp/css-shell-assert.css", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });
let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n} ${d}`); };
const q = (page, sel, props, pseudo = null) => page.evaluate(([sel, props, pseudo]) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e, pseudo); return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)])); }, [sel, props, pseudo]);
for (const lang of ["en", "ar"]) for (const mode of ["light", "dark"]) for (const density of ["comfortable", "compact"]) {
	const tag = `${lang}-${mode}-${density}`;
	const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: lang === "ar" ? "ar-SA" : "en-US" });
	const page = await ctx.newPage();
	await page.goto("http://localhost:8000/login");
	await page.fill("#login_email", `css-shell-${lang}-${mode}@midad.test`); await page.fill("#login_password", "Mdd#Test2026x");
	await Promise.all([page.waitForURL(/\/app|\/desk/), page.click(".btn-login")]);
	const prep = async (route, sel) => { await page.goto("http://localhost:8000" + route); await page.waitForSelector(sel, { timeout: 30000 }); await page.waitForTimeout(1200); await page.addStyleTag({ content: css }); await page.evaluate((d) => document.documentElement.setAttribute("data-ins-density", d), density); await page.waitForTimeout(200); };
	// list
	await prep("/desk/user", ".list-row-head");
	const ap = await q(page, ".standard-sidebar-item.active-sidebar", ["border-radius", "box-shadow"]);
	ok(`${tag} sidebar active radius 4px and ring`, ap && ap["border-radius"] === "4px" && /0px 0px 0px 1px/.test(ap["box-shadow"]), JSON.stringify(ap));
	const bar = await q(page, ".standard-sidebar-item.active-sidebar", ["inline-size", "background-color", "inset-inline-start"], "::before");
	ok(`${tag} accent bar 3px`, bar && bar["inline-size"] === "3px", JSON.stringify(bar));
	const side = await page.evaluate(() => { const e = document.querySelector(".active-sidebar"), r = e.getBoundingClientRect(); return { x: r.x, w: r.width, vw: innerWidth, dir: document.documentElement.dir }; });
	const barPos = await page.evaluate(() => { const e = document.querySelector(".active-sidebar"); const cs = getComputedStyle(e, "::before"); return { left: cs.left, right: cs.right }; });
	ok(`${tag} bar on the inline-start side`, lang === "ar" ? barPos.left !== "0px" && barPos.right === "0px" : barPos.left === "0px", JSON.stringify(barPos));
	const ph = await q(page, ".page-head", ["top", "position"]);
	ok(`${tag} page-head sticky top 0px (no ribbon)`, ph.top === "0px" && ph.position === "sticky", JSON.stringify(ph));
	const tt = await q(page, ".page-title .title-text", ["font-size", "font-weight"]);
	ok(`${tag} title 18px/600`, tt["font-size"] === "18px" && tt["font-weight"] === "600" || (lang === "ar" && tt["font-size"] === "18px"), JSON.stringify(tt));
	const sub = await q(page, ".list-row .level-left .list-subject", ["position", "inset-inline-start", "background-color"]);
	ok(`${tag} list subject sticky at inline start`, sub && sub.position === "sticky" && sub["inset-inline-start"] === "0px" && sub["background-color"] !== "rgba(0, 0, 0, 0)", JSON.stringify(sub));
	const sp = await q(page, ".frappe-list .result-container", ["scroll-padding-inline-start"]);
	ok(`${tag} list scroll-padding-inline-start 192px`, sp && sp["scroll-padding-inline-start"] === "192px", JSON.stringify(sp));
	// report: row and cell height must be core's, untouched
	await prep("/desk/user/view/report", ".datatable .dt-scrollable .dt-cell");
	const h = await page.evaluate(() => { const r = document.querySelector(".datatable .dt-scrollable .dt-row"); const c = document.querySelector(".datatable .dt-scrollable .dt-cell"); return { row: getComputedStyle(r).height, rowInline: r.style.height, cell: getComputedStyle(c).height, cellInline: c.style.height }; });
	const hs = await page.evaluate(() => [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch (e) { return []; } }).filter((r) => r.selectorText && /dt-row|dt-cell/.test(r.selectorText) && r.style && r.style.height && r.parentStyleSheet.ownerNode && r.parentStyleSheet.ownerNode.textContent.includes("ins-text-base")).length);
	ok(`${tag} theme sets no height on dt-row or dt-cell`, hs === 0, JSON.stringify(h));
	const pad = await q(page, ".datatable .dt-scrollable .dt-cell__content", ["padding-inline-start", "padding-block-start", "font-size"]);
	ok(`${tag} cell inline padding follows density`, pad["padding-inline-start"] === (density === "compact" ? "8px" : "12px"), JSON.stringify(pad));
	const hd = await q(page, ".datatable .dt-header .dt-cell--header .dt-cell__content", ["font-weight", "background-color"]);
	ok(`${tag} header weight 500`, hd["font-weight"] === "500", JSON.stringify(hd));
	// dialog
	await prep("/desk/user", ".list-row-head");
	await page.evaluate(() => { new frappe.ui.Dialog({ title: "T", fields: [{ fieldtype: "Data", label: "A", fieldname: "a" }] }).show(); });
	await page.waitForSelector(".modal.show"); await page.waitForTimeout(500);
	const mc = await q(page, ".modal.show .modal-content", ["border-radius", "box-shadow", "background-color"]);
	ok(`${tag} dialog radius 8px with elevation`, mc["border-radius"] === "8px" && mc["box-shadow"] !== "none", JSON.stringify(mc));
	await ctx.close();
}
// appearance page markup contract (fixture): sr-only and swatch
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: "en-US" });
const page = await ctx.newPage();
await page.goto("http://localhost:8000/login");
await page.fill("#login_email", "css-shell-en-light@midad.test"); await page.fill("#login_password", "Mdd#Test2026x");
await Promise.all([page.waitForURL(/\/app|\/desk/), page.click(".btn-login")]);
await page.goto("http://localhost:8000/desk/ins-appearance"); await page.waitForSelector(".ins-appearance", { timeout: 30000 }); await page.waitForTimeout(1500);
await page.addStyleTag({ content: css });
const dot = await q(page, ".ins-swatch-dot", ["background-color", "border-top-width", "inline-size"]);
ok("appearance swatch dot painted from --ins-swatch-colour with 1px border", dot && dot["background-color"] !== "rgba(0, 0, 0, 0)" && dot["border-top-width"] === "1px", JSON.stringify(dot));
const sr = await q(page, ".ins-sr-only", ["position", "inline-size", "overflow"]);
ok("appearance .ins-sr-only is visually hidden", sr && sr.position === "absolute" && sr["inline-size"] === "1px", JSON.stringify(sr));
await b.close();
console.log(`pass ${pass} fail ${fail}`);
