import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {mkdirSync} from 'node:fs';
const port=8894,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'});
await pause(600);
const failures=[];const browser=await chromium.launch({headless:true});
async function mock(page,authorized=true){
 await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({status:200,body:'',contentType:'application/javascript'}));
 await page.addInitScript(value=>{
  let signedIn=false;
  const recipe={id:'11111111-1111-4111-8111-111111111111',legacy_key:'BP0001',title:'Terci de ovăz cu mere',
    category:'Mic dejun',servings:2,minutes_to_prepare:20,instructions:['Amestecă.','Fierbe.'],
    ingredient_details:[{name:'fulgi de ovăz',quantity:100,unit:'g'}],
    short_description:'Prima variantă',description:'Test',published:true,image_reviewed:false,
    photo_url:null,tags:[],allergens:[],source_status:'generated_unreviewed'};
  const ingredient={id:'22222222-2222-4222-8222-222222222222',slug:'ovaz',name:'Ovăz',
     base_unit:'g',image_url:null,image_reviewed:false};
  function builder(name){
   let isHead=false,mutation=false;
   const b={
    select(_fields,opts={}){isHead=opts.head===true;return b;},
    order(){return b},range(){return b},eq(){return b},not(){return b},or(){return b},ilike(){return b},
    update(fields){mutation=true;window.__lastSaved=fields;return b},
    insert(fields){mutation=true;window.__lastSaved=fields;return b},
    single(){return Promise.resolve({data:mutation?{id:recipe.id}:(name==='recipes'?recipe:ingredient),error:null})},
    then(resolve,reject){return Promise.resolve({data:isHead?null:[name==='recipes'?recipe:ingredient],count:1,error:null}).then(resolve,reject)}
   };
   return b;
  }
  window.__lastSaved=null;
  window.supabase={createClient:()=>({
    auth:{
      async getSession(){return {data:{session:signedIn?{user:{email:'admin@example.com'}}:null}}},
      async signInWithPassword(){signedIn=true;return {error:null}},
      async signOut(){signedIn=false;return {error:null}}
    },
    async rpc(){return {data:value,error:null}},
    from(name){return builder(name)},
    storage:{from(){return {async upload(){return {error:null}},getPublicUrl(){return {data:{publicUrl:'https://example.test/photo.webp'}}}}}
    }
  })};
 },authorized);
}
try{
 for(const width of [360,768]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await mock(page,true);
  await page.goto(base+'/admin/index.html',{waitUntil:'domcontentloaded'});
  if(await page.locator('#workspace').isVisible())failures.push({width,test:'unauthenticated-admin-visible'});
  await page.locator('#login-email').fill('admin@example.com');
  await page.locator('#login-password').fill('not-a-real-password');
  await page.locator('#login-form button').click();
  await page.waitForSelector('#workspace:not(.hidden)',{timeout:7000});
  await page.locator('[data-section="recipes"]').click();
  await page.locator('[data-edit-recipe]').first().click();
  const title=await page.locator('#edit-form input[name="title"]').inputValue();
  const ingredient=await page.locator('.ingredient-line').count();
  if(title!=='Terci de ovăz cu mere'||ingredient!==1)failures.push({width,test:'recipe-editor-load',title,ingredient});
  await page.locator('textarea[name="short_description"]').fill('Descriere editată manual în admin.');
  await page.locator('#editor-save').click();
  await page.waitForSelector('#editor-backdrop',{state:'hidden',timeout:7000});
  const saved=await page.evaluate(()=>window.__lastSaved);
  if(saved?.short_description!=='Descriere editată manual în admin.'||saved?.image_reviewed!==false)
    failures.push({width,test:'recipe-save-payload',saved});
  await page.locator('[data-section="ingredients"]').click();
  await page.locator('[data-edit-ingredient]').first().click();
  await page.locator('input[name="name"]').fill('Ovăz integral');
  await page.locator('#editor-save').click();
  await page.waitForSelector('#editor-backdrop',{state:'hidden',timeout:7000});
  const savedIngredient=await page.evaluate(()=>window.__lastSaved);
  if(savedIngredient.name!=='Ovăz integral')failures.push({width,test:'ingredient-save',savedIngredient});
  const horizontal=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  if(horizontal>2||errors.length)failures.push({width,test:'admin-responsive-errors',horizontal,errors});
  if(width===768){mkdirSync('builds/ui-preview',{recursive:true});await page.screenshot({path:'builds/ui-preview/admin-recipes-768.png',fullPage:true})}
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:780}});
 await mock(page,false);
 await page.goto(base+'/admin/index.html',{waitUntil:'domcontentloaded'});
 await page.locator('#login-email').fill('normal@example.com');
 await page.locator('#login-password').fill('not-a-real-password');
 await page.locator('#login-form button').click();
 await page.getByText('Acest cont nu are rol de administrator.').waitFor({state:'visible',timeout:7000}).catch(()=>{});
 const locked=await page.locator('#workspace').isVisible();
 const denied=await page.locator('#login-message').textContent();
 if(locked||!denied.includes('nu are rol de administrator'))failures.push({test:'non-admin-login-denied',locked,denied});
 await page.close();
}catch(e){failures.push({fatal:String(e.stack||e)})}
finally{await browser.close();server.kill()}
console.log(JSON.stringify({passed:failures.length===0,failures},null,2));
if(failures.length)process.exit(1);
