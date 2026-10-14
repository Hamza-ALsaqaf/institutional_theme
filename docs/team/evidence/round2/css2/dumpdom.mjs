import { combos, launch, ready } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const { browser, page } = await launch(combos[0]);
const clean = () => {
	const strip = (el) => { const c = el.cloneNode(true); c.querySelectorAll("script,style,audio").forEach(e => e.remove()); c.querySelectorAll("svg").forEach(s => { const u = s.querySelector("use"); s.innerHTML = u ? `<use href="${u.getAttribute("href")}"></use>` : ""; }); const walk = (e) => { e.removeAttribute("style"); for (const k of e.children) walk(k); }; walk(c); return c.outerHTML.replace(/\s*\n\s*/g, "\n"); };
	return strip;
};
const grab = async (name, path, sels, wait) => {
	await ready(page, path); if (wait) await page.waitForSelector(wait, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(800);
	const out = await page.evaluate(([sels, fn]) => { const strip = eval(fn)(); return sels.map(s => { const e = document.querySelector(s); return e ? `<!-- ${s} -->\n` + strip(e) : `<!-- ${s} MISSING -->`; }).join("\n"); }, [sels, `(${clean.toString()})`]);
	writeFileSync(`/tmp/css2/dom/${name}.html`, out); console.log(name, out.length);
};
await grab("list", "/desk/todo", [".body-sidebar-container", ".main-section"], ".list-row");
await grab("form", "/desk/note/new", [".main-section"], ".ql-editor");
await grab("report", "/desk/query-report/ToDo", [".main-section"], ".datatable");
await page.evaluate(() => frappe.msgprint({ title: "Title", message: "Body", indicator: "red" }));
await page.waitForTimeout(600);
writeFileSync("/tmp/css2/dom/dialog.html", await page.evaluate(([fn]) => eval(fn)()(document.querySelector(".modal.show")), [`(${clean.toString()})`]));
await browser.close();
