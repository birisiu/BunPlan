package ro.bunplan.app;

import android.app.Activity;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class BunPlanAuth {
    private static final String BASE="https://aedyviqoelgbbrrtwayu.supabase.co";
    // Publishable key only; never place a service role key in a distributed APK.
    private static final String APIKEY="sb_publishable_pLh8mKxNWKkq396TyM518A_N_q7fm0Z";
    private final Activity activity;
    private final SessionVault vault;
    private final ExecutorService pool=Executors.newSingleThreadExecutor();
    public BunPlanAuth(Activity a){activity=a;vault=new SessionVault(a);}

    private JSONObject post(String path,JSONObject payload,String bearer) throws Exception{
        HttpURLConnection con=(HttpURLConnection)new URL(BASE+path).openConnection();
        con.setConnectTimeout(12000);
        con.setReadTimeout(18000);
        con.setRequestMethod("POST");
        con.setRequestProperty("Content-Type","application/json");
        con.setRequestProperty("apikey",APIKEY);
        if(bearer!=null && !bearer.isEmpty())con.setRequestProperty("Authorization","Bearer "+bearer);
        con.setDoOutput(true);
        try(OutputStream out=con.getOutputStream()){
            out.write(payload.toString().getBytes(StandardCharsets.UTF_8));
        }
        int code=con.getResponseCode();
        InputStream stream=code<400?con.getInputStream():con.getErrorStream();
        String raw;
        try(InputStream input=stream;ByteArrayOutputStream output=new ByteArrayOutputStream()){
            byte[] buf=new byte[4096];int n;
            while((n=input.read(buf))!=-1)output.write(buf,0,n);
            raw=new String(output.toByteArray(),StandardCharsets.UTF_8);
        }finally{con.disconnect();}
        JSONObject result=new JSONObject(raw);
        if(code>=400)throw new Exception(result.optString("msg",result.optString("message",
            result.optString("error_description","Server HTTP "+code))));
        return result;
    }

    private void result(String action,JSONObject data){
        String script="if(window.BunPlanAuthDone)window.BunPlanAuthDone("
            +JSONObject.quote(action)+","+data+");";
        activity.runOnUiThread(()->{
            if(activity instanceof MainActivity)((MainActivity)activity).eval(script);
        });
    }
    private void storeSession(JSONObject auth,String email) throws Exception {
        JSONObject session=new JSONObject();
        session.put("access_token",auth.getString("access_token"));
        session.put("refresh_token",auth.getString("refresh_token"));
        JSONObject user=auth.optJSONObject("user");
        session.put("email",user!=null?user.optString("email",email):email);
        session.put("expires_at",System.currentTimeMillis()/1000L + Math.max(30,auth.optLong("expires_in",3600)));
        vault.save(session);
    }
    private void successLogin(String action, JSONObject tokenResponse,String email) throws Exception{
        if(tokenResponse.optString("access_token","").isEmpty()){
            if(!"signup".equals(action))throw new Exception("Nu a fost emisă o sesiune.");
            result(action,new JSONObject().put("ok",true).put("signed_in",false)
                 .put("message","Confirmă adresa prin e-mail, apoi conectează-te."));
            return;
        }
        storeSession(tokenResponse,email);
        result(action,new JSONObject().put("ok",true).put("signed_in",true));
    }
    private void perform(String kind,String email,String password,String displayName){
        pool.execute(()->{
            try{
                if(email==null||!email.matches("(?i)^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))
                    throw new Exception("Adresa de e-mail nu este validă.");
                if(password==null||password.length()<8)
                    throw new Exception("Parola trebuie să aibă minimum 8 caractere.");
                JSONObject body=new JSONObject().put("email",email.trim()).put("password",password);
                String endpoint="signup".equals(kind)?"/auth/v1/signup":"/auth/v1/token?grant_type=password";
                if("signup".equals(kind))
                    body.put("data",new JSONObject().put("display_name",
                         displayName==null?"":displayName.substring(0,Math.min(displayName.length(),80))));
                successLogin(kind,post(endpoint,body,null),email.trim());
            }catch(Exception ex){error(kind,ex);}
        });
    }
    private void error(String action,Exception ex){
        try{result(action,new JSONObject().put("ok",false)
            .put("message",ex.getMessage()==null?"Operația nu a reușit.":ex.getMessage()));}
        catch(Exception ignored){}
    }
    /** Credential Manager obtains the ID token. Supabase checks its signature, audience and nonce. */
    public void googleIdToken(String idToken,String rawNonce){
        pool.execute(()->{
            try{
                if(idToken==null||idToken.length()<100||rawNonce==null||rawNonce.length()<20)
                    throw new Exception("Google nu a furnizat un token valid.");
                JSONObject body=new JSONObject().put("provider","google")
                    .put("id_token",idToken).put("nonce",rawNonce);
                successLogin("google",post("/auth/v1/token?grant_type=id_token",body,null),"");
            }catch(Exception ex){error("google",ex);}
        });
    }
    public void exchangeGoogleOAuthCode(String code,String verifier){
        pool.execute(()->{
            try {
                if(code==null||code.length()<5||verifier==null||verifier.length()<32)
                    throw new Exception("Sesiunea de conectare Google a expirat. Încearcă din nou.");
                JSONObject body=new JSONObject().put("auth_code",code).put("code_verifier",verifier);
                successLogin("google",post("/auth/v1/token?grant_type=pkce",body,null),"");
            }catch(Exception ex){error("google",ex);}
        });
    }
    private void recover(String email){
        pool.execute(()->{
            try{
                if(email==null||!email.matches("(?i)^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))
                    throw new Exception("Introdu o adresă de e-mail validă.");
                post("/auth/v1/recover",new JSONObject().put("email",email.trim()),null);
                result("recover",new JSONObject().put("ok",true).put("message",
                    "Dacă există un cont pentru această adresă, vei primi instrucțiuni prin e-mail."));
            }catch(Exception ex){error("recover",ex);}
        });
    }
    public class Bridge {
        @JavascriptInterface public void login(String e,String p){perform("login",e,p,null);}
        @JavascriptInterface public void signup(String e,String p,String name){perform("signup",e,p,name);}
        @JavascriptInterface public void recover(String e){BunPlanAuth.this.recover(e);}
        @JavascriptInterface public boolean hasSession(){return !vault.token().isEmpty();}
        @JavascriptInterface public String currentEmail(){return vault.email();}
        @JavascriptInterface public void logout(){
            String token=vault.token();
            vault.clear();
            if(!token.isEmpty())pool.execute(()->{
                try{post("/auth/v1/logout",new JSONObject(),token);}catch(Exception ignored){}
            });
        }
    }
    public Bridge bridge(){return new Bridge();}
}
