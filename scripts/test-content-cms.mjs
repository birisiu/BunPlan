import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
const server=spawn('python3',['-m','http.server','8895','--bind','127.0.0.1'],{stdio:'ignore'});
await sleep(700);const failures=[],browser=await chromium.launch({headless:true});
try{
 for(const width of [360,980]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.addInitScript(()=>{
   let signedIn=false;
   const content=[
    {section_key:'home',title:'Acasă',content:{subtitle:'Planifică simplu',
     catalog_title:'idei noi',featured_recipe_ids:['BP0001'],enabled:true},
     published:true,updated_at:'2026-10-18T10:00:00Z'},
    {section_key:'tour',title:'Tutorial',content:{enabled:true,
      steps:[{tab:'home',title:'Bine ai venit',body:'Primul pas',icon:'🌿'}]},
      published:true,updated_at:'2026-10-18T10:00:00Z'}
   ];
   window.__cmsUpdates=[];
   function builder(name){
    let head=false,update=null,record=null;
    return Object.assign({
      select(_fields,opts={}){head=!!opts.head;return this},
      order(){return this},eq(_key,_value){record=_value;return this},
      update(payload){update=payload;window.__cmsUpdates.push({name,record,payload});return this},
      single(){return Promise.resolve({error:null,data:name==='bunplan_content_sections'?
       {...content.find(x=>x.section_key===record),...update,updated_at:new Date().toISOString()}:{id:'updated'}})},
      then(resolve,reject){const rows=name==='bunplan_content_sections'?content:[];
        return Promise.resolve({data:head?null:rows,count:rows.length,error:null}).then(resolve,reject)}
    });
   }
   window.supabase={createClient:()=>({
    auth:{
     async getSession(){return {data:{session:signedIn?{user:{id:'admin-uuid',email:'ibirisiu@gmail.com'}}:null}}},
     async signInWithPassword(){signedIn=true;return {error:null}},
     async getUser(){return {data:{user:{id:'admin-uuid'}}}},
     async signOut(){signedIn=false;return {error:null}},
     onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}
    },
    async rpc(){return {data:true,error:null}},
    from(name){return builder(name)},
    storage:{from(){return {async upload(){return {error:null}},getPublicUrl(){return {data:{publicUrl:'https://example.com/x.jpg'}}}}}}
   })};
  });
  await page.goto('http://127.0.0.1:8895/admin/index.html',{waitUntil:'domcontentloaded'});
  await page.locator('#login-email').fill('ADMIN');
  await page.locator('#login-password').fill('secure-password');
  await page.locator('#login-form button[type=submit]').click();
  await page.locator('#workspace:not(.hidden)').waitFor();
  await page.locator('[data-section=content]').click();
  await page.locator('#bp56-content-categories [data-cms-key=home]').waitFor();
  await page.locator('#bp56-cms-form [data-field=subtitle]').fill('Salut din noul CRM');
  await page.locator('#bp56-cms-form button[type=submit]').click();
  await page.waitForFunction(()=>window.__cmsUpdates.length>0,{timeout:8000});
  const saved=await page.evaluate(()=>window.__cmsUpdates.at(-1));
  if(saved.name!=='bunplan_content_sections'||saved.record!=='home'||
     saved.payload.content.subtitle!=='Salut din noul CRM')failures.push({width,test:'cms-write',saved});
  await page.locator('#bp56-content-categories [data-cms-key=tour]').click();
  const input=page.locator('#bp56-cms-form [data-field=steps]');
  if(!await input.isVisible())failures.push({width,test:'cms-tour-config'});
  if(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)>2)
    failures.push({width,test:'cms-responsive-overflow'});
  if(errors.length)failures.push({width,test:'cms-js-errors',errors});
  await page.close();
 }
}catch(e){failures.push({fatal:String(e.stack||e)})}
finally{await browser.close();server.kill()}
console.log(JSON.stringify({passed:failures.length===0,failures},null,2));
if(failures.length)process.exit(1);
