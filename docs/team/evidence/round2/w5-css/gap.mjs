import { combos, launch, ready } from "./lib.mjs";
const { browser, page } = await launch(combos[0]);
await ready(page, "/desk/todo");
console.log(await page.evaluate(() => {
 const row = document.querySelector(".list-row-container .list-row"); const hdr=document.querySelector(".list-row-head");
 const f = (e)=>{const b=e.getBoundingClientRect();return `${e.className.toString().slice(0,30)} x${b.left|0}-${b.right|0} y${b.top|0}-${b.bottom|0}`};
 return [hdr, row].map(r=>[...r.querySelectorAll("input,.like-action,a,button")].map(f).join("\n")).join("\n--\n")+"\nrowH "+row.getBoundingClientRect().height+"\n"+row.querySelector(".list-row-checkbox").parentElement.outerHTML.slice(0,300);
}));
await browser.close();
