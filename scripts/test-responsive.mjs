import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {mkdirSync} from 'node:fs';
const port=8877;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory','android-native/app/src/main/assets'],{stdio:'ignore'});
const base='http://127.0.0.1:'+port;
const screens='builds/ui-preview';
mkdirSync(screens,{recursive:true});
await sleep(700);
let browser=null;let failures=[];
try{
 browser=await chromium.launch({headless:true});
 for(const width of [320,360,390,430,768]){
  const page=await browser.newPage({viewport:{width,height:840},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
  await page.getByText('Începem →',{exact:true}).click();
  for(let i=0;i<5;i++){
   await page.getByText(i===4?'Continuă spre cont':'Continuă →',{exact:true}).click();
  }
  const loginVisible=await page.locator('button.action.google').isVisible();
  const metrics=await page.evaluate(()=>({screen:document.documentElement.scrollWidth,viewport:window.innerWidth,hasBrand:document.body.textContent.includes('BunPlan')}));
  if(!loginVisible||metrics.screen>metrics.viewport+2||errors.length)failures.push({width,loginVisible,metrics,errors});
  if(width===390)await page.screenshot({path:screens+'/onboarding-390.png',fullPage:true});
  await page.close();
 }
 for(const width of [320,390,768]){
  const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.BunPlanAuth={hasSession(){return true;},currentEmail(){return 'test@example.com';}};
    window.BunPlanCloud={loadProfile(){},saveProfile(){},saveWeek(){},loadWeek(){}};
    window.BunPlanAds={getStatus(){},showRewardedInterstitial(){}};
    localStorage.setItem('bunplan_onboard_v2',JSON.stringify({completed:true,step:4,store:'Lidl',name:'Tester',city:'București',budget:450,adults:2,children:1,diet:'Echilibrat',meals:3,time:30,exclusions:[]}));
  });
  await page.goto(base+'/main.html',{waitUntil:'domcontentloaded'});
  const debug=await page.evaluate(()=>({url:location.href,body:document.body.innerText.slice(0,800),tabCount:document.querySelectorAll('nav button').length}));
  console.log('MAIN PRE-PROFILE',width,JSON.stringify({debug,errors}));
  await page.locator('nav button').filter({hasText:'Profil'}).first().click({timeout:10000});
  const profileVisible=await page.getByText('Securitate și confidențialitate',{exact:true}).isVisible();
  const metrics=await page.evaluate(()=>({screen:document.documentElement.scrollWidth,viewport:innerWidth}));
  if(!profileVisible||metrics.screen>metrics.viewport+2||errors.length)failures.push({width,profileVisible,metrics,errors});
  if(width===390)await page.screenshot({path:screens+'/profile-390.png',fullPage:true});
  await page.close();
 }

 for(const width of [320,390,430,768]){
  const page=await browser.newPage({viewport:{width,height:760},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.BunPlanAuth={hasSession(){return true;},currentEmail(){return 'qa@example.com';}};
   window.BunPlanCloud={loadProfile(){},saveProfile(){},saveWeek(){},loadWeek(){}};
   window.BunPlanAds={getStatus(){},showRewardedInterstitial(){}};
   localStorage.setItem('bunplan_onboard_v2',JSON.stringify({completed:true,store:'Lidl',name:'Tester',city:'București',budget:450,adults:2,children:0,diet:'Echilibrat',meals:3,time:30,exclusions:[]}));
  });
  await page.goto(base+'/main.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
   bp100.days[0]['Mic dejun']='R001';
   bp100.days[0]['Prânz']='R003';
   bp35Commit();
   state.unlocks[bp35Key()]=true;storage();go('basket100');
  });
  const rows=page.locator('.bp35-checklist .bp35-product input[type=checkbox]');
  const total=await rows.count();
  if(total<2)failures.push({width,test:'shopping-list rows',total});
  else{
   await rows.first().scrollIntoViewIfNeeded();
   await page.evaluate(()=>document.querySelector('main.scroll').dataset.qaStable='yes');
   const before=await page.evaluate(()=>scrollY);
   await rows.first().check();
   const after=await page.evaluate(()=>scrollY);
   const status=await page.evaluate(()=>({
    stable:document.querySelector('main.scroll')?.dataset.qaStable==='yes',
    checked:document.querySelector('.bp35-checklist input[type=checkbox]')?.checked,
    progress:document.querySelector('.bp35-boughtheading span')?.textContent,
    overflow:document.documentElement.scrollWidth-innerWidth
   }));
   if(!status.stable||!status.checked||!status.progress?.startsWith('1/')||Math.abs(after-before)>8||status.overflow>2||errors.length)
    failures.push({width,test:'shopping-checkbox-no-jump',before,after,status,errors});
   if(width===390)await page.screenshot({path:screens+'/shopping-390.png',fullPage:true});
   const cross=await page.evaluate(()=>{
    bp35ChooseStore('Kaufland');
    return {store:bp35.store,checked:Object.values(bp35.bought[bp35Key()]||{}).some(Boolean)};
   });
   if(cross.store!=='Kaufland'||cross.checked)failures.push({width,test:'store-isolation',cross});
  }
  await page.close();
 }
}catch(e){failures.push({fatal:String(e.stack||e)})}
finally{if(browser)await browser.close();server.kill();}
console.log(JSON.stringify({passed:!failures.length,failures},null,2));
if(failures.length)process.exit(1);
