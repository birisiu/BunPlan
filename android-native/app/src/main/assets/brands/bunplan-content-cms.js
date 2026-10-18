/* BunPlan App Content — Supabase is the editorial source of truth.
 * Safe fallbacks are bundled only for first boot/offline access.
 * No auth/service secrets, raw HTML or executable code are accepted from CMS.
 */
(function(){
'use strict';
const API='https://aedyviqoelgbbrrtwayu.supabase.co/rest/v1/bunplan_content_sections';
const KEY='sb_publishable_pLh8mKxNWKkq396TyM518A_N_q7fm0Z';
const CACHE='bunplan-published-content-v1';
let content={},lastSync=null,request=null;
try{
 const saved=JSON.parse(localStorage.getItem(CACHE)||'null');
 if(saved&&typeof saved==='object'&&!Array.isArray(saved))content=saved;
}catch(e){}
const text=(section,key,fallback='')=>{
 const v=content[section]?.[key];
 return typeof v==='string'&&v.length<3500?v:fallback;
};
const value=(section,key,fallback=null)=>{
 const v=content[section]?.[key];
 if(v===undefined||v===null)return fallback;
 if(typeof v==='object'&&!(Array.isArray(v)||Object.getPrototypeOf(v)===Object.prototype))return fallback;
 return v;
};
window.bunplanCMSCopy=text;
window.bunplanCMSGet=value;
window.bunplanCMSAll=()=>content;
function changeText(node,textValue){if(node&&typeof textValue==='string')node.textContent=textValue}
function from(section,key,fallback){return text(section,key,fallback)}
function refreshLabels(){
 const translated={
  home:'home',library100:'recipes',basket100:'shopping',profile:'profile'
 };
 for(const tab of nav){
  const section=translated[tab[0]];
  if(section)tab[2]=from('navigation',section,tab[2]);
 }
}
function paint(){
 refreshLabels();
 const main=document.querySelector('main.scroll');if(!main)return;
 document.querySelectorAll('nav.bottom button.nav').forEach((b,i)=>{
   if(nav[i])b.lastChild.textContent=nav[i][2];
 });
 const st=state.tab;
 if(st==='home'){
  const compact=String(state.name||'').trim().split(/\s+/)[0]||'prietene';
  changeText(main.querySelector('.bp-brand-greeting h1'),
   from('home','greeting_prefix','Bună,')+' '+compact+from('home','greeting_suffix','! 👋'));
  changeText(main.querySelector('.bp-brand-greeting p'),
   from('home','subtitle','Hai să planificăm o săptămână mai bună!'));
  const heads=[...main.querySelectorAll('.bp-brand-sectionhead h2')];
  const links=[...main.querySelectorAll('.bp-brand-sectionhead button')];
  changeText(heads[0],from('home','weekly_plan_title','Planul săptămânii'));
  changeText(links[0],from('home','weekly_plan_button','Vezi tot →'));
  changeText(heads[1],from('home','budget_title','Bugetul acestei săptămâni'));
  changeText(links[1],from('home','budget_button','Detalii →'));
  changeText(heads[2],from('home','discover_title','Poftă de ceva nou?'));
  changeText(links[2],from('home','discover_button','Vezi rețete →'));
  changeText(main.querySelector('.bp-brand-budget .btn:not(.out)'),
   from('home','budget_plan_button','Planifică mesele →'));
  changeText(main.querySelector('.bp-brand-budget .btn.out'),
   from('home','shopping_button','Vezi lista de cumpărături'));
  changeText(main.querySelector('.bp-brand-retailer > span'),
   from('home','store_title','Magazin'));
  changeText(main.querySelector('.bp-brand-retailer > button'),
   from('home','store_button','Schimbă'));
  changeText(main.querySelector('.bp-brand-disclaimer'),
   from('home','disclaimer','Prețurile sunt orientative și nu confirmă stocul local.'));
  const n=Number(window.bunplanCatalogCount)||BP100.length;
  changeText(main.querySelector('.bp-brand-catalogpromo b'),
   n.toLocaleString('ro-RO')+' '+from('home','catalog_title','idei de încercat'));
  changeText(main.querySelector('.bp-brand-catalogpromo small'),
   from('home','catalog_subtitle','Mese simple și ingrediente organizate'));
 }
 if(st==='library100'){
  changeText(main.querySelector('h1.title'),from('recipes','title','Rețete de gătit'));
  changeText(main.querySelector('p.sub'),from('recipes','subtitle','Pași și ingrediente pentru familie.'));
  const search=main.querySelector('.p-headsearch');
  if(search)search.placeholder=from('recipes','search_placeholder','Caută rețete sau ingrediente…');
  changeText(main.querySelector('#bpCloudMore'),from('recipes','load_more_button','Încarcă alte rețete ↓'));
  const notes=[...main.querySelectorAll('.bp-notice')];
  if(notes.length>1)changeText(notes[notes.length-1],
   from('recipes','disclaimer','Prețurile pot să difere de cele de la raft.'));
  const menu=[...main.querySelectorAll('.row button')].find(b=>b.getAttribute('onclick')?.includes('menu100'));
  changeText(menu,from('recipes','menu_button','Planul meu →'));
 }
 if(st==='basket100'){
  changeText(main.querySelector('.bp50-spend-head h2'),
   from('shopping','paid_title','Cheltuielile săptămânii'));
  const summaries=[...main.querySelectorAll('.bp50-spend-grid .bp50-stat small')];
  changeText(summaries[0],from('shopping','estimated_label','Total estimat'));
  changeText(summaries[1],from('shopping','paid_label','Total plătit confirmat'));
  changeText(summaries[2],from('shopping','difference_label','Diferență pe produse confirmate'));
  changeText(main.querySelector('.bp50-both-stores span'),
   from('shopping','week_label','Cheltuit săptămâna aceasta (Lidl + Kaufland)'));
 }
 if(st==='profile'){
  const tit=main.querySelector('.title');if(tit)changeText(tit,from('profile','title',tit.textContent));
  const sub=main.querySelector('.sub');if(sub)changeText(sub,from('profile','subtitle',sub.textContent));
  changeText(main.querySelector('.bp52-feedback-card h2'),
   from('profile','support_title','Ajută-ne să îmbunătățim BunPlan'));
  changeText(main.querySelector('.bp52-feedback-card p'),
   from('profile','support_description','Ai o sugestie?'));
  changeText(main.querySelector('.bp52-feedback-card button'),
   from('profile','support_button','Trimite feedback →'));
  changeText(main.querySelector('.bp54-tutorial-restart h2'),
   from('profile','tutorial_title','Ghidul BunPlan'));
  changeText(main.querySelector('.bp54-tutorial-restart p'),
   from('profile','tutorial_description','Descoperă funcțiile aplicației.'));
  changeText(main.querySelector('#bp54-start-tour'),
   from('profile','tutorial_button','Vezi din nou tutorialul'));
 }
}
window.bunplanCMSPaint=paint;
function perform(){
 if(request)return request;
 const url=API+'?select=section_key,content,updated_at&published=eq.true&order=section_key&limit=100';
 request=fetch(url,{cache:'no-store',
  headers:{apikey:KEY,Accept:'application/json','Cache-Control':'no-cache'}})
 .then(async response=>{
  if(!response.ok)throw Error('HTTP '+response.status);
  const rows=await response.json();
  if(!Array.isArray(rows)||rows.length<5)throw Error('Conținutul nu a fost încărcat complet');
  const next={};
  for(const section of rows){
   if(typeof section.section_key==='string'&&section.content&&typeof section.content==='object')
    next[section.section_key]=section.content;
  }
  content=next;lastSync=Date.now();
  window.BunPlanContent=content;
  window.dispatchEvent(new CustomEvent('bunplan-content-updated',{detail:{at:lastSync}}));
  try{localStorage.setItem(CACHE,JSON.stringify(content))}catch(e){}
  // The UI is regenerated from the shared, central content version.
  if(typeof draw==='function')draw();
  paint();
  return {ok:true,count:rows.length,at:lastSync};
 })
 .catch(error=>({ok:false,message:error?.message||'Conexiune indisponibilă'}))
 .finally(()=>{request=null});
 return request;
}
window.bunplanRefreshCMSContent=perform;
const prior=draw;
draw=function(){prior();paint()};
refreshLabels();paint();
perform();
})();