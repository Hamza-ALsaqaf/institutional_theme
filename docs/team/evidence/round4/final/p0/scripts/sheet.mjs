import { chromium } from "/home/runner/work/institutional_theme/institutional_theme/docs/team/evidence/round4/final/p0/scripts/lib.mjs";
import fs from "node:fs";
const root="/home/runner/work/institutional_theme/institutional_theme/docs/team/evidence/round4/final/p0";
const b=await chromium.launch({args:["--no-sandbox"]});const p=await b.newPage({viewport:{width:1600,height:1000}});
const jobs=[["16.32.0","comfortable"],["16.32.0","compact"],["16.52.0","comfortable"]];
for(const [v,d] of jobs)for(const s of ["desktop","workspace","list","form","report","dialog"]){
 const im=["en-light","en-dark","ar-light","ar-dark"].map(k=>`<img style="width:800px;border:1px solid #888" src="data:image/png;base64,${fs.readFileSync(`${root}/${v}/${k}-${d}-${s}.png`).toString("base64")}">`).join("");
 await p.setContent(`<body style="margin:0;display:flex;flex-wrap:wrap;width:1604px">${im}</body>`);
 await p.screenshot({path:`${root}/sheets/${v}-${d}-${s}.png`,fullPage:true});
}
await b.close();
