# BunPlan CRM — activare găzduire web

Panoul este pregătit în branch-ul `crm-live`, folderul `/docs`.

**Activare de către proprietarul repository-ului (o singură dată):**
1. Accesează https://github.com/birisiu/BunPlan/settings/pages.
2. La **Build and deployment → Source**, selectează **Deploy from a branch**.
3. La **Branch** alege `crm-live`, apoi folderul `/docs`; apasă **Save**.
4. După publicarea Pages, site-ul va fi la `https://birisiu.github.io/BunPlan/`.

Nu folosi URL-ul Supabase Edge Function `/functions/v1/bunplan-admin` pentru interfață: Supabase schimbă tipul MIME `text/html` în `text/plain`, așa încât browserul afișează codul paginii.

**Autentificare:** conturile administratoare se verifică exclusiv prin Supabase Auth și RLS. Cheia `publishable` din frontend nu oferă privilegii de administrator. Contul autorizat este gestionat în `public.bunplan_admin_users`.

Pentru redirecționarea după Google OAuth, adaugă în **Supabase → Authentication → URL Configuration → Redirect URLs**:
`https://birisiu.github.io/BunPlan/`
Folosește HTTPS; nu adăuga redirect-uri wildcard pentru domenii arbitrare.

**Publicarea modificărilor:** la actualizări de interfață, sincronizează `admin/index.html`, `admin/admin.css`, `admin/admin.js`, `admin/crm.css`, `admin/crm.js` și `admin/bunplan-icon.svg` în `docs/`. Testul `scripts/test-crm-pages-ready.mjs` verifică identitatea fișierelor și afișarea responsive.

**Notă privind funcționalitatea:** aplicația mobilă citește date editoriale din Supabase. CRM-ul poate gestiona date și anumite setări publice, dar schimbările de cod nativ, permisiuni Android, build-uri APK, Google Play și integrările externe necesită încă procese dedicate.
