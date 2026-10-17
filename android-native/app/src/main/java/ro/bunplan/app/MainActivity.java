package ro.bunplan.app;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd;
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import org.json.JSONObject;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final String TAG = "BunPlanAds";
    // GOOGLE official demo unit. Never use publisher production unit in debug/test builds.
    private static final String TEST_UNIT = "ca-app-pub-3940256099942544/5354046379";
    private static final Pattern PLAN_KEY = Pattern.compile("^(Lidl|Kaufland)\\|\\d{4}-\\d{2}-\\d{2}$");
    private WebView web;
    public void eval(String js){if(web!=null)web.evaluateJavascript(js,null);}
    private RewardedInterstitialAd rewardedAd;
    private ConsentInformation consent;
    private String pendingKey;
    private boolean loading = false;
    private boolean showing = false;
    private boolean adsInitialized = false;
    private String lastStatus = "Se inițializează AdMob";

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new JsBridge(), "BunPlanAds");
        web.addJavascriptInterface(new BunPlanAuth(this).bridge(),"BunPlanAuth");
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file:///android_asset/")) return false;
                if (url.startsWith("https://")) {
                    try {
                        startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse(url)));
                    } catch(Exception ignored) {}
                }
                return true;
            }
        });
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
        startConsent();
    }

    private void status(String message) {
        Log.i(TAG, message);
        lastStatus = message;
        invokeJs("bunPlanAdStatus", message);
    }
    private void invokeJs(String name,String value) {
        final String js = "if(typeof window."+name+"==='function')window."+name+"("+JSONObject.quote(value)+");";
        runOnUiThread(()->{ if(web != null) web.evaluateJavascript(js,null); });
    }
    private void fail(String message) {
        pendingKey=null;
        status(message);
        invokeJs("bunPlanOnAdError", message);
    }
    private void startConsent() {
        consent = UserMessagingPlatform.getConsentInformation(this);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        consent.requestConsentInfoUpdate(this, params,
            () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(this, formError -> {
                if (formError != null) status("Consimțământ: "+formError.getMessage());
                if(consent.canRequestAds()) initializeAds();
                else status("Reclamele nu sunt disponibile până la rezolvarea consimțământului");
            }),
            requestError -> {
                status("Verificare consimțământ: "+requestError.getMessage());
                if(consent.canRequestAds()) initializeAds();
            });
        if(consent.canRequestAds()) initializeAds();
    }
    private void initializeAds() {
        if(adsInitialized) return;
        adsInitialized=true;
        status("Se încarcă reclama Google de test");
        MobileAds.initialize(this, state -> loadAd());
    }
    private void loadAd() {
        if(loading || showing || rewardedAd!=null || !adsInitialized) return;
        loading=true;
        RewardedInterstitialAd.load(this, TEST_UNIT, new AdRequest.Builder().build(),
            new RewardedInterstitialAdLoadCallback() {
                @Override public void onAdLoaded(@NonNull RewardedInterstitialAd ad) {
                    rewardedAd=ad;
                    loading=false;
                    status("Reclama Google de test este pregătită");
                    if(pendingKey!=null) displayRewarded(pendingKey);
                }
                @Override public void onAdFailedToLoad(@NonNull LoadAdError error) {
                    rewardedAd=null;
                    loading=false;
                    fail("AdMob: "+error.getCode()+" / "+error.getDomain()+" — "+error.getMessage());
                }
            });
    }
    private void requestAd(String key) {
        if(showing){invokeJs("bunPlanOnAdError","O reclamă este deja deschisă");return;}
        if(!PLAN_KEY.matcher(key).matches()) {
            fail("Cheie plan invalidă (format magazin|YYYY-MM-DD)");
            return;
        }
        pendingKey=key;
        if(consent==null || !consent.canRequestAds()) {
            fail("AdMob: se așteaptă verificarea consimțământului");
            return;
        }
        if(rewardedAd!=null) displayRewarded(key);
        else {
            status("Pregătesc reclama. Va porni automat când se încarcă.");
            loadAd();
        }
    }
    private void displayRewarded(String key) {
        if(rewardedAd==null || showing) return;
        final RewardedInterstitialAd ad=rewardedAd;
        rewardedAd=null;
        pendingKey=null;
        showing=true;
        status("Reclama de test este afișată");
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdShowedFullScreenContent() {
                status("Reclamă afișată");
            }
            @Override public void onAdDismissedFullScreenContent() {
                showing=false;
                status("Reclamă închisă");
                loadAd();
            }
            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                showing=false;
                fail("AdMob nu a putut afișa reclama: "+error.getMessage());
                loadAd();
            }
        });
        ad.show(this, reward -> {
            status("Recompensa Google a fost acordată");
            invokeJs("bunPlanOnAdEarned",key);
        });
    }
    public class JsBridge {
        @JavascriptInterface public void showRewardedInterstitial(String key) {
            runOnUiThread(()->requestAd(key));
        }
        @JavascriptInterface public void getStatus() {
            runOnUiThread(()->status(lastStatus));
        }
    }
    @Override protected void onDestroy() {
        if(web!=null){web.destroy();web=null;}
        super.onDestroy();
    }
}
