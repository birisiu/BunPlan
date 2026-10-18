/* BunPlan 5.0 — real weekly spend, per-product paid prices.
 * User-confirmed values NEVER overwrite catalog estimates.
 * Separate by store and ISO Monday, durable across navigation/restart.
 */
(function(){
'use strict';
const KEY='bunplan-paid-amounts-v1';
const money=n=>Number(n||0).toLocaleString('ro-RO',{minimumFractionDigits:2,maximumFractionDigits:2})+' lei';
let paid={};
try{const p=JSON.parse(localStorage.getItem(KEY)||'{}');if(p&&typeof p==='object')paid=p}catch(e){}
const own=Object.prototype.hasOwnProperty;
function key(){return bp35Key()}
function record(k=key()){return paid[k]||(paid[k]={})}
function save(){try{localStorage.setItem(KEY,JSON.stringify(paid))}catch(e){console.error('BunPlan paid prices could not be saved',e)}}
function hasPaid(k=key(),id){return own.call(paid[k]||{},id)&&Number.isFinite(Number(paid[k][id]?.amount))}
function entry(k=key(),id){return paid[k]?.[id]||null}
function cost(item){return Number(item?.cost??item?.total??0)||0}
function rows(){const c=bp35Calc();return {c,all:[
  ...c.rows.map(x=>({id:'i:'+x.id,reference:x,name:bpName(x.id),approx:cost(x),unit:x.a?.unit||'g',
      amount:x.a?Math.ceil(x.a.quantity)+' '+bp35Unit(x.a):'',missing:x.type==='missing'})),
  ...c.extras.map(x=>({id:'p:'+x.id,reference:x,name:x.name,approx:cost(x),
      unit:x.amount||'buc',amount:x.qty+' × '+x.amount,missing:false}))
]};}
function summary(k=key()){
  const cur=rows(),items=cur.all,bought=bp35.bought[k]||{};
  const count=items.filter(x=>bought[x.id]).length;
  const confirmed=items.filter(x=>bought[x.id]&&hasPaid(k,x.id));
  const paidTotal=confirmed.reduce((sum,item)=>sum+Number(entry(k,item.id).amount),0);
  const approxPurchased=confirmed.filter(x=>!x.missing).reduce((sum,item)=>sum+item.approx,0);
  const totalKnown=items.reduce((sum,x)=>sum+x.missing?0:0,0);
  const unfinished=count-confirmed.length;
  const remaining=items.filter(x=>!bought[x.id]);
  const remainingEstimate=remaining.reduce((sum,item)=>sum+(item.missing?0:item.approx),0);
  return {count,total:items.length,confirmed:confirmed.length,unfinished,
    paid:paidTotal,estimated:cur.c.total,estimatedPurchased:approxPurchased,
    diff:paidTotal-approxPurchased,remainingEstimate,missing:cur.c.missing||0,
    store:bp35.store,week:bp35.week};
}
function weeklyBothStores(){
 const monday=bp35.week,stores=['Lidl','Kaufland'];
 let total=0,items=0;
 for(const store of stores){
  const code=store+'|'+monday,buys=bp35.bought[code]||{};
  for(const [id,x] of Object.entries(paid[code]||{})){
   if(buys[id]&&Number.isFinite(Number(x?.amount))){
    total+=Number(x.amount);items++;
   }
  }
 }
 return {total,items};
}
function recentPrice(id,item){
 const k=key(),found=entry(k,id);
 if(bp35Marked(id)&&hasPaid(k,id))return {value:Number(found.amount),confirmed:true};
 return {value:item.approx,confirmed:false};
}
function syncTotals(){
 const stat=summary(),both=weeklyBothStores();
 const totalBox=document.getElementById('bp50-total-paid');
 if(!totalBox)return;
 const bind=(id,text)=>{const node=document.getElementById(id);if(node)node.textContent=text};
 bind('bp50-total-paid',money(stat.paid));
 bind('bp50-total-estimate',stat.missing?'≈ '+money(stat.estimated)+'+':'≈ '+money(stat.estimated));
 bind('bp50-total-difference',(stat.diff>0?'+':'')+money(stat.diff));
 bind('bp50-pending',stat.unfinished?stat.unfinished+' produse bifate fără preț final confirmat':'Toate prețurile bifate sunt confirmate');
 bind('bp50-week-paid',money(both.total));
 bind('bp50-week-count',both.items+' produse, ambele magazine');
 bind('bp50-progress',stat.count+' din '+stat.total+' cumpărate');
 const pct=stat.total?Math.round(stat.count/stat.total*100):0;
 const bar=document.getElementById('bp50-bar');if(bar)bar.style.width=pct+'%';
 bind('bp50-remaining',stat.total-stat.count+' rămase');
 const heading=document.querySelector('.bp35-boughtheading span');
 if(heading)heading.textContent=stat.count+'/'+stat.total+' bifate';
}
function sheetHtml(item){
 const old=entry(key(),item.id);
 const guess=old&&hasPaid(key(),item.id)?Number(old.amount):(!item.missing?item.approx:0);
 return '<div class="bp50-editor-backdrop" id="bp50-price-dialog" role="presentation">'+
 '<div class="bp50-editor" role="dialog" aria-modal="true" aria-labelledby="bp50-edit-title">'+
 '<button type="button" class="bp50-editor-close" onclick="bp50Close()" aria-label="Închide">✕</button>'+
 '<span class="bp50-eyebrow">PREȚ PLĂTIT</span>'+
 '<h2 id="bp50-edit-title">'+esc(item.name)+'</h2>'+
 '<p>Preț estimat: '+(item.missing?'necunoscut':money(item.approx))+
 '. Introdu suma totală de pe bon pentru acest produs și cantitatea cumpărată.</p>'+
 '<label for="bp50-price-field">Preț final plătit (lei)</label>'+
 '<input id="bp50-price-field" inputmode="decimal" type="text" autocomplete="off" value="'+
 (guess?guess.toFixed(2).replace('.',','):'')+'" placeholder="ex. 8,20" />'+
 '<small>Prețul este salvat doar în cheltuielile tale, nu modifică prețurile Lidl/Kaufland.</small>'+
 '<div class="bp50-editor-actions"><button class="btn out" onclick="bp50Close()">Mai târziu</button>'+
 '<button class="btn" id="bp50-save-price">Salvează prețul</button></div></div></div>';
}
let current=null;
window.bp50Close=function(){const e=document.getElementById('bp50-price-dialog');if(e)e.remove();current=null};
window.bp50EditPrice=function(id){
 const item=rows().all.find(x=>x.id===id);
 if(!item)return;
 current=item;
 const existing=document.getElementById('bp50-price-dialog');if(existing)existing.remove();
 document.body.insertAdjacentHTML('beforeend',sheetHtml(item));
 const panel=document.getElementById('bp50-price-dialog');
 panel.addEventListener('click',e=>{if(e.target===panel)window.bp50Close()});
 const input=panel.querySelector('input');
 panel.querySelector('#bp50-save-price').addEventListener('click',()=>{
  const raw=input.value.trim().replace(/\s/g,'').replace(',','.');
  if(!/^\d+(\.\d{1,2})?$/.test(raw)){input.setCustomValidity('Introdu o sumă validă, de exemplu 8,20');input.reportValidity();return}
  const amount=Number(raw);
  if(!Number.isFinite(amount)||amount<0||amount>100000){alert('Preț invalid.');return;}
  const k=key();record(k)[id]={amount:Math.round(amount*100)/100,updatedAt:new Date().toISOString()};
  save();window.bp50Close();
  const location=document.querySelector('.bp50-price-value[data-product-id="'+CSS.escape(id)+'"]');
  if(location){location.textContent=money(amount);location.classList.add('confirmed')}
  syncTotals();
  // Rerender while retaining current scroll position; avoid jumping.
  const y=window.scrollY;draw();window.scrollTo({top:y,behavior:'instant'});
 });
 input.focus();input.select();
};
const oldToggle=bp35ToggleBought;
bp35ToggleBought=function(itemId,checked,input){
 oldToggle(itemId,checked,input);syncTotals();
 // Ask for the real receipt price when marking purchased.
 if(checked&&!hasPaid(key(),itemId))window.bp50EditPrice(itemId);
};
const oldClear=bp35Clear;
bp35Clear=function(){
 const k=key(),old=JSON.stringify(bp35.plans[k]||{});
 oldClear();
 // Clearing the current week's menu also clears that week's prices, but
 // does not affect other stores/weeks. Detect if user actually confirmed.
 const latest=JSON.stringify(bp35.plans[k]||{});
 if(old!==latest && !Object.values(bp35.bought[k]||{}).some(Boolean)){
  delete paid[k];save();
 }
};
const previousRows=bp35BasketRows;
bp35BasketRows=function(calculation){
 const data=rows().all;
 const make=item=>{
  const bought=bp35Marked(item.id),a=recentPrice(item.id,item);
  const photo=window.bpFoodProductPhoto?.(item.name);
  const visual=photo?'<img class="bp50-product-image" loading="lazy" src="'+esc(photo.src)+'" alt="Fotografie reprezentativă: '+esc(item.name)+'" onerror="this.style.display=\'none\'"/>':
   '<span class="bp50-product-placeholder" aria-hidden="true">🛒</span>';
  const label='<label class="bp50-check-label"><input type="checkbox" '+(bought?'checked':'')+
   ' onchange="bp35ToggleBought('+JSON.stringify(item.id).replace(/"/g,'&quot;')+',this.checked,this)" aria-label="Cumpărat '+esc(item.name)+'"/></label>';
  const estimate=item.missing?'Preț necunoscut':'≈ '+money(item.approx);
  const paidText=bought?(a.confirmed?money(a.value):'De confirmat'):'—';
  return '<article class="bp50-product bp35-product '+(bought?'bought':'')+'">'+
   label+'<div class="bp50-product-photo">'+visual+'</div>'+
   '<div class="bp50-product-details"><b>'+esc(item.name)+'</b><small>'+esc(item.amount)+'</small>'+
   '<small>'+esc(bp35.store)+'</small></div>'+
   '<div class="bp50-product-money"><span>Estimat<br/><b>'+esc(estimate)+'</b></span>'+
   '<span>Plătit<br/><strong data-product-id="'+esc(item.id)+'" class="bp50-price-value '+(a.confirmed?'confirmed':'')+'">'+
   esc(paidText)+'</strong></span></div>'+
   '<div class="bp50-product-controls">'+
   '<button type="button" class="bp50-edit-button" onclick="bp50EditPrice('+JSON.stringify(item.id).replace(/"/g,'&quot;')+
   ')" aria-label="Editează prețul plătit pentru '+esc(item.name)+'" title="Preț final">✎</button>'+
   (!item.id.startsWith('p:')?'<button type="button" class="bp50-search-button" onclick="bpBrowseProducts('+
    JSON.stringify(item.reference.id).replace(/"/g,'&quot;')+')">Vezi produse în catalog</button>':'')+
   '</div></article>';
 };
 return data.map(make).join('');
};
const oldBasket=bpBasket;
bpBasket=function(){
 const html=oldBasket();
 const stat=summary(),both=weeklyBothStores();
 const panel='<section class="bp50-spend-panel"><div class="bp50-spend-head"><h2>Cheltuielile săptămânii</h2>'+
 '<span>✔ '+stat.count+'/'+stat.total+' produse</span></div>'+
 '<div class="bp50-spend-grid">'+
 '<div class="bp50-stat"><small>Total estimat</small><strong id="bp50-total-estimate">'+
 (stat.missing?'≈ '+money(stat.estimated)+'+':'≈ '+money(stat.estimated))+'</strong></div>'+
 '<div class="bp50-stat paid"><small>Total plătit confirmat</small><strong id="bp50-total-paid">'+money(stat.paid)+'</strong></div>'+
 '<div class="bp50-stat"><small>Diferență pe produse confirmate</small><strong id="bp50-total-difference">'+
 (stat.diff>0?'+':'')+money(stat.diff)+'</strong></div></div>'+
 '<div class="bp50-progress"><span id="bp50-bar" style="width:'+(stat.total?Math.round(stat.count/stat.total*100):0)+'%"></span></div>'+
 '<div class="bp50-progress-caption"><span id="bp50-progress">'+stat.count+' din '+stat.total+' cumpărate</span>'+
 '<span id="bp50-remaining">'+(stat.total-stat.count)+' rămase</span></div>'+
 '<p id="bp50-pending" class="bp50-price-caveat">'+(stat.unfinished?stat.unfinished+' produse bifate fără preț final confirmat':
 'Toate prețurile bifate sunt confirmate')+'</p>'+
 '<div class="bp50-both-stores"><span>Cheltuit săptămâna aceasta (Lidl + Kaufland)</span><strong id="bp50-week-paid">'+
 money(both.total)+'</strong><small id="bp50-week-count">'+both.items+' produse, ambele magazine</small></div>'+
 '</section>';
 // Keep the original locked/unlocked flow and render the panel before the list.
 const marker='<div class="bp35-summary">';
 const p=html.indexOf(marker);
 return p<0?html+panel:html.slice(0,p)+panel+html.slice(p);
};
window.bp50Stats=summary;
window.bp50WeekStats=weeklyBothStores;
})();
