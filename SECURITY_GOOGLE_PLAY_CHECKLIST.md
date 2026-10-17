# BunPlan — verificare securitate și configurare Google / Play (17 octombrie 2026)

## Implementat și auditat

- Supabase Auth + PostgreSQL cu RLS pe tabelele private.
- Funcția internă de profil mutată în schema `private` și lipsită de privilegii RPC pentru anon/authenticated.
- RPC-urile `save_bunplan_week` și `load_bunplan_week` folosesc **SECURITY INVOKER**, deci accesul trece prin RLS.
- Singura notă rămasă în Supabase Security Advisors este `import_runs` fără politici RLS, **intenționat inaccesibil** utilizatorilor aplicației.
- Android stochează acces/refresh tokens criptat AES-256-GCM prin Android Keystore (`SessionVault`); nu pune tokenurile în JavaScript.
- WebView acceptă pagini numai din resursele aplicației servite ca HTTPS prin WebViewAssetLoader, fără permisiuni `file://`, mixed content și cu CSP. Linkurile externe se deschid în browser.
- Google Credential Manager folosește nonce aleator și SHA-256 către Google, nonce brut către Supabase pentru verificarea ID tokenului.
- Funcția de **ștergere a contului** din Supabase `delete-account` verifică JWT-ul și așteaptă confirmarea explicită; în aplicație există și dialog nativ suplimentar.
- Buildul de test are Google AdMob test ID + UMP. **Deocamdată recompensa reclamei este locală**, nu validată Google Server-Side Verification (SSV).

## Google Login — ce trebuie să configurezi o singură dată

1. În **Google Cloud**: proiect OAuth BunPlan; completează OAuth Consent Screen / Google Auth Platform cu numele BunPlan, domeniu și pagini valide de privacy/terms.
2. Creează un **OAuth 2.0 Client ID tip Web** pentru Supabase. La Authorized Redirect URIs: `https://aedyviqoelgbbrrtwayu.supabase.co/auth/v1/callback`.
3. Supabase → **Authentication → Providers → Google**: activează providerul și completează **Client ID** și **Client Secret** în dashboard. **Client Secret nu se publică în GitHub și nu se introduce în APK.** Păstrează nonce-check activ.
4. Creează și un OAuth client **Android** în Google Cloud cu package name și certificatul SHA-1:
   - APK-ul de test: `ro.bunplan.app.securitytest`, certificat SHA-1 al acelui APK;
   - viitorul release: `ro.bunplan.app` și amprenta SHA-1 a certificatului **Google Play App Signing**, nu doar a cheii locale.
   **ATENȚIE:** cheia debug creată automat pe runnerul GitHub se poate schimba între builduri. Înaintea testării repetate Google OAuth configurează o cheie de semnare de test stabilă, ținută în GitHub Secrets, sau alege un APK și folosește amprenta lui.
5. Pentru APK-ul de test setează variabila publică din GitHub `Settings → Secrets and variables → Actions → Variables → BUNPLAN_GOOGLE_WEB_CLIENT_ID` la Web Client ID-ul tău (nu la Client Secret).
6. Rulează workflow-ul **Build BunPlan Native AdMob Test** sau publică o modificare nouă. Instalează APK-ul nou și testează autentificarea cu Google pe telefon.

Până la această configurare, butonul „Continuă cu Google” afișează un mesaj de configurare. Nu este autenticare Google live.

## Înainte de Google Play

- Din **31 august 2026**, aplicațiile Android noi trebuie să țintească **API 36** (conform Google Play Help).
- Necesare: **Android App Bundle (AAB) release semnat**, Google Play App Signing, icon/logo propriu, nume/pachet definitiv, texte store listing și capturi reale.
- Politică de confidențialitate publică accesibilă din aplicație și Play Console; declarații **Data safety** corecte, inclusiv AdMob, Supabase, locații doar dacă sunt utilizate.
- **Ștergerea contului** în aplicație plus pagină publică externă pentru solicitări, fără a cere alt cont; funcția native/server există, **pagina externă publică nu este încă pregătită**.
- Test GDPR (consimțământ UMP și retragere consimțământ), securitatea transferurilor, date minime, ștergerea backupurilor conform politicii.
- Ștergerea contului Edge Function trebuie testată cu un cont de test, fără date reale, inclusiv propagarea ștergerii și e-mailurile de confirmare.
- Configurare SMTP, resetare parolă cu redirect Android corect, rate limits/CAPTCHA la autentificare și protecție contra abuzului.
- AdMob recompensat: **SSV de la Google pe backend**, prevenire replay și validare recompensa pe server; închidere ori eșec => nu se acordă recompensa.
- Teste automate + testare pe dispozitive fizice, scanare SAST/dependințe, audit OWASP MASVS, evaluare XSS a interfeței HTML, fuzz/negative RLS și verificarea crashurilor.
- Dacă este un cont Play Console personal nou (creat după 13 noiembrie 2023), se poate aplica cerința de 12 testeri timp de 14 zile consecutive în closed testing.

**Nu există garanții absolute că aplicația nu poate fi compromisă și nici aprobare automată din partea Google Play.**

Surse:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation
- https://developer.android.com/develop/ui/views/layout/webapps/load-local-content
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://support.google.com/googleplay/android-developer/answer/13327111
