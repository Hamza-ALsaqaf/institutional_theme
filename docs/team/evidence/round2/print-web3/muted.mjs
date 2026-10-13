import { launch, BASE } from "../print-web2/lib.mjs";
const b = await launch();
const pages=[["about","/ins-p2-about"],["webform","/visitor-request/new"],["404","/ins-no-such-page"],["403","/me"],["login","/login"]];
const fn = () => {
  const lum=c=>{const [r,g,bl]=c.map(v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*bl};
  const parse=s=>{const m=s.match(/rgba?\(([^)]+)\)/);const p=m[1].split(/[ ,\/]+/).map(Number);return {c:p.slice(0,3),a:p.length>3?p[3]:1}};
  const bg=e=>{const L=[];for(let n=e;n;n=n.parentElement){const p=parse(getComputedStyle(n).backgroundColor);if(p.a>0){L.push(p);if(p.a>=1)break}}let base=[255,255,255];for(const l of L.reverse())base=base.map((v,i)=>Math.round(l.c[i]*l.a+v*(1-l.a)));return base};
  return [...document.querySelectorAll(".text-muted")].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const cs=getComputedStyle(e);const f=parse(cs.color).c;const B=bg(e);const r=(Math.max(lum(f),lum(B))+.05)/(Math.min(lum(f),lum(B))+.05);return `${e.tagName}.${e.className} "${e.textContent.trim().slice(0,28)}" color ${cs.color} ratio ${r.toFixed(2)}`});
};
for (const lang of ["en","ar"]) { const ctx=await b.newContext({viewport:{width:1100,height:800}}); const p=await ctx.newPage();
 for (const [n,u] of pages){ await p.goto(`${BASE}${u}?_lang=${lang}`,{waitUntil:"networkidle"}); for (const l of await p.evaluate(fn)) console.log(lang,n,l);} await ctx.close(); }
await b.close();
