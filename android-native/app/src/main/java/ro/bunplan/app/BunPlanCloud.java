package ro.bunplan.app;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
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
 private final SharedPreferences prefs;
 private final ExecutorService pool=Executors.newSingleThreadExecutor();
 public BunPlanCloud(Activity activity){
  this.activity=activity;this.prefs=activity.getSharedPreferences("bunplan_auth",Context.MODE_PRIVATE);
 }
 private String http(String url,JSONObject payload,String token) throws Exception{
  HttpURLConnection con=(HttpURLConnection)new URL(BASE+url).openConnection();
  con.setRequestMethod("POST");con.setConnectTimeout(15000);con.setReadTimeout(20000);
  con.setDoOutput(true);con.setRequestProperty("Content-Type","application/json");
  con.setRequestProperty("apikey",APIKEY);con.setRequestProperty("Authorization","Bearer "+token);
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
      String token=prefs.getString("access_token","");
      if(token.isEmpty())throw new Exception("Autentifică-te din nou");
      JSONObject req=new JSONObject().put("p_store",store.toLowerCase()).put("p_week_start",week);
      if(action.equals("save")){
        req.put("p_budget",budget).put("p_days",new org.json.JSONArray(days));
      }
      String endpoint=action.equals("save")?"save_bunplan_week":"load_bunplan_week";
      String body;
      try{body=http("/rest/v1/rpc/"+endpoint,req,token);}
      catch(Exception e){
        if(!e.getMessage().contains("401")&&!e.getMessage().toLowerCase().contains("jwt"))throw e;
        String refresh=prefs.getString("refresh_token","");
        if(refresh.isEmpty())throw new Exception("Sesiunea a expirat, autentifică-te din nou");
        JSONObject refreshed=new JSONObject(http("/auth/v1/token?grant_type=refresh_token",
          new JSONObject().put("refresh_token",refresh),APIKEY));
        token=refreshed.getString("access_token");
        prefs.edit().putString("access_token",token)
          .putString("refresh_token",refreshed.optString("refresh_token",refresh)).apply();
        body=http("/rest/v1/rpc/"+endpoint,req,token);
      }
      response.put("ok",true).put("data",new JSONObject(body));
    }catch(Exception ex){try{response.put("ok",false).put("message",ex.getMessage());}catch(Exception ignored){}}
    callback(action,response);
  });
 }
 public class Bridge {
  @JavascriptInterface public void saveWeek(String store,String week,double budget,String days){call("save",store,week,budget,days);}
  @JavascriptInterface public void loadWeek(String store,String week){call("load",store,week,0,"[]");}
 }
 public Bridge bridge(){return new Bridge();}
}
