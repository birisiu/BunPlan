import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as wait} from 'node:timers/promises';
import {mkdirSync} from 'node:fs';
const port=8899,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory','android-native/app/src/main/assets'],{stdio:'ignore'});
await wait(750);
const failures=[],browser=await chromium.launch({headless:true});
let productTitle='Terci cu mere';
const settings=[{key:'maintenance_banner',value:{enabled:false,message:''}},
 {key:'shopping_notice',value:{enabled:true,message:'Prețuri orientative'}}];
const cms=[
 {section_key:'home',content:{subtitle:'Salut din Supabase'}},
 {section_key:'recipes',content:{title:'Rețete de gătit'}},
 {section_key:'navigation',content:{home:'Acasă',recipes:'Rețete',shopping:'Lista',profile:'Profil'}},
 {section_key:'shopping',content:{paid_title:'Cheltuielile săptămânii'}},
 {section_key:'profile',content:{title:'Profilul meu'}},
 {section_key:'retailers',content:{supported_stores:['Lidl','Kaufland']}}
];
const recipe=()=>[{legacy_key:'BP0001',title:productTitle,category:'Mic dejun',
 servings:2,minutes_to_prepare:20,variant_of:'Terci de ovăz cald',
 instructions:['Pune ovăzul în oală.','Amestecă și gătește 10 minute.'],
 ingredient_details:[{name:'fulgi de ovăz',quantity:150,unit:'g'}],
 short_description:'Descriere din CRM',description:'Pași actualizați',
 photo_url:null,image_reviewed:false,published:true,source_status:'reviewed',
 tags:['vegetarian'],allergens:[]}];
function priceRefs(){
 return Array.from({length:150},(_,i)=>['lidl','kaufland'].map(store_id=>({
  label:'ingredient_'+i,store_id,ingredient_slug:i===0?'ovaz':null,
  normalized_unit:'g',quantity_multiplier:1,estimated_price_ron:4.2,
  pack_quantity:500,pack_unit:'g',estimate_method:'budget_model_unverified'
 }))).flat();
}
const routeHandler=route=>{
 const u=route.request().url();
 const payload=u.includes('/recipes?')?recipe():u.includes('bunplan_recipe_ingredient_pricing')?priceRefs():
 u.includes('/ingredients?')?[]:u.includes('bunplan_app_settings')?settings:
 u.includes('/bunplan_content_sections?')?cms:[];
 return route.fulfill({status:200,contentType:'application/json',
  headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'},body:JSON.stringify(payload)});
};
try{
 for(const width of [320,390,430]){
  const page=await browser.newPage({viewport:{width,height:860}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/rest/v1/**',routeHandler);
  // Keep the synchronization test deterministic: promotions are a separate external feed.
  await page.route('**/api/promotions/current.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({schema_version:1,stores:{}})}));
  await page.addInitScript(()=>{
   window.BunPlanAuth={hasSession:()=>true,currentEmail:()=> 'tester@example.com'};
   window.BunPlanCloud={loadProfile(){},saveProfile(){},saveWeek(){},loadWeek(){},sendFeedback(){}};
   window.BunPlanAds={getStatus(){},showRewardedInterstitial(){}};
   localStorage.setItem('bunplan_onboard_v2',JSON.stringify({completed:true,store:'Lidl',name:'Tester',
    city:'București',budget:450,adults:2,children:0,diet:'Echilibrat',meals:3,time:30,exclusions:[]}));
  });
  await page.goto(base+'/main.html',{waitUntil:'domcontentloaded'});
  await page.locator('#bp54-tour-layer').waitFor({state:'visible',timeout:8000});
  const initial=await page.locator('#bp54-tour-title').textContent();
  if(!initial?.includes('Bine ai venit'))failures.push({width,test:'first-use',initial});
  if(width===390){mkdirSync('builds/ui-preview',{recursive:true});await page.screenshot({path:'builds/ui-preview/bunplan-54-first-use-tour.png',fullPage:true})}
  for(let i=0;i<9;i++){
   const b=page.locator('.bp54-tour-next');
   await b.click();
   if(i<8)await page.locator('#bp54-tour-layer').waitFor({state:'visible'});
  }
  const after=await page.evaluate(()=>({done:localStorage.getItem('bunplan_app_tour_v54_finished'),
   overlay:!!document.querySelector('#bp54-tour-layer'),
   pullGesture:!!document.querySelector('#bp56-pull-indicator'),
   refreshButtonGone:!document.querySelector('.bp54-refresh-button'),
   overflow:document.documentElement.scrollWidth-innerWidth}));
  if(after.done!=='1'||after.overlay||!after.pullGesture||!after.refreshButtonGone||after.overflow>2)
   failures.push({width,test:'finish-first-tour',after});
  await page.evaluate(()=>go('profile'));
  await page.locator('#bp54-start-tour').click();
  await page.locator('.bp54-tour-skip').click();
  const skipped=await page.evaluate(()=>({done:localStorage.getItem('bunplan_app_tour_v54_finished'),
   overlay:!!document.querySelector('#bp54-tour-layer')}));
  if(skipped.done!=='1'||skipped.overlay)failures.push({width,test:'skip-replay-tour',skipped});
  if(width===390){
   productTitle='Terci îmbunătățit de administrator';
   settings[0].value={enabled:true,message:'Anunț nou din CRM'};
   // Mimic the native touch gesture instead of clicking any refresh control.
   cms[0].content.subtitle='Actualizat prin CMS';
   const result=await page.evaluate(async()=>{
     const touch=(type,y)=>document.dispatchEvent(new TouchEvent(type,{
       bubbles:true,cancelable:true,touches:type==='touchend'?[]:[new Touch({identifier:1,target:document.body,clientX:150,clientY:y})],
       changedTouches:[new Touch({identifier:1,target:document.body,clientX:150,clientY:y})],
       targetTouches:type==='touchend'?[]:[new Touch({identifier:1,target:document.body,clientX:150,clientY:y})]
     }));
     go('home');window.scrollTo(0,0);
     touch('touchstart',80);touch('touchmove',195);touch('touchend',195);
     await new Promise(resolve=>setTimeout(resolve,250));
     return window.bunplanLastSync?{ok:window.bunplanLastSync.results.every(x=>x.ok)}:{ok:false};
   });
   const fresh=await page.evaluate(()=>({
    title:BP100.find(x=>x.id==='BP0001')?.title,
    at:window.bunplanLastSync?.at,settings:window.BunPlanPublicSettings?.maintenance_banner?.value?.message,
    notice:document.body.textContent.includes('Anunț nou din CRM'),
    copiedText:document.body.textContent.includes('Actualizat prin CMS'),
    planPreserved:Array.isArray(bp100.days)
   }));
   if(!result.ok||fresh.title!==productTitle||!fresh.at||
      fresh.settings!=='Anunț nou din CRM'||!fresh.notice||!fresh.copiedText||!fresh.planPreserved)
    failures.push({width,test:'crm-live-refresh',result,fresh});
  }
  if(errors.length)failures.push({width,test:'javascript-errors',errors});
  await page.close();
 }
}catch(e){failures.push({fatal:String(e.stack||e)})}
finally{await browser.close();server.kill()}
console.log(JSON.stringify({passed:failures.length===0,failures},null,2));
if(failures.length)process.exitCode=1;
