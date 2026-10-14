import { chromium, BENCH, login, setUser } from "./lib.mjs";
const base=BENCH["16.52.0"];
const OUT="/home/runner/work/institutional_theme/institutional_theme/docs/team/evidence/round4/final/p0/16.52.0/";
const b=await chromium.launch({args:["--no-sandbox"]});
const ctx=await b.newContext({locale:"en-US",viewport:{width:1280,height:800},forcedColors:"active"});
const page=await ctx.newPage();
await login(page,base);
await page.goto(base+"/desk/todo");await page.waitForTimeout(2500);
await setUser(page,base,{desk_theme:"Light",language:"en"});
// ensure rows with statuses
await page.evaluate(async()=>{const h={"Content-Type":"application/json","X-Frappe-CSRF-Token":frappe.csrf_token};
 const ex=await (await fetch("/api/resource/ToDo?fields=[\"name\"]&limit=1")).json();
 if(!ex.data.length) for(const [d,s] of [["Review the budget","Open"],["File the report","Closed"],["Archive the notes","Cancelled"]]) await fetch("/api/resource/ToDo",{method:"POST",headers:h,body:JSON.stringify({description:d,status:s})});});
await page.goto(base+"/desk/todo");await page.waitForSelector(".frappe-list .result, .list-row-container");await page.waitForTimeout(2500);
await page.screenshot({path:OUT+"forced-colors-todo-list.png"});
const names=await page.evaluate(()=>[...document.querySelectorAll(".list-row-container")].length);
console.log("rows",names);
await page.goto(base+"/desk/todo/new");await page.waitForSelector(".form-layout");await page.waitForTimeout(2500);
// focus ring on primary button via keyboard
await page.locator(".primary-action").first().focus();
await page.keyboard.press("Shift+Tab");await page.keyboard.press("Tab");
const ring=await page.evaluate(()=>{const e=document.activeElement;const c=getComputedStyle(e);return {tag:e.className,outline:c.outlineStyle+" "+c.outlineWidth+" "+c.outlineColor,offset:c.outlineOffset};});
console.log(JSON.stringify(ring));
await page.screenshot({path:OUT+"forced-colors-todo-form.png"});
const badge=await page.evaluate(()=>{const e=document.querySelector(".indicator-pill");if(!e)return null;const c=getComputedStyle(e);return {c:c.color,bg:c.backgroundColor,b:c.borderStyle+" "+c.borderWidth+" "+c.borderColor,fc:c.forcedColorAdjust}});
console.log(JSON.stringify(badge));
await setUser(page,base,{desk_theme:"Light"});
try{await b.close()}catch(e){}
