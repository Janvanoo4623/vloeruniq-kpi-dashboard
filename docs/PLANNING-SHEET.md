# Planning-Sheet (Google Sheets) — automatisch vullen vanuit Teamleader

Status 2026-11-18: **input ontvangen, nog niets gebouwd.** Dit document legt vast hoe Jans
planning-Sheet in elkaar zit, wat er automatisch kan en welke vragen nog open staan. Lees het
voordat je aan de n8n-koppeling begint.

## Waarom

Bij elke geaccepteerde offerte typt Jan (of de collega die plant) de klantgegevens, de m² en de
vloer, plint, trap en mat "klakkeloos" over uit de offerte. Daarbij ontstaan verschillende
schrijfwijzen voor dezelfde vloer ("P470 dark oak", "P470 warm oak", "Luca P470 Dark Oak"). Jans
wens: **kolommen G t/m M automatisch gevuld.** De rest van de Sheet blijft handwerk.

## Hoe de Sheet nu werkt (toelichting Jan, 2026-11-18)

- **Eén tab per maand** (voorbeeld: januari 2026).
- Binnen een tab staan **weekblokken** ("Week 2", "Week 3", …). Een kopregel per week, daaronder
  de klussen, onderaan elk weekblok een **grijs vlak "Afspraken"**: inspecties/opnames bij klanten
  thuis (niet standaard, meestal eind van de week), met de initialen van wie gaat (bv. "GI").
- **Afwezigheid** staat los in de Sheet, vaak linksboven op de plek van maandag ("22 januari t/m
  31 januari Gerrit afwezig", "Vrijdag 30 januari Endrit afwezig").
- Onderaan de tab staat een **totaal m²** (januari: 1644).
- **Bij akkoord** zet Jan de klus "voorlopig in een maand zonder specifieke week", zodat hij niet
  vergeten wordt. Klanten weten bij akkoord vaak nog niet wanneer; bij nieuwbouw soms pas over
  kwartalen. **Klussen worden geregeld meerdere keren doorgeschoven.**

### Kolommen volgens Jan

| Kolom | Inhoud | Wie vult |
|---|---|---|
| A–E | De dagen van de week: wie doet wat op welke dag. Verandert dagelijks. | handwerk (planner) |
| F | Opmerkingen: bijzonderheden, waar aan gedacht moet worden | handwerk |
| G | Naam | **automatisch** |
| H | Telefoonnummer | **automatisch** |
| I | Plaats | **automatisch** |
| J | m² incl. snijverlies | **automatisch** |
| K | Verdieping(en), óf de m² als het **zonder legservice** is — dan tellen ze niet mee in het totaal onderaan | **automatisch** (m²) / handwerk (verdieping) |
| L | Vloer | **automatisch** |
| M | Plint / Mat / Trap | **automatisch** |

### Kolommen zoals ze in de geplakte januari-tab staan

`Planning | Opmerkingen | Opmerkingen | Naam | Telnummer | Plaats | m2 incl. snijverl. | (leeg) | Vloer | Plinten | Trap | Mat | Wie | Wanneer`

> **Dit wijkt af van Jans toelichting:** hier zijn plint, trap en mat drie aparte kolommen en
> staan "Wie" en "Wanneer" rechts; de dagkolommen A–E ontbreken. Mogelijk is januari een oudere
> indeling of zijn kolommen bij het kopiëren weggevallen. **Niet bouwen op een van beide totdat we
> de echte Sheet gezien hebben** (zie open vragen).

### Wat opvalt in de januari-voorbeelden

- **Naam** = meestal alleen de achternaam ("Wessels", "Ter Avest", "Vd Velden"), soms een bedrijf
  ("Ten Zende Hovenier", "Pouw accountent") of een omschrijving ("Schoonouders Coskun").
- **Telefoon** in wisselende vormen: `Tel:+31 6 11962752`, `Tel: 0610036794`, `Tel; 06 44383055`,
  twee nummers met `/`, en een keer met een regelafbreking in de cel.
- **Meerdere vloeren** bij één klant = **extra rijen eronder met alleen m² en vloer** (Braamhaar:
  70 m² P620 Smoky + 45 m² P420 smoky; Schuinder: 3 rijen, met BG/1e in kolom K).
- **Vloer** = het stuk vóór de eerste `|` van de offerteregel, vaak ingekort ("P610 Natural Oak").
  Soms met extra info: "| Voorraad", "Weense punt met band GEEN bies".
- **Plint** met maat en kleur en soms voorraad: "90x12 zwart (20 lengtes voorraad)", "65m1 -
  120x12 9010", "Geen plint (mail 11 januari)", "Alleen plinten plaatsen. Klant heeft plint".
- **Trap**: "Traprenovatie P470 dark oak | zwarte profielen", "Trap Livo Warm Oak | RVS profielen
  voor en achter | Open trap", "2x trap met tapijt touch of mistyque 191".
- **Mat**: "Mat taupe 553-070", "Entreemat exclusive. kleur?".
- **Klussen zonder vloer** komen ook voor: alleen egaliseren, sleuven dichten (50 m²),
  vloerverwarming frezen, uitvlakken keukenvloer, alleen plinten plaatsen.
- **Eén klant meerdere keren** (Groteboer in week 4 én week 5): verschillende fases van dezelfde
  klus (sleuven dichten → egaliseren → leggen).

## Ontwerp (voorstel, nog niet afgestemd)

**Route.** Teamleader-webhook → **n8n** → Google Sheets. Niet via dit dashboard.
- n8n krijgt een **eigen Teamleader-integratie** (generieke OAuth2 API-credential, eigen refresh
  token). **Nooit** de token van het dashboard delen: Teamleader roteert de refresh token bij elke
  refresh, twee eigenaren = ingetrokken token (zie `ARCHITECTURE.md`, incident 2026-09-12).
- Trigger: `quotation.accepted` (rij aanmaken) en `deal.updated` (datum uitvoering gewijzigd).
  De datum uitvoering is het deal-custom-field `CF_DATUM_UITVOERING`
  (`lib/teamleader/constants.ts`).

**Van offerte naar kolommen.**

| Kolom | Bron in Teamleader | Let op |
|---|---|---|
| Naam | contact (achternaam) of bedrijf van de deal | Jan schrijft alleen de achternaam; bevestigen |
| Telefoon | telefoon van het contact | kan meerdere nummers hebben |
| Plaats | adres van de klant, of werkadres als dat afwijkt | welk adres? (open vraag) |
| m² | aantal op de vloerregel | per vloerregel een eigen rij, zoals Jan nu doet |
| K | m² van vloerregels **zonder legservice** in K i.p.v. J | dezelfde regel als `laborRule = 'excluded'` in `lib/teamleader/matching.ts` |
| Vloer | omschrijving vóór de eerste `\|` | dezelfde bewerking als `deriveProductName` |
| Plint/Trap/Mat | overige-productregels | herkenning zoals `classifyExtra` in `lib/extras.ts` |

> De herkenning van vloer, legservice en overige producten bestaat al in deze repo en is getoetst
> op alle echte regelteksten. Niet opnieuw raden in n8n: of n8n roept een endpoint van het
> dashboard aan dat de rijen al kant-en-klaar teruggeeft (alleen lezen uit Supabase, geen
> Teamleader-token nodig), of de patronen worden letterlijk overgenomen. Voorkeur: endpoint.

**Spelregels voor schrijven in de Sheet.**
- n8n **schrijft alleen in G–M** (en een verborgen sleutelkolom). A–F en "Wie/Wanneer" zijn van
  de planner en worden nooit aangeraakt.
- **Verborgen kolom met het Teamleader-offerte-id** per rij, zodat een tweede webhook de rij
  terugvindt in plaats van een dubbele aan te maken.
- **Nooit rijen verwijderen of verplaatsen** zonder afspraak; de planner kan er al aan gewerkt
  hebben. Bij een gewijzigde datum: eerst afspreken wat er moet gebeuren (open vraag).
- Nieuwe rijen moeten **boven** het totaal m² en buiten de Afspraken-vlakken landen; gewoon
  "append" onderaan de tab werkt dus niet. Voorstel: een vast blok "Nog in te plannen" bovenaan
  elke maandtab.

## Open vragen (aan Jan)

1. **Toegang tot de echte Sheet** (link, gedeeld met Jasper): welke indeling klopt, die van de
   toelichting (A–E dagen, M = plint/mat/trap samen) of die van de januari-tab?
2. **Tabnamen**: precies hoe heten ze ("Januari 2026"?) en wie maakt een nieuwe maandtab aan?
3. **In welke maand** komt een klus bij akkoord als er nog **geen datum uitvoering** is? De maand
   van akkoord, de volgende maand, of een aparte tab "Nog in te plannen"?
4. **Doorschuiven**: als de datum uitvoering in Teamleader verandert, moet de rij dan mee naar de
   andere maandtab, alleen gemarkeerd worden, of niets?
5. **Vervallen klus** (deal verloren/geannuleerd): rij doorstrepen, markeren of laten staan?
6. **Plaats**: woonadres of werkadres (nieuwbouw)?
7. **Plint/Trap/Mat**: één kolom of drie?
8. **Wat n8n níet hoeft**: Afspraken, afwezigheid, weekindeling blijven handwerk — bevestigen.

## Stappen

1. Jasper: in n8n een OAuth2 API-credential aanmaken en de OAuth Redirect URL doorsturen.
2. Jan of Jasper (met beheerrechten): een aparte Teamleader-integratie "n8n planning" aanmaken
   met die redirect URL.
3. Open vragen hierboven beantwoord + toegang tot de Sheet.
4. Endpoint in het dashboard dat per offerte de planningsrijen teruggeeft (lezen uit Supabase).
5. n8n-flow: webhook → endpoint → Sheet (upsert op offerte-id).
6. Webhooks registreren in Teamleader.

Later ook via n8n: werkbon/servicebon.
