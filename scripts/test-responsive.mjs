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
   // Playwright locator.check() may itself scroll the page to the element;
   // trigger the native checkbox change with DOM click to isolate app scrolling.
   await page.evaluate(()=>{window.scrollTo(0,350);document.querySelector('main.scroll').dataset.qaStable='yes'});
   const before=await page.evaluate(()=>scrollY);
   await page.evaluate(()=>document.querySelector('.bp35-checklist .bp35-product input[type=checkbox]').click());
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


 // Regression sweep: all major app screens must render without JS errors or
 // horizontal overflow on common phone widths (including 320px).
 for(const width of [320,360,390,430,768]){
  const page=await browser.newPage({viewport:{width,height:760},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.BunPlanAuth={hasSession(){return true;},currentEmail(){return 'qa@example.com';}};
    window.BunPlanCloud={loadProfile(){},saveProfile(){},saveWeek(){},loadWeek(){}};
    window.BunPlanAds={getStatus(){},showRewardedInterstitial(){}};
    localStorage.setItem('bunplan_onboard_v2',JSON.stringify({
      completed:true,store:'Lidl',name:'QA',city:'București',budget:450,
      adults:2,children:1,diet:'Echilibrat',meals:3,time:30,exclusions:[]}));
  });
  await page.goto(base+'/main.html',{waitUntil:'domcontentloaded'});
  for(const screen of ['home','stores','menu100','basket100','library100','profile']){
    const state=await page.evaluate(tab=>{
      go(tab);
      return {tab:window.state?.tab||null,width:document.documentElement.scrollWidth,
        vw:innerWidth,main:!!document.querySelector('main.scroll'),
        menu:!!document.querySelector('nav.bottom'),
        buttons:[...document.querySelectorAll('button')].length,
        title:document.querySelector('h1')?.textContent?.slice(0,80)
      };
    },screen);
    if(screen==='home'){
      const b=await page.evaluate(()=>({
        home:!!document.querySelector('.bp-brand-home'),
        dayCount:document.querySelectorAll('.bp-weekline button').length,
        logo:!!document.querySelector('.bp-brand-symbol')&&document.querySelector('.bp-brand-symbol').naturalWidth>0,
        navCount:document.querySelectorAll('nav.bottom .nav').length,
        navIcons:document.querySelectorAll('nav.bottom .nav .ni svg').length,
        budget:!!document.querySelector('.bp-brand-ring'),
        theme:getComputedStyle(document.body).backgroundColor
      }));
      if(!b.home||b.dayCount!==7||!b.logo||b.navCount!==4||b.navIcons!==4||!b.budget)
        failures.push({test:'branding-home',width,b});
      if(width===390)await page.screenshot({path:screens+'/bunplan-brand-home-390.png',fullPage:true});
    }
        if(state.width>state.vw+2||!state.main||!state.menu||state.buttons<2||errors.length)
      failures.push({test:'navigation-responsive-smoke',width,screen,state,errors:[...errors]});
  }
  await page.evaluate(()=>{bp100.detail='R001';go('detail100')});
  const recipeDetails=await page.locator('.bp-steps li').count();
  if(recipeDetails<2||errors.length)failures.push({test:'classic-recipe-steps',width,recipeDetails,errors});
  await page.close();
 }
 // Cloud catalog regression: 1000 records from Supabase + 100 classic recipes
 // should appear in the searchable app library without breaking recipe details.
 {
   const page=await browser.newPage({viewport:{width:390,height:850}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const cloud=Array.from({length:1000},(_,i)=>({
     legacy_key:'BP'+String(i+1).padStart(4,'0'),title:i===0?'Terci de ovăz cu mere':'Rețeta cloud '+(i+1),
     category:'Mic dejun',servings:2,minutes_to_prepare:18,
     instructions:['Spală ingredientele.','Prepară la foc mic.','Servește.'],
     ingredient_details:i===0?[{name:'fulgi de ovăz',quantity:100,unit:'g'},{name:'migdale',quantity:20,unit:'g'}]:[{name:'mere',quantity:150,unit:'g'}],tags:['vegetarian'],allergens:[],source_status:'generated_unreviewed'
   }));
   await page.route('**/rest/v1/recipes**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(cloud)}));
   const refs=Array.from({length:165},(_,i)=>i===0?'fulgi de ovăz':i===1?'migdale':'ingredient_mock_'+i).flatMap(label=>
     ['lidl','kaufland'].map(store_id=>({
       label,store_id,ingredient_slug:label==='fulgi de ovăz'?'ovaz':null,
       quantity_multiplier:1,normalized_unit:'g',mapping_note:'test',
       pack_quantity:label==='fulgi de ovăz'?500:null,pack_unit:label==='fulgi de ovăz'?'g':null,
       estimated_price_ron:label==='fulgi de ovăz'?(store_id==='lidl'?2.49:3.49):null,
       estimate_method:'budget_model_unverified'
     })));
   await page.route('**/rest/v1/bunplan_recipe_ingredient_pricing**',route=>
     route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(refs)}));
   await page.route('**/rest/v1/bunplan_store_catalog_prices**',route=>
     route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{store_id:'lidl',name:'Mere Golden',pack_amount:null,pack_unit:null,amount_ron:3.49,captured_on:'2026-10-17',source_url:'https://www.lidl.ro/'}])}));
   await page.addInitScript(()=>{
     window.BunPlanAuth={hasSession(){return true;},currentEmail(){return 'qa@example.com'}};
     window.BunPlanCloud={loadProfile(){},saveProfile(){},saveWeek(){},loadWeek(){}};
     window.BunPlanAds={getStatus(){},showRewardedInterstitial(){}};
     localStorage.setItem('bunplan_onboard_v2',JSON.stringify({completed:true,store:'Lidl',city:'București',name:'Tester',budget:450,adults:2,children:0,diet:'Echilibrat',meals:3,time:30,exclusions:[]}));
   });
   await page.goto(base+'/main.html',{waitUntil:'domcontentloaded'});
   await page.evaluate(()=>go('library100'));
   await page.waitForFunction(()=>document.body.textContent.includes('1.100 rețete disponibile'),null,{timeout:15000});
   const gallery=await page.evaluate(()=>({
      count:document.querySelectorAll('nav.bottom .nav').length,
      grid:getComputedStyle(document.querySelector('#bpCloudResults')).gridTemplateColumns,
      width:document.documentElement.scrollWidth-window.innerWidth,
      logo:document.querySelector('.bp-brand-symbol')?.naturalWidth||0
   }));
   if(gallery.count!==4||gallery.width>2||gallery.logo===0)
      failures.push({test:'branded-recipe-gallery',gallery});
   await page.screenshot({path:screens+'/bunplan-brand-recipes-390.png',fullPage:true});
   await page.locator('.p-headsearch').fill('Terci de ovăz cu mere');
   const searchCount=await page.locator('#bpCloudCount').textContent();
   const cloudButton=page.locator('#bpCloudResults button').filter({hasText:'Terci de ovăz cu mere'}).first();
   const found=await cloudButton.isVisible();
   if(found)await cloudButton.click();
   const details=await page.getByText('Cum se prepară, pas cu pas').isVisible();
   if(!found||!details||errors.length)failures.push({test:'cloud-catalog',searchCount,found,details,errors});
   await page.waitForFunction(()=>BP100.some(x=>x.id==='BP0001'&&x.cloud),null,{timeout:10000});
   const add=page.locator('button').filter({hasText:'Adaugă în plan'}).last();
   if(await add.isVisible())await add.click();
   const planned=await page.evaluate(()=>bp100.days[0]['Mic dejun']==='BP0001');
   if(!planned)failures.push({test:'cloud-recipe-plan-assignment',planned});
   await page.evaluate(()=>{state.unlocks[bp35Key()]=true;storage();go('basket100')});
   const shopping=await page.evaluate(()=>({
     count:document.querySelectorAll('.bp35-checklist .bp35-product input[type="checkbox"]').length,
     missing:bp35Calc().missing,store:bp35.store,
     subtotal:bp35Calc().total,mark:document.body.textContent.includes('subtotal')
   }));
   if(shopping.count!==2||shopping.missing!==1||shopping.store!=='Lidl'||!shopping.mark)
      failures.push({test:'cloud-recipe-shopping',shopping});
   // Regression for the screenshot: the ingredient name must not break into
   // one-character lines when price and "Caută în catalog" appear beside it.
   for(const width of [320,360,390,430,768]){
     await page.setViewportSize({width,height:840});
     const sizes=await page.evaluate(()=>{
       const el=document.querySelector('.bp35-checklist .bp35-product');
       const info=el?.querySelector('.bp35-productinfo');
       const name=info?.querySelector('b');
       const actions=el?.querySelector('.bp48-shopping-actions');
       const price=el?.querySelector('.bp48-shopping-price');
       const rect=x=>x?.getBoundingClientRect();
       const r=rect(el),n=rect(name),a=rect(actions),p=rect(price);
       return {
         itemWidth:r?.width,itemHeight:r?.height,nameWidth:n?.width,
         infoWidth:rect(info)?.width,actionsWidth:a?.width,
         priceWidth:p?.width,priceOutside:p?.right>r?.right+1,
         actionOutside:a?.right>r?.right+1,
         horizontalOverflow:document.documentElement.scrollWidth-window.innerWidth,
         text:name?.textContent,rows:document.querySelectorAll('.bp35-checklist .bp35-product').length,
       };
     });
     if(!sizes.itemWidth||sizes.nameWidth<130||sizes.itemHeight>270||
        sizes.priceOutside||sizes.actionOutside||sizes.horizontalOverflow>2||
        sizes.text!=='fulgi de ovăz'||sizes.rows!==2)
       failures.push({test:'visual-shopping-layout',width,sizes});
     if(width===390)await page.screenshot({path:screens+'/shopping-products-390.png',fullPage:true});
   }
   await page.setViewportSize({width:390,height:840});
   const queryButton=page.locator('.bp48-shopping-actions button').filter({hasText:'Caută în catalog'}).first();
   await queryButton.click();
   const dialogOpen=await page.locator('#bp-product-search-modal').isVisible();
   if(!dialogOpen)failures.push({test:'catalog-modal-open'});
   await page.locator('#bp-catalog-close').click();
   if(await page.locator('#bp-product-search-modal').count())failures.push({test:'catalog-modal-close'});
   await page.evaluate(()=>document.querySelector('.bp35-checklist input[type="checkbox"]')?.click());
   const checked=await page.evaluate(()=>document.querySelector('.bp35-boughtheading span')?.textContent);
   if(!checked?.startsWith('1/'))failures.push({test:'cloud-recipe-checkbox',checked});
   const prices=await page.evaluate(()=>{
      const lidl=bp35Calc().total;
      bp35ChooseStore('Kaufland');bp100.days[0]['Mic dejun']='BP0001';bp35Commit();
      const kaufland=bp35Calc().total;
      const storeIsolation=Object.values(bp35.bought[bp35Key()]||{}).some(Boolean);
      return {lidl,kaufland,storeIsolation};
   });
   if(!(prices.kaufland>prices.lidl)||prices.storeIsolation)failures.push({test:'store-pricing-and-purchased-isolation',prices});
   await page.close();
 }
}catch(e){failures.push({fatal:String(e.stack||e)})}
finally{if(browser)await browser.close();server.kill();}
console.log(JSON.stringify({passed:!failures.length,failures},null,2));
if(failures.length)process.exit(1);
