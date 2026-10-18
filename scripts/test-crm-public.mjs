import {chromium} from 'playwright';
const root='https://birisiu.github.io/BunPlan/';
const assets=['','admin.css','crm.css','admin.js','crm.js','bunplan-icon.svg'];
let failed=false;
for(const filename of assets){
 const url=root+filename;
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(18000)});
  const body=await r.text();
  const type=r.headers.get('content-type')||'';
  const correct=filename===''?
    type.includes('text/html')&&body.includes('<title>BunPlan CRM'):
    filename.endsWith('.css')?type.includes('text/css'):
    filename.endsWith('.js')?type.includes('javascript'):
    type.includes('image/svg+xml');
  console.log(JSON.stringify({url,status:r.status,contentType:type,ok:correct,bytes:body.length}));
  if(!r.ok||!correct)failed=true;
 }catch(e){console.error('Public CRM resource failed',url,String(e));failed=true;}
}
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',error=>errors.push(error.message||String(error)));
try{
 const r=await page.goto(root,{waitUntil:'domcontentloaded',timeout:25000});
 await page.waitForTimeout(1400);
 const state=await page.evaluate(()=>({
  title:document.title,
  login:!!document.querySelector('#login-form'),
  logo:document.querySelector('.login-card .logo-box')?.naturalWidth||0,
  styles:getComputedStyle(document.body).backgroundColor,
  modules:document.querySelectorAll('[data-section]').length,
  jsLoaded:typeof document.querySelector('#login-google')?.onclick==='function',
  overflow:document.documentElement.scrollWidth-innerWidth
 }));
 console.log('LIVE CRM BROWSER',JSON.stringify({http:r?.status(),...state,errors}));
 if(r?.status()!==200||!state.login||!state.logo||state.modules<10||
    !state.jsLoaded||state.overflow>3||errors.length)failed=true;
}catch(e){console.error('Live CRM failed',String(e));failed=true;}
await browser.close();
if(failed)process.exitCode=1;
