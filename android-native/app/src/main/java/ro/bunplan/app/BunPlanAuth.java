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
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class BunPlanAuth {
 private static final String BASE="https://aedyviqoelgbbrrtwayu.supabase.co";
 private static final String APIKEY="sb_publishable_pLh8mKxNWKkq396TyM518A_N_q7fm0Z";
 private final Activity activity;
 private final ExecutorService pool=Executors.newSingleThreadExecutor();
 private final SharedPreferences prefs;
 public BunPlanAuth(Activity a){activity=a;prefs=a.getSharedPreferences("bunplan_auth",Context.MODE_PRIVATE);}
 private String request(String path,JSONObject payload,String token) throws Exception{
  HttpURLConnection con=(HttpURLConnection)new URL(BASE+path).openConnection();
  con.setConnectTimeout(12000);con.setReadTimeout(18000);con.setRequestMethod("POST");
  con.setRequestProperty("apikey",APIKEY);
  con.setRequestProperty("Content-Type","application/json");
  if(token!=null)con.setRequestProperty("Authorization","Bearer "+token);
  con.setDoOutput(true);
  try(OutputStream out=con.getOutputStream()){out.write(payload.toString().getBytes(StandardCharsets.UTF_8));}
  int code=con.getResponseCode();
  InputStream stream=code<400?con.getInputStream():con.getErrorStream();
  String response;
  try(InputStream in=stream){response=new String(in.readAllBytes(),StandardCharsets.UTF_8);}
  con.disconnect();
  if(code>=400){
   JSONObject error;try{error=new JSONObject(response);}catch(Exception ex){throw new Exception("Server HTTP "+code);}
   throw new Exception(error.optString("msg",error.optString("message",error.optString("error_description","HTTP "+code))));
  }
  return response;
 }
 private void callback(String action,JSONObject result){
  String js="if(window.BunPlanAuthDone)window.BunPlanAuthDone("+JSONObject.quote(action)+","+result+");";
  activity.runOnUiThread(()->{if(activity instanceof MainActivity)((MainActivity)activity).eval(js);});
 }
 private void perform(String kind,String email,String password,String displayName){
  pool.execute(()->{
   JSONObject response=new JSONObject();
   try{
    if(email==null||!email.matches("(?i)^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))throw new Exception("Introdu o adresă de e-mail validă");
    if(password==null||password.length()<8)throw new Exception("Parola trebuie să aibă minimum 8 caractere");
    JSONObject body=new JSONObject().put("email",email.trim()).put("password",password);
    String path=kind.equals("signup")?"/auth/v1/signup":"/auth/v1/token?grant_type=password";
    if(kind.equals("signup"))body.put("data",new JSONObject().put("display_name",displayName==null?"":displayName));
    JSONObject auth=new JSONObject(request(path,body,null));
    String token=auth.optString("access_token","");
    if(!token.isEmpty()){
     prefs.edit().putString("access_token",token).putString("refresh_token",auth.optString("refresh_token","")).putString("email",email.trim()).apply();
     response.put("ok",true).put("signed_in",true).put("email",email.trim());
    }else if(kind.equals("signup")){
     response.put("ok",true).put("signed_in",false).put("message","Verifică e-mailul și confirmă contul, apoi conectează-te.");
    }else throw new Exception("Autentificarea a eșuat");
   }catch(Exception error){try{response.put("ok",false).put("message",error.getMessage());}catch(Exception ignored){}}
   callback(kind,response);
  });
 }
 public class Bridge{
  @JavascriptInterface public void login(String e,String p){perform("login",e,p,null);}
  @JavascriptInterface public void signup(String e,String p,String name){perform("signup",e,p,name);}
  @JavascriptInterface public boolean hasSession(){return !prefs.getString("access_token","").isEmpty();}
  @JavascriptInterface public String currentEmail(){return prefs.getString("email","");}
  @JavascriptInterface public void logout(){prefs.edit().clear().apply();}
 }
 public Bridge bridge(){return new Bridge();}
}
