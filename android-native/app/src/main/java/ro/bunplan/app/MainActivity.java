package ro.bunplan.app;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

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
    private android.widget.FrameLayout rootView;
    private com.google.android.gms.ads.AdView cookingBanner;
    private static final String TEST_BANNER_UNIT = "ca-app-pub-3940256099942544/6300978111";
    private BunPlanGoogleBrowser googleBrowser;
    public void startGoogleBrowser(){
        runOnUiThread(() -> {
            if (googleBrowser != null) googleBrowser.start();
            else authError("Conectarea Google se inițializează. Încearcă din nou.");
        });
    }
    public void authError(String message){eval("if(window.BunPlanAuthDone)window.BunPlanAuthDone(\'google\',"+new JSONObject(java.util.Collections.singletonMap("message",message)).toString().replace("{","{\"ok\":false,") + ");");}
    public void eval(String js){if(web!=null)web.evaluateJavascript(js,null);}
    private RewardedInterstitialAd rewardedAd;
    private ConsentInformation consent;
    private String pendingKey;
    private boolean loading = false;
    private boolean showing = false;
    private boolean adsInitialized = false;
    private boolean consentStarted = false;
    private String lastStatus = "Se inițializează AdMob";

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        // Android 15+ draws edge-to-edge. Apply the system-bar / cutout safe area
        // to the entire WebView so EVERY BunPlan screen stays below the clock
        // and battery indicators, rather than adding a fragile fixed CSS offset.
        // Apply system-bar insets to an OUTER container, not to WebView itself:
        // WebView may override its padding during layout/resize, which causes
        // the logo to overlap the clock on Android 15/16 edge-to-edge devices.
        android.widget.FrameLayout root = new android.widget.FrameLayout(this);
        rootView=root;
        root.setBackgroundColor(android.graphics.Color.rgb(247, 248, 239));
        root.setFitsSystemWindows(false);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(
                    WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars()
                        | WindowInsets.Type.displayCutout());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(),
                    insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(),
                    insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        root.addView(web, new android.widget.FrameLayout.LayoutParams(
            android.view.ViewGroup.LayoutParams.MATCH_PARENT,
            android.view.ViewGroup.LayoutParams.MATCH_PARENT));
        // Load ONLY trusted, locally-bundled UI from a distinct HTTPS origin.
        // Never allow remote pages to obtain the JavaScript authentication interfaces.
        final String localOrigin="https://appassets.androidplatform.net";
        final WebViewAssetLoader loader=new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        WebSettings s=web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O)s.setSafeBrowsingEnabled(true);
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)!=0);

        BunPlanAuth auth=new BunPlanAuth(this);
        web.addJavascriptInterface(new JsBridge(),"BunPlanAds");
        web.addJavascriptInterface(auth.bridge(),"BunPlanAuth");
        web.addJavascriptInterface(new BunPlanCloud(this).bridge(),"BunPlanCloud");
        web.addJavascriptInterface(new BunPlanGoogle(this,auth).bridge(),"BunPlanGoogle");
        googleBrowser=new BunPlanGoogleBrowser(this,auth);
        web.addJavascriptInterface(googleBrowser.bridge(),"BunPlanGoogleBrowser");
        web.setWebViewClient(new WebViewClientCompat(){
            @Override public void onPageFinished(WebView view,String url){
                super.onPageFinished(view,url);
                if(!consentStarted && url!=null && url.startsWith("https://appassets.androidplatform.net/assets/main.html")){
                    consentStarted=true;
                    startConsent();
                }
            }

            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r){
                if(isBundledAsset(r.getUrl()))return loader.shouldInterceptRequest(r.getUrl());
                return super.shouldInterceptRequest(v,r);
            }
            private boolean isBundledAsset(Uri u){
                return "https".equals(u.getScheme())
                    && "appassets.androidplatform.net".equals(u.getHost())
                    && u.getPath()!=null && u.getPath().startsWith("/assets/");
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                Uri url=request.getUrl();
                if(isBundledAsset(url))return false;
                if(request.isForMainFrame() && "https".equals(url.getScheme())){
                    try{startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,url));}
                    catch(Exception ignored){}
                }
                return true;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,String url){
                Uri uri=Uri.parse(url);
                if(isBundledAsset(uri))return false;
                if("https".equals(uri.getScheme())){
                    try{startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,uri));}
                    catch(Exception ignored){}
                }
                return true;
            }
        });
        getWindow().setStatusBarColor(android.graphics.Color.rgb(247, 248, 239));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(255, 255, 255));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        setContentView(root);
        // Open the logged-in app directly whenever the Android Keystore still
        // contains a valid-looking persisted session. An onboarding/localStorage
        // flag must never force an existing user back to the login page.
        final boolean returningUser=auth.hasStoredSession();
        web.loadUrl(localOrigin+"/assets/"+(returningUser?"main.html":"index.html"));
        if(getIntent()!=null && getIntent().getData()!=null){
            web.postDelayed(()->{if(googleBrowser!=null)googleBrowser.handleIntent(getIntent());},350);
        }
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
    private void showCookingBanner(double y){
        if(rootView==null || web==null || consent==null || !consent.canRequestAds())return;
        if(cookingBanner==null){
            cookingBanner=new com.google.android.gms.ads.AdView(this);
            cookingBanner.setAdSize(com.google.android.gms.ads.AdSize.BANNER);
            cookingBanner.setAdUnitId(TEST_BANNER_UNIT);
            android.widget.FrameLayout.LayoutParams p=new android.widget.FrameLayout.LayoutParams(
                android.view.ViewGroup.LayoutParams.WRAP_CONTENT,
                android.view.ViewGroup.LayoutParams.WRAP_CONTENT,
                android.view.Gravity.TOP|android.view.Gravity.CENTER_HORIZONTAL);
            rootView.addView(cookingBanner,p);
            cookingBanner.loadAd(new AdRequest.Builder().build());
        }
        android.widget.FrameLayout.LayoutParams p=(android.widget.FrameLayout.LayoutParams)cookingBanner.getLayoutParams();
        p.topMargin=Math.max(0,(int)(y*getResources().getDisplayMetrics().density)+rootView.getPaddingTop());
        cookingBanner.setLayoutParams(p);
        cookingBanner.setVisibility(y>=0&&y<web.getHeight()/getResources().getDisplayMetrics().density?View.VISIBLE:View.GONE);
    }
    public class JsBridge { 
        @JavascriptInterface public void showCookingBanner(double y){runOnUiThread(()->showCookingBanner(y));}
        @JavascriptInterface public void hideCookingBanner(){runOnUiThread(()->{if(cookingBanner!=null)cookingBanner.setVisibility(View.GONE);});}
        @JavascriptInterface public void showRewardedInterstitial(String key) {
            runOnUiThread(()->requestAd(key));
        }
        @JavascriptInterface public void getStatus() {
            runOnUiThread(()->status(lastStatus));
        }
    }
    @Override protected void onNewIntent(android.content.Intent intent){
        super.onNewIntent(intent);
        setIntent(intent);
        if(googleBrowser!=null)googleBrowser.handleIntent(intent);
    }
    @Override protected void onDestroy() {
        if(cookingBanner!=null){cookingBanner.destroy();cookingBanner=null;}
        if(web!=null){web.destroy();web=null;}
        super.onDestroy();
    }
}
