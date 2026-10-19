# UI — opbouw, stijl en onderdelen

Vastgelegd na de restyle van oktober 2026. Lees dit voordat je een pagina toevoegt of
verbouwt: de afspraken hieronder zijn met de opdrachtgever uitgeprobeerd en bijgestuurd.

## Navigatie

`lib/nav.ts`:
- `NAV`: titel en ondertitel per **pagina** (route). Bron voor de uitleg in de kopbalk.
- `SIDEBAR` + `SETTINGS_SECTION`: de **9 onderdelen** in de zijbalk. Een onderdeel kan meerdere
  pagina's hebben (Verkoop = Pijplijn · Offertes · Verloren); `components/layout/SubNav.tsx`
  toont dan een pilschakelaar bovenaan. Elke pagina houdt zijn eigen adres.
- Een nieuwe pagina: route aanmaken, toevoegen aan `NAV` én aan een onderdeel in `SIDEBAR`.

## Het sjabloon voor elke pagina

Van boven naar beneden, elke laag beantwoordt één vraag:

1. **Statement-rij** — `components/page/HeroCard.tsx` (het kerngetal, groot, met een statuspil
   en twee `MiniStat`s) naast `InsightCard` ("In het kort", 2–4 regels met een rond icoon) of een
   actielijst (`CallCard`, de werkvoorraad op Controleren).
2. **Hooguit vier tegels** — `StatTile` in `components/overview/cards.tsx`.
3. **Eén hoofdgrafiek** — `components/page/HighlightChart.tsx`.
4. **`<DetailsLabel />`** ("Verdieping") en daaronder de tabellen en verdiepende grafieken.

Overzicht wijkt af: begroeting als paginatitel, `StatementCard` (de lopende maand) en
`HighlightBars` (12 weken/maanden). Instellingen heeft bewust geen statement-kaart.

## Kleur

- **Zwart (`night`, accent-token) = bediening**: knoppen, actieve navigatie, schakelaars.
- **Merkgroen (`brand` #22CB63, `brand-ink` voor tekst) = data**: balken, de gemarkeerde staaf.
- **Groen/oranje/rood (`good`/`warn`/`crit`) alleen als het iets betekent.** Een balk waarbij meer
  níet beter is (verlopen, onbekend, concentratie) krijgt `barTone="neutral"`.
- Statement-kaart: thema via `HERO_THEME` in `HeroCard.tsx` (`mint` | `green` | `night`), kleuren
  als CSS-variabelen in `.hero` in `app/globals.css`. Gekozen: **mint** (licht, donkere tekst);
  vol groen leest een tekort als goed nieuws.
- Leadbronnen krijgen een vaste kleur op naam (`sourceColor` in `components/charts/theme.ts`).

## Vorm

- Kaarten: `rounded-[28px]`, geen rand, zachte schaduw (`Card`, `BENTO`).
- Knoppen en schakelaars: volledige pillen (`rounded-full`), actief = zwart.
- Getallen groot en half vet (`font-semibold`, `tracking-[-0.03em]`), labels klein en grijs.

## Grafieken

`HighlightChart`: rechte staven met alleen ronde bovenhoeken, context **effen** lichtgrijs (geen
arcering — die leest als "leeg"), één staaf in merkgroen met de waarde in een zwarte ballon, dun
raster en bedragen op de as, volle nullijn bij negatieve waarden, lopende periode lichter
(`current`), gedempte punten (`muted`). Geprobeerd en afgewezen: volledig ronde pilstaven met
arcering (kleine waarden werden bolletjes, alleen het gemarkeerde getal was af te lezen).

Oudere grafieken (Recharts) delen verlopen en een gloedfilter via `GlobalChartDefs` en de CSS
onder "Grafiek-polish" in `globals.css`.

## Verschillen (pijltjes)

`CalmDelta`: groen = beter, rood = slechter, grijs onder 1%. Bij weinig offertes zegt de tooltip
"kan toeval zijn" (`deltaTone` in `lib/signal.ts`).

## Mobiel

Tabellen worden onder 640px automatisch kaartjes: `components/layout/TableLabels.tsx` zet de
kolomnaam als `data-label` op elke cel, de CSS onder "Tabellen op telefoonbreedte" doet de rest.
Een tabel die tabel moet blijven krijgt `data-keep`.

## Lokaal ontwikkelen

Wijzigingen in `app/globals.css` (tokens, `.hero`) komen soms niet door in de dev-server: stop
hem, `rm -rf .next/dev`, start opnieuw. Controleer met `document.styleSheets`, niet op het oog.
Altijd zelf screenshots maken (playwright-core met `channel: 'chrome'`, script in de projectmap)
op 1440 en 390 breed voordat je iets oplevert.
