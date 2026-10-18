/* BunPlan Content Manager. Admin Auth/RLS is enforced server-side in Supabase. */
(()=>{
'use strict';
const PROJECT='https://aedyviqoelgbbrrtwayu.supabase.co';
const KEY='sb_publishable_pLh8mKxNWKkq396TyM518A_N_q7fm0Z';
const db=window.supabase.createClient(PROJECT,KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const el=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories={
 home:{name:'Acasă',icon:'🏡',detail:'Hero, carduri, mesaje, butoane, rețete recomandate'},
 recipes:{name:'Biblioteca de rețete',icon:'🍲',detail:'Titluri, categorii, filtre, căutare, explicații'},
 navigation:{name:'Navigare',icon:'🧭',detail:'Numele taburilor și textele de orientare'},
 shopping:{name:'Cumpărături',icon:'🛒',detail:'Cheltuieli, etichete și avertismente'},
 profile:{name:'Profil',icon:'👤',detail:'Preferințe, feedback și tutorial'},
 onboarding:{name:'Prima utilizare / Cont',icon:'✨',detail:'Mesaje de bun venit, chestionar, opțiuni și autentificare'},
 tour:{name:'Tutorial de utilizare',icon:'📖',detail:'Etape, mesaje și activarea tutorialului'},
 retailers:{name:'Lidl / Kaufland',icon:'🏬',detail:'Magazine și mesaje despre stocuri'},
};
const captions={
 greeting_prefix:'Început salut',greeting_suffix:'Sfârșit salut',subtitle:'Subtitlu',
 title:'Titlul paginii',categories:'Categorii disponibile',
 featured_recipe_ids:'Codurile rețetelor recomandate în ordinea dorită, de exemplu ["BP0001","R003"]',
 steps:'Etapele tutorialului: tab, target, icon, title, body',
 enabled:'Activat',
 supported_stores:'Magazine afișate în interfață'
};
let sections=[],active=null,saving=false;
function label(k){return captions[k]||k.replaceAll('_',' ')}
function isStructured(value){return Array.isArray(value)||typeof value==='object'&&value!==null}
function renderRow(key,value){
 const type=Array.isArray(value)?'array':typeof value;
 const long=key.endsWith('_description')||key.endsWith('_notice')||key.endsWith('_body')||
 key.endsWith('_subtitle')||key.endsWith('_disclaimer')||key==='steps'||key==='featured_recipe_ids';
 const control=type==='boolean'?
  '<label class="bp56-cms-switch"><input type="checkbox" data-field="'+esc(key)+'" data-type="boolean" '+(value?'checked':'')+'> Activează</label>':
  isStructured(value)||long?
   '<textarea data-field="'+esc(key)+'" data-type="'+type+'" rows="'+(isStructured(value)?Math.min(18,Math.max(4,JSON.stringify(value,null,2).split('\n').length)):3)+'">'+
     esc(isStructured(value)?JSON.stringify(value,null,2):value)+'</textarea>':
   '<input data-field="'+esc(key)+'" data-type="'+type+'" value="'+esc(value)+'" />';
 return '<label class="bp56-cms-field"><strong>'+esc(label(key))+'</strong>'+
  '<small>'+esc(key)+(type==='array'?' · listă JSON':'')+'</small>'+control+'</label>';
}
function makeMenu(){
 el('bp56-content-categories').innerHTML=sections.map(row=>{
  const c=categories[row.section_key]||{name:row.title,icon:'📝',detail:'Conținut'};
  return '<button type="button" data-cms-key="'+esc(row.section_key)+'" class="bp56-cms-section '+
   (active?.section_key===row.section_key?'active':'')+'">'+
   '<span class="bp56-cms-menu-icon">'+c.icon+'</span><span><strong>'+esc(c.name)+'</strong>'+
   '<small>'+esc(c.detail)+'</small></span><span class="bp56-cms-status">'+(row.published?'●':'○')+'</span></button>';
 }).join('');
 el('bp56-content-categories').querySelectorAll('[data-cms-key]').forEach(b=>{
  b.onclick=()=>select(b.dataset.cmsKey);
 });
}
function select(key){
 active=sections.find(r=>r.section_key===key);
 if(!active)return;
 makeMenu();
 const c=categories[key]||{name:active.title,icon:'📝',detail:'Conținut'};
 el('bp56-content-editor').innerHTML='<div class="bp56-cms-head"><span class="bp56-cms-menu-icon">'+c.icon+'</span>'+
 '<div><span class="eyebrow">CONȚINUT VIZIBIL ÎN APLICAȚIE</span><h2>'+esc(c.name)+'</h2>'+
 '<p>'+esc(c.detail)+'</p></div></div>'+
 '<form id="bp56-cms-form" class="crm-form">'+
 Object.entries(active.content).map(([k,v])=>renderRow(k,v)).join('')+
 '<label class="bp56-cms-switch"><input type="checkbox" id="bp56-cms-publish" '+(active.published?'checked':'')+'> Secțiune publicată</label>'+
 '<div class="bp56-cms-actions"><span id="bp56-cms-feedback" role="status">Ultima modificare: '+
 esc(new Date(active.updated_at).toLocaleString('ro-RO'))+'</span>'+
 '<button class="primary" type="submit">Salvează și publică</button></div></form>';
 el('bp56-cms-form').onsubmit=save;
}
async function load(){
 const box=el('bp56-content-editor');
 box.innerHTML='<div class="crm-blank">Se încarcă textele și opțiunile din Supabase…</div>';
 const {data,error}=await db.from('bunplan_content_sections')
 .select('section_key,title,content,published,updated_at').order('title');
 if(error){box.innerHTML='<div class="crm-alert">'+esc(error.message)+'</div>';return}
 sections=data||[];
 if(!sections.length){box.innerHTML='<div class="crm-alert">Nu există secțiuni CMS încă.</div>';return}
 const key=active?.section_key&&sections.some(s=>s.section_key===active.section_key)?active.section_key:'home';
 select(key);
}
async function save(event){
 event.preventDefault();if(saving||!active)return;
 const form=el('bp56-cms-form'),submit=form.querySelector('button[type=submit]');
 const output={};
 try{
  for(const input of form.querySelectorAll('[data-field]')){
   const key=input.dataset.field,kind=input.dataset.type;
   let value=kind==='boolean'?input.checked:input.value;
   if(kind==='array'||kind==='object'){
    try{value=JSON.parse(value)}catch(e){throw Error('JSON invalid în '+key+': '+e.message)}
    if(kind==='array'&&!Array.isArray(value))throw Error(key+' trebuie să fie o listă');
    if(kind==='object'&&(Array.isArray(value)||!value||typeof value!=='object'))
     throw Error(key+' trebuie să fie un obiect');
   }else if(kind==='number'){
    value=Number(value);if(!Number.isFinite(value))throw Error(key+' trebuie să fie număr');
   }
   if(typeof value==='string'&&value.length>3000)throw Error(key+' depășește 3000 de caractere');
   output[key]=value;
  }
  if(active.section_key==='tour'&&(!Array.isArray(output.steps)||output.steps.some(x=>!x?.title||!x?.body||!x.tab))){
   throw Error('Etapele tutorialului trebuie să aibă tab, titlu și descriere');
  }
  if(active.section_key==='navigation'&&!output.home)throw Error('Numele paginii Acasă este necesar');
  saving=true;submit.disabled=true;el('bp56-cms-feedback').textContent='Se salvează…';
  const {data:{user}}=await db.auth.getUser();if(!user)throw Error('Sesiunea a expirat');
  const {data,error}=await db.from('bunplan_content_sections')
    .update({content:output,published:el('bp56-cms-publish').checked,updated_by:user.id})
    .eq('section_key',active.section_key)
    .select('section_key,title,content,published,updated_at').single();
  if(error)throw error;
  const idx=sections.findIndex(x=>x.section_key===active.section_key);
  if(idx>=0)sections[idx]=data;
  active=data;makeMenu();
  el('bp56-cms-feedback').textContent='Salvat în Supabase · Trage ecranul în jos în aplicație pentru actualizare.';
  el('bp56-cms-feedback').classList.add('saved');
 }catch(e){
  const node=el('bp56-cms-feedback');
  if(node){node.textContent='Eroare: '+e.message;node.classList.remove('saved')}
 }finally{saving=false;if(submit)submit.disabled=false}
}
document.addEventListener('bunplan-admin-section',e=>{
 if(e.detail.name==='content')load().catch(error=>{
  el('bp56-content-editor').textContent='Nu am putut încărca conținutul: '+error.message;
 });
});
})();