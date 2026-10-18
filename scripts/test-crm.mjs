import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
const port=8896,root='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'});
await sleep(650);
const failures=[],browser=await chromium.launch({headless:true});
const known={
 user:{user_id:'eb62faa3-dd71-4e10-be37-99195f321029',email:'user@example.com',display_name:'Test User',city:'București',
 preferred_store:'lidl',weekly_budget_ron:500,number_of_plans:2,registered_at:'2026-10-15T10:00:00Z'},
 recipe:{id:'11111111-1111-4111-8111-111111111111',legacy_key:'BP0001',title:'Supă',category:'Supe'},
 ingredient:{id:'22222222-2222-4222-8222-222222222222',name:'Ovăz',slug:'ovaz',base_unit:'g'},
 product:{id:'33333333-3333-4333-8333-333333333333',store_id:'lidl',external_id:'test',name:'Ovăz integral',pack_amount:500,pack_unit:'g',category:'Cereale',image_url:null,active:true},
 estimate:{ingredient_id:'22222222-2222-4222-8222-222222222222',store_id:'lidl',estimated_pack_price_ron:2.49,suggested_pack_quantity:500,pack_unit:'g',estimate_method:'test'},
 settings:{key:'maintenance_banner',value:{enabled:false,message:''},description:'Banner',public_visible:true,updated_at:'2026-10-15T10:00:00Z'}
};
try{
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({status:200,body:'',contentType:'application/javascript'}));
 await page.addInitScript(({known})=>{
  let signedIn=false;
  window.__crmWrites=[];
  const dataFor=(name)=>{
   switch(name){
    case 'recipes':return [known.recipe];
    case 'ingredients':return [known.ingredient];
    case 'products':return [known.product];
    case 'price_estimates':return [known.estimate];
    case 'bunplan_app_settings':return [known.settings];
    case 'profiles':return [{...known.user,household_adults:2,household_children:0,onboarding_completed:true}];
    case 'weekly_plans':return [{id:'44444444-4444-4444-8444-444444444444',store_id:'lidl',user_id:known.user.user_id,week_start:'2026-10-12',weekly_budget_ron:450}];
    case 'bunplan_crm_notes':return [{id:'note123',user_id:known.user.user_id,note:'Interesat de rețete',tags:['trial'],followup_status:'active',created_at:'2026-10-16T13:00:00Z'}];
    case 'bunplan_feedback':return [{id:'feedback123',user_id:known.user.user_id,category:'bug',message:'Text prea mic',status:'open',admin_reply:null,created_at:'2026-10-17T13:00:00Z'}];
    case 'stores':return [{id:'lidl',name:'Lidl'},{id:'kaufland',name:'Kaufland'}];
    case 'store_locations':return [{name:'Lidl București',address:'București',city:'București',store_id:'lidl'}];
    case 'import_runs':return [{retailer_id:'lidl',source_kind:'test',started_at:'2026-10-17T10:00:00Z',status:'success',items_seen:3,items_written:3}];
    case 'product_prices':return [{product_id:known.product.id,store_id:'lidl',amount_ron:6.49,captured_on:'2026-10-17',source_kind:'manual_user'}];
    default:return [];
   }
  };
  window.supabase={createClient:()=>({
   auth:{
    async getSession(){return {data:{session:signedIn?{user:{id:known.user.user_id,email:'admin@example.com'}}:null}}},
    async getUser(){return {data:{user:{id:known.user.user_id,email:'admin@example.com'}}}},
    async signInWithPassword(){signedIn=true;return {error:null}},
    async signOut(){signedIn=false;return {error:null}}
   },
   async rpc(name){return {data:name==='is_bunplan_admin'?true:name==='bunplan_admin_user_directory'?[known.user]:{},error:null}},
   from(name){
    let mutation=false,changed=null,isHead=false;
    const builder={
     select(_s,opt={}){isHead=!!opt.head;return builder},
     order(){return builder},range(){return builder},eq(){return builder},ilike(){return builder},
     not(){return builder},or(){return builder},limit(){return builder},in(){return builder},
     update(x){mutation=true;changed=x;window.__crmWrites.push({name,op:'update',data:x});return builder},
     insert(x){mutation=true;changed=x;window.__crmWrites.push({name,op:'insert',data:x});return builder},
     single(){return Promise.resolve({error:null,data:mutation?{id:'ok'}:dataFor(name)[0]||null})},
     maybeSingle(){return Promise.resolve({error:null,data:dataFor(name)[0]||null})},
     then(resolve,reject){return Promise.resolve({error:null,data:isHead?null:dataFor(name),count:dataFor(name).length}).then(resolve,reject)}
    };return builder;
   },
   storage:{from(){return {async upload(){return {error:null}},getPublicUrl(){return {data:{publicUrl:'https://example.test/foo.png'}}}}}}
  })};
 },{known});
 await page.goto(root+'/admin/index.html',{waitUntil:'domcontentloaded'});
 await page.locator('#login-email').fill('admin@example.com');
 await page.locator('#login-password').fill('secret-password');
 await page.locator('#login-form button[type=submit]').click();
 await page.waitForSelector('#workspace:not(.hidden)',{timeout:7000});
 for(const section of ['users','plans','products','prices','stores','feedback','settings','audit']){
  await page.locator('[data-section="'+section+'"]').click();
  await page.waitForTimeout(140);
  if(!await page.locator('section#'+section+':visible').count())failures.push({test:'section-nav',section});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  if(overflow>3)failures.push({test:'desktop-overflow',section,overflow});
 }
 await page.locator('[data-section="users"]').click();
 await page.locator('[data-user]').first().click();
 if(!await page.locator('#crm-note-form').isVisible())failures.push({test:'user-card'});
 await page.locator('#crm-note-form textarea[name=note]').fill('Apel de follow-up pentru sugestie');
 await page.locator('#crm-note-form button').click();
 await page.locator('[data-section="products"]').click();
 await page.locator('[data-product]').first().click();
 await page.locator('#crm-product-form input[name=name]').fill('Ovăz integral 500g');
 await page.locator('#crm-product-form button.primary').click();
 await page.locator('[data-section="settings"]').click();
 await page.locator('.crm-setting-form textarea[name=value]').first().fill('{"enabled":true,"message":"Anunț BunPlan"}');
 await page.locator('.crm-setting-form button').first().click();
 // confirmation is mocked directly for the e2e UI. The DB still enforces RLS.
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-section="prices"]').click();
 await page.locator('#crm-price-product-search').fill('Ovăz');
 await page.waitForSelector('#crm-price-choices [data-pick]',{timeout:7000});
 await page.locator('#crm-price-choices [data-pick]').first().click();
 await page.locator('#crm-price-amount').fill('7.99');
 await page.locator('#crm-price-form button').click();
 page.once('dialog',dialog=>dialog.accept());
 const changes=await page.evaluate(()=>window.__crmWrites);
 for(const name of ['bunplan_crm_notes','products','bunplan_app_settings','product_prices']){
  if(!changes.some(x=>x.name===name))failures.push({test:'crm-mutation',name,changes});
 }
 if(errors.length)failures.push({test:'page-errors',errors});
 await page.close();
}catch(e){failures.push({fatal:String(e.stack||e)})}
finally{await browser.close();server.kill()}
console.log(JSON.stringify({passed:failures.length===0,failures},null,2));
if(failures.length)process.exit(1);
