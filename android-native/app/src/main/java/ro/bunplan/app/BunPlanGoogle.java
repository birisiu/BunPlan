package ro.bunplan.app;

import android.app.Activity;
import android.util.Base64;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.concurrent.Executor;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.ConnectionResult;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.NoCredentialException;

import androidx.annotation.NonNull;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/** Native Credential Manager Google ID token; identity is verified by Supabase. */
public final class BunPlanGoogle {
    private final MainActivity activity;
    private final BunPlanAuth auth;
    private final CredentialManager manager;
    private boolean inProgress=false;
    public BunPlanGoogle(MainActivity a,BunPlanAuth auth){
        this.activity=a;this.auth=auth;this.manager=CredentialManager.create(a);
    }
    private void notifyError(String message) {
        String script="if(window.BunPlanAuthDone)window.BunPlanAuthDone('google',"+
            new JSONObjectSafe().json(message)+");";
        activity.eval(script);
    }
    /** Keeps error text escaped when passing it into a trusted bundled page. */
    private static class JSONObjectSafe {
        String json(String message) {
            try{return new JSONObject().put("ok",false).put("message",message).toString();}
            catch(Exception ignored){return "{\"ok\":false,\"message\":\"Nu s-a putut autentifica.\"}";}
        }
    }
    public void signIn(){
        if(inProgress)return;
        final String webClientId=activity.getString(R.string.google_web_client_id).trim();
        if(webClientId.isEmpty() || !webClientId.endsWith(".apps.googleusercontent.com")){
            notifyError("Conectarea Google este pregătită în cod, dar lipsește Client ID-ul OAuth din Google Cloud. Configurează-l înainte de test.");
            return;
        }
        int googlePlayStatus=GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(activity);
        if(googlePlayStatus!=ConnectionResult.SUCCESS){
            notifyError("Google Play Services indisponibil (cod "+googlePlayStatus+"): "+GoogleApiAvailability.getInstance().getErrorString(googlePlayStatus)+". Actualizează Google Play Services sau încearcă loginul prin browser.");
            return;
        }
        try {
            byte[] randomness=new byte[32];
            new SecureRandom().nextBytes(randomness);
            final String rawNonce=Base64.encodeToString(randomness,Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING);
            byte[] digest=MessageDigest.getInstance("SHA-256").digest(rawNonce.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex=new StringBuilder(64);
            for(byte b:digest)hex.append(String.format(java.util.Locale.US,"%02x",b&0xff));
            GetSignInWithGoogleOption option=new GetSignInWithGoogleOption.Builder(webClientId)
                .setNonce(hex.toString()).build();
            GetCredentialRequest request=new GetCredentialRequest.Builder()
                .addCredentialOption(option).build();
            inProgress=true;
            Executor main=command->activity.runOnUiThread(command);
            manager.getCredentialAsync(activity,request,null,main,
                new CredentialManagerCallback<GetCredentialResponse,GetCredentialException>(){
                    @Override public void onResult(GetCredentialResponse response){
                        inProgress=false;
                        Credential credential=response.getCredential();
                        if(!(credential instanceof CustomCredential)){
                            notifyError("Google nu a furnizat acreditările solicitate.");
                            return;
                        }
                        CustomCredential custom=(CustomCredential)credential;
                        if(!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(custom.getType())){
                            notifyError("Tip de cont Google neașteptat.");return;
                        }
                        try{
                            GoogleIdTokenCredential google=GoogleIdTokenCredential.createFrom(custom.getData());
                            auth.googleIdToken(google.getIdToken(),rawNonce);
                        }catch(Exception ex){notifyError("Răspunsul Google nu a putut fi validat.");}
                    }
                    @Override public void onError(@NonNull GetCredentialException error){
                        inProgress=false;
                        android.util.Log.e("BunPlanGoogle","Credential Manager: "+error.getType()+" / "+error.getMessage(),error);
                        String type=error.getType()==null?"necunoscut":error.getType();
                        if(error instanceof GetCredentialCancellationException)notifyError("Ai închis selecția contului Google.");
                        else if(error instanceof NoCredentialException)notifyError("Nu există o acreditare Google disponibilă (NoCredential). Verifică clientul OAuth Android/SHA-1 și contul Google selectat. Tip: "+type);
                        else notifyError("Google Credential Manager a eșuat: "+type+" — "+(error.getMessage()==null?"fără detalii":error.getMessage())+". Poți încerca autentificarea prin browser.");
                    }
                });
        }catch(Exception e){
            inProgress=false;
            android.util.Log.e("BunPlanGoogle","Google sign-in initialization",e);
            notifyError("Google Login: "+e.getClass().getSimpleName()+" — "+(e.getMessage()==null?"verifică Play Services":e.getMessage()));
        }
    }
    public class Bridge{
        @android.webkit.JavascriptInterface public void signIn(){
            activity.runOnUiThread(()->BunPlanGoogle.this.signIn());
        }
    }
    public Bridge bridge(){return new Bridge();}
}
