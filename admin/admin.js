/* BunPlan Content Studio — authenticated, RLS-protected Supabase editor.
   No service_role key or admin credentials are embedded in this client.
*/
(() => {
'use strict';
const PROJECT_URL='https://aedyviqoelgbbrrtwayu.supabase.co';
const KEY='sb_publishable_pLh8mKxNWKkq396TyM518A_N_q7fm0Z';
const db=window.supabase?.createClient(PROJECT_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const ADMIN_USERNAME='ADMIN';
const RECOVERY_EMAIL='ibirisiu@gmail.com';
let recoveryMode=false;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL=url=>{try{const u=new URL(url);return u.protocol==='https:'?u.href:''}catch{return ''}};
const session={section:'dashboard',recipes:{page:0,per:40,query:'',filter:'all',count:0},ingredients:{page:0,per:40,query:'',count:0},editing:null,photoFile:null,photoPreview:null,loggedIn:false};
let tSearch;
function flash(s,ok=false){$('flash').textContent=s||'';$('flash').className='message'+(ok?' ok':'')}
function loginMessage(s){$('login-message').textContent=s||''}
function updateScreen(authenticated){
 session.loggedIn=authenticated;
 $('login').classList.toggle('hidden',authenticated||recoveryMode);
 $('workspace').classList.toggle('hidden',!authenticated||recoveryMode);
 $('password-setup').classList.toggle('hidden',!recoveryMode);
}
function showRecovery(){
 recoveryMode=true;updateScreen(false);
 $('password-message').textContent='';
}
function randomIndex(max){
 const lim=Math.floor(0x100000000/max)*max;
 let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0]}while(n>=lim);
 return n%max;
}
async function authenticate(){
 if(!db){loginMessage('Biblioteca Supabase nu s-a încărcat. Reîncarcă pagina.');return}
 const {data:{session:authSession}}=await db.auth.getSession();
 if(!authSession){updateScreen(false);return}
 if(recoveryMode){updateScreen(false);return}
 const {data:allowed,error}=await db.rpc('is_bunplan_admin');
 if(error||allowed!==true){
  updateScreen(false);await db.auth.signOut();
  loginMessage('Acest cont nu are rol de administrator. Solicitați acordarea accesului de către proprietarul proiectului.');return;
 }
 $('admin-email').textContent=authSession.user.email||'Administrator';
 updateScreen(true);document.dispatchEvent(new CustomEvent('bunplan-admin-authenticated'));await loadDashboard();
}
$('login-reset-request').onclick=async()=>{
 if(!db){loginMessage('Supabase indisponibil.');return}
 const btn=$('login-reset-request');btn.disabled=true;
 loginMessage('Se trimite linkul securizat către adresa de recuperare a contului ADMIN…');
 try{
  const {error}=await db.auth.resetPasswordForEmail(RECOVERY_EMAIL,{
   redirectTo:window.location.origin+window.location.pathname
  });
  if(error)throw error;
  loginMessage('Dacă adresa este configurată în Supabase, vei primi un e-mail cu linkul pentru setarea parolei. Verifică și Spam.');
 }catch(e){loginMessage('Nu s-a putut trimite linkul: '+e.message)}
 finally{btn.disabled=false}
};
$('login-form').addEventListener('submit',async e=>{
 e.preventDefault();
 const btn=e.submitter,username=$('login-email').value.trim().toUpperCase();
 if(username!==ADMIN_USERNAME){loginMessage('Acest CRM acceptă exclusiv utilizatorul ADMIN.');return}
 btn.disabled=true;loginMessage('Se verifică autentificarea ADMIN…');
 try{
  if(!db)throw Error('Supabase indisponibil.');
  const {error}=await db.auth.signInWithPassword({email:RECOVERY_EMAIL,password:$('login-password').value});
  if(error)throw error;
  loginMessage('');await authenticate();
 }catch(error){loginMessage('Autentificarea nu a reușit. Verifică parola sau folosește recuperarea.')}
 finally{btn.disabled=false}
});
const WORDS=['menta','stejar','albastru','astru','ramura','luna','cedru','piper','castan','izvor',
 'trandafir','carte','salcie','umbra','coral','munte','iris','nisip','curcubeu','zori',
 'lampas','prun','tulipan','drum','balcon','toamna','cireasa','lavanda','trandafir','stanca',
 'soare','noroc','viitor','liniste','roata','gradina','castel','brad','racheta','visin',
 'punte','nuc','steag','taina','lac','boboc','liliac','pajiste','pictura','mare',
 'cafea','aurora','avion','carabus','faleza','inghetata','briza','motan','frunza','vers',
 'puntea','vioara','vis','fluture','apa','tigrul','pasare','lemn','piatra','privire',
 'mesteacan','ramasag','cobalt','smochina','coasta','capsuna','antena','margareta',
 'cometa','zmeura','proaspata','mica','panda','ploaie','candela','curaj','tobogan',
 'voiaj','picatura','perla','clopot','zmeu','radu','stejarul','teatru','pod','poveste',
 'bulgare','rond','prundis','harta','dulap','palarie','marmura','radacina','bulevard',
 'verde','campie','aripa','calator','nufar','orhidee','vapor','melodie','caiet',
 'atmosfera','aluna','tartina','salba','planeta','agava','limonada','cascada','mister',
 'amulet','cais','safir','miez','tempo','delfin','padure','roinita','bucurie',
 'caramel','izolat','pahar','molid','pelican','carte','toamna','mac','caramida','iarba',
 'jurnal','cort','furtuna','horizon','azur','mica','aromat','tandrete','alun',
 'saturn','prieten','scoica','panza','castor','marinar','flamura','violet','optim',
 'barca','pian','vultur','zambet','lupin','plop','mugur','stejar','arta',
 'baston','rafala','vant','violet','nor','feriga','padurar','arcada','migdal',
 'mar','tramvai','luminis','linte','alpin','nectar','anason','desert','razvan',
 'pajura','fier','lira','haina','romanta','imaginatie','papadie','rodie',
 'almanah','somn','povarnis','vioara','lotus','carte','petal','arhanghel',
 'tigru','maree','malin','apricot','radio','caprioara','maslin','perete',
 'atlas','oceane','gradinar','lumanare','floare','flori','peisaj','marmota',
 'foc','balena','rasarit','venin','aprilie','glorie','visator','cupa',
 'crom','ventilator','desen','cusatura','indigo','motor','miracol','gand',
 'bunic','sambure','vulcan','ulcior','sclipire','sanatos','magnet','silaba',
 'funie','saculet','carnet','izbanda','aroma','auriu','pepene','zenit','liniar',
 'cocos','glazura','sunet','palma','orizont','grad'];
$('password-suggest').onclick=()=>{
 const words=[];for(let i=0;i<7;i++)words.push(WORDS[randomIndex(WORDS.length)]);
 const digits=String(randomIndex(10000)).padStart(4,'0');
 const pass=words.join('-')+'!'+digits;
 $('password-new').value=pass;$('password-confirm').value=pass;
 $('password-new').type='text';$('password-confirm').type='text';
 $('password-message').textContent='Parolă generată local. Noteaz-o într-un manager de parole sau într-un loc securizat, apoi apasă Salvează.';
};
$('password-setup-form').onsubmit=async e=>{
 e.preventDefault();
 const one=$('password-new').value,two=$('password-confirm').value;
 if(one!==two||one.length<16){$('password-message').textContent='Parolele trebuie să fie identice și să conțină minimum 16 caractere.';return}
 const btn=e.submitter;btn.disabled=true;
 $('password-message').textContent='Se actualizează parola…';
 try{
  const {error}=await db.auth.updateUser({password:one});
  if(error)throw error;
  await db.auth.signOut();
  recoveryMode=false;history.replaceState(null,'',location.origin+location.pathname);
  $('password-new').value='';$('password-confirm').value='';
  $('password-new').type='password';$('password-confirm').type='password';
  updateScreen(false);
  loginMessage('Parola ADMIN a fost setată. Autentifică-te cu ADMIN și noua parolă.');
 }catch(error){$('password-message').textContent='Nu s-a putut salva parola: '+error.message}
 finally{btn.disabled=false}
};
if(db){
 if(typeof db.auth.onAuthStateChange==='function'){
  db.auth.onAuthStateChange((event)=>{
   if(event==='PASSWORD_RECOVERY')showRecovery();
  });
 }
 if(location.hash.includes('type=recovery')||new URLSearchParams(location.search).get('type')==='recovery'){
  showRecovery();
 }
}
$('logout').onclick=async()=>{await db.auth.signOut();updateScreen(false);loginMessage('Deconectat.')};
function section(name){
 session.section=name;for(const s of document.querySelectorAll('.panel-section'))s.classList.toggle('hidden',s.id!==name);
 for(const b of document.querySelectorAll('.tab'))b.classList.toggle('active',b.dataset.section===name);
 $('page-title').textContent={dashboard:'Dashboard',recipes:'Biblioteca de rețete',ingredients:'Ingrediente',users:'Utilizatori / CRM',plans:'Meniuri și liste',products:'Produse',prices:'Prețuri',stores:'Magazine și importuri',feedback:'Sesizări',content:'Conținut aplicație',settings:'Setări aplicație',audit:'Istoric modificări'}[name]||'BunPlan CRM';
 flash('');if(name==='dashboard')loadDashboard();if(name==='recipes')loadRecipes();if(name==='ingredients')loadIngredients();
 document.dispatchEvent(new CustomEvent('bunplan-admin-section',{detail:{name}}));
}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>section(b.dataset.section));
$('review-photos').onclick=()=>{$('recipe-filter').value='no-photo';session.recipes.filter='no-photo';session.recipes.page=0;section('recipes')};
async function loadDashboard(){
 try{
  const [all,approved,unpublished,ingredientCount,ingredientPhotoCount]=await Promise.all([
   db.from('recipes').select('id',{head:true,count:'exact'}),
   db.from('recipes').select('id',{head:true,count:'exact'}).eq('image_reviewed',true).not('photo_url','is',null),
   db.from('recipes').select('id',{head:true,count:'exact'}).eq('published',false),
   db.from('ingredients').select('id',{head:true,count:'exact'}),
   db.from('ingredients').select('id',{head:true,count:'exact'}).eq('image_reviewed',true).not('image_url','is',null)]);
  const results=[all,approved,unpublished,ingredientCount,ingredientPhotoCount];
  const error=results.find(x=>x.error)?.error;if(error)throw error;
  const cards=[
   ['Rețete totale',all.count],['Cu fotografie verificată',approved.count],
   ['Fără fotografie verificată',(all.count||0)-(approved.count||0)],
   ['Rețete nepublicate',unpublished.count],
   ['Ingrediente',ingredientCount.count],['Ingrediente cu fotografie',ingredientPhotoCount.count]
  ];
  $('stats').innerHTML=cards.map(([title,n])=>'<div class="stat"><small>'+esc(title)+'</small><strong>'+Number(n||0).toLocaleString('ro-RO')+'</strong></div>').join('');
 }catch(e){flash('Eroare la statistici: '+e.message)}
}
const recipeCols='id,legacy_key,title,short_description,description,category,servings,minutes_to_prepare,instructions,ingredient_details,tags,allergens,photo_url,photo_credit,image_reviewed,published,source_status,updated_at';
async function loadRecipes(){
 const p=session.recipes;flash('');
 try{
  let query=db.from('recipes').select(recipeCols,{count:'exact'}).order('title',{ascending:true}).range(p.page*p.per,(p.page+1)*p.per-1);
  if(p.query)query=query.ilike('title','%'+p.query.replace(/[%,()]/g,' ')+'%');
  if(p.filter==='no-photo')query=query.or('photo_url.is.null,image_reviewed.eq.false');
  if(p.filter==='draft')query=query.eq('published',false);
  if(p.filter==='review')query=query.eq('source_status','generated_unreviewed');
  const {data,count,error}=await query;if(error)throw error;
  p.count=count||0;
  $('recipe-table').innerHTML=(data||[]).map(x=>'<tr>'+
   '<td><strong>'+esc(x.title)+'</strong><small>'+esc(x.legacy_key||'')+' · '+esc(x.source_status||'')+'</small></td>'+
   '<td>'+esc(x.category)+'</td><td>'+thumb(x.photo_url,x.image_reviewed)+'</td>'+
   '<td><span class="pill '+(x.published?'live':'warn')+'">'+(x.published?'Publicată':'Ciornă')+'</span></td>'+
   '<td class="table-actions"><button class="light" data-edit-recipe="'+esc(x.id)+'">Editează →</button></td></tr>').join('')||'<tr><td colspan="5">Nu sunt rețete pentru filtrul selectat.</td></tr>';
  $('recipe-count').textContent=(p.count?p.page*p.per+1:0)+'–'+Math.min((p.page+1)*p.per,p.count)+' din '+p.count;
  $('recipe-prev').disabled=p.page===0;$('recipe-next').disabled=(p.page+1)*p.per>=p.count;
  $('recipe-table').querySelectorAll('[data-edit-recipe]').forEach(b=>b.onclick=()=>openRecipe(b.dataset.editRecipe));
 }catch(e){flash('Nu am putut încărca rețetele: '+e.message)}
}
function thumb(url,reviewed){
 const good=reviewed&&safeURL(url);
 return good?'<img class="thumb" src="'+esc(safeURL(url))+'" loading="lazy" alt="Fotografie verificată">':
 '<span class="thumb-placeholder">De verificat</span>';
}
async function loadIngredients(){
 const p=session.ingredients;flash('');
 try{
  let query=db.from('ingredients').select('id,slug,name,base_unit,description,image_url,image_reviewed,updated_at',{count:'exact'})
   .order('name',{ascending:true}).range(p.page*p.per,(p.page+1)*p.per-1);
  if(p.query)query=query.ilike('name','%'+p.query.replace(/[%,()]/g,' ')+'%');
  const {data,count,error}=await query;if(error)throw error;p.count=count||0;
  $('ingredient-table').innerHTML=(data||[]).map(x=>'<tr><td><strong>'+esc(x.name)+'</strong><small>'+esc(x.slug)+'</small></td>'+
   '<td>'+esc(x.base_unit)+'</td><td>'+thumb(x.image_url,x.image_reviewed)+'</td>'+
   '<td><button class="light" data-edit-ingredient="'+esc(x.id)+'">Editează →</button></td></tr>').join('')||'<tr><td colspan="4">Nu sunt ingrediente.</td></tr>';
  $('ingredient-count').textContent=(p.count?p.page*p.per+1:0)+'–'+Math.min((p.page+1)*p.per,p.count)+' din '+p.count;
  $('ingredient-prev').disabled=p.page===0;$('ingredient-next').disabled=(p.page+1)*p.per>=p.count;
  $('ingredient-table').querySelectorAll('[data-edit-ingredient]').forEach(b=>b.onclick=()=>openIngredient(b.dataset.editIngredient));
 }catch(e){flash('Nu am putut încărca ingredientele: '+e.message)}
}
$('recipe-search').oninput=e=>{clearTimeout(tSearch);tSearch=setTimeout(()=>{session.recipes.query=e.target.value.trim();session.recipes.page=0;loadRecipes()},260)};
$('ingredient-search').oninput=e=>{clearTimeout(tSearch);tSearch=setTimeout(()=>{session.ingredients.query=e.target.value.trim();session.ingredients.page=0;loadIngredients()},260)};
$('recipe-filter').onchange=e=>{session.recipes.filter=e.target.value;session.recipes.page=0;loadRecipes()};
for(const kind of ['recipe','ingredient']){
 $(kind+'-prev').onclick=()=>{session[kind+'s'].page--;kind==='recipe'?loadRecipes():loadIngredients()};
 $(kind+'-next').onclick=()=>{session[kind+'s'].page++;kind==='recipe'?loadRecipes():loadIngredients()};
}
$('new-recipe').onclick=()=>openRecipe(null);
$('new-ingredient').onclick=()=>openIngredient(null);
$('editor-close').onclick=closeEditor;$('editor-cancel').onclick=closeEditor;
$('editor-backdrop').onclick=e=>{if(e.target===$('editor-backdrop'))closeEditor()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('editor-backdrop').classList.contains('hidden'))closeEditor()});
function closeEditor(){
 $('editor-backdrop').classList.add('hidden');$('edit-fields').innerHTML='';
 session.editing=null;session.photoFile=null;
 if(session.photoPreview){URL.revokeObjectURL(session.photoPreview);session.photoPreview=null}
}
function label(name,title,value='',attr=''){return '<label>'+esc(title)+'<input name="'+name+'" value="'+esc(value)+'" '+attr+'></label>'}
function area(name,title,value='',rows=4){return '<label class="field-full">'+esc(title)+'<textarea name="'+name+'" rows="'+rows+'">'+esc(value)+'</textarea></label>'}
function bool(name,title,value=false){return '<label class="checkline"><input type="checkbox" name="'+name+'" '+(value?'checked':'')+'>'+esc(title)+'</label>'}
function photoFields(row,kind){
 const image=kind==='recipe'?row?.photo_url:row?.image_url;
 return '<fieldset class="editor-fieldset"><legend>Fotografie verificată</legend>'+
 '<p>Încarcă o fotografie care reprezintă <strong>exact</strong> preparatul sau ingredientul. Nu se vor afișa automat fotografii aproximative.</p>'+
 '<img id="photo-preview" class="image-preview" src="'+esc(safeURL(image))+'" alt="Previzualizare fotografie" style="'+(safeURL(image)?'':'display:none')+'">'+
 '<div class="photo-row"><input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp">'+
 '<button class="light" type="button" id="photo-remove">Elimină fotografia</button></div>'+
 label('photo_credit','Credit foto / licență',row?.photo_credit||'')+
 bool('image_reviewed','Confirm că fotografia reprezintă corect conținutul și am dreptul să o public.',!!row?.image_reviewed)+
 '<p>Maxim 5 MB; JPG, PNG sau WebP. Salvarea imaginii necesită autentificare de administrator.</p></fieldset>';
}
async function openRecipe(id){
 try{
  let row=null;
  if(id){const {data,error}=await db.from('recipes').select(recipeCols).eq('id',id).single();if(error)throw error;row=data}
  session.editing={kind:'recipe',row,removePhoto:false};session.photoFile=null;
  $('editor-type').textContent='BIBLIOTECA DE REȚETE';$('editor-heading').textContent=row?'Editează rețeta':'Rețetă nouă';
  $('edit-fields').innerHTML='<div class="grid-2">'+
   label('title','Denumire rețetă',row?.title||'','required maxlength="160"')+
   label('category','Categorie',row?.category||'Prânz','required')+
   label('servings','Porții',row?.servings||2,'type="number" min="1" max="40" required')+
   label('minutes_to_prepare','Timp total (minute)',row?.minutes_to_prepare||30,'type="number" min="1" max="600" required')+
   area('short_description','Descriere scurtă',row?.short_description||'',3)+
   area('description','Descriere completă',row?.description||'',4)+
   area('steps','Instrucțiuni pas cu pas (un pas pe rând)',(row?.instructions||[]).join('\n'),7)+
   area('tags','Etichete (separate prin virgulă)',(row?.tags||[]).join(', '),2)+
   area('allergens','Alergeni (separați prin virgulă)',(row?.allergens||[]).join(', '),2)+
   '</div>'+
   '<fieldset class="editor-fieldset"><legend>Ingrediente & cantități</legend><p>Ingredientele de aici sunt folosite și pentru lista de cumpărături.</p>'+
   '<div id="ingredient-rows"></div><button class="light" type="button" id="add-row">+ Adaugă ingredient</button></fieldset>'+
   photoFields(row,'recipe')+
   bool('published','Publică rețeta în BunPlan (dezactivează pentru a o ascunde)',row?.published!==false);
  $('editor-backdrop').classList.remove('hidden');
  for(const it of (Array.isArray(row?.ingredient_details)?row.ingredient_details:[]))addIngredientLine(it);
  $('add-row').onclick=()=>addIngredientLine();
  bindPhoto();
 }catch(e){flash('Nu am putut deschide rețeta: '+e.message)}
}
function addIngredientLine(data={}){
 const wrap=document.createElement('div');wrap.className='ingredient-line';
 wrap.innerHTML='<input placeholder="Ingredient" aria-label="Ingredient" class="ing-name" value="'+esc(data.name||'')+'">'+
 '<input placeholder="Gramaj" aria-label="Cantitate" class="ing-qty" type="number" min=".001" step="any" value="'+esc(data.quantity||'')+'">'+
 '<input placeholder="Unitate" aria-label="Unitate" class="ing-unit" value="'+esc(data.unit||'g')+'">'+
 '<button type="button" aria-label="Șterge ingredient">✕</button>';
 wrap.querySelector('button').onclick=()=>wrap.remove();$('ingredient-rows').appendChild(wrap);
}
async function openIngredient(id){
 try{
  let row=null;if(id){const {data,error}=await db.from('ingredients').select('*').eq('id',id).single();if(error)throw error;row=data}
  session.editing={kind:'ingredient',row,removePhoto:false};session.photoFile=null;
  $('editor-type').textContent='INGREDIENTE';$('editor-heading').textContent=row?'Editează ingredientul':'Ingredient nou';
  $('edit-fields').innerHTML='<div class="grid-2">'+
   label('name','Denumire afișată',row?.name||'','required')+
   label('slug','Identificator (slug)',row?.slug||'','required pattern="[a-z0-9_]+"')+
   label('base_unit','Unitate implicită',row?.base_unit||'g','required')+
   area('description','Descriere ingredient',row?.description||'',3)+'</div>'+
   photoFields(row,'ingredient');
  $('editor-backdrop').classList.remove('hidden');bindPhoto();
 }catch(e){flash('Nu am putut deschide ingredientul: '+e.message)}
}
function bindPhoto(){
 $('photo-file').onchange=e=>{
  const file=e.target.files[0];if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){
   alert('Selectează JPG/PNG/WebP, maximum 5 MB.');e.target.value='';return;
  }
  session.photoFile=file;session.editing.removePhoto=false;
  if(session.photoPreview)URL.revokeObjectURL(session.photoPreview);
  session.photoPreview=URL.createObjectURL(file);
  $('photo-preview').src=session.photoPreview;$('photo-preview').style.display='block';
 };
 $('photo-remove').onclick=()=>{
  session.photoFile=null;session.editing.removePhoto=true;$('photo-file').value='';
  $('photo-preview').style.display='none';
  $('edit-form').elements.image_reviewed.checked=false;
 };
}
async function uploadIfNeeded(kind,form){
 if(!session.photoFile)return null;
 if(!form.get('image_reviewed'))throw Error('Bifează confirmarea dreptului de utilizare și a corectitudinii fotografiei.');
 const file=session.photoFile,ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';
 const path=(kind==='recipe'?'recipes':'ingredients')+'/'+crypto.randomUUID()+'.'+ext;
 const {error}=await db.storage.from('bunplan-media').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'});
 if(error)throw error;
 const {data}=db.storage.from('bunplan-media').getPublicUrl(path);return data.publicUrl;
}
$('edit-form').addEventListener('submit',async e=>{
 e.preventDefault();const edit=session.editing;if(!edit)return;
 const btn=$('editor-save'),f=new FormData(e.target);btn.disabled=true;btn.textContent='Se salvează…';
 try{
  const imgKey=edit.kind==='recipe'?'photo_url':'image_url';
  const changed=await uploadIfNeeded(edit.kind,f);
  let fields;
  if(edit.kind==='recipe'){
   const ingredient_details=[...document.querySelectorAll('.ingredient-line')].map(line=>({
    name:line.querySelector('.ing-name').value.trim(),
    quantity:Number(line.querySelector('.ing-qty').value),
    unit:line.querySelector('.ing-unit').value.trim()
   })).filter(x=>x.name);
   if(ingredient_details.some(x=>!x.unit||!Number.isFinite(x.quantity)||x.quantity<=0))throw Error('Verifică gramajul și unitatea tuturor ingredientelor.');
   const instructions=String(f.get('steps')||'').split('\n').map(x=>x.trim()).filter(Boolean);
   if(!instructions.length)throw Error('Adaugă cel puțin un pas de preparare.');
   fields={
    title:String(f.get('title')||'').trim(),category:String(f.get('category')||'').trim(),
    servings:Number(f.get('servings')),minutes_to_prepare:Number(f.get('minutes_to_prepare')),
    short_description:String(f.get('short_description')||'').trim(),
    description:String(f.get('description')||'').trim(),instructions,ingredient_details,
    tags:String(f.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean),
    allergens:String(f.get('allergens')||'').split(',').map(x=>x.trim()).filter(Boolean),
    published:f.has('published'),source_status:'reviewed',
    photo_credit:String(f.get('photo_credit')||'').trim()
   };
   if(!fields.title||!fields.category)throw Error('Titlul și categoria sunt obligatorii.');
   if(fields.servings<1||fields.servings>40||fields.minutes_to_prepare<1||fields.minutes_to_prepare>600)
      throw Error('Porțiile sau minutele sunt în afara intervalului.');
   if(!edit.row)fields.legacy_key='ADM-'+crypto.randomUUID();
  }else{
   fields={name:String(f.get('name')||'').trim(),slug:String(f.get('slug')||'').trim(),
    base_unit:String(f.get('base_unit')||'').trim(),description:String(f.get('description')||'').trim()};
   if(!fields.name||!/^[a-z0-9_]+$/.test(fields.slug)||!fields.base_unit)throw Error('Nume, slug sau unitate invalidă.');
  }
  fields.image_reviewed=f.has('image_reviewed')&&!!(changed||(!edit.removePhoto&&edit.row?.[imgKey]));
  if(changed)fields[imgKey]=changed;
  else if(edit.removePhoto)fields[imgKey]=null;
  let query=edit.row?db.from(edit.kind==='recipe'?'recipes':'ingredients').update(fields).eq('id',edit.row.id):
   db.from(edit.kind==='recipe'?'recipes':'ingredients').insert(fields);
  const {error}=await query.select('id').single();if(error)throw error;
  closeEditor();flash('Modificările au fost salvate în Supabase și vor apărea în aplicație la sincronizare.',true);
  if(edit.kind==='recipe')await loadRecipes();else await loadIngredients();
 }catch(error){alert('Nu s-a putut salva: '+error.message)}
 finally{btn.disabled=false;btn.textContent='Salvează modificările'}
});
if(!db)loginMessage('Nu se poate încărca Supabase. Verifică conexiunea sau reîncarcă pagina.');
else authenticate();
})();