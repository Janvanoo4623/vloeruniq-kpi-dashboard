# Omzet per campagne (click-ID-attributie) — plan

Stand 2026-11-21. Doel: per Google- of Meta-campagne zien hoeveel **gewonnen omzet en marge**
eruit komt, en die waarde later terugsturen naar Google/Meta zodat ze op echte klanten
optimaliseren in plaats van op formulieren. Vervangt de grove aanname "leadbron Social media =
Meta" (zie ROADMAP, "Idee: conversies terugkoppelen").

## Wat er nu is (onderzocht op de live site, 2026-11-21)

- **Website** www.vloeruniq.nl: een Next.js-site met een headless CMS op `cms.vloeruniq.nl`.
  Formulieren (contact, `/offerte?product=…`) posten met `FormData` naar
  `https://cms.vloeruniq.nl/api/email/send/` — het CMS verstuurt een **e-mail**.
- **Tracking**: Google Tag Manager + gtag staan erop. Er wordt **geen** `gclid`, `gbraid`,
  `wbraid`, `fbclid` of `utm_*` uitgelezen of meegestuurd met het formulier. Geen cookiebanner
  gevonden in de HTML.
- **Teamleader**: de deal heeft eigen velden "Leadbron" (meerkeuze), "Datum uitvoering",
  "Doorlooptijd". Geen velden voor click-ID of campagne. `lib/teamleader/deals.ts`
  (`readCustomFields`) leest eigen velden al, dus nieuwe velden meelezen is klein werk.
- Hoe een aanvraag nu in Teamleader komt (handmatig uit de mail?) is **onbekend** → Jan.

## Plan in vier stappen

1. **Website (webbouwer).** Bij binnenkomst `gclid`/`gbraid`/`wbraid`/`fbclid` en
   `utm_source`/`utm_medium`/`utm_campaign` uit de URL in een eigen cookie of localStorage zetten
   (90 dagen, alleen na toestemming), plus Metas `_fbc`/`_fbp`. Bij verzenden als extra velden aan
   de `FormData` toevoegen. De submit-hook (`onSubmit` → `fetch(cms…/api/email/send/)`) voegt al
   alle formuliervelden toe; het zijn een paar regels.
2. **Aanvraag → Teamleader.** Twee routes:
   - *Klein*: het CMS zet de velden in de mail; Jan plakt ze bij het aanmaken van de deal in
     nieuwe eigen velden. Foutgevoelig — wordt vergeten.
   - *Beter (aanrader)*: het formulier stuurt óók naar een n8n-webhook, en n8n maakt in
     Teamleader het contact + de deal aan met de click-ID's in eigen velden (n8n heeft al een
     eigen Teamleader-koppeling). Scheelt Jan overtypen. Vraagt: welke velden, welke pijplijn/fase.
3. **Dashboard.** Nieuwe eigen velden meelezen in de sync (`readCustomFields`), op de deal
   opslaan, en op Marketing een tabel *per campagne*: leads, gewonnen offertes, omzet, marge,
   kosten (uit `ads_daily`) en marge na advertenties. `utm_campaign`/`gclid` koppelen aan de
   campagne-ID in `ads_daily`.
4. **Terugsturen (later).** Google: offline conversies "offerte gewonnen" met de omzet als waarde
   — de eenvoudigste route is een geplande upload vanuit een Google Sheet die n8n vult (geen
   developer token nodig); klik-ID's verlopen na 90 dagen. Meta: Conversions API, pas als de
   Meta-koppeling weer werkt (geblokkeerd sinds 2026-09-18).

Werkt alleen **vooruit**: bestaande deals hebben geen click-ID. Na ±2–3 maanden is er genoeg om
per campagne iets te zeggen.

## Nodig van Jan

- Wie beheert de website en het CMS (`cms.vloeruniq.nl`)? Die moet stap 1 doen.
- Hoe komt een websiteaanvraag nu in Teamleader: met de hand uit de mail, of automatisch?
- Is er een cookiebanner / Consent Mode? Zonder toestemming mag de click-ID niet bewaard worden
  (AVG); Google Consent Mode v2 is ook nodig voor de conversie-upload.
- Akkoord op nieuwe eigen velden op de deal: "gclid", "fbclid", "Campagne", "Aanvraagdatum".
