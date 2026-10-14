const {chromium}=require('playwright-core');
(async()=>{
const b=await chromium.launch();const out=process.argv[2];
for(const lang of ['ar','en']){
 const c=await b.newContext({viewport:{width:1100,height:800}});const p=await c.newPage();
 await p.goto(`http://midad.test:8000/login?_lang=${lang}`);
 await p.screenshot({path:`${out}/login-${lang}.png`});
 const su=await p.evaluate(()=>[...document.querySelectorAll('h4,a')].filter(e=>/sign\s*up|تسجيل|اشتراك/i.test(e.textContent)).map(e=>e.tagName+':'+e.textContent.trim()));
 console.log(lang,'login',JSON.stringify(su));
 await p.goto('http://midad.test:8000/login');
 await p.fill('#login_email','Administrator');await p.fill('#login_password','admin');
 await p.click('.btn-login');await p.waitForTimeout(2500);
 await p.goto(`http://midad.test:8000/update-password?_lang=${lang}`);
 await p.screenshot({path:`${out}/update-password-${lang}.png`});
 console.log(lang,'update',await p.evaluate(()=>{const e=document.querySelector('.page-card-subtitle');return e?[e.outerHTML,getComputedStyle(e).direction]:'none'}));
 await c.close();
}
await b.close();})();
