const {chromium}=require('playwright-core');
(async()=>{const b=await chromium.launch();
 const p=await (await b.newContext({viewport:{width:1000,height:800}})).newPage();
 await p.goto(`http://midad.test:8000/ins-preview-err?_lang=en`);
 await p.click('.view-error');
 console.log(JSON.stringify(await p.evaluate(()=>{const c=document.querySelector('.error-content code');const pr=document.querySelector('.error-content pre');const f=e=>{const s=getComputedStyle(e);return {bg:s.backgroundColor,color:s.color,h:s.height,txt:e.textContent.length}};return {code:f(c),pre:f(pr),cls:c.className}})));
 await p.screenshot({path:`error-page-en.png`});
await b.close();})();
