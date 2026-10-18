/* BunPlan 5.2 — Administrator CRM extensions. Authorization is enforced
 * server-side by Supabase Auth/RLS, not by this frontend.
 * Never use or expose a service_role key in this file.
 */
(() => {
'use strict';
const db=window.supabase.createClient('https://aedyviqoelgbbrrtwayu.supabase.co',
 'sb_publishable_pLh8mKkq396TyM518A_N_q7fm0Z',
 {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const $=id=>document.getElementById(id);
const E=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const price=n=>Number(n??0).toLocaleString('ro-RO',{minimumFractionDigits:2,maximumFractionDigits:2})+' lei';
const stamp=s=>s?new Date(s).toLocaleString('ro-RO'):'—';
const day=s=>s?new Date(s).toLocaleDateString('ro-RO'):'—';
const opt=(v,selected)=>'<option value="'+E(v)+'"'+(v===selected?' selected':'')+'>'+E(v)+'</option>';
const avatar=u=>E(u.display_name||u.email||'Utilizator');
const displayError=(id,error)=>{const e=$(id);if(e)e.innerHTML='<div class="crm-alert">'+E(error.message||error)+'</div>'};
const pager=(id,page,count,limit,next,prev)=>{$(id).innerHTML='<span>'+((page*limit)+1)+'–'+Math.min((page+1)*limit,count)+' din '+count+'</span><div class="crm-inline"><button class="light" data-prev'+(page===0?' disabled':'')+'>←</button><button class="light" data-next'+((page+1)*limit>=count?' disabled':'')+'>→</button></div>';
 $(id).querySelector('[data-prev]')?.addEventListener('click',prev);$(id).querySelector('[data-next]')?.addEventListener('click',next);
};
const state={authorized:false,tab:'dashboard',userPage:0,userSearch:'',users:[],user:null,
 planPage:0,productPage:0,productSearch:'',productStore:'',productSelected:null,
 estimateRows:[],priceSelected:null,loading:false};
function safeText(s){return E(s).replace(/\n/g,'<br>')}
async function requireAdmin(){
 const {data:{session}}=await db.auth.getSession();
 if(!session){state.authorized=false;return false}
 const {data,error}=await db.rpc('is_bunplan_admin');
 state.authorized=!error&&data===true;
 return state.authorized;
}
function ensureAuth(){if(!state.authorized)throw Error('Acces administrator indisponibil. Reautentifică-te.')}
async function respond(p){const r=await p;if(r.error)throw r.error;return r}
async function switchTo(name){
 state.tab=name;
 try{
  if(!(await requireAdmin()))throw Error('Sesiunea nu mai are permisiuni de administrator.');
  const loaders={users:loadUsers,plans:loadPlans,products:loadProducts,prices:loadPrices,
   stores:loadStores,feedback:loadFeedback,settings:loadSettings,audit:loadAudit,dashboard:loadExtraDashboard};
  if(loaders[name])await loaders[name]();
 }catch(e){const target={users:'crm-user-list',plans:'crm-plans-list',products:'crm-products-list',
  prices:'crm-price-history',stores:'crm-store-list',feedback:'crm-feedback-list',
  settings:'crm-settings-list',audit:'crm-audit-list',dashboard:'stats'}[name];
  if(target)displayError(target,e);
 }
}
document.addEventListener('bunplan-admin-authenticated',async()=>{state.authorized=true;await loadExtraDashboard()});
document.addEventListener('bunplan-admin-section',e=>switchTo(e.detail.name));
let lookupTimer;
$('crm-search').oninput=e=>{clearTimeout(lookupTimer);lookupTimer=setTimeout(()=>{state.userSearch=e.target.value.trim();state.userPage=0;loadUsers()},280)};
$('crm-reload').onclick=()=>loadUsers();
async function loadUsers(){
 ensureAuth();
 const {data,error}=await db.rpc('bunplan_admin_user_directory',{q:state.userSearch,max_rows:35,skip_rows:state.userPage*35});
 if(error)throw error;
 state.users=data||[];
 $('crm-user-list').innerHTML=state.users.map(x=>'<tr><td><strong>'+avatar(x)+'</strong><small>'+E(x.email||'')+'</small></td>'+
  '<td>'+E(x.preferred_store||'—')+'</td><td>'+Number(x.number_of_plans||0)+'</td>'+
  '<td><button class="light" data-user="'+E(x.user_id)+'">Fișa →</button></td></tr>').join('')||'<tr><td colspan="4" class="crm-blank">Nu există rezultate.</td></tr>';
 $('crm-user-list').querySelectorAll('[data-user]').forEach(btn=>btn.onclick=()=>showUser(btn.dataset.user));
 $('crm-pager').innerHTML='<span>Pagina '+(state.userPage+1)+' · '+state.users.length+' conturi încărcate</span>'+
 '<div><button class="light" id="crm-user-prev"'+(!state.userPage?' disabled':'')+'>←</button> '+
 '<button class="light" id="crm-user-next"'+(state.users.length<35?' disabled':'')+'>→</button></div>';
 $('crm-user-prev').onclick=()=>{state.userPage--;loadUsers()};
 $('crm-user-next').onclick=()=>{state.userPage++;loadUsers()};
}
async function showUser(id){
 ensureAuth();const u=state.users.find(x=>x.user_id===id);if(!u)return;
 state.user=u;
 const [profile,plans,notes]=await Promise.all([
  respond(db.from('profiles').select('display_name,city,preferred_store,weekly_budget_ron,household_adults,household_children,meals_per_day,onboarding_completed,created_at').eq('user_id',id).maybeSingle()),
  respond(db.from('weekly_plans').select('id,week_start,store_id,weekly_budget_ron').eq('user_id',id).order('week_start',{ascending:false}).limit(8)),
  respond(db.from('bunplan_crm_notes').select('id,note,tags,followup_status,created_at').eq('user_id',id).order('created_at',{ascending:false}).limit(30))]);
 const p=profile.data||{};
 $('crm-user-detail').innerHTML='<h2>'+avatar(u)+'</h2><p>'+E(u.email)+'</p>'+
  '<div class="crm-kpis">'+
  [['Înregistrat',day(u.registered_at)],['Ultima conectare',stamp(u.last_sign_in_at)],
   ['Oraș',p.city||'—'],['Magazin',p.preferred_store||'—'],
   ['Buget săptămânal',price(p.weekly_budget_ron)],['Adulți / copii',(p.household_adults??'—')+' / '+(p.household_children??'—')],
   ['Onboarding',p.onboarding_completed?'Complet':'Incomplet'],['Planuri',u.number_of_plans||0]]
   .map(([a,b])=>'<div><span>'+E(a)+'</span><strong>'+E(b)+'</strong></div>').join('')+'</div>'+
  '<h3 style="margin-top:20px">Planuri recente</h3>'+
  ((plans.data||[]).map(x=>'<div class="crm-note"><p>'+E(x.week_start)+' · '+E(x.store_id)+' · '+price(x.weekly_budget_ron)+'</p></div>').join('')||'<p>Fără planuri salvate în cloud.</p>')+
  '<h3>Notițe CRM</h3><div id="crm-user-notes">'+((notes.data||[]).map(noteCard).join('')||'<p>Nu există notițe.</p>')+'</div>'+
  '<form id="crm-note-form" class="crm-form crm-note-form"><label>Notiță nouă<textarea name="note" rows="3" maxlength="5000" required placeholder="Observații pentru suport sau follow-up…"></textarea></label>'+
  '<label>Status<select name="followup_status">'+['new','active','waiting','resolved'].map(x=>opt(x,'new')).join('')+'</select></label>'+
  '<label>Etichete (separate prin virgulă)<input name="tags" maxlength="300" placeholder="client, feedback, trial"></label>'+
  '<button class="primary">Salvează notița</button></form>';
 $('crm-note-form').onsubmit=async e=>{
  e.preventDefault();
  const f=new FormData(e.target),note=String(f.get('note')||'').trim();
  if(!note)return;
  try{
   const {data:{user}}=await db.auth.getUser();if(!user)throw Error('Sesiune expirată');
   await respond(db.from('bunplan_crm_notes').insert({
    user_id:id,note,followup_status:f.get('followup_status'),
    tags:String(f.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean),
    created_by:user.id
   }));
   await showUser(id);
  }catch(err){alert('Nu am putut salva notița: '+err.message)}
 };
}
function noteCard(x){return '<div class="crm-note"><p>'+safeText(x.note)+'</p><small>'+
 E(stamp(x.created_at))+' · '+E(x.followup_status)+' · '+E((x.tags||[]).join(', '))+'</small></div>'}
$('crm-plan-store').onchange=()=>{state.planPage=0;loadPlans()};
$('crm-plans-reload').onclick=loadPlans;
async function loadPlans(){
 ensureAuth();const limit=40;
 let q=db.from('weekly_plans').select('id,user_id,store_id,week_start,weekly_budget_ron,created_at',{count:'exact'})
   .order('week_start',{ascending:false}).range(state.planPage*limit,(state.planPage+1)*limit-1);
 if($('crm-plan-store').value)q=q.eq('store_id',$('crm-plan-store').value);
 const r=await respond(q);
 $('crm-plans-list').innerHTML=(r.data||[]).map(x=>'<tr><td>'+E(x.week_start)+'</td><td>'+E(x.store_id)+'</td>'+
  '<td class="crm-money">'+price(x.weekly_budget_ron)+'</td><td><small>'+E(x.user_id.slice(0,8))+'…</small></td>'+
  '<td><button class="light" data-plan="'+E(x.id)+'">Detalii</button></td></tr>').join('')||'<tr><td colspan="5">Fără date.</td></tr>';
 $('crm-plans-list').querySelectorAll('[data-plan]').forEach(btn=>btn.onclick=()=>showPlan(btn.dataset.plan));
 pager('crm-plans-pager',state.planPage,r.count||0,limit,()=>{state.planPage++;loadPlans()},()=>{state.planPage--;loadPlans()});
}
async function showPlan(planId){
 ensureAuth();
 const [meals,shopping]=await Promise.all([
  respond(db.from('planned_meals').select('meal_date,meal_slot,portions,recipe_id').eq('plan_id',planId).order('meal_date')),
  respond(db.from('shopping_items').select('description,requested_quantity,requested_unit,pack_price_ron,budget_cost_ron,purchased,store_id').eq('plan_id',planId).limit(250))
 ]);
 const node=$('crm-plan-detail');node.classList.remove('hidden');
 node.innerHTML='<h2>Plan săptămânal</h2><div class="crm-alert">Activitatea este afișată numai pentru suport. Nu modificăm alegerile utilizatorului.</div>'+
 '<div class="crm-columns"><div><h3>Mese ('+(meals.data?.length||0)+')</h3><ul class="crm-plan-lines">'+
 (meals.data||[]).map(x=>'<li>'+E(x.meal_date)+' · '+E(x.meal_slot)+' · '+E(x.recipe_id||'—')+'</li>').join('')+
 '</ul></div><div><h3>Cumpărături ('+(shopping.data?.length||0)+')</h3><ul class="crm-plan-lines">'+
 (shopping.data||[]).map(x=>'<li>'+E(x.purchased?'✓ ':'□ ')+E(x.description||'Produs')+
 ' · '+E(x.requested_quantity)+' '+E(x.requested_unit||'')+'</li>').join('')+'</ul></div></div>';
}
let productTimer;
$('crm-product-search').oninput=e=>{clearTimeout(productTimer);productTimer=setTimeout(()=>{state.productSearch=e.target.value;state.productPage=0;loadProducts()},260)};
$('crm-product-store').onchange=e=>{state.productStore=e.target.value;state.productPage=0;loadProducts()};
$('crm-product-refresh').onclick=loadProducts;
async function loadProducts(){
 ensureAuth();const limit=40;
 let q=db.from('products').select('id,store_id,external_id,name,pack_amount,pack_unit,category,image_url,active,location_code',{count:'exact'})
 .order('name',{ascending:true}).range(state.productPage*limit,(state.productPage+1)*limit-1);
 if(state.productStore)q=q.eq('store_id',state.productStore);
 if(state.productSearch)q=q.ilike('name','%'+state.productSearch.replace(/[%_,()]/g,' ')+'%');
 const r=await respond(q);
 $('crm-products-list').innerHTML=(r.data||[]).map(x=>'<tr><td><strong>'+E(x.name)+'</strong><small>'+E(x.external_id)+'</small></td>'+
 '<td>'+E(x.store_id)+'</td><td>'+E(x.pack_amount??'—')+' '+E(x.pack_unit||'')+'</td>'+
 '<td><span class="pill '+(x.active?'live':'warn')+'">'+(x.active?'Activ':'Ascuns')+'</span></td>'+
 '<td><button class="light" data-product="'+E(x.id)+'">Editează</button></td></tr>').join('')||'<tr><td colspan="5">Nu există rezultate.</td></tr>';
 $('crm-products-list').querySelectorAll('[data-product]').forEach(btn=>btn.onclick=()=>editProduct(btn.dataset.product));
 pager('crm-products-pager',state.productPage,r.count||0,limit,()=>{state.productPage++;loadProducts()},()=>{state.productPage--;loadProducts()});
}
async function editProduct(id){
 ensureAuth();const r=await respond(db.from('products').select('*').eq('id',id).single());const p=r.data;
 state.productSelected=p;
 const panel=$('crm-product-editor');panel.classList.remove('hidden');
 panel.innerHTML='<h2>Editare produs · '+E(p.store_id)+'</h2><form id="crm-product-form" class="crm-grid-form">'+
 '<label class="wide">Nume produs<input name="name" required maxlength="250" value="'+E(p.name)+'"></label>'+
 '<label>Categorie<input name="category" value="'+E(p.category||'')+'"></label>'+
 '<label>Cod extern<input readonly value="'+E(p.external_id)+'"></label>'+
 '<label>Cantitate ambalaj<input type="number" min=".001" step="any" name="pack_amount" value="'+E(p.pack_amount??'')+'"></label>'+
 '<label>Unitate ambalaj<input name="pack_unit" value="'+E(p.pack_unit||'')+'"></label>'+
 '<label class="wide">URL fotografie produs (HTTPS)<input type="url" name="image_url" placeholder="https://…" value="'+E(p.image_url||'')+'"></label>'+
 '<label class="crm-toggle wide"><input type="checkbox" name="active" '+(p.active?'checked':'')+'> Produs activ</label>'+
 '<div class="wide crm-section-actions"><button class="primary">Salvează produsul</button></div></form>';
 $('crm-product-form').onsubmit=async e=>{
 e.preventDefault();const f=new FormData(e.target);
 const amount=f.get('pack_amount')?Number(f.get('pack_amount')):null;
 const url=String(f.get('image_url')||'').trim();
 if(url&&!url.startsWith('https://')){alert('Fotografia trebuie să aibă adresă HTTPS.');return}
 if(amount!==null&&(!Number.isFinite(amount)||amount<=0)){alert('Cantitate invalidă');return}
 try{
 await respond(db.from('products').update({
   name:String(f.get('name')).trim(),category:String(f.get('category')||'').trim()||null,
   pack_amount:amount,pack_unit:String(f.get('pack_unit')||'').trim()||null,
   image_url:url||null,active:f.has('active')
 }).eq('id',id));
 panel.classList.add('hidden');await loadProducts();alert('Produsul a fost salvat în Supabase.');
 }catch(err){alert('Eroare la salvare: '+err.message)}
 };
}

/* Pricing. The "manual_user" source_kind is deliberately retained: publishing a
 * hand-entered observation must not turn it into an official retailer offer. */
$('crm-price-store').onchange=()=>{$('crm-price-product-search').value='';state.priceSelected=null;$('crm-price-selected').textContent='Nu ai selectat un produs.';$('crm-price-choices').innerHTML=''};
$('crm-price-product-search').oninput=e=>{
 clearTimeout(lookupTimer);
 lookupTimer=setTimeout(async()=>{
  const term=e.target.value.trim(),store=$('crm-price-store').value;
  if(term.length<2){$('crm-price-choices').innerHTML='';return}
  try{
   const r=await respond(db.from('products').select('id,name,store_id,pack_amount,pack_unit')
     .eq('store_id',store).ilike('name','%'+term.replace(/[%_,()]/g,' ')+'%').limit(15));
   $('crm-price-choices').innerHTML=(r.data||[]).map(p=>
    '<button type="button" data-pick="'+E(p.id)+'">'+E(p.name)+'<small>'+
     E(p.pack_amount??'')+' '+E(p.pack_unit||'')+'</small></button>').join('')||
     '<span class="hint">Niciun produs găsit.</span>';
   const byID=Object.fromEntries((r.data||[]).map(p=>[p.id,p]));
   $('crm-price-choices').querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{
    state.priceSelected=byID[b.dataset.pick];
    $('crm-price-selected').textContent=state.priceSelected.name+' · '+state.priceSelected.store_id;
    $('crm-price-choices').innerHTML='';
   });
  }catch(error){displayError('crm-price-choices',error)}
 },230);
};
$('crm-price-form').onsubmit=async e=>{
 e.preventDefault();const p=state.priceSelected;
 if(!p||p.store_id!==$('crm-price-store').value){alert('Selectează produsul din rezultate.');return}
 const amount=Number($('crm-price-amount').value),date=$('crm-price-date').value;
 if(!Number.isFinite(amount)||amount<=0||amount>99999||!/^\d{4}-\d{2}-\d{2}$/.test(date)){alert('Preț sau dată invalidă.');return}
 if(!confirm('Salvezi o observație manuală, NU un preț oficial sau un stoc confirmat?'))return;
 try{
  await respond(db.from('product_prices').insert({
   product_id:p.id,store_id:p.store_id,location_code:'national',
   amount_ron:amount,source_kind:'manual_user',price_scope:'national',
   captured_on:date,valid_from:date,
   source_url:null,membership_required:false
  }));
  $('crm-price-amount').value='';$('crm-price-note').value='';
  alert('Observația de preț a fost înregistrată. Sursa este marcată manuală.');
  await loadPriceHistory();
 }catch(error){alert('Nu am putut salva prețul: '+error.message)}
};
$('crm-estimate-store').onchange=loadEstimates;
$('crm-estimate-search').oninput=()=>renderEstimates();
async function loadEstimates(){
 ensureAuth();const store=$('crm-estimate-store').value;
 const [ingredients,estimates]=await Promise.all([
  respond(db.from('ingredients').select('id,name,slug,base_unit').order('name').limit(400)),
  respond(db.from('price_estimates').select('ingredient_id,store_id,suggested_pack_quantity,pack_unit,estimated_pack_price_ron,estimate_method').eq('store_id',store).limit(400))]);
 const byId=Object.fromEntries((ingredients.data||[]).map(x=>[x.id,x]));
 state.estimateRows=(estimates.data||[]).map(x=>({...x,ingredient:byId[x.ingredient_id]}));
 renderEstimates();
}
function renderEstimates(){
 const q=$('crm-estimate-search').value.toLowerCase().trim();
 const rows=state.estimateRows.filter(x=>(x.ingredient?.name||'').toLowerCase().includes(q));
 $('crm-estimate-list').innerHTML=rows.map(x=>'<tr><td>'+E(x.ingredient?.name||x.ingredient_id)+'</td>'+
 '<td>'+E(x.suggested_pack_quantity)+' '+E(x.pack_unit||'')+'</td>'+
 '<td class="crm-money">'+price(x.estimated_pack_price_ron)+'</td>'+
 '<td><button class="light" data-estimate="'+E(x.ingredient_id)+'">Editează</button></td></tr>').join('')||
 '<tr><td colspan="4">Niciun ingredient găsit.</td></tr>';
 $('crm-estimate-list').querySelectorAll('[data-estimate]').forEach(b=>b.onclick=()=>editEstimate(b.dataset.estimate));
}
async function editEstimate(id){
 const existing=state.estimateRows.find(x=>x.ingredient_id===id);if(!existing)return;
 const n=existing.ingredient?.name||id;
 const value=prompt('Preț estimat pentru pachetul '+n+' ('+existing.suggested_pack_quantity+' '+existing.pack_unit+'), în lei:',existing.estimated_pack_price_ron);
 if(value===null)return;const amount=Number(value.replace(',','.'));
 if(!Number.isFinite(amount)||amount<=0||amount>99999){alert('Suma este invalidă');return}
 try{
 await respond(db.from('price_estimates').update({
  estimated_pack_price_ron:amount,estimate_method:'admin_manual_estimate',
  updated_at:new Date().toISOString()
 }).eq('ingredient_id',id).eq('store_id',$('crm-estimate-store').value));
 await loadEstimates();alert('Estimarea a fost actualizată, fără a pretinde un preț oficial.');
 }catch(error){alert(error.message)}
}
async function loadPriceHistory(){
 const r=await respond(db.from('product_prices').select('amount_ron,store_id,captured_on,source_kind,product_id')
 .order('captured_on',{ascending:false}).limit(14));
 $('crm-price-history').innerHTML='<h2>Ultimele valori înregistrate</h2><div class="table-wrap"><table>'+
 '<thead><tr><th>Magazin</th><th>Data</th><th>Preț</th><th>Sursă</th></tr></thead><tbody>'+
 (r.data||[]).map(x=>'<tr><td>'+E(x.store_id)+'</td><td>'+E(x.captured_on)+'</td><td>'+price(x.amount_ron)+
 '</td><td>'+E(x.source_kind)+'</td></tr>').join('')+'</tbody></table></div>';
}
async function loadPrices(){
 ensureAuth();
 $('crm-price-date').value=new Date().toISOString().slice(0,10);
 await Promise.all([loadEstimates(),loadPriceHistory()]);
}
async function loadStores(){
 ensureAuth();
 const [stores,locations,imports]=await Promise.all([
  respond(db.from('stores').select('id,name')),
  respond(db.from('store_locations').select('name,address,city,store_id,external_code').order('city').limit(60)),
  respond(db.from('import_runs').select('retailer_id,source_kind,started_at,finished_at,status,items_seen,items_written,error_message').order('started_at',{ascending:false}).limit(30))
 ]);
 $('crm-store-list').innerHTML=(stores.data||[]).map(x=>{
 const count=(locations.data||[]).filter(l=>l.store_id===x.id).length;
 return '<div class="crm-card"><h3>'+E(x.name)+'</h3><p>'+count+' locații în eșantionul încărcat.</p></div>';
 }).join('')+'<div class="table-wrap"><table><thead><tr><th>Locație</th><th>Magazin</th><th>Oraș</th></tr></thead><tbody>'+
 (locations.data||[]).map(x=>'<tr><td>'+E(x.name)+'<small>'+E(x.address||'')+'</small></td>'+
 '<td>'+E(x.store_id)+'</td><td>'+E(x.city||'')+'</td></tr>').join('')+'</tbody></table></div>';
 $('crm-imports').innerHTML='<div class="table-wrap"><table><thead><tr><th>Dată</th><th>Magazin</th><th>Stare</th><th>Scrise / găsite</th></tr></thead><tbody>'+
 (imports.data||[]).map(x=>'<tr><td>'+stamp(x.started_at)+'</td><td>'+E(x.retailer_id)+
 '</td><td>'+E(x.status)+(x.error_message?'<small>'+E(x.error_message.slice(0,150))+'</small>':'')+
 '</td><td>'+E(x.items_written)+' / '+E(x.items_seen)+'</td></tr>').join('')+
 '</tbody></table></div><p class="hint">Importurile automate necesită surse autorizate; acest panou nu presupune acces la stocuri live.</p>';
}
$('crm-feedback-filter').onchange=loadFeedback;$('crm-feedback-refresh').onclick=loadFeedback;
async function loadFeedback(){
 ensureAuth();let q=db.from('bunplan_feedback')
 .select('id,user_id,category,message,status,admin_reply,created_at')
 .order('created_at',{ascending:false}).limit(80);
 if($('crm-feedback-filter').value)q=q.eq('status',$('crm-feedback-filter').value);
 const r=await respond(q);
 $('crm-feedback-list').innerHTML=(r.data||[]).map(x=>'<article class="crm-card" data-feedback="'+E(x.id)+'"><h3>'+
 E(x.category)+' <span class="crm-badge">'+E(x.status)+'</span></h3><p>'+safeText(x.message)+'</p>'+
 '<div class="meta">'+stamp(x.created_at)+' · Utilizator '+E(x.user_id.slice(0,8))+'…</div>'+
 '<form class="crm-form crm-feedback-form"><label>Stare<select name="status">'+
 ['open','in_progress','resolved','closed'].map(v=>opt(v,x.status)).join('')+'</select></label>'+
 '<label>Răspuns administrator<textarea class="crm-feedback-reply" name="admin_reply" maxlength="4000">'+E(x.admin_reply||'')+
 '</textarea></label><button class="primary">Salvează starea</button></form></article>').join('')||
 '<div class="crm-card">Nicio sesizare pentru filtrul selectat. Mesajele vor apărea aici după ce canalul de feedback este folosit în aplicație.</div>';
 $('crm-feedback-list').querySelectorAll('[data-feedback]').forEach(card=>{
 card.querySelector('form').onsubmit=async e=>{
  e.preventDefault();const f=new FormData(e.target);
  try{
   await respond(db.from('bunplan_feedback').update({
    status:f.get('status'),admin_reply:String(f.get('admin_reply')||'').trim()||null,
    updated_at:new Date().toISOString()
   }).eq('id',card.dataset.feedback));
   await loadFeedback();
  }catch(err){alert('Nu am putut salva: '+err.message)}
 };
 });
}
const settingLabels={
 maintenance_banner:'Banner de mentenanță / anunț',
 recipe_discovery:'Setări catalog rețete',
 shopping_notice:'Notificare prețuri și stocuri',
 admin_app_metadata:'Metadate administrative (private)'
};
async function loadSettings(){
 ensureAuth();
 const r=await respond(db.from('bunplan_app_settings').select('key,value,description,public_visible,updated_at').order('key'));
 $('crm-settings-list').innerHTML='<div class="crm-sysnotice">Setările publice pot apărea în aplicația mobilă la sincronizare. Nu introdu aici parole, chei API sau date personale.</div>'+
 (r.data||[]).map(x=>'<div class="crm-card"><h3>'+E(settingLabels[x.key]||x.key)+
 (x.public_visible?' <span class="pill live">Public</span>':' <span class="pill">Privat</span>')+'</h3>'+
 '<p>'+E(x.description||'')+'</p>'+
 '<form class="crm-form crm-setting-form" data-key="'+E(x.key)+'">'+
 '<label>Valoare JSON<textarea name="value" spellcheck="false" rows="4">'+E(JSON.stringify(x.value,null,2))+'</textarea></label>'+
 '<div class="crm-section-actions"><small class="hint">Ultima schimbare: '+E(stamp(x.updated_at))+'</small>'+
 '<button class="primary">Salvează setarea</button></div></form></div>').join('');
 $('crm-settings-list').querySelectorAll('.crm-setting-form').forEach(form=>form.onsubmit=async e=>{
  e.preventDefault();let value;const raw=new FormData(e.target).get('value');
  try{value=JSON.parse(String(raw));if(!value||Array.isArray(value)||typeof value!=='object')throw Error('Obiect JSON necesar')}
  catch(err){alert('JSON invalid: '+err.message);return}
  const key=form.dataset.key;
  if(!confirm('Aplici setarea '+key+'?'))return;
  try{
   const {data:{user}}=await db.auth.getUser();
   await respond(db.from('bunplan_app_settings').update({value,updated_by:user?.id||null,updated_at:new Date().toISOString()}).eq('key',key));
   await loadSettings();
  }catch(err){alert('Nu am putut salva setarea: '+err.message)}
 });
}
async function loadAudit(){
 ensureAuth();
 const r=await respond(db.from('bunplan_admin_audit').select('id,actor_user_id,entity_type,entity_id,operation,changed_at')
 .order('changed_at',{ascending:false}).limit(100));
 $('crm-audit-list').innerHTML=(r.data||[]).map(x=>'<tr class="crm-audit"><td>'+E(stamp(x.changed_at))+'</td>'+
 '<td>'+E(x.entity_type)+'</td><td>'+E(x.operation)+'</td><td>'+E(x.entity_id)+'</td></tr>').join('')||
 '<tr><td colspan="4">Fără operații administrative înregistrate.</td></tr>';
}
async function loadExtraDashboard(){
 if(!state.authorized)return;
 let panel=$('crm-dashboard-extended');
 if(!panel){panel=document.createElement('div');panel.id='crm-dashboard-extended';$('dashboard').insertBefore(panel,$('dashboard').children[1])}
 try{
 const [users,plans,feedback,products,prices,notes,imports]=await Promise.all([
  respond(db.from('profiles').select('user_id',{head:true,count:'exact'})),
  respond(db.from('weekly_plans').select('id',{head:true,count:'exact'})),
  respond(db.from('bunplan_feedback').select('id',{head:true,count:'exact'}).eq('status','open')),
  respond(db.from('products').select('id',{head:true,count:'exact'})),
  respond(db.from('product_prices').select('id',{head:true,count:'exact'})),
  respond(db.from('bunplan_crm_notes').select('id',{head:true,count:'exact'})),
  respond(db.from('import_runs').select('id',{head:true,count:'exact'}))
 ]);
 const metrics=[['Profiluri',users.count],['Planuri salvate',plans.count],
  ['Sesizări deschise',feedback.count],['Produse',products.count],
  ['Înregistrări de preț',prices.count],['Notițe CRM',notes.count],['Importuri',imports.count]];
 panel.innerHTML='<h2>Operațiuni & activitate</h2><div class="stats">'+metrics.map(([a,b])=>
  '<div class="stat"><small>'+E(a)+'</small><strong>'+Number(b||0).toLocaleString('ro-RO')+'</strong></div>').join('')+
 '</div><div class="crm-sysnotice">Numerele provin din baza de date conectată, nu din estimări. '
 +'Cheltuielile efective salvate doar pe telefon nu sunt disponibile în acest dashboard până la sincronizarea lor în cloud.</div>';
 }catch(err){panel.innerHTML='<div class="crm-alert">'+E(err.message)+'</div>'}
}
})();