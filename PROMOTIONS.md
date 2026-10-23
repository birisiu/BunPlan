# Promoții pe prima pagină — BunPlan 6.6

Carusel accesibil cu swipe nativ, butoane înainte/înapoi, filtre Lidl/Kaufland, preț, unitate, date de valabilitate, condiții de card și link oficial. Înlocuiește doar secțiunea sa la actualizarea datelor, fără redesenarea paginii sau modificarea navigației.

Importator: `python scripts/promotions_daily.py` (requests + beautifulsoup4). Lidl este citit din datele structurate ale paginii principale și categoriilor de oferte descoperite acolo; Kaufland din importatorul existent. Nu reprezintă întregul sortiment sau stocul unui magazin. Prețurile Lidl sunt cele ale regiunii implicite, menționată în card. Ofertele Lidl Plus și Kaufland Card sunt etichetate.

Feed: `docs/api/promotions/current.json`. Fiecare magazin are propriul checked_at; eșecul unei surse nu îi reîmprospătează artificial timestampul. Ofertele expirate/viitoare sunt filtrate în client în fusul Europe/Bucharest; un feed mai vechi de 48h nu se afișează. Copia inclusă în APK permite prima afișare/offline, numai cât este actuală.

Aplicația solicită feedul din main la fiecare 24h, la revenirea online și la refresh manual. Verifică expirarea la fiecare minut în prim-plan și la revenirea în aplicație. În lipsa internetului nu poate descărca actualizări; nu inventează promoții. Actualizarea zilnică nu garantează oferte diferite zilnic: comercianții le pot păstra o săptămână.

Workflow-ul `promotions-daily.yml` rulează zilnic la 06:15 UTC. GitHub activează schedule numai pe branch-ul implicit: integrarea acestui workflow în main este necesară pentru actualizarea automată a sursei. Programările Actions pot întârzia; nu reprezintă un SLA exact de 24h. Fluxul Android citește GitHub, deci nu depinde de mutarea CRM-ului pe CyberFolks. Copierea statică a feedului pe CyberFolks nu activează un cron acolo.

Teste: `node scripts/test-promotions.mjs`, `node scripts/test-five-tabs-navigation.mjs`. Build debug versionCode 66, versionName 6.6-home-promotions-test. Pentru actualizare peste un APK existent trebuie semnătură compatibilă; cheia debug a unui runner CI poate diferi.
