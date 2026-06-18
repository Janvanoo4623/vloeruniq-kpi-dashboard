# Vloeruniq KPI Dashboard — accounts & toegang (voor de klant)

Dit dashboard draait op twee gratis diensten. Om eigenaar te blijven van je eigen
gegevens en facturatie, maak jij de accounts aan en nodig je de ontwikkelaar uit als
medewerker. De ontwikkelaar doet daarna de technische instelling.

## Wat je krijgt
Een beveiligde webpagina (eigen link) met je KPI's uit Teamleader — omzet, marge,
conversie, doorlooptijd, producten, regio's en facturatie. Te openen op elk apparaat
met één gedeeld wachtwoord.

## Accounts die je aanmaakt (2 stuks, gratis)

1. **GitHub** — https://github.com → *Sign up*
   - Hier staat de programmacode + de automatische data-verversing.
   - Nodig de ontwikkelaar uit: repo → *Settings* → *Collaborators*.

2. **Vercel** — https://vercel.com → *Sign up* (kies "Continue with GitHub")
   - Hier draait de website zelf. Het gratis **Hobby**-plan volstaat.
   - Nodig de ontwikkelaar uit als teamlid.
   - Binnen Vercel koppel je later in 1 klik de opslag (**Upstash Redis**, ook gratis) —
     dat hoef je niet apart aan te maken.

> Teamleader heb je al; daar hoef je niets nieuws voor aan te maken.

## Wat jij kiest / aanlevert
- **Een wachtwoord** voor het dashboard (deel je met wie het mag zien).
- Toegang tot **Teamleader** voor de koppeling (de ontwikkelaar gebruikt de bestaande
  API-gegevens; mogelijk vraagt hij je een nieuwe "client secret" te genereren — 2 minuten).

## Wat de ontwikkelaar doet (na jouw uitnodiging)
- Code op GitHub zetten en aan Vercel koppelen.
- Upstash-opslag koppelen.
- Alle technische sleutels (Teamleader, opslag) als geheime waarden instellen.
- De eerste data-synchronisatie draaien en controleren dat de cijfers kloppen.

## Daarna
- De data ververst **automatisch** een paar keer per dag.
- In het dashboard kun je met de knop **Vernieuwen** handmatig een update starten
  (duurt ~1–2 minuten; daarna pagina verversen).
- Belangrijk: de oude Google Sheet / het oude script niet meer laten draaien — het
  dashboard beheert de Teamleader-koppeling nu zelf.

## Kosten
- GitHub: gratis. Vercel Hobby: gratis. Upstash: gratis (ruim voldoende voor dit gebruik).
- Let op: Vercel's gratis plan is bedoeld voor niet-commercieel gebruik. Wil je het
  netjes/zakelijk afdekken of automatische verversing ín Vercel, dan is **Vercel Pro
  (~$20/mnd)** de juiste keuze — niet nodig voor de werking, wel zo correct.
