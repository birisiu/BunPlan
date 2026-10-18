/* BunPlan public runtime configuration and Feedback -> Admin CRM.
 * Uses public app settings only; never stores service_role or admin tokens.
 */
(function(){
'use strict';
const url='https://aedyviqoelgbbrrtwayu.supabase.co/rest/v1/bunplan_app_settings';
const key='sb_publishable_pLh8mKxNWKkq396TyM518A_N_q7fm0Z';
let settings={};
const safe=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function get(name){return settings[name]?.value||{}}
function decorate(){
 const root=document.querySelector('main.scroll');if(!root)return;
 root.querySelectorAll('.bp52-admin-banner').forEach(el=>el.remove());
 const banner=get('maintenance_banner');
 if(banner.enabled&&banner.message&&String(banner.message).trim()){
  const node=document.createElement('div');
  node.className='bp52-admin-banner';
  node.innerHTML='<strong>Informație BunPlan</strong><p>'+safe(String(banner.message).slice(0,600))+'</p>';
  const top=root.querySelector('.top');
  (top||root.firstElementChild)?.insertAdjacentElement('afterend',node);
 }
 if(state.tab==='basket100'){
  const shopping=get('shopping_notice');
  if(shopping.enabled&&shopping.message){
   const node=document.createElement('div');node.className='bp52-admin-banner';
   node.innerHTML='<p>'+safe(String(shopping.message).slice(0,600))+'</p>';
   const anchor=root.querySelector('.bp50-spend-panel');
   if(anchor)anchor.insertAdjacentElement('afterend',node);
  }
 }
}
const oldDraw=draw;
draw=function(){oldDraw();decorate()};
window.bunplanRefreshSettings=function(){
 return fetch(url+'?select=key,value&public_visible=eq.true&limit=30&v='+Date.now(),
  {cache:'no-store',headers:{apikey:key,Accept:'application/json','Cache-Control':'no-cache'}})
  .then(async response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.json()})
  .then(rows=>{
    if(!Array.isArray(rows))throw Error('Date configurație invalide');
    settings=Object.fromEntries(rows.map(x=>[x.key,x]));
    window.BunPlanPublicSettings=settings;
    decorate();
    return {ok:true,count:rows.length};
  }).catch(error=>{
    console.warn('Public BunPlan settings unavailable',error);
    return {ok:false,message:error.message||'Conexiune indisponibilă'};
  });
};
window.bunplanRefreshSettings();
const originalProfile=profileScreen;
profileScreen=function(){
 return originalProfile()+
 '<section class="bp52-feedback-card"><h2>Ajută-ne să îmbunătățim BunPlan</h2>'+
 '<p>Ai găsit o problemă, vrei o rețetă nouă sau ai o sugestie? Mesajul ajunge direct în panoul de administrare.</p>'+
 '<button class="btn block out" onclick="bp52FeedbackOpen()">Trimite feedback →</button></section>';
};
window.bp52FeedbackOpen=function(){
 const old=document.getElementById('bp52-feedback-sheet');if(old)old.remove();
 const modal=document.createElement('div');modal.className='bp52-feedback-backdrop';modal.id='bp52-feedback-sheet';
 modal.innerHTML='<section class="bp52-feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="bp52-feedback-title">'+
 '<button class="bp52-feedback-close" onclick="bp52FeedbackClose()" aria-label="Închide">✕</button>'+
 '<h2 id="bp52-feedback-title">Spune-ne ce putem îmbunătăți</h2>'+
 '<label>Tip mesaj<select id="bp52-feedback-category"><option value="bug">Problemă tehnică</option>'+
 '<option value="suggestion">Sugestie</option><option value="question">Întrebare</option>'+
 '<option value="other">Altele</option></select></label>'+
 '<label>Mesaj<textarea id="bp52-feedback-message" minlength="2" maxlength="4000" rows="5" placeholder="Descrie problema sau propunerea…"></textarea></label>'+
 '<small id="bp52-feedback-status" role="status">Nu include parole, coduri de autentificare sau alte date sensibile.</small>'+
 '<button id="bp52-feedback-submit" class="btn block" onclick="bp52SendFeedback()">Trimite către BunPlan</button>'+
 '</section>';
 document.body.appendChild(modal);
 modal.addEventListener('click',e=>{if(e.target===modal)window.bp52FeedbackClose()});
};
window.bp52FeedbackClose=function(){document.getElementById('bp52-feedback-sheet')?.remove()};
window.bp52SendFeedback=function(){
 const category=document.getElementById('bp52-feedback-category')?.value;
 const message=document.getElementById('bp52-feedback-message')?.value?.trim()||'';
 const info=document.getElementById('bp52-feedback-status'),btn=document.getElementById('bp52-feedback-submit');
 if(!['bug','suggestion','question','other'].includes(category)||message.length<2||message.length>4000){
  if(info)info.textContent='Introdu un mesaj de 2–4.000 caractere.';return;
 }
 if(!window.BunPlanCloud?.sendFeedback){if(info)info.textContent='Trimite mesajul din aplicația Android actualizată.';return}
 btn.disabled=true;info.textContent='Se trimite…';
 window.BunPlanCloud.sendFeedback(category,message);
};
const oldDone=window.BunPlanCloudDone;
window.BunPlanCloudDone=function(action,result){
 if(action!=='feedback')return oldDone?.(action,result);
 const status=document.getElementById('bp52-feedback-status'),btn=document.getElementById('bp52-feedback-submit');
 if(btn)btn.disabled=false;
 if(result?.ok){if(status)status.textContent='Mesajul tău a fost înregistrat. Mulțumim!';
  const input=document.getElementById('bp52-feedback-message');if(input)input.value='';
 }else{if(status)status.textContent='Nu am putut trimite: '+String(result?.message||'Încearcă din nou.').slice(0,250)}
};
if(state.tab==='profile')draw();
})();