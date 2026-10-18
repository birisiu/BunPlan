import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
const site='docs';const same=['index.html','admin.css','admin.js','crm.css','crm.js','content.css','content.js','bunplan-icon.svg'];
for(const file of same){
 const expected=fs.readFileSync(path.join('admin',file),'utf8');
 const actual=fs.readFileSync(path.join(site,file),'utf8');
 assert.equal(actual,expected,'Pages asset out of sync: '+file);
}
assert(fs.existsSync(path.join(site,'.nojekyll')));
const port=8898,server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',site],{stdio:'ignore'});
await wait(700);const browser=await chromium.launch({headless:true});const problems=[];
try{
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:860}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}})}})};'}));
  const response=await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(80);
  const info=await page.evaluate(()=>({
   title:document.title,
   login:!!document.querySelector('#login-form'),
   background:getComputedStyle(document.body).backgroundColor,
   links:[...document.querySelectorAll('link[rel=stylesheet]')].length,
   logo:document.querySelector('img.logo-box')?.naturalWidth||0,
   overflow:document.documentElement.scrollWidth-innerWidth,
   modules:document.querySelectorAll('[data-section]').length
  }));
  if(response.status()!==200||info.title!=='BunPlan CRM · Panou de administrare'||!info.login||info.links<3||
    info.logo===0||info.overflow>2||info.modules<10||errors.length){
   problems.push({width,info,errors});
  }
  if(width===390){fs.mkdirSync('builds/ui-preview',{recursive:true});await page.screenshot({path:'builds/ui-preview/bunplan-crm-publish-ready.png',fullPage:true});}
  await page.close();
 }
}finally{await browser.close();server.kill()}
console.log(JSON.stringify({passed:problems.length===0,problems}));
if(problems.length)process.exit(1);
