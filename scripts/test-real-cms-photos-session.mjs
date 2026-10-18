import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {readFileSync,mkdirSync} from 'node:fs';
const project='https://aedyviqoelgbbrrtwayu.supabase.co';
const apiKey='sb_publishable_pLh8mKxNWKkq396TyM518A_N_q7fm0Z';
const ids=['R001','R039','BP0534'];
const failures=[];
const response=await fetch(project+'/rest/v1/recipes?select=legacy_key,title,photo_url,image_reviewed,published,updated_at&legacy_key=in.('+ids.join(',')+')',{
 headers:{apikey:apiKey,Accept:'application/json'},signal:AbortSignal.timeout(15000)
});
if(!response.ok)throw Error('Public published recipes endpoint: HTTP '+response.status);
const photos=await response.json(),byId=Object.fromEntries(photos.map(x=>[x.legacy_key,x]));
for(const id of ids){
 const p=byId[id];
 if(!p?.photo_url||p.image_reviewed!==true||p.published!==true){failures.push({test:'cms-photo-approved',id,p});continue}
 try{
  const check=await fetch(p.photo_url,{method:'GET',signal:AbortSignal.timeout(15000)});
  const bytes=check.ok?(await check.arrayBuffer()).byteLength:0;
  if(!check.ok||!String(check.headers.get('content-type')||'').startsWith('image/')||bytes<1000)
    failures.push({test:'storage-image-GET',id,status:check.status,bytes});
 }catch(e){failures.push({test:'storage-image-request',id,error:String(e)})}
}
const activity=readFileSync('android-native/app/src/main/java/ro/bunplan/app/MainActivity.java','utf8');
const auth=readFileSync('android-native/app/src/main/java/ro/bunplan/app/BunPlanAuth.java','utf8');
if(!activity.includes('returningUser?"main.html":"index.html"')||!auth.includes('boolean hasStoredSession()'))
 failures.push({test:'returning-android-session-native-routing'});
const port=8892;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory','android-native/app/src/main/assets'],{stdio:'ignore'});
await delay(750);
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:860}});
 const jsErrors=[];page.on('pageerror',e=>jsErrors.push(e.message));
 await page.addInitScript(()=>{
  window.BunPlanAuth={hasSession:()=>true,currentEmail:()=> 'returning.user@example.com'};
  window.BunPlanCloud={loadProfile(){},saveProfile(){},saveWeek(){},loadWeek(){},sendFeedback(){}};
  window.BunPlanAds={getStatus(){},showRewardedInterstitial(){}};
  localStorage.setItem('bunplan_onboard_v2',JSON.stringify({completed:true,store:'Lidl',name:'User',
   city:'București',budget:500,adults:2,children:0,diet:'Echilibrat',meals:3,time:30,exclusions:[]}));
  localStorage.setItem('bunplan_app_tour_v54_finished','1');
 });
 await page.goto('http://127.0.0.1:'+port+'/main.html',{waitUntil:'domcontentloaded'});
 const sync=await page.evaluate(()=>bunplanRefreshRecipes());
 if(!sync.ok)failures.push({test:'live-catalog-refresh',sync});
 await page.evaluate(()=>{bp100.category='Toate';bp100.query='Terci de ovăz cu banane';go('library100')});
 await page.waitForTimeout(700);
 const result=await page.evaluate(()=>({
  rows:document.querySelectorAll('#bpCloudResults .bp-recipecard').length,
  imgs:[...document.querySelectorAll('#bpCloudResults .bp-recipecard img')].map(x=>({
   src:x.src,loaded:x.complete&&x.naturalWidth>0,naturalWidth:x.naturalWidth})),
  r001:BP100.find(x=>x.id==='R001')?.photo_url,
  approved:BP100.find(x=>x.id==='R001')?.image_reviewed,
  catalogCount:window.bunplanCatalogCount
 }));
 if(result.catalogCount<1100||!result.rows||!result.approved||
    !result.imgs.some(x=>x.loaded))
   failures.push({test:'live-verified-photo-in-recipe-card',result});
 await page.evaluate(()=>{bp100.category='Toate';bp100.query='Ardei umpluți cu carne tocată de curcan';go('library100')});
 await page.waitForTimeout(500);
 const bp=await page.evaluate(()=>({
  imgs:[...document.querySelectorAll('#bpCloudResults img')].map(x=>({src:x.src,loaded:x.complete&&x.naturalWidth>0})),
  count:document.querySelectorAll('#bpCloudResults .bp-recipecard').length
 }));
 if(!bp.count||!bp.imgs.some(x=>x.loaded))failures.push({test:'live-cloud-photo-card',bp});
 await page.evaluate(()=>{bp100.detail='BP0534';go('detail100')});
 await page.waitForTimeout(400);
 const detail=await page.evaluate(()=>{
  const img=document.querySelector('#bp50-recipe-detail-photo img');
  return {has:!!img,loaded:img?.complete&&img.naturalWidth>0,src:img?.src}
 });
 if(!detail.has||!detail.loaded)failures.push({test:'live-cloud-recipe-photo-detail',detail});
 mkdirSync('builds/ui-preview',{recursive:true});
 await page.screenshot({path:'builds/ui-preview/bunplan-57-live-cms-recipe-photo.png',fullPage:true});
 if(jsErrors.length)failures.push({test:'javascript-errors',errors:jsErrors.slice(0,5)});
 await page.close();
}catch(e){failures.push({fatal:String(e.stack||e)})}
finally{await browser.close();server.kill()}
console.log(JSON.stringify({passed:failures.length===0,records:photos.map(r=>({id:r.legacy_key,approved:r.image_reviewed})),failures},null,2));
if(failures.length)process.exit(1);
