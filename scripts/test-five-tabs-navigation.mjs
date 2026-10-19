import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const server=spawn('python3',['-m','http.server','8891','--bind','127.0.0.1','--directory','android-native/app/src/main/assets'],{stdio:'ignore'});
await sleep(800);
let browser;
try {
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
   window.BunPlanAuth={hasSession(){return true},currentEmail(){return 'qa@example.com'}};
   window.BunPlanCloud={loadProfile(){},saveProfile(){},saveWeek(){},loadWeek(){}};
   window.BunPlanAds={getStatus(){},showRewardedInterstitial(){},showCookingBanner(){},hideCookingBanner(){}};
   localStorage.setItem('bunplan_app_tour_v54_finished','1');
   localStorage.setItem('bunplan_onboard_v2',JSON.stringify({completed:true,store:'Lidl',name:'Tester',budget:450,adults:2,children:0,diet:'Echilibrat',meals:3,time:30,exclusions:[]}));
 });
 await page.goto('http://127.0.0.1:8891/main.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{bp100.days[0]['Mic dejun']='R001';bp35Commit();});
 const targets=['savedCooking','home','library100','basket100','profile','savedCooking'];
 for(const target of targets){
  await page.locator('nav.bottom button').filter({hasText:({savedCooking:'Salvate',home:'Planul meu',library100:'Rețete',basket100:'Lista',profile:'Profil'})[target]}).first().click();
  const actual=await page.evaluate(()=>state.tab);
  if(actual!==target)throw new Error('Navigation failed '+target+' -> '+actual);
 }
 await page.evaluate(()=>bp62Open('R001'));
 if(await page.evaluate(()=>state.tab)!=='savedCookingDetail')throw new Error('Saved cooking detail failed');
 for(const target of ['profile','savedCooking','home','savedCooking','library100','basket100','savedCooking']){
  await page.locator('nav.bottom button').filter({hasText:({savedCooking:'Salvate',home:'Planul meu',library100:'Rețete',basket100:'Lista',profile:'Profil'})[target]}).first().click();
  const actual=await page.evaluate(()=>state.tab);
  if(actual!==target)throw new Error('From detail nav '+target+' -> '+actual);
  if(target==='savedCooking')await page.evaluate(()=>bp62Open('R001'));
 }
 if(errors.length)throw new Error(JSON.stringify(errors));
 console.log('PASS all 5 bottom nav destinations and navigation after opening Saved cooking recipe');
 await page.close();
}finally{await browser?.close();server.kill();}
