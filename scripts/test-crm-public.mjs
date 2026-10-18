import { chromium } from 'playwright';
const root='https://aedyviqoelgbbrrtwayu.supabase.co/functions/v1/bunplan-admin';
const paths=['','/admin.css','/crm.css','/admin.js','/crm.js'];
let failed=false;
for(const path of paths){
 try{
  const r=await fetch(root+path,{headers:{'accept':path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'text/html'},signal:AbortSignal.timeout(18000)});
  const s=await r.text(),type=r.headers.get('content-type')||'';
  console.log(JSON.stringify({url:root+path,status:r.status,contentType:type,length:s.length,firstChars:s.slice(0,160)}));
  if(!r.ok||path===''?!(type.includes('text/html')&&s.startsWith('<!doctype html>')):path.endsWith('.css')?!type.includes('text/css'):!type.includes('javascript')){console.error('WRONG PUBLIC ASSET',path);failed=true}
 }catch(e){console.error('PUBLIC ASSET FAIL',path,String(e));failed=true}
}
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
page.on('console',e=>{if(e.type()==='error')console.error('CONSOLE',e.text())});
try{
 const r=await page.goto(root,{waitUntil:'domcontentloaded',timeout:25000});
 await page.waitForTimeout(1400);
 const state=await page.evaluate(()=>({title:document.title,login:!!document.querySelector('#login-form'),
   styles:getComputedStyle(document.body).backgroundColor,
   jsLoaded:!!document.querySelector('#login-google')?.onclick,
   text:document.body?.innerText?.slice(0,180),
   overflow:document.documentElement.scrollWidth-innerWidth}));
 console.log('PUBLIC BROWSER',JSON.stringify({status:r?.status(),state,errors}));
 if(!state.login||!state.jsLoaded||errors.length||state.overflow>3)failed=true;
}catch(e){console.error('PUBLIC BROWSER FAIL',String(e));failed=true}
await browser.close();
if(failed)process.exitCode=1;
