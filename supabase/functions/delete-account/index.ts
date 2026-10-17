import { createClient } from "npm:@supabase/supabase-js@2";

// Deployed with verify_jwt=true. Clients must pass their own bearer token,
// type ȘTERGE, and confirm through a separate Android native alert.
const json=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{"content-type":"application/json; charset=utf-8",
    "cache-control":"no-store","x-content-type-options":"nosniff"}
});
Deno.serve(async request=>{
  if(request.method!=="POST")return json({error:"Method not allowed"},405);
  const auth=request.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))return json({error:"Authentication required"},401);
  let body:{confirmation?:string};
  try{body=await request.json();}catch{return json({error:"JSON required"},400);}
  if(body.confirmation!=="ȘTERGE")return json({error:"Confirmation required"},400);
  const url=Deno.env.get("SUPABASE_URL");
  const anon=Deno.env.get("SUPABASE_ANON_KEY");
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!secret)return json({error:"Server unavailable"},503);
  const identity=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:identError}=await identity.auth.getUser(auth.substring(7));
  if(identError||!user)return json({error:"Invalid or expired session"},401);
  const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
  const {error}=await admin.auth.admin.deleteUser(user.id);
  if(error){console.error("Account deletion failed");return json({error:"Account deletion failed"},500);}
  return json({ok:true,message:"Account and linked personal data were deleted"});
});
