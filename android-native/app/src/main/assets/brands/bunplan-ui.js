/* BunPlan 4.9 - cohesive visual presentation. Existing storage, Supabase
   recipes, retailer separation, shopping totals and authentication stay intact. */
(function(){
'use strict';
const icons={
 house:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 food:'<path d="M4 3v7m3-7v7M4 6h3M5.5 10v11M15 3v18M15 3c6 3 7 8 0 11"/>',
 list:'<path d="M7 3h11a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M9 8h7m-7 5h7m-7 5h7M3 8h1M3 13h1M3 18h1"/>',
 chef:'<path d="M6 13a4 4 0 0 1-1-7 5 5 0 0 1 9-2 4 4 0 1 1 4 7v5H6z"/><path d="M6 20h12M8 16v4m8-4v4"/>',
 person:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3-7 8-7s8 3 8 7"/>'
};
const svg=key=>'<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">'+icons[key]+'</svg>';
nav.splice(0,nav.length,
 ['home',svg('house'),'Planul meu'],
 ['library100',svg('food'),'Rețete'],
 ['basket100',svg('list'),'Lista'],
 ['savedCooking',svg('chef'),'Salvate'],
 ['profile',svg('person'),'Profil']
);
function recipe(id){return BP100.find(x=>x.id===id)}
function formatMoney(v){return ron(Number(v)||0)+' lei'}
function shortDay(i){return ['Lun','Mar','Mie','Joi','Vin','Sâm','Dum'][i]}
function iconFor(r){return r?BP100_EMOJI[r.category]||'🥘':'🍽️'}
function compactName(s){return String(s||'').split(/\s+/)[0]||'prietene'}
function feature(r,small=false){
 if(!r)return '<div class="bp-brand-feature"><div class="bp-brand-food">🥗</div><div class="bp-brand-featuretext"><b>Ce gătim săptămâna asta?</b><span class="muted">Explorează rețetele și adaugă un preparat în plan.</span><button onclick="go(\'library100\')">Alege o rețetă →</button></div></div>';
 return '<article class="bp-brand-feature">'+
  '<div class="bp-brand-food'+(small?' small':'')+'" role="img" aria-label="Preparat: '+esc(r.title)+'">'+iconFor(r)+'</div>'+
  '<div class="bp-brand-featuretext"><b>'+esc(r.title)+'</b>'+
  '<span class="muted">◷ '+Number(r.minutes||0)+' min · '+Number(r.servings||2)+' porții</span>'+
  '<button type="button" onclick="bpOpen('+JSON.stringify(r.id).replace(/"/g,'&quot;')+')">Vezi rețeta →</button></div></article>';
}
home=function(){
 const counted=bpCountPlan(),bill=bp35Calc(),budget=Math.max(1,Number(state.budget)||450);
 const money=Number(bill.total)||0,missing=Number(bill.missing)||0;
 const today=Math.max(0,Math.min(6,Number(bp100.day)||0));
 const dates=Array.from({length:7},(_,i)=>bp35Date(bp35.week,i));
 const week=dates[0].toLocaleDateString('ro-RO',{day:'numeric',month:'short'})+' – '+dates[6].toLocaleDateString('ro-RO',{day:'numeric',month:'short'});
 const dayPlanned=Object.values(bp100.days[today]||{}).map(recipe).filter(Boolean);
 const featuredIds=window.bunplanCMSGet?.('home','featured_recipe_ids',[])||[];
 const featured=Array.isArray(featuredIds)?featuredIds.map(recipe).filter(Boolean):[];
 const todayPick=dayPlanned[0]||featured[0]||BP100.find(x=>x.id==='R001')||BP100[0];
 const fallback=featured.find(r=>r.id!==todayPick?.id)||
   BP100.find(r=>r.id!==todayPick?.id && r.category==='Vegetarian')||
   BP100.find(r=>r.id!==todayPick?.id);
 const percent=counted?Math.max(0,Math.min(100,Math.round(money/budget*100))):0;
 const greeting='Bună, '+esc(compactName(state.name))+'! 👋';
 return commonTop()+'<div class="bp-brand-home">'+
 '<header class="bp-brand-greeting"><h1>'+greeting+'</h1><p>Hai să planificăm o săptămână mai bună!</p></header>'+
 (window.bunplanPromotionsHTML?.()||'')+
 '<div class="bp-weekline" aria-label="Zilele săptămânii">'+
 dates.map((d,i)=>'<button type="button" class="'+(i===today?'active':'')+'" onclick="bpDay('+i+');go(\'menu100\')" aria-label="'+
 esc(BP_DAYS[i]+' '+d.getDate())+'">'+shortDay(i)+'<span>'+d.getDate()+'</span></button>').join('')+'</div>'+
 '<div class="bp-brand-sectionhead"><h2>Planul săptămânii</h2><button onclick="go(\'menu100\')">Vezi tot →</button></div>'+
 feature(todayPick)+
 '<div class="bp-brand-budget"><div class="bp-brand-sectionhead"><h2>Bugetul acestei săptămâni</h2><button onclick="go(\'basket100\')">Detalii →</button></div>'+
 '<div class="bp-brand-budget-grid"><div class="bp-brand-ring" style="--bp-progress:'+percent+'%"><div class="bp-brand-ringinner">'+(counted?Math.round(money):'0')+' lei<small>din '+Math.round(budget)+' lei</small></div></div>'+
 '<div class="bp-brand-budgetcopy"><strong>'+(counted&&missing?'Subtotal parțial':counted?'≈ '+Math.round(Math.max(0,budget-money))+' lei':'Începe un plan')+'</strong>'+
 '<small>'+(counted?counted+' mese planificate · '+week:'Alege rețete pentru cele 7 zile')+'</small>'+
 '<small>'+(missing?missing+' ingrediente fără preț, bugetul este incomplet.':counted?'Prețuri orientative, nu stocuri confirmate.':'Bugetul se actualizează automat după planificare.')+'</small></div></div>'+
 '<button class="btn" onclick="go(\'menu100\')">Planifică mesele →</button>'+
 '<button class="btn out" onclick="go(\'basket100\')">Vezi lista de cumpărături</button></div>'+
 '<div class="bp-brand-retailer"><span style="font-size:11px;color:var(--muted);font-weight:900">Magazin</span>'+bpStoreBrand(bp35.store)+
 '<button onclick="go(\'stores\')">Schimbă</button></div>'+
 '<div class="bp-brand-sectionhead"><h2>Poftă de ceva nou?</h2><button onclick="go(\'library100\')">Vezi rețete →</button></div>'+
 feature(fallback,true)+
 '<div class="bp-brand-catalogpromo"><span>🌿</span><div><b>1.100 de idei de încercat</b><small>Mese simple și ingrediente organizate</small></div>'+
 '<button aria-label="Explorează rețetele" onclick="go(\'library100\')">›</button></div>'+
 '<p class="bp-brand-disclaimer">BunPlan este independentă de Lidl și Kaufland. Prețurile estimate nu confirmă disponibilitatea produselor într-un magazin.</p>'+
 '</div>';
};
// A theme change should never discard the current menu or checkboxes.
if(['home','library100','basket100','menu100','profile','stores'].includes(state.tab))draw();
})();