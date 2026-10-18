/* BunPlan 5.0 - display locally bundled, properly attributed photos.
 * Photographs are representative for recipe families, not claimed to
 * depict an exact generated ingredient substitution.
 */
(function(){
'use strict';
const M=window.BunPlanPhotoMap||{recipes:{},ingredients:{}};
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('ro-RO');
const familyList=Object.keys(M.recipes||{});
const ingredientList=Object.keys(M.ingredients||{});
const aliases={
 'fulgi de ovaz':'ovaz','fulgi de ovaz macinati':'ovaz','morcov':'morcovi',
 'piper negru':'piper','ceapa rosie':'ceapa','mere':'mere','ou':'oua','oua fierte':'oua',
 'rosii pasate':'rosii_conserva','rosii tocate':'rosii','rosii cherry':'rosii',
 'piept de pui':'pui_piept','piept de curcan':'curcan','carne de vita':'vita',
 'peste alb':'peste_alb','cartofi fierti':'cartofi','dovlecei':'dovlecel',
 'pulpă de pui dezosată':'pui_pulpe','pulpe de pui dezosate':'pui_pulpe',
 'banane':'banane','lapte de cocos':'lapte','iaurt grecesc':'iaurt',
 'mozzarella':'mozzarella','seminte de chia':'seminte_chia',
 'orez fiert':'orez','faina':'faina','bulgur fiert':'orez',
 'migdale':'nuci','fasole alba fiarta':'fasole','fasole rosie fiarta':'fasole'
};
function photoForRecipe(recipe){
 if(!recipe)return null;
 if(recipe.id&&M.originals?.[recipe.id])return M.originals[recipe.id];
 const key=recipe.variant_of;
 if(key&&M.recipes?.[key])return M.recipes[key];
 const title=normalize(recipe.title),names=familyList.sort((a,b)=>b.length-a.length);
 let m=names.find(n=>title.startsWith(normalize(n)));
 if(!m){
  if(/pasta|paste|spaghett/.test(title))m='Paste';
  else if(/supa crema/.test(title))m='Supă cremă';
  else if(/supa de linte/.test(title))m='Supă de linte';
  else if(/ciorba/.test(title))m='Ciorbă de legume';
  else if(/tocan|tocanita/.test(title))m='Tocană vegetariană';
  else if(/salat/.test(title))m='Salată consistentă';
  else if(/omlet/.test(title))m='Omletă pufoasă';
  else if(/pui/.test(title))m='Piept de pui la tigaie';
  else if(/terci/.test(title))m='Terci de ovăz cald';
 }
 if(M.recipes?.[m])return M.recipes[m];
 // Classic dishes often have an English/alternative title.
 // Fall back to an appropriate dish family, never to arbitrary stock photos.
 const c=normalize(recipe.category);
 const groups=[
  [/overnight|ovaz peste noapte/,'Ovăz peste noapte'],
  [/iaurt|yogurt/,'Budincă de chia'],
  [/omlet|oua|ou fiert|frittata/,'Omletă pufoasă'],
  [/sandvis|toast|bruschete/,'Toast integral'],
  [/clatite|pancak|biscuit/,'Clătite de ovăz'],
  [/mamali|polenta/,'Pilaf'],
  [/muscaca|lasagna/,'Gratin de legume'],
  [/ardei umplut/,'Ardei umpluți'],
  [/peste|somon|pastrav|sardine/,'File de pește la cuptor'],
  [/crevet/,'Creveți sotați'],
  [/risotto/,'Risotto'],
  [/pila[fv]|orez/,'Pilaf'],
  [/paste|spaghet|macaroan/,'Paste'],
  [/salata/,'Salată consistentă'],
  [/pui|ostropel|snitel/,'Piept de pui la tigaie'],
  [/porc|cotlet/,'Cotlet de porc la tigaie'],
  [/vita|chili|chiftel/,'Chifteluțe de vită la cuptor'],
  [/tocan|fasole/,'Tocană vegetariană'],
  [/briose|banana bread|chec/,'Brioșe fragede']
 ];
 for(const [rx,family] of groups){
  if(rx.test(title)&&M.recipes?.[family])return M.recipes[family];
 }
 const byCategory={
  'mic dejun':['Terci de ovăz cald','Clătite de ovăz','Omletă pufoasă'],
  'supe si ciorbe':['Ciorbă de legume','Supă cremă'],
  'pui si curcan':['Piept de pui la tigaie','Curry de pui'],
  'carne':['Tocăniță de vită','Cotlet de porc la tigaie'],
  'vegetarian':['Legume la cuptor','Salată consistentă'],
  'paste si orez':['Paste','Risotto'],
  'peste si fructe de mare':['File de pește la cuptor','Pește la tigaie'],
  'cina si salate':['Salată consistentă','Legume la cuptor'],
  'desert si gustari':['Brioșe fragede','Crumble la cuptor']
 };
 return (byCategory[c]||[]).map(k=>M.recipes?.[k]).find(Boolean)||null;
}
function photoForIngredient(name){
 const slug=normalize(name).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
 const mapped=aliases[normalize(name)]||slug;
 return M.ingredients?.[mapped]||null;
}
window.bpFoodProductPhoto=photoForIngredient;
window.bpFoodRecipePhoto=photoForRecipe;
function imageTag(photo,alt,cls){
 if(!photo)return '';
 return '<img class="'+cls+'" loading="lazy" decoding="async" src="'+esc(photo.src)+'" alt="'+esc(alt)+
  '" onerror="this.style.display=\'none\';this.parentElement?.classList.remove(\'has-photo\')"/>';
}
function paintGallery(){
 const cards=document.querySelectorAll('#bpCloudResults .bp-recipecard');
 for(const card of cards){
  if(card.dataset.bpPhoto)continue;
  const code=card.getAttribute('onclick')||'';
  const match=code.match(/(?:BP\d{4}|R\d{3})/);
  const r=match&&BP100.find(x=>x.id===match[0]);
  const photo=photoForRecipe(r);
  if(!photo)continue;
  const slot=card.querySelector('.bp-emoji');
  if(!slot)continue;
  card.dataset.bpPhoto='1';
  slot.classList.add('has-photo');
  slot.insertAdjacentHTML('afterbegin',imageTag(photo,'Fotografie reprezentativă pentru '+r.title,'bp50-recipe-photo'));
 }
}
function paintHome(){
 for(const feature of document.querySelectorAll('.bp-brand-feature')){
  if(feature.dataset.bpPhoto)continue;
  const match=(feature.querySelector('button')?.getAttribute('onclick')||'').match(/(?:BP\d{4}|R\d{3})/);
  const r=match&&BP100.find(x=>x.id===match[0]);
  const photo=photoForRecipe(r);
  const slot=feature.querySelector('.bp-brand-food');
  if(!photo||!slot)continue;
  feature.dataset.bpPhoto='1';
  slot.classList.add('has-photo');
  slot.insertAdjacentHTML('afterbegin',imageTag(photo,'Fotografie reprezentativă pentru '+r.title,'bp50-home-photo'));
 }
}
function paintDetail(){
 if(state.tab!=='detail100')return;
 const r=BP100.find(x=>x.id===bp100.detail);
 const photo=photoForRecipe(r);
 if(!photo||document.querySelector('#bp50-recipe-detail-photo'))return;
 const anchor=document.querySelector('.bp-heroicon')||document.querySelector('h1.title');
 if(!anchor)return;
 const caption=photo.source?'<figcaption>Imagine reprezentativă · '+
 '<a href="'+esc(photo.source)+'" target="_blank" rel="noopener noreferrer">'+
 esc(photo.author||'Wikimedia Commons')+'</a> · '+esc(photo.license||'licență liberă')+'</figcaption>':'';
 const figure='<figure class="bp50-recipe-detail-image" id="bp50-recipe-detail-photo">'+
 imageTag(photo,'Fotografie reprezentativă a unui preparat din familia '+(r.variant_of||r.title),'')+caption+'</figure>';
 anchor.insertAdjacentHTML('beforebegin',figure);
 if(anchor.classList.contains('bp-heroicon'))anchor.style.display='none';
}
function repaint(){
 if(state.tab==='library100')paintGallery();
 if(state.tab==='home')paintHome();
 if(state.tab==='detail100')paintDetail();
}
let waiting=false;
const observer=new MutationObserver(()=>{
 if(waiting)return;waiting=true;requestAnimationFrame(()=>{waiting=false;repaint()});
});
observer.observe(document.getElementById('app'),{childList:true,subtree:true});
repaint();
})();