// Compatibility endpoint. Supabase Edge Functions cannot serve HTML pages:
// the gateway rewrites text/html to text/plain. Host the real UI on GitHub Pages.
const DESTINATION='https://birisiu.github.io/BunPlan/';
Deno.serve(async (request:Request)=>{
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 try{
  const probe=await fetch(DESTINATION,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(4000)});
  if(probe.ok)return Response.redirect(DESTINATION,302);
 }catch(_error){/* Site awaiting Pages activation; show a useful status. */}
 const message='BunPlan CRM este pregătit, dar găzduirea web trebuie activată o singură dată.\n\n'+
 'Deschide https://github.com/birisiu/BunPlan/settings/pages\n'+
 'Source: Deploy from a branch\n'+
 'Branch: crm-live\n'+
 'Folder: /docs\n'+
 'Apasă Save.\n\nDupă activare: '+DESTINATION+'\n';
 return new Response(request.method==='HEAD'?null:message,{status:503,headers:{
  'Content-Type':'text/plain; charset=utf-8',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff'
 }});
});