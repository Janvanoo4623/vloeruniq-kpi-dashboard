# Archief juni t/m 17 november 2026

Compact, per maand, achteraf samengesteld uit de commits en `docs/DATA-MODEL.md`. Vanaf 18 november
staat elke wijziging als kaart in een eigen dagbestand.

## Juni 2026 — start
- Eerste versie: Teamleader-sync, dashboard, dagelijkse sync op Vercel. Vervangt het Apps Script
  dat de cijfers naar een Google Sheet schreef.

## Juli 2026 — fundament
- Opslag naar **Supabase**; inkoopprijzen en kosten **met ingangsdatum**, zodat een prijswijziging
  oude offertes niet verandert.
- **Instellingen**: prijzen, kosten per m², uitsluitingen.
- Periodekiezer met vergelijkingsperiode; **Trends**; facturen opgeslagen.
- **Cashflow**: openstaande facturen naar ouderdom; betaalgedrag (dagen tot betaling).
- Pijplijnprognose (open offertes × winkans).
- Offertes openen in een venster met de opbouw per regel; ontbrekende inkoopprijzen meteen invullen.
- Feedback Jan: snijden/kitten telt niet als vloer-m²; speciale inkoopprijs per offerte; los
  verkocht = geen legservice.
- **Fix 16/7**: een te ruime regel ("snij") zette alle vloer-m² op nul — teruggedraaid binnen een dag.

## Augustus 2026 — van rapport naar app
- Navigatie, pagina's, **Controleren** (open punten afvinken), **Uitzonderingen**.
- Zelfklevende ondervloer (€5,92/m²); geen arbeid bij een losse vloer.
- **Fix**: status "verlopen" werd nooit opgehaald — €1,84M aan offertes ontbrak; 23 spookoffertes uit
  de pijplijn.
- Verloren omzet, marge-spreiding per product, klantanalyses, CBS-marktaandeel per gemeente.
- Sync-lock: twee processen kunnen elkaars Teamleader-token niet meer intrekken.

## September 2026 — marketing
- Kostprijs per m² rekende verkeerd en prijswijzigingen werkten niet door — opgelost; marges worden
  sindsdien **bij het lezen** berekend.
- Deelbetalingen zelf invullen; overal "ex/incl btw" erbij; mobiel bruikbaar.
- **Exportrapport**: het hele dashboard als één afdrukbaar rapport.
- **Marketing**: Google Ads-kosten naast de marge, maandbudget (16/9); **Meta Ads** gekoppeld (17/9).
- **Fix 15/9**: een handmatige sync naast de cron trok het Teamleader-token in; `force` neemt de lock
  nu over in plaats van hem over te slaan.

## Oktober 2026 — resultaat en nieuwe stijl
- **Resultaat** uit Moneybird: kosten per grootboekrekening, omzet uit Teamleader (15–16/10).
- Belijst, maanddoel, cashprognose, break-even.
- Hele app in Vloeruniq zwart + groen; navigatie van 15 naar 9 onderdelen; elke pagina in één sjabloon (19/10).
- Gefactureerd = gewonnen: 73 verlopen offertes met facturen tellen als gewonnen.
- Marge naar rato bij onvolledige dekking: onbeprijsde regels tellen niet meer als pure winst (−6% totale marge).
- Tests op de rekenmodules (`npm test`).

## November 2026 (1–17)
- Resultaat viel om op "30 november": opgelost (2/11).
- Gietvloer herkend als vloer; Controleren toont alleen geaccepteerde en open offertes (5/11).
- **Overige producten**: trappen, plinten, tapijt, entreematten, verwijderen met kostprijs per eenheid,
  plus nacalculatie uit facturen (5/11). Nooit meer dan er boven de offerte gefactureerd is (€12,5k
  telde dubbel).
