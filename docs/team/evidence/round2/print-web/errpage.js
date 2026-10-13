const {chromium}=require('playwright-core');
(async()=>{const b=await chromium.launch();const out=[];
for(const lang of ['en','ar']){
 const p=await (await b.newContext({viewport:{width:1000,height:800}})).newPage();
 await p.goto(`http://midad.test:8000/ins-preview-err?_lang=${lang}`);
 await p.click('.view-error');
 const cs=await p.evaluate(()=>{const e=document.querySelector('.error-content');const s=getComputedStyle(e);return {dir:s.direction,align:s.textAlign,font:s.fontFamily.slice(0,30),hasClass:document.body.classList.contains('ins-error'),htmlDir:document.documentElement.dir}});
 console.log(lang,JSON.stringify(cs));
 await p.screenshot({path:`error-page-${lang}.png`});
 // untranslated string on RTL page: bidi check of the full stop
 }
await b.close();})();
