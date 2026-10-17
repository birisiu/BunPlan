package ro.bunplan.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Encrypts mobile auth tokens with a non-exportable Android Keystore AES key. */
public final class SessionVault {
    private static final String ALIAS="bunplan-session-aes-v1";
    private static final String PREFS="bunplan_encrypted_session";
    private static final String FIELD="session";
    private final SharedPreferences preferences;
    public SessionVault(Context context){
        preferences=context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
    private SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        SecretKey existing=(SecretKey)store.getKey(ALIAS,null);
        if(existing!=null)return existing;
        KeyGenerator g=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(ALIAS,
            KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true).build());
        return g.generateKey();
    }
    public synchronized void save(JSONObject session) throws Exception {
        if(session==null || session.optString("access_token","").isEmpty()
           || session.optString("refresh_token","").isEmpty())
            throw new IllegalArgumentException("Incomplete session");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE,key());
        byte[] iv=cipher.getIV();
        byte[] ciphertext=cipher.doFinal(session.toString().getBytes(StandardCharsets.UTF_8));
        JSONObject envelope=new JSONObject();
        envelope.put("iv",Base64.encodeToString(iv,Base64.NO_WRAP));
        envelope.put("data",Base64.encodeToString(ciphertext,Base64.NO_WRAP));
        preferences.edit().putString(FIELD,envelope.toString()).commit();
    }
    public synchronized JSONObject read(){
        String raw=preferences.getString(FIELD,null);
        if(raw==null)return null;
        try{
            JSONObject env=new JSONObject(raw);
            byte[] iv=Base64.decode(env.getString("iv"),Base64.NO_WRAP);
            byte[] encrypted=Base64.decode(env.getString("data"),Base64.NO_WRAP);
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,iv));
            return new JSONObject(new String(cipher.doFinal(encrypted),StandardCharsets.UTF_8));
        }catch(Exception invalid){
            clear();return null;
        }
    }
    public synchronized String token(){
        JSONObject obj=read();
        return obj==null?"":obj.optString("access_token","");
    }
    public synchronized String refresh(){
        JSONObject obj=read();
        return obj==null?"":obj.optString("refresh_token","");
    }
    public synchronized String email(){
        JSONObject obj=read();
        return obj==null?"":obj.optString("email","");
    }
    public synchronized void clear(){preferences.edit().clear().commit();}
}
