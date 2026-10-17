package ro.bunplan.app;
import android.app.Activity;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class BunPlanCloud {
 private static final String BASE="https://aedyviqoelgbbrrtwayu.supabase.co";
 private static final String APIKEY="sb_publishable_pLh8mKxNWKkq396TyM518A_N_q7fm0Z";
 private final Activity activity;
 private final SessionVault vault;
 private final ExecutorService pool=Executors.newSingleThreadExecutor();
 public BunPlanCloud(Activity activity){
  this.activity=activity;this.vault=new SessionVault(activity);
 }
 private String http(String url,JSONObject payload,String token) throws Exception{
  HttpURLConnection con=(HttpURLConnection)new URL(BASE+url).openConnection();
  con.setRequestMethod("POST");con.setConnectTimeout(15000);con.setReadTimeout(20000);
  con.setDoOutput(true);con.setRequestProperty("Content-Type","application/json");
  con.setRequestProperty("apikey",APIKEY);if(!APIKEY.equals(token))con.setRequestProperty("Authorization","Bearer "+token);
  try(OutputStream o=con.getOutputStream()){o.write(payload.toString().getBytes(StandardCharsets.UTF_8));}
  int status=con.getResponseCode();
  String s;
  try(InputStream input=status<400?con.getInputStream():con.getErrorStream();
      ByteArrayOutputStream out=new ByteArrayOutputStream()){
    byte[] b=new byte[4096];int n;while((n=input.read(b))!=-1)out.write(b,0,n);
    s=new String(out.toByteArray(),StandardCharsets.UTF_8);
  }finally{con.disconnect();}
  if(status>=400){
    String message="HTTP "+status;
    try{JSONObject e=new JSONObject(s);message=e.optString("message",e.optString("msg",message));}catch(Exception ignored){}
    throw new Exception(message);
  }
  return s;
 }
 private void callback(String action,JSONObject payload){
  final String js="if(window.BunPlanCloudDone)window.BunPlanCloudDone("+JSONObject.quote(action)+","+payload+");";
  activity.runOnUiThread(()->{if(activity instanceof MainActivity)((MainActivity)activity).eval(js);});
 }
 private void call(String action,String store,String week,double budget,String days){
  pool.execute(()->{
    JSONObject response=new JSONObject();
    try{
      if(!("Lidl".equals(store)||"Kaufland".equals(store))||week==null||!week.matches("\\d{4}-\\d{2}-\\d{2}"))
        throw new Exception("Magazin sau săptămână invalidă");
      String token=freshSessionToken();
      JSONObject req=new JSONObject().put("p_store",store.toLowerCase()).put("p_week_start",week);
      if(action.equals("save")){
        req.put("p_budget",budget).put("p_days",new org.json.JSONArray(days));
      }
      String endpoint=action.equals("save")?"save_bunplan_week":"load_bunplan_week";
      String body;
      try{body=http("/rest/v1/rpc/"+endpoint,req,token);}
      catch(Exception e){
        if(!e.getMessage().contains("401")&&!e.getMessage().toLowerCase().contains("jwt"))throw e;
        String refresh=vault.refresh();
        if(refresh.isEmpty())throw new Exception("Sesiunea a expirat, autentifică-te din nou");
        JSONObject refreshed=new JSONObject(http("/auth/v1/token?grant_type=refresh_token",
          new JSONObject().put("refresh_token",refresh),APIKEY));
        token=refreshed.getString("access_token");
        JSONObject encrypted=vault.read();
        if(encrypted==null)throw new Exception("Sesiunea nu mai este disponibilă");
        encrypted.put("access_token",token);
        encrypted.put("refresh_token",refreshed.optString("refresh_token",refresh));
        encrypted.put("expires_at",System.currentTimeMillis()/1000L+Math.max(30,refreshed.optLong("expires_in",3600)));
        vault.save(encrypted);
        body=http("/rest/v1/rpc/"+endpoint,req,token);
      }
      response.put("ok",true).put("data",new JSONObject(body));
    }catch(Exception ex){try{response.put("ok",false).put("message",ex.getMessage());}catch(Exception ignored){}}
    callback(action,response);
  });
 }
 private void permanentlyDeleteAccount(){
  pool.execute(()->{
    JSONObject result=new JSONObject();
    try{
      String token=vault.token();
      if(token.isEmpty())throw new Exception("Sesiunea a expirat. Autentifică-te din nou.");
      JSONObject body=new JSONObject(http("/functions/v1/delete-account",
          new JSONObject().put("confirmation","ȘTERGE"),token));
      if(!body.optBoolean("ok"))throw new Exception("Serverul nu a confirmat ștergerea.");
      vault.clear();
      result.put("ok",true).put("message","Contul și datele au fost șterse.");
    }catch(Exception ex){
      try{result.put("ok",false).put("message",ex.getMessage());}catch(Exception ignored){}
    }
    callback("delete",result);
  });
 }
 private String freshSessionToken() throws Exception{
   JSONObject stored=vault.read();
   if(stored==null)throw new Exception("Autentifică-te pentru a continua");
   String token=stored.optString("access_token","");
   if(token.isEmpty())throw new Exception("Sesiunea a expirat");
   long expires=stored.optLong("expires_at",0L);
   if(expires>0 && expires-System.currentTimeMillis()/1000L<90){
     String refresh=stored.optString("refresh_token","");
     if(refresh.isEmpty())throw new Exception("Sesiunea a expirat. Conectează-te din nou.");
     JSONObject updated=new JSONObject(http("/auth/v1/token?grant_type=refresh_token",
       new JSONObject().put("refresh_token",refresh),APIKEY));
     token=updated.getString("access_token");
     stored.put("access_token",token);
     stored.put("refresh_token",updated.optString("refresh_token",refresh));
     stored.put("expires_at",System.currentTimeMillis()/1000L+Math.max(30,updated.optLong("expires_in",3600)));
     vault.save(stored);
   }
   return token;
 }
 private void profileRequest(String action,String json){
  pool.execute(()->{
    JSONObject result=new JSONObject();
    try {
      String token=freshSessionToken();
      String method=action.equals("profile-save")?"save_bunplan_profile":"load_bunplan_profile";
      JSONObject request=action.equals("profile-save")
          ?new JSONObject().put("p_preferences",new JSONObject(json))
          :new JSONObject();
      String data=http("/rest/v1/rpc/"+method,request,token);
      result.put("ok",true).put("data",new JSONObject(data));
    }catch(Exception error){
      try{result.put("ok",false).put("message",error.getMessage());}catch(Exception ignored){}
    }
    callback(action,result);
  });
 }
 public class Bridge {
  @JavascriptInterface public void saveWeek(String store,String week,double budget,String days){call("save",store,week,budget,days);}
  @JavascriptInterface public void loadWeek(String store,String week){call("load",store,week,0,"[]");}
  @JavascriptInterface public void saveProfile(String json){profileRequest("profile-save",json);}
  @JavascriptInterface public void loadProfile(){profileRequest("profile-load","{}");}
  @JavascriptInterface public void deleteAccount(String typed){
   activity.runOnUiThread(()->{
     if(!"ȘTERGE".equals(typed)){
       callback("delete",new org.json.JSONObject(java.util.Collections.singletonMap("message","Scrie ȘTERGE pentru confirmare.")));
       return;
     }
     new android.app.AlertDialog.Builder(activity)
       .setTitle("Ștergere definitivă cont")
       .setMessage("Contul BunPlan, meniurile și datele asociate vor fi eliminate. Operația nu poate fi anulată.")
       .setNegativeButton("Renunță",(dialog,which)->dialog.dismiss())
       .setPositiveButton("Șterge definitiv",(dialog,which)->permanentlyDeleteAccount())
       .show();
   });
  }
 }
 public Bridge bridge(){return new Bridge();}
}
