import { launch, BASE } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const b = await launch();
const out = {};
const pages = [["about","/ins-p2-about"],["about-ar-page","/ins-p2-about-ar"],["visitor-request","/visitor-request/new"],["home","/"]];
const userPages = [["me","/me"],["orders","/orders"],["quotations","/quotations"],["my-requests","/my-requests"],["my-requests-new","/my-requests/new"]];
const inPage = () => {
  const lum = c => { const [r,g,bl] = c.map(v => { v/=255; return v<=0.03928? v/12.92 : ((v+0.055)/1.055)**2.4 }); return 0.2126*r+0.7152*g+0.0722*bl; };
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if(!m) return null; const p=m[1].split(/[ ,\/]+/).map(Number); return {c:p.slice(0,3), a:p.length>3?p[3]:1}; };
  const bgOf = e => { let layers=[]; for (let n=e; n; n=n.parentElement) { const p=parse(getComputedStyle(n).backgroundColor); if (p && p.a>0) { layers.push(p); if (p.a>=1) break; } } let base=[255,255,255]; for (const l of layers.reverse()) base = base.map((v,i)=>Math.round(l.c[i]*l.a+v*(1-l.a))); return base; };
  const res = { minContrast: 99, low: [], spacing: [], total: 0 };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode; if (!t.textContent.trim()) continue; const e = t.parentElement; if (seen.has(e)) continue; seen.add(e);
    const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); if (cs.visibility==="hidden"||cs.display==="none"||r.width===0||r.height===0) continue;
    if (e.closest("script,style,noscript,svg")) continue;
    const fg = parse(cs.color); if(!fg) continue; const bg = bgOf(e);
    const fgc = fg.c.map((v,i)=>Math.round(v*fg.a+bg[i]*(1-fg.a)));
    const L1 = lum(fgc), L2 = lum(bg); const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    res.total++; const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight)>=700; const large = size>=24 || (size>=18.66 && bold);
    if (ratio < res.minContrast) res.minContrast = Math.round(ratio*100)/100;
    if (ratio < (large?3:4.5)) res.low.push(`${e.tagName}.${e.className} "${t.textContent.trim().slice(0,30)}" ${ratio.toFixed(2)}`);
    const ls = parseFloat(cs.letterSpacing); if (ls && ls !== 0 && !isNaN(ls)) res.spacing.push(`${e.tagName}.${e.className}:${cs.letterSpacing}`);
  }
  return res;
};
const focusInfo = async (page) => {
  const rows = [];
  for (let i=0;i<14;i++) { await page.keyboard.press("Tab"); await page.waitForTimeout(350); const r = await page.evaluate(() => { const e=document.activeElement; if(!e||e===document.body) return null; const c=getComputedStyle(e); return {tag:e.tagName+"."+String(e.className).slice(0,30), style:c.outlineStyle, width:c.outlineWidth, color:c.outlineColor, offset:c.outlineOffset, bc:c.borderTopColor}; }); if (r) rows.push(r); }
  return rows;
};
for (const lang of ["en","ar"]) {
  const ctx = await b.newContext({ baseURL: BASE, viewport:{width:1100,height:800}});
  const page = await ctx.newPage();
  for (const [n,p] of pages) {
    await page.goto(`${BASE}${p}?_lang=${lang}`,{waitUntil:"networkidle"});
    out[`${lang}-${n}`] = { ...(await page.evaluate(inPage)), focus: await focusInfo(page) };
  }
  await ctx.close();
  const c2 = await b.newContext({ baseURL: BASE, viewport:{width:1100,height:800}});
  await c2.request.post(`${BASE}/api/method/login`, {form:{usr:`ins-p2-${lang}@midad.test`, pwd:"P2-Visit-Pass-2026!"}});
  const pg = await c2.newPage();
  for (const [n,p] of userPages) {
    await pg.goto(`${BASE}${p}`,{waitUntil:"networkidle"});
    out[`${lang}-user-${n}`] = { ...(await pg.evaluate(inPage)), focus: await focusInfo(pg) };
  }
  await c2.close();
}
await b.close();
writeFileSync("p2_checks.json", JSON.stringify(out,null,1));
for (const [k,v] of Object.entries(out)) {
  const bad = v.focus.filter(f=>f.style==="none"||parseFloat(f.width)<2);
  console.log(k.padEnd(28), "texts", v.total, "minContrast", v.minContrast, "low", v.low.length, "letterSpacingNonZero", v.spacing.length, "focusStops", v.focus.length, "focusBad", bad.length);
  if (v.low.length) console.log("   low:", v.low.slice(0,4).join(" | "));
  if (k.startsWith("ar") && v.spacing.length) console.log("   spacing:", v.spacing.slice(0,4).join(" | "));
  if (bad.length) console.log("   focusBad:", JSON.stringify(bad.slice(0,3)));
}
