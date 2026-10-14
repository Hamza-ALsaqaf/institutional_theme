import { chromium, BENCH, login } from "./lib.mjs";
const which = process.argv[2];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await b.newContext({ locale: "en-US", viewport: { width: 1366, height: 768 } })).newPage();
await login(page, BENCH[which]);
await page.goto(BENCH[which] + "/desk/todo"); await page.waitForSelector(".list-row-container",{timeout:30000}); await page.waitForTimeout(1500);
console.log(which, JSON.stringify(await page.evaluate(()=>{ const f=document.querySelector('.indicator-pill.filterable, .es-badge.filterable'); return { badge:{cls:f&&f.className.slice(0,40), tabindex:f&&f.getAttribute('tabindex'), role:f&&f.getAttribute('role')}, ariaCurrent:[...document.querySelectorAll('[aria-current]')].map(e=>e.tagName+'.'+String(e.className).slice(0,30)), rowsTabindex:[...document.querySelectorAll('.list-row-container')].map(e=>e.getAttribute('tabindex')) }; })));
await b.close();
