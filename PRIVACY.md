# Confidențialitate BunPlan — proiect de politică (versiune de test)

**Statut:** document informativ pentru testare. **Nu este încă politica finală cerută pentru Google Play.** Operatorul legal, adresa și contactul pentru protecția datelor trebuie confirmate înainte de lansare.

BunPlan este o aplicație pentru planificarea meniurilor alimentare și a listelor de cumpărături.

## Ce date prelucrăm
- Cont: adresă de e-mail, numele afișat, identitate Google când alegi Google Login; parolele sunt administrate de Supabase Auth, nu sunt stocate de BunPlan în clar.
- Preferințe: număr de persoane, buget orientativ, stil alimentar, excluderi declarate, oraș și magazin preferat.
- Datele planificării: rețete alese, meniuri pe săptămâni, liste de ingrediente, bifări și unele corecții de preț.
- Jurnale tehnice minime, necesare autentificării, securității și funcționării infrastructurii.
- Reclame de test Google AdMob și mesaje de consimțământ prin Google UMP în această versiune.

## Pentru ce sunt folosite
Pentru funcționarea contului, recomandări de rețete și liste, salvarea și sincronizarea datelor, prevenirea abuzului și afișarea reclamelor în condițiile consimțământului aplicabil.

## Cu cine pot fi partajate
Datele de cont și preferințele sunt stocate în proiectul Supabase al BunPlan, găzduit în regiunea UE. Google participă la autentificare numai dacă alegi Google Login și la livrarea/consimțământul reclamelor când sunt active.

## Siguranța și accesul
Accesul la datele personale este controlat prin RLS în PostgreSQL; sesiunea este criptată local prin Android Keystore. Nicio măsură nu asigură securitate absolută.

## Drepturi și ștergere
Poți solicita ștergerea contului direct din Profil, cu confirmare. Fluxul pe server utilizează o sesiune autentificată și șterge contul Auth împreună cu datele personale referențiate la acel cont. Retenția backupurilor și solicitările externe trebuie descrise în politica de producție.

## Actualizare necesară înainte de distribuție
Trebuie stabilite operatorul și datele sale de contact, temeiurile GDPR, perioadele exacte de stocare și backup, transferurile internaționale, politica cookies/AdMob și drepturile de persoană vizată. Documentul de față **nu reprezintă încă o declarație de conformitate GDPR completă**.
