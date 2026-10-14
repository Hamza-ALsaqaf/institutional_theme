import { chromium, BENCH, OUT } from "./lib.mjs";
import { HELPERS } from "./measure.mjs";
const [which, lang, scheme] = process.argv.slice(2);
const base = BENCH[which];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await b.newContext({ locale: lang==="ar"?"ar":"en-US", viewport: { width: 1366, height: 800 }, colorScheme: scheme, reducedMotion:"reduce" });
const page = await ctx.newPage();
await page.goto(`${base}/login?_lang=${lang}`, { waitUntil: "networkidle" });
await page.waitForSelector("#login_email");
await page.evaluate(HELPERS);
const res = {};
res.root = await page.evaluate(()=>({theme:document.documentElement.dataset.theme, mode:document.documentElement.dataset.themeMode, dir:document.documentElement.dir, cs:getComputedStyle(document.documentElement).colorScheme, bodyBg:getComputedStyle(document.body).backgroundColor}));
const T = (sel) => page.evaluate((sel)=>{ const e=document.querySelector(sel); if(!e) return null; const cs=getComputedStyle(e); const r=e.getBoundingClientRect(); return {...__text(e), w:Math.round(r.width), h:Math.round(r.height), fw:cs.fontWeight, fs:cs.fontSize, ls:cs.letterSpacing, ta:cs.textAlign, ol:cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor+' off '+cs.outlineOffset, border:cs.borderTopStyle+' '+cs.borderTopWidth+' '+cs.borderTopColor, bg:cs.backgroundColor}; }, sel);
res.button = await T(".page-card-actions .es-button, .btn-login");
res.label = await T(".for-login label, .for-login .form-label");
res.labels = await page.evaluate(()=>[...document.querySelectorAll('.for-login label')].map(e=>({t:e.textContent.trim(), ...__text(e), fw:getComputedStyle(e).fontWeight, ls:getComputedStyle(e).letterSpacing})));
res.forgot = await T("a[href='#forgot']");
res.input = await T("#login_email");
res.pwd = await T("#login_password");
res.placeholder = await page.evaluate(()=>{ const e=document.querySelector('#login_email'); const p=getComputedStyle(e,'::placeholder'); return { ph:e.placeholder, color:p.color, nt:__nt(p.color,e)} });
// field icons
res.icons = await page.evaluate(()=>[...document.querySelectorAll('.email-field, .password-field')].map(f=>{ const b=getComputedStyle(f,'::before'); const inp=f.querySelector('input'); const svg=f.querySelector('svg.field-icon'); const r=f.getBoundingClientRect(); const ir=inp.getBoundingClientRect(); const left=(b.insetInlineStart); return { cls:f.className, before:b.content, bg:b.backgroundColor, w:b.width, left:b.left, right:b.right, pos:b.position, inputBg:getComputedStyle(inp).backgroundColor, nt: b.content!=='none'?__nt(b.backgroundColor, inp):null, svg: svg?{fill:getComputedStyle(svg).fill, nt:__nt(getComputedStyle(svg).fill, inp)}:null, padStart:getComputedStyle(inp).paddingInlineStart, padEnd:getComputedStyle(inp).paddingInlineEnd, fieldRect:[Math.round(r.left),Math.round(r.right)] }; }));
// reveal button
res.reveal = await page.evaluate(()=>{ const e=document.querySelector('.ins-reveal'); if(!e) return null; const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); const sv=e.querySelector('svg'); return { w:Math.round(r.width), h:Math.round(r.height), left:Math.round(r.left), right:Math.round(r.right), label:e.getAttribute('aria-label'), pressed:e.getAttribute('aria-pressed'), nt: sv? __nt(getComputedStyle(sv).fill==='none'?getComputedStyle(sv).color:getComputedStyle(sv).fill, document.querySelector('#login_password')):null, svgfill: sv&&getComputedStyle(sv).fill }; });
// Tab order through the form
const order=[]; await page.focus('#login_email'); order.push(await page.evaluate(()=>document.activeElement.id||document.activeElement.className));
for (let i=0;i<6;i++){ await page.keyboard.press('Tab'); order.push(await page.evaluate(()=>{const e=document.activeElement; const cs=getComputedStyle(e); return (e.id||e.tagName+'.'+String(e.className).slice(0,30))+' ring='+cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor+' off '+cs.outlineOffset+' fv='+e.matches(':focus-visible'); })); }
res.tabOrder=order;
// Shift+Tab back
const back=[]; for (let i=0;i<3;i++){ await page.keyboard.press('Shift+Tab'); back.push(await page.evaluate(()=>document.activeElement.id||document.activeElement.tagName+'.'+String(document.activeElement.className).slice(0,30))); } res.shiftTab=back;
import("node:fs").then(f=>f.writeFileSync(`<out>/login-${which}-${lang}-${scheme}.json`, JSON.stringify(res,null,1)));
// focus the button for the screenshot
await page.focus('#login_password'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
await page.screenshot({ path: OUT + `login-${which}-${lang}-${scheme}.png` });
// disabled button on forgot page
await page.goto(`${base}/login?_lang=${lang}#forgot`, {waitUntil:"networkidle"}); await page.waitForTimeout(500);
await page.evaluate(HELPERS);
const res2 = await page.evaluate(()=>{ const e=document.querySelector('.btn-forgot'); if(!e) return null; const cs=getComputedStyle(e); return {...__text(e), disabled:e.disabled, border:cs.borderTopStyle+' '+cs.borderTopWidth+' '+cs.borderTopColor, bg:cs.backgroundColor, borderNt: __nt(cs.borderTopColor, e.closest('.page-card')||document.body)}; });
console.log("FORGOT-DISABLED", JSON.stringify(res2));
await page.screenshot({ path: OUT + `login-forgot-${which}-${lang}-${scheme}.png` });
await b.close();
