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
 return M.recipes?.[m]||null;
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