# BunPlan 4.0 — backend și prețuri actualizabile

## Ce este deja în repository

- **Android:** `android-native/` — versiunea de test AdMob 3.7, recompensă la deblocarea listei. Reclamele sunt doar cele demonstrative Google.
- **PostgreSQL + Supabase Auth:** `supabase/migrations/20261017181500_bunplan_foundation.sql` — 14 tabele, relații și politici RLS.
- **Conținut:** `data/bunplan_recipes_v1.json` (100 rețete, 107 ingrediente) și `data/bunplan_estimated_packs_v1.json` (costuri orientative, explicit neverificate).
- **Import:** `scripts/seed_bunplan_supabase.py` pentru rețete; `scripts/sync_catalog_to_supabase.py` pentru produse și prețuri documentate.
- **Acțiuni automate:** `.github/workflows/seed-supabase.yml` (o dată, manual), `.github/workflows/sync-supabase.yml` (zilnic după fluxurile de catalog), plus workflow-urile Lidl/Kaufland existente.

## Cum pornești baza REALĂ de date (neactivată încă)

1. Creează sau conectează un proiect **Supabase** în regiunea UE și acordă acces pentru configurarea lui. Activarea aplicației Supabase din ChatGPT îți permite să lucrezi asistat direct în proiect.
2. Aplică migrarea SQL (o singură dată). SQL-ul creează tabelele din `public`, nu schimbă politica Supabase Auth implicită.
3. În **Authentication > Providers** activează e-mail/parolă, iar în **URL Configuration** configurează redirecționările și confirmarea e-mailului. Configurează SMTP pentru livrare reală la volum și o politică de ștergere a contului.
4. În GitHub → **Settings → Secrets and variables → Actions** adaugă **SUPABASE_URL** și **SUPABASE_SERVICE_ROLE_KEY**. Acestea se adaugă acolo, **niciodată în chat, în Android, în HTML sau în fișierele publice**.
5. Rulează din GitHub Actions **Seed BunPlan database**; apoi **Sync verified prices to Supabase**.
6. Verifică numărul de înregistrări și regulile RLS cu două conturi de test distincte, apoi conectează Android la Supabase Auth și API, folosind doar cheia **publishable/anon** în client.

## Designul datelor

- `auth.users` + `profiles`: identitatea utilizatorului și preferințele; Supabase gestionează parolele și resetările.
- `weekly_plans` + `planned_meals` + `shopping_items`: planuri pentru fiecare utilizator, **magazin** și **săptămână**, separat.
- `stores`, `store_locations`, `products`, `product_prices`: produse și observații de preț legate de magazin, sursă, dată, valabilitate și domeniul locației.
- `ingredients`, `recipes`, `recipe_ingredients`: ingrediente cantitative și rețete.
- `price_estimates`: fallback separat pentru buget, niciodată preț declarat ca verificat.
- `ad_rewards`: pregătit pentru verificarea Google AdMob **pe server** în producție; clientul nu are voie să-și acorde singur o recompensă server-side.
- `import_runs`: monitorizarea importurilor, gestionată server-side.

**Protecție:** RLS împiedică un cont să citească sau să modifice planul altuia. Constrângerile compuse `(product_id, store_id)` și `(plan_id, store_id)` împiedică asocierea produsului din Kaufland cu o listă Lidl.

## Ce înseamnă „preț exact”

**Lidl** publică lista oficială a prețurilor pentru sortimentul permanent la nivel național, de luni până vineri. Nu avem de aici stocuri locale, fotografii sau toate promoțiile; prețurile pot să nu includă garanția SGR.

**Kaufland** expune prin site oferte publice cu preț, dată de valabilitate și uneori imagine, dependente de contextul magazinului selectat. Scraperul public **nu** enumeră în mod verificat toate produsele și toate prețurile de raft pe fiecare filială.

Pentru catalogul Kaufland complet și verificat la nivel de filială, este necesar un **feed/API autorizat** din partea Kaufland ori a unui partener care acordă dreptul de reutilizare. Catalogul Glovo, dacă se obține legal, poate reflecta **prețuri de livrare**, nu automat prețuri din magazin.

În ecranul de cumpărături, prețurile trebuie etichetate vizibil: **confirmat (sursă + dată)**, **ofertă valabilă până la ...**, **estimare de buget** ori **preț introdus de utilizator**. Totalul unui coș incomplet nu trebuie prezentat drept preț garantat.

## AdMob

- 3.7 folosește App ID și rewarded interstitial ID Google **de test**, nu unitatea comercială din contul AdMob.
- Am corectat verificarea cheii de forma `Lidl|YYYY-MM-DD` / `Kaufland|YYYY-MM-DD`.
- Am adăugat UMP pentru consimțământ, mesaje de eroare SDK și inițializare/reîncărcare.
- Recompensa din APK de test este locală; înainte de monetizare trebuie implementată verificarea AdMob SSV și protecția conținutului server-side.
- Nu presupune afișarea reclamei până când este probată pe telefonul fizic, cu internet și Google Play Services funcționale.

## Pentru un produs pregătit de lansare

Înlocuiește autentificarea HTML demonstrativă cu un client Supabase Auth securizat în Android, implementează ștergerea contului, recuperearea parolei, sincronizare offline/conflicte, accesibilitate, politică GDPR și un sistem de observabilitate care alertează la importuri eșuate sau date expirate.
