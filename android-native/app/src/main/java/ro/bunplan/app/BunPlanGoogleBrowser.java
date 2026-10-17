package ro.bunplan.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import androidx.browser.customtabs.CustomTabsIntent;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

/** Browser-based Google login with PKCE; works without Credential Manager or Play Services.
 * Supabase Dashboard > Auth > URL configuration must allow bunplan://oauth-callback.
 */
public final class BunPlanGoogleBrowser {
 private static final String REDIRECT="bunplan://oauth-callback";
 private static final String OAUTH="https://aedyviqoelgbbrrtwayu.supabase.co/auth/v1/authorize";
 private static final String STATE_KEY="pkce_verifier";
 private static final String AGE_KEY="started";
 private final MainActivity activity;
 private final BunPlanAuth auth;
 private final SharedPreferences prefs;
 public BunPlanGoogleBrowser(MainActivity activity,BunPlanAuth auth){
  this.activity=activity;this.auth=auth;
  prefs=activity.getSharedPreferences("bunplan_oauth_pending",Context.MODE_PRIVATE);
 }
 private String randomVerifier(){
  byte[] bytes=new byte[48];
  new SecureRandom().nextBytes(bytes);
  return Base64.encodeToString(bytes,Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING);
 }
 private String challenge(String verifier) throws Exception{
  byte[] digest=MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
  return Base64.encodeToString(digest,Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING);
 }
 public void start(){
  try{
   String verifier=randomVerifier();
   String codeChallenge=challenge(verifier);
   prefs.edit().putString(STATE_KEY,verifier).putLong(AGE_KEY,System.currentTimeMillis()).commit();
   Uri uri=Uri.parse(OAUTH).buildUpon()
     .appendQueryParameter("provider","google")
     .appendQueryParameter("redirect_to",REDIRECT)
     .appendQueryParameter("code_challenge",codeChallenge)
     .appendQueryParameter("code_challenge_method","s256")
     .build();
   new CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(activity,uri);
  }catch(Exception error){
   prefs.edit().clear().apply();
   activity.authError("Conectarea Google prin browser nu poate porni: "+error.getClass().getSimpleName());
  }
 }
 /** Uses only the custom scheme + exact host, and requires the locally-stored PKCE verifier. */
 public boolean handleIntent(Intent intent){
  Uri uri=intent==null?null:intent.getData();
  if(uri==null||!"bunplan".equals(uri.getScheme())||!"oauth-callback".equals(uri.getHost())||uri.getPort()!=-1)
   return false;
  String verifier=prefs.getString(STATE_KEY,"");
  long started=prefs.getLong(AGE_KEY,0L);
  prefs.edit().clear().commit();
  if(verifier.length()<32||Math.abs(System.currentTimeMillis()-started)>10*60*1000L){
   activity.authError("Sesiunea Google a expirat. Încearcă din nou.");
   return true;
  }
  String error=uri.getQueryParameter("error_description");
  if(error!=null){activity.authError("Google: "+error);return true;}
  String code=uri.getQueryParameter("code");
  if(code==null||code.length()<5){
   activity.authError("Google nu a întors codul OAuth; verifică redirect-ul Supabase.");return true;
  }
  auth.exchangeGoogleOAuthCode(code,verifier);
  return true;
 }
 public class Bridge {
  @android.webkit.JavascriptInterface public void signIn(){
    activity.runOnUiThread(()->BunPlanGoogleBrowser.this.start());
  }
 }
 public Bridge bridge(){return new Bridge();}
}
