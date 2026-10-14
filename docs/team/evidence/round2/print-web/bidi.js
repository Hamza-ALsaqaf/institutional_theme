const {chromium}=require('playwright-core');
(async()=>{const b=await chromium.launch();
 const c=await b.newContext({viewport:{width:900,height:500}});const p=await c.newPage();
 await p.goto('http://midad.test:8000/login');await p.fill('#login_email','Administrator');await p.fill('#login_password','admin');await p.click('.btn-login');await p.waitForTimeout(2500);
 await p.goto('http://midad.test:8000/update-password?_lang=ar');
 await p.evaluate(()=>{document.querySelector('.page-card-subtitle').textContent='Use strong passwords.'});
 console.log(await p.evaluate(()=>{const e=document.querySelector('.page-card-subtitle');const s=getComputedStyle(e);return [s.unicodeBidi,s.textAlign]}));
 await p.screenshot({path:'update-password-ar-english-fallback.png',clip:{x:300,y:80,width:300,height:140}});
 await b.close();})();
