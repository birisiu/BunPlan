import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const server=spawn('python3',['-m','http.server','8897','--bind','127.0.0.1'],{stdio:'ignore'});
await delay(750);
const errors=[],browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.addInitScript(()=>{
  let loggedIn=false;
  window.__adminAuthActions=[];
  const db={
   auth:{
    async getSession(){return {data:{session:loggedIn?{user:{email:'ibirisiu@gmail.com'}}:null}}},
    async signInWithPassword(args){window.__adminAuthActions.push({action:'sign-in',email:args.email,passwordLength:args.password.length});loggedIn=true;return {error:null}},
    async resetPasswordForEmail(email,options){window.__adminAuthActions.push({action:'reset',email,redirectTo:options?.redirectTo});return {error:null}},
    async updateUser(payload){window.__adminAuthActions.push({action:'new-password',length:payload.password.length});return {error:null}},
    async signOut(){loggedIn=false;return {error:null}},
    onAuthStateChange(handler){window.__authListener=handler;return {data:{subscription:{unsubscribe(){}}}}},
    async getUser(){return {data:{user:{email:'ibirisiu@gmail.com'}}}}
   },
   async rpc(name){return {data:true,error:null}},
   from(name){
    let head=false;
    const b={select(_cols,args={}){head=!!args.head;return b},eq(){return b},not(){return b},
       order(){return b},range(){return b},then(resolve,reject){
        return Promise.resolve({data:head?null:[],count:0,error:null}).then(resolve,reject)}};
    return b;
   }
  };
  window.supabase={createClient(){return db}};
 });
 await page.goto('http://127.0.0.1:8897/admin/index.html',{waitUntil:'domcontentloaded'});
 await page.locator('#login-email').fill('OTHER');
 await page.locator('#login-password').fill('invalidpass');
 await page.locator('#login-form button[type=submit]').click();
 const bad=await page.locator('#login-message').textContent();
 const attempts=await page.evaluate(()=>window.__adminAuthActions.length);
 if(!bad?.includes('exclusiv utilizatorul ADMIN')||attempts!==0)errors.push('Other username should not call sign-in.');
 await page.locator('#login-email').fill('ADMIN');
 await page.locator('#login-reset-request').click();
 const request=await page.evaluate(()=>window.__adminAuthActions.find(x=>x.action==='reset'));
 if(request?.email!=='ibirisiu@gmail.com'||!request.redirectTo.includes('/admin/index.html'))errors.push('Password reset not sent to approved owner address.');
 await page.evaluate(()=>window.__authListener('PASSWORD_RECOVERY',{}));
 const modal=await page.locator('#password-setup').isVisible();
 if(!modal)errors.push('Recovery screen hidden');
 await page.locator('#password-suggest').click();
 const generated=await page.locator('#password-new').inputValue();
 if(generated.length<30||generated!==await page.locator('#password-confirm').inputValue())errors.push('Generated password weak or mismatched.');
 await page.locator('#password-setup-form button[type=submit]').click();
 const saved=await page.evaluate(()=>window.__adminAuthActions.find(x=>x.action==='new-password'));
 if(saved?.length!==generated.length)errors.push('Password update did not run');
 await page.locator('#login-email').fill('ADMIN');
 await page.locator('#login-password').fill('memorable-admin-password');
 await page.locator('#login-form button[type=submit]').click();
 await page.locator('#workspace:not(.hidden)').waitFor({timeout:7000});
 const signIn=await page.evaluate(()=>window.__adminAuthActions.find(x=>x.action==='sign-in'));
 if(signIn?.email!=='ibirisiu@gmail.com')errors.push('ADMIN not mapped to recovery email');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 if(overflow>2)errors.push('Responsive overflow '+overflow);
 await page.close();
}catch(e){errors.push(String(e.stack||e))}
finally{await browser.close();server.kill()}
console.log(JSON.stringify({passed:errors.length===0,errors},null,2));
if(errors.length)process.exitCode=1;