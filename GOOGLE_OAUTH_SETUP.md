# Google Sign-In pentru BunPlan — configurare OAuth

## Soluția alternativă când Google Play Services nu poate autentifica (BunPlan 4.3)

Butonul principal **„Continuă cu Google”** deschide un browser securizat (Chrome Custom Tabs), cu OAuth PKCE. Nu folosește Google Credential Manager și nu necesită selectorul nativ din Play Services.

**Acțiune obligatorie, de făcut manual în Supabase:** în [Authentication → URL Configuration](https://supabase.com/dashboard/project/aedyviqoelgbbrrtwayu/auth/url-configuration), la **Redirect URLs / Additional Redirect URLs**, adaugă exact:
`bunplan://oauth-callback`

Această adresă este interceptată numai de aplicația Android BunPlan care are un flux PKCE valid în curs. Google Cloud Web OAuth client trebuie să păstreze redirect-ul către Supabase:
`https://aedyviqoelgbbrrtwayu.supabase.co/auth/v1/callback`.

**Verifică Google Provider activ** în [Supabase Auth Providers](https://supabase.com/dashboard/project/aedyviqoelgbbrrtwayu/auth/providers). Client Secret trebuie să fie valoarea NOUĂ rotită în Google Cloud, nepublicată. Dacă Google Cloud proiectul este în Testing, adaugă contul de test în Audience.

Butonul secundar **„Folosește contul Google de pe telefon”** rămâne opțiunea nativă; în cazul unei erori se afișează **tipul exact** de eroare Credential Manager / Play Services. Acesta poate depinde de clientul Google Android, SHA-1 și disponibilitatea Google Play Services.

## 1. Acreditări Google Cloud

Clientul Web OAuth este de tipul corect. **Client ID-ul este public** și este introdus în `android-native/app/build.gradle` ca valoare implicită pentru `google_web_client_id`.

**Securitate:** un Client Secret a fost dezvăluit într-o conversație; îl considerăm compromis. Rotește-l/regenerează-l din [Google Cloud Auth Clients](https://console.cloud.google.com/auth/clients), apoi introdu noul secret **numai** în [Supabase → Authentication → Providers → Google](https://supabase.com/dashboard/project/aedyviqoelgbbrrtwayu/auth/providers). **Nu-l pune în GitHub, codul Android, fișiere JSON publice sau conversații.**

Supabase Google Provider:
- Google enabled = true.
- Client ID = identificatorul **Web** din Google Cloud.
- Client Secret = secretul **nou, rotit**, configurat direct prin interfața Supabase.
- Redirect URI autorizat în clientul Web Google:
  `https://aedyviqoelgbbrrtwayu.supabase.co/auth/v1/callback`.
- Setează Google Auth Platform → **Audience** la External, și adaugă conturile în Test users dacă proiectul este în Testing.
- Scopes: `openid`, `email`, `profile`.
- Păstrează nonce-check activ.

**APK 4.3:** SHA-1 (debug, numai această compilare): `86:E1:AE:A8:72:55:FC:34:18:70:E2:A4:BE:D0:D0:F5:EA:DC:15:6B`. Acest pas este necesar **numai pentru butonul secundar nativ**, nu pentru loginul principal prin browser OAuth PKCE.

## 2. Client Android OAuth pentru APK-ul de test

Creează un alt client OAuth tip **Android** în Google Cloud Auth Clients.

- **Android package:** `ro.bunplan.app.ux43test`
- **SHA-1:** citește amprenta din [BunPlan-4.3-UX-Google-SHA1.txt](builds/BunPlan-4.3-UX-Google-SHA1.txt), obținută automat prin `apksigner verify --print-certs` pentru APK-ul publicat efectiv.
- Folosește numai APK-ul `builds/BunPlan-4.3-UX-Google-TEST.apk` care are exact acel SHA-1.

Adaugă noul Android Client ID și în lista **Additional Client IDs / Client IDs** din Google Provider Supabase, dacă este solicitată de proiect.

**Atenție:** APK-ul actual folosește o cheie de semnare de tip debug de pe GitHub Actions. Fiecare recompilare pe alt runner poate genera alt certificat și SHA-1. Pentru un proiect stabil, configurăm ulterior o cheie privată de semnare a testelor, păstrată numai în GitHub Actions Secrets, și Google Play App Signing pentru release.

## 3. Verificare pe dispozitiv

1. Instalează APK 4.2 și deschide ecranul de login.
2. Apasă „Continuă cu Google” și selectează contul Google de test.
3. Google Credential Manager emite un ID token; aplicația îl trimite la Supabase Auth, care validează identitatea și emite sesiunea.
4. Verifică în [Supabase Auth Users](https://supabase.com/dashboard/project/aedyviqoelgbbrrtwayu/auth/users) că există contul creat.
5. Creează un meniu Lidl, salvează în cloud, verifică logout/login și reîncărcarea meniului. Repetă cu Kaufland.

Dacă butonul Google produce o eroare, verifică: Web Client ID, Client Secret nou în Supabase, Audience/Test Users, Android Client ID corelat cu **SHA-1 exact**, Google Play Services și conexiunea la Internet.

Acesta este un APK de **test**, nu un AAB release pregătit pentru Google Play. Google Play cere separat configurarea semnării, pagini de confidențialitate/ștergere cont, declarații Data Safety și verificări reale de securitate.
