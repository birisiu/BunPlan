/* BunPlan 5.4 — public CRM refresh and first-run guided tour.
 * No privileged keys are embedded. Android only reads public RLS data.
 * User's purchases, prices and weekly plan are never overwritten.
 */
(function(){
'use strict';
const TOUR_KEY='bunplan_app_tour_v54_finished';
const TOUR_STATE_KEY='bunplan_app_tour_v54_progress';
const $=selector=>document.querySelector(selector);
let syncing=false,active=false,index=0,previousTab='home',seenAt=0;
const fallbackSteps=[
 {tab:'home',target:'.top .logo',title:'Bine ai venit în BunPlan!',icon:'🌿',
  body:'BunPlan te ajută să alegi ce gătești, să planifici mesele și să organizezi cumpărăturile.'},
 {tab:'home',target:'.bp-weekline',title:'Săptămâna ta, dintr-o privire',icon:'📅',
  body:'Selectează o zi ca să alegi mesele. Poți reveni oricând pentru a schimba meniul.'},
 {tab:'home',target:'.bp-brand-budget',title:'Controlează bugetul',icon:'💰',
  body:'Vezi bugetul orientativ. Sumele fără preț complet nu sunt tratate drept total final.'},
 {tab:'library100',target:'.p-headsearch',title:'Descoperă rețete',icon:'🍲',
  body:'Caută după nume sau ingredient, deschide o rețetă și verifică ingredientele și pașii.'},
 {tab:'menu100',target:'.bp35-week',title:'Construiește planul alimentar',icon:'🗓️',
  body:'Adaugă rețetele în zilele săptămânii, pentru mic dejun, prânz și cină.'},
 {tab:'basket100',target:'.bp50-spend-panel',title:'Lista de cumpărături',icon:'🛒',
  body:'Produsele din meniuri apar în listă. Bifează-le și introdu suma de pe bon pentru totalul efectiv plătit.'},
 {tab:'home',target:'.bp-brand-retailer',title:'Lidl sau Kaufland',icon:'🏬',
  body:'Alege magazinul pentru care vrei să pregătești lista și să vezi estimările de preț.'},
 {tab:'profile',target:'.profile-hero',title:'Profilul și preferințele tale',icon:'👤',
  body:'Aici poți modifica preferințele, bugetul, familia și poți trimite feedback.'},
 {tab:'home',target:'.bp56-pull-indicator',title:'Trage în jos pentru actualizare',icon:'🔄',
  body:'Trage ecranul în jos de sus pentru a actualiza rețetele și prețurile din CRM.'}
];
let steps=fallbackSteps;
function syncSteps(){
 const cms=window.bunplanCMSGet?.('tour','steps');
 if(Array.isArray(cms)&&cms.length>=3&&cms.length<=20&&
  cms.every(st=>st&&typeof st.title==='string'&&typeof st.body==='string'&&
    ['home','library100','menu100','basket100','profile','detail100'].includes(st.tab))){
  steps=cms;
 }else steps=fallbackSteps;
}
syncSteps();
window.addEventListener('bunplan-content-updated',()=>{
 syncSteps();
 if(active){index=Math.min(index,steps.length-1);renderTour()}
});
function eligible(){
 try{
  const o=JSON.parse(localStorage.getItem('bunplan_onboard_v2')||'null');
  return o?.completed===true &&
    (!window.BunPlanAuth||typeof window.BunPlanAuth.hasSession!=='function'||window.BunPlanAuth.hasSession());
 }catch(e){return false}
}
function note(msg){
 let node=document.getElementById('bp54-sync-note');
 if(!node){node=document.createElement('div');node.id='bp54-sync-note';node.setAttribute('role','status');document.body.appendChild(node)}
 node.textContent=msg;node.classList.add('visible');
 clearTimeout(note._timer);note._timer=setTimeout(()=>node.classList.remove('visible'),4200);
}
async function syncAll(){
 if(syncing)return {ok:false,reason:'busy'};
 syncing=true;
 note('Actualizăm rețetele, fotografiile, prețurile și setările…');
 try{
  const tasks=[
   ['rețete',window.bunplanRefreshRecipes],
   ['prețuri',window.bunplanRefreshIngredientPrices],
   ['fotografii',window.bunplanRefreshIngredientPhotos],
   ['setări',window.bunplanRefreshSettings],
   ['conținutul aplicației',window.bunplanRefreshCMSContent]
  ];
  const results=await Promise.all(tasks.map(async ([type,fn])=>{
   try{return {type,...(typeof fn==='function'?await fn():{ok:false,message:'Sursă indisponibilă'})}}
   catch(e){return {type,ok:false,message:e.message||'Eroare'}}
  }));
  const failed=results.filter(x=>!x.ok);
  if(failed.length===0){note('Datele au fost actualizate din BunPlan CRM.');}
  else{note('Actualizare parțială: '+failed.map(x=>x.type).join(', ')+'. Verifică internetul.')}
  window.bunplanLastSync={at:new Date().toISOString(),results};
  return {ok:failed.length===0,results};
 }finally{
  syncing=false;
 }
}
window.bp54RefreshAll=syncAll;
function installRefreshButton(){
 const top=$('main.scroll .top');
 if(!top||top.querySelector('.bp57-refresh-button'))return;
 const button=document.createElement('button');
 button.className='bp57-refresh-button';
 button.type='button';
 button.title='Actualizează din BunPlan CRM';
 button.setAttribute('aria-label','Actualizează rețetele, fotografiile și prețurile');
 button.textContent='↻';
 button.onclick=()=>syncAll();
 const avatar=top.querySelector('button.avatar');
 top.insertBefore(button,avatar||null);
}
function installProfileTutorial(){
 if(state.tab==='profile'&&!document.getElementById('bp54-tutorial-restart')){
  const main=$('main.scroll');
  if(main){
   const block=document.createElement('section');
   block.id='bp54-tutorial-restart';block.className='bp54-tutorial-restart';
   block.innerHTML='<h2>Ghidul BunPlan</h2>'+
    '<p>Poți redeschide tutorialul oricând și poți actualiza rețetele din CRM.</p>'+
    '<button class="btn out block" type="button" id="bp54-start-tour">Vezi din nou tutorialul</button>'+
    '<button class="btn block" type="button" id="bp57-refresh-profile">↻ Actualizează din CRM</button>';
   main.appendChild(block);
   block.querySelector('#bp54-start-tour').onclick=()=>window.bp54TourStart(true);
   block.querySelector('#bp57-refresh-profile').onclick=syncAll;
  }
 }
}
function removeOverlay(){document.getElementById('bp54-tour-layer')?.remove()}
function stop(completed){
 if(completed)localStorage.setItem(TOUR_KEY,'1');
 localStorage.removeItem(TOUR_STATE_KEY);
 removeOverlay();active=false;
 if(state.tab!==previousTab)go(previousTab);
}
window.bp54TourSkip=function(){stop(true)};
window.bp54TourNext=function(){
 if(!active)return;
 if(index>=steps.length-1){stop(true);return}
 index++;localStorage.setItem(TOUR_STATE_KEY,String(index));renderTour();
};
window.bp54TourPrev=function(){
 if(!active)return;
 index=Math.max(0,index-1);renderTour();
};
window.bp54TourStart=function(force){
 syncSteps();
 if(active)return;
 if(!force&&(localStorage.getItem(TOUR_KEY)==='1'||!eligible()))return;
 previousTab=state.tab||'home';index=0;active=true;renderTour();
};
function focusRectangle(target){
 const el=$('.bp54-tour-spot');
 if(!el)return;
 if(!target){el.style.display='none';return}
 const rect=target.getBoundingClientRect();
 if(rect.width<20||rect.height<8){el.style.display='none';return}
 const pad=5;
 el.style.display='block';el.style.top=Math.max(4,rect.top-pad)+'px';
 el.style.left=Math.max(4,rect.left-pad)+'px';
 el.style.width=Math.min(window.innerWidth-8,rect.width+pad*2)+'px';
 el.style.height=Math.min(window.innerHeight-8,rect.height+pad*2)+'px';
}
function renderTour(){
 if(!active)return;
 const step=steps[index];
 if(!step)return stop(true);
 if(state.tab!==step.tab)go(step.tab);
 // Run after the screen is painted, including Android WebView.
 requestAnimationFrame(()=>{
  if(!active)return;
  installProfileTutorial();
  removeOverlay();
  const layer=document.createElement('div');
  layer.id='bp54-tour-layer';layer.className='bp54-tour-layer';
  layer.innerHTML='<div class="bp54-tour-spot" aria-hidden="true"></div>'+
   '<div class="bp54-tour-dialog" role="dialog" aria-modal="true" aria-labelledby="bp54-tour-title">'+
    '<div class="bp54-tour-progress"><span>Ghid BunPlan</span><span>Pasul '+(index+1)+' din '+steps.length+'</span></div>'+
    '<div class="bp54-tour-icon">'+step.icon+'</div>'+
    '<h2 id="bp54-tour-title">'+step.title+'</h2><p>'+step.body+'</p>'+
    '<div class="bp54-tour-dots">'+steps.map((_,i)=>'<span class="'+(i===index?'active':'')+'"></span>').join('')+'</div>'+
    '<div class="bp54-tour-buttons">'+
     '<button class="bp54-tour-skip" type="button" onclick="bp54TourSkip()">'+
      (window.bunplanCMSCopy?.('tour','skip_label','Sari peste')||'Sari peste')+'</button>'+
     (index?'<button class="bp54-tour-back" type="button" onclick="bp54TourPrev()">'+
       (window.bunplanCMSCopy?.('tour','back_label','Înapoi')||'Înapoi')+'</button>':'')+
     '<button class="bp54-tour-next" type="button" onclick="bp54TourNext()">'+
       (index===steps.length-1?
       (window.bunplanCMSCopy?.('tour','finish_label','Am înțeles ✓')||'Am înțeles ✓'):
       (window.bunplanCMSCopy?.('tour','next_label','Continuă →')||'Continuă →'))+'</button>'+
    '</div></div>';
  document.body.appendChild(layer);
  const target=document.querySelector(step.target);
  if(target){
   const r=target.getBoundingClientRect();
   if(r.top<8||r.bottom>window.innerHeight-230)target.scrollIntoView({behavior:'instant',block:'center'});
  }
  requestAnimationFrame(()=>focusRectangle(document.querySelector(step.target)));
 });
}
const previousDraw=draw;
draw=function(){
 previousDraw();
 installRefreshButton();
 installProfileTutorial();
 if(active){
  requestAnimationFrame(()=>focusRectangle(document.querySelector(steps[index].target)));
 }
};
// Pull-to-refresh is bound to normal DOCUMENT scrolling in Android WebView.
// The main.scroll element is a non-scrolling wrapper; using main.scroll.scrollTop
// would never correctly detect top-of-page.
let startY=null,startX=null,pulling=false,pullDistance=0,pullEnabled=true;
const indicator=document.createElement('div');
indicator.id='bp56-pull-indicator';
indicator.className='bp56-pull-indicator';
indicator.setAttribute('role','status');
indicator.setAttribute('aria-live','polite');
indicator.innerHTML='<span class="bp56-pull-wheel">↻</span><span class="bp56-pull-text">Trage în jos pentru actualizare</span>';
document.body.appendChild(indicator);
function pullLabel(text){indicator.querySelector('.bp56-pull-text').textContent=text}
function resetPull(){
 startY=null;startX=null;pulling=false;pullDistance=0;
 indicator.classList.remove('active','ready','refreshing');
 indicator.style.setProperty('--pull-distance','0px');
 indicator.style.setProperty('--pull-rotation','0deg');
}
window.bp56PullState=()=>({pulling,distance:pullDistance,syncing});
document.addEventListener('touchstart',event=>{
 if(event.touches.length!==1||syncing||active||document.visibilityState==='hidden')return;
 const target=event.target;
 if(target.closest?.('.bp54-tour-layer,.bp52-feedback-backdrop,.bp50-editor-backdrop,select,textarea,input,[role="dialog"]'))return;
 if((window.scrollY||document.scrollingElement?.scrollTop||0)>2)return;
 const t=event.touches[0];startY=t.clientY;startX=t.clientX;pulling=false;pullDistance=0;
},{passive:true});
document.addEventListener('touchmove',event=>{
 if(startY===null||event.touches.length!==1||syncing||active)return;
 const t=event.touches[0],dy=t.clientY-startY,dx=t.clientX-startX;
 if(dy<=10||Math.abs(dx)>dy*.7){
  if(dy<0||Math.abs(dx)>35)resetPull();
  return;
 }
 if((window.scrollY||document.scrollingElement?.scrollTop||0)>2){resetPull();return}
 if(event.cancelable)event.preventDefault();
 pulling=true;pullDistance=Math.min(160,dy);
 const ready=pullDistance>=85;
 indicator.classList.add('active');
 indicator.classList.toggle('ready',ready);
 indicator.style.setProperty('--pull-distance',Math.min(84,dy*.58)+'px');
 indicator.style.setProperty('--pull-rotation',Math.min(360,dy*3)+'deg');
 pullLabel(ready?'Eliberează pentru actualizare':(window.bunplanCMSCopy?.('navigation','pull_hint','Trage în jos pentru a actualiza')||'Trage în jos pentru a actualiza'));
},{passive:false});
document.addEventListener('touchend',async event=>{
 if(startY===null)return;
 const shouldSync=pulling&&pullDistance>=85&&!syncing&&!active;
 resetPull();
 if(!shouldSync)return;
 indicator.classList.add('active','refreshing');
 pullLabel('Actualizăm datele din CRM…');
 try{await syncAll()}
 finally{resetPull()}
},{passive:true});
document.addEventListener('touchcancel',resetPull,{passive:true});

window.addEventListener('resize',()=>{
 if(active)focusRectangle(document.querySelector(steps[index].target));
});
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'&&eligible()&&Date.now()-seenAt>60000){
  seenAt=Date.now();syncAll();
 }
});
window.addEventListener('online',()=>{
 if(eligible()&&Date.now()-seenAt>60000){seenAt=Date.now();syncAll()}
});
installRefreshButton();
installProfileTutorial();
if(localStorage.getItem(TOUR_KEY)!=='1'&&eligible()&&
 window.bunplanCMSGet?.('tour','enabled',true)!==false){
 // Let the opening screen finish loading before the first popup.
 setTimeout(()=>window.bp54TourStart(false),750);
}
})();