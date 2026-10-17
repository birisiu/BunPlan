# BunPlan — Android, rețete și prețuri Lidl/Kaufland

Aplicație în dezvoltare pentru meniuri săptămânale, buget alimentar și liste de cumpărături pe magazin.

- [APK Android 4.3 — chestionar, design responsive, Google browser login](https://raw.githubusercontent.com/birisiu/BunPlan/main/builds/BunPlan-4.3-UX-Google-TEST.apk) — instalabil separat, autentificarea Google browser necesită redirect-ul Supabase autorizat
- [Pașii de configurare Google OAuth](GOOGLE_OAUTH_SETUP.md)
- [Sigle pentru identificarea retailerilor](BRAND_ASSETS.md)
- [Notificare privind confidențialitatea în testare](PRIVACY.md)
- [Checklist securitate și cerințe Google Play](SECURITY_GOOGLE_PLAY_CHECKLIST.md)
- [Instalare backend Supabase și autentificare reală](BACKEND_SETUP.md) — migrarea este pregătită, serverul trebuie configurat
- [Migrare PostgreSQL și RLS](supabase/migrations/20261017181500_bunplan_foundation.sql)
- [100 rețete + 107 ingrediente](data/bunplan_recipes_v1.json)
- [Estimări de buget distincte per retailer](data/bunplan_estimated_packs_v1.json)

**Important:** până la conectarea și migrarea proiectului Supabase, APK-ul folosește încă autentificare demonstrativă și stocare locală. Reclamele folosesc ID-uri demonstrative Google, fără monetizare.

---

# BunPlan – catalog Lidl România

Acest repository public conține importatorul pentru lista oficială Lidl România de prețuri a **sortimentului permanent**. Scopul este furnizarea unui catalog alimentar pentru aplicația de planificare a meselor BunPlan.

## Catalogul public

- [JSON complet](https://raw.githubusercontent.com/birisiu/BunPlan/main/docs/api/lidl/lidl_products.json)
- [CSV](https://github.com/birisiu/BunPlan/blob/main/data/lidl_products.csv)
- [Rulări GitHub Actions](https://github.com/birisiu/BunPlan/actions/workflows/lidl-daily.yml)

Fișierul JSON conține: `meta.checked_at`, `meta.product_count` și `products` cu `id`, `name`, `size`, `category`, `price_ron`, `shop` și `source_url`.

## Actualizare

Workflow: `.github/workflows/lidl-daily.yml`. Este programat zilnic la **09:30 UTC** și rulează și după modificări ale importatorului. Procesul descarcă XLSB din lista publicată de Lidl, filtrează alimentele și băuturile nealcoolice, păstrează separat descrierile ambigue și publică doar după validare.

Pentru rerulare manuală: **Actions → Lidl daily food prices → Run workflow**.

## Limite importante

- **Nu** este un API oficial Lidl și nu oferă date de stoc la nivel de magazin.
- Prețurile reflectă fișierul public Lidl și **nu includ promoțiile temporare**, Lidl Plus sau imaginile produselor.
- Produsele fără identificator unic și cu prețuri contradictorii sunt excluse din importul principal pentru a evita informații greșite.
- Contul de produse poate varia în fiecare zi. Verificați mereu câmpul `meta.checked_at`.
- Reutilizarea comercială a datelor și a mărcilor/fotografiilor trebuie verificată separat.

## Integrarea în aplicație

Aplicația BunPlan 3.2 încarcă JSON-ul public prin HTTPS la pornire și poate reutiliza ultima copie salvată când nu există internet. Datele Lidl nu trebuie confundate cu prețurile istorice ale altor retaileri.

## Kaufland (nou în BunPlan 3.3)

- [Catalog JSON — oferte Kaufland](https://raw.githubusercontent.com/birisiu/BunPlan/main/docs/api/kaufland/kaufland_offers.json)
- [Catalog CSV — oferte Kaufland](https://github.com/birisiu/BunPlan/blob/main/data/kaufland_offers.csv)
- [Workflow automat](https://github.com/birisiu/BunPlan/actions/workflows/kaufland-daily.yml)
- [Scriptul importator](https://github.com/birisiu/BunPlan/blob/main/scripts/kaufland_daily.py)

Spre deosebire de fișierul Lidl de sortiment permanent, **Kaufland este importat doar din ofertele săptămânale publice** ale paginii `oferte/prezentare-generala-oferte.html`, din datele structurate incluse în HTML. Scriptul salvează denumirea, prețul, unitatea, perioada de valabilitate, categoria și URL-ul fotografiei când există. Nu obține stoc fizic și nici sortiment complet.

**Limitare de locație:** site-ul poate afișa un magazin prestabilit diferit de cel al utilizatorului. Importatorul nu garantează prețul pentru fiecare filială; în BunPlan acesta apare explicit drept ofertă a magazinului implicit al site-ului. Nu compara automat coșul total cu Lidl în lipsa prețurilor pentru toate ingredientele.

Actualizarea este programată zilnic la **09:45 UTC**. În caz de schimbări pe site, procesul eșuează fără să suprascrie catalogul anterior cu rezultate incomplete.

### Magazinele active în aplicație

BunPlan 3.3 afișează numai **Lidl și Kaufland**. Carrefour și Mega Image sunt puse în așteptare până când există importatoare verificate pentru ele.

### Condiții de reutilizare

Datele provin din pagini publice și nu sunt un API oficial. Automatizarea este neafiliată retailerilor. Înaintea monetizării, verifică termenii de reutilizare pentru datele, mărcile și fotografiile produselor.
