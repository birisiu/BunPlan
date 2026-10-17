package ro.bunplan.app;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.util.Log;
import androidx.annotation.NonNull;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd;
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback;
import org.json.JSONObject;

public class MainActivity extends Activity {
  // Google TEST rewarded interstitial, never production IDs.
  private static final String TEST_UNIT = "ca-app-pub-3940256099942544/5354046379";
  private WebView web;
  private RewardedInterstitialAd ad;
  private boolean loading=false,showing=false;
  @Override public void onCreate(Bundle b){
    super.onCreate(b);
    web=new WebView(this);
    WebSettings settings=web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    web.addJavascriptInterface(new JsBridge(),"BunPlanAds");
    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView view,String url){
        if(url.startsWith("file:///android_asset/"))return false;
        if(url.startsWith("https://")){
          try{startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse(url)));}catch(Exception ignored){}
          return true;
        }
        return true;
      }
    });
    setContentView(web);
    web.loadUrl("file:///android_asset/index.html");
    MobileAds.initialize(this,status -> loadAd());
  }
  private void emit(String name,String value){
    String js="window."+name+"("+JSONObject.quote(value)+")";
    runOnUiThread(()->{if(web!=null)web.evaluateJavascript(js,null);});
  }
  private void loadAd(){
    if(loading||ad!=null)return;
    loading=true;
    RewardedInterstitialAd.load(this,TEST_UNIT,new AdRequest.Builder().build(),new RewardedInterstitialAdLoadCallback(){
      @Override public void onAdLoaded(@NonNull RewardedInterstitialAd loaded){ad=loaded;loading=false;}
      @Override public void onAdFailedToLoad(@NonNull LoadAdError error){ad=null;loading=false;Log.w("BunPlanAds",error.getMessage());}
    });
  }
  public class JsBridge{
    @JavascriptInterface public void showRewardedInterstitial(String planKey){
      if(planKey==null||!planKey.matches("^(Lidl|Kaufland)\\\\|[0-9]{4}-[0-9]{2}-[0-9]{2}$")){
        emit("bunPlanOnAdError","Cheie de listă invalidă");return;
      }
      runOnUiThread(()->showRewarded(planKey));
    }
  }
  private void showRewarded(String planKey){
    if(showing)return;
    if(ad==null){loadAd();emit("bunPlanOnAdError","Reclama se încarcă. Așteaptă câteva secunde și încearcă din nou.");return;}
    final RewardedInterstitialAd current=ad;ad=null;showing=true;
    current.setFullScreenContentCallback(new FullScreenContentCallback(){
      @Override public void onAdDismissedFullScreenContent(){showing=false;loadAd();}
      @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError error){showing=false;emit("bunPlanOnAdError",error.getMessage());loadAd();}
    });
    current.show(this,reward -> emit("bunPlanOnAdEarned",planKey));
  }
  @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
  @Override protected void onDestroy(){if(web!=null){web.destroy();web=null;}super.onDestroy();}
}
