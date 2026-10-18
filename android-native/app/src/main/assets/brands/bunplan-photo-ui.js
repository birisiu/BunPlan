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
// A photograph is shown only after an administrator explicitly confirms its
// suitability. Never guess a soup, meat, or dessert photo by category.
function photoForRecipe(recipe){
 if(!recipe||recipe.image_reviewed!==true||typeof recipe.photo_url!=='string')return null;
 if(!/^https:\/\//i.test(recipe.photo_url))return null;
 return {src:recipe.photo_url,license:recipe.photo_credit||'Fotografie aprobată de administrator',
         author:recipe.photo_credit||'',source:null};
}
const approvedIngredients=new Map();
function photoForIngredient(name){
 const n=normalize(name);
 const slug=n.replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
 const alias=aliases[n]||slug;
 return approvedIngredients.get(n)||approvedIngredients.get(alias)||null;
}
window.bpFoodProductPhoto=photoForIngredient;
window.bpFoodRecipePhoto=photoForRecipe;
window.bunplanRefreshIngredientPhotos=function(){
 return fetch('https://aedyviqoelgbbrrtwayu.supabase.co/rest/v1/ingredients?select=slug,name,image_url,image_reviewed&limit=500',
  {cache:'no-store',headers:{apikey:'sb_publishable_pLh8mKxNWKkq396TyM518A_N_q7fm0Z','Cache-Control':'no-cache'}})
  .then(async response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.json()})
  .then(rows=>{
    if(!Array.isArray(rows))throw Error('Date ingrediente invalide');
    approvedIngredients.clear();
    for(const row of rows){
      if(row.image_reviewed===true&&/^https:\/\//i.test(row.image_url||'')){
        const photo={src:row.image_url};
        approvedIngredients.set(normalize(row.name),photo);
        approvedIngredients.set(normalize(row.slug),photo);
      }
    }
    if(state.tab==='basket100')draw();
    return {ok:true,count:rows.length};
  })
  .catch(error=>({ok:false,message:error.message||'Indisponibil'}));
};
window.bunplanRefreshIngredientPhotos();
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