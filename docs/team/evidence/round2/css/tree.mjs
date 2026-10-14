// Tree view (Account) on its real route: indent direction, selected row, focus ring, 4 combos.
import { combos, launch, ready } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const out = [];
for (const c of combos) {
	const { browser, page } = await launch(c);
	await ready(page, "/desk/account/view/tree");
	await page.waitForSelector(".tree-link", { timeout: 20000 }).catch(() => console.log("no tree-link"));
	// expand the first nodes so children exist
	for (let i = 0; i < 2; i++) { const l = page.locator(".tree-link:not(.opened)").first(); if (await l.count()) { await l.click().catch(() => {}); await page.waitForTimeout(1200); } }
	await page.keyboard.press("Tab");
	const link = page.locator(".tree-link").nth(1);
	await link.focus(); await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab");
	const info = await page.evaluate(() => {
		const ch = document.querySelector(".tree-children"), lb = document.querySelector(".tree-label"), tb = document.querySelector(".tree-node-toolbar");
		const cs = (e, ...p) => e ? Object.fromEntries(p.map((k) => [k, getComputedStyle(e)[k]])) : null;
		const act = document.querySelector(".tree-link.active"); const foc = document.activeElement;
		const r = (e) => e ? Math.round(e.getBoundingClientRect().left) + "-" + Math.round(e.getBoundingClientRect().right) : null;
		const nested = document.querySelectorAll(".tree-children .tree-link");
		return { dir: getComputedStyle(document.documentElement).direction, children: cs(ch, "paddingLeft", "paddingRight", "paddingInlineStart"), label: cs(lb, "marginLeft", "marginRight"), toolbar: cs(tb, "marginLeft", "marginRight"), active: act ? cs(act, "backgroundColor", "borderRadius") : "none active", focused: foc ? { cls: foc.className, outline: getComputedStyle(foc).outlineStyle + " " + getComputedStyle(foc).outlineWidth + " " + getComputedStyle(foc).outlineColor, offset: getComputedStyle(foc).outlineOffset } : null, rootLink: r(document.querySelector(".tree-link")), nestedLink: nested[0] ? r(nested[0]) : "no nested", nestedCount: nested.length };
	});
	out.push({ ...c, ...info });
	await page.screenshot({ path: `${c.lang}-${c.mode}-tree.png` });
	await browser.close();
}
writeFileSync("tree-computed.json", JSON.stringify(out, null, 1));
for (const o of out) console.log(o.lang, o.mode, JSON.stringify([o.children, o.label, o.focused, o.active, o.rootLink, o.nestedLink]));
