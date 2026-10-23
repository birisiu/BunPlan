/* BunPlan 6.5: one delegated navigation path for every branded bottom tab.
 * Loaded LAST, after the tour/refresh draw wrappers. */
(function(){
 'use strict';
 const routes=new Set(['home','library100','basket100','savedCooking','profile']);
 function renderRoute(target){
   if(!routes.has(target))return;
   window.BunPlanAds?.hideCookingBanner?.();
   if(typeof go!=='function'||typeof draw!=='function')return;
   // Saved screens have a dedicated renderer. Other screens use the canonical
   // go() chain, preserving catalog, shopping and profile data.
   go(target);
   if(state.tab!==target){
     state.tab=target;
     state.detail=null;
     state.modal=null;
     storage();
     draw();
   }
 }
 document.addEventListener('click',event=>{
   const button=event.target.closest?.('nav.bottom button');
   if(!button)return;
   const target=button.dataset.bpNav ||
     (button.getAttribute('onclick')||'').match(/go\(['"]([^'"]+)['"]\)/)?.[1];
   if(!routes.has(target))return;
   event.preventDefault();
   event.stopImmediatePropagation();
   renderRoute(target);
 },true);
 window.bunplanNavigateTab=renderRoute;
})();
