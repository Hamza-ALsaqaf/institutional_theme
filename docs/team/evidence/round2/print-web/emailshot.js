const {chromium}=require('playwright-core');
(async()=>{const b=await chromium.launch();
for(const l of ['en','ar']){const p=await (await b.newContext({viewport:{width:760,height:620}})).newPage();
await p.goto('file:///tmp/pdfout/email-'+l+'.html');await p.screenshot({path:'/tmp/pdfout/email-'+l+'.png'});}
await b.close();})();
