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

> Dit is de **oude** indeling (jan–jun). Vanaf juli geldt Jans toelichting; zie "Echte indeling".

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

## Echte indeling — uit de export van 2026-11-19

Bestand: **Planning '26** (eigenaar info@vloeruniq.nl, Jasper bewerker als jaspervdheide@gmail.com).
Origineel `16jKiKf5c5MCIcEQ0CvpIOR4tnC7qzR2NqaqzMuN6Xto`, testkopie
`1fzP--ApMv3PUPUNBusdg6_YtpG-UnFVq4zXlSh2ffSw` (eigendom Jasper; n8n schrijft alleen hierin tot live).

**Tabs:** `Jan 26` … `Jun 26`, `Jul 26`, `Aug 26`, `Sept 26`, `Okt 26`, `Nov 26`, `Dec 26`, `2027`,
`Geen datum`, `Totalen`, `Bronbestand`. Let op: "Sept", niet "Sep"; "Mrt", "Mei", "Okt".

**Twee kolomindelingen.** Vanaf juli is de indeling veranderd; de twee verschillen in de paste en
Jans toelichting kwamen daarvandaan.

| | Jul 26 t/m Dec 26 (nieuw) | Jan–Jun 26, `2027`, `Bronbestand` (oud) | `Geen datum` |
|---|---|---|---|
| Dagen | A–E = Ma–Vr (A1 leeg = maandag) | A = Planning (vrije tekst) | — |
| Opmerkingen | F | B, C | A, B |
| Naam / Tel / Plaats | G / H / I | D / E / F | C / D / E |
| m² incl. snijverlies | **J** | G | F |
| Verdieping / m² zonder legservice | K | H | G |
| Vloer | L | I | H |
| Plint / Trap / Mat | **M (één kolom)** | J / K / L (drie) | I / J / K |
| Wie / Wanneer | — | M / N | L / M |

Kolommen rechts van M (N–AM) bevatten in sommige tabs restanten van kopiëren/plakken
(bv. Nov rij 46, 55). Negeren.

**Blokken binnen een maandtab** (te herkennen aan kolom A en de achtergrondkleur):
- `Week 45` enz. in kolom A, grijs `#F3F3F3` = kop van een week.
- `Afspraken` in kolom A, grijs `#F3F3F3`, 3 rijen = inspecties/opnames (alleen Nov en Dec).
- `Overig` in kolom A, lichtgrijs `#EFEFEF` = **klussen zonder specifieke week**: dit is waar Jan
  een klus "voorlopig in een maand" zet. Ontbreekt in `Jan 26` en `Nov 26`.
- Afwezigheid: losse tekst in A/B, meestal fel groen `#00FF00` of `#E6B8AF`.
- Groen `#D9EAD3` / `#B6D7A8` op klusrijen = handmatige status (bv. "Factuur kan weg"); oranje
  `#FF9900` = "Bellen". Betekenis per kleur niet bevestigd; n8n raakt kleuren niet aan.
- Meerdere vloeren = vervolgrijen met alleen J (m²), K (verdieping) en L (vloer).
- Totaal: `=SUM(J<eerste>:J<laatste>)` onder de laatste rij; `Totalen` verwijst per maand naar die
  cel (`'Nov 26'!J80`). **Het SUM-bereik loopt niet altijd door tot onder Overig** (Aug: `J5:J58`,
  Overig op rij 53 — rijen 59+ tellen niet mee). Een rij die n8n buiten het bereik schrijft, valt
  dus uit het maandtotaal.

**Tab `Geen datum`** bestaat al (oude indeling, verschoven, 1 klus). **Tab `2027`**: oude indeling,
in kolom A vrije tekst als "Feb '27", "2e kwartaal 2027", "begin mei".

**Gevolgen voor het ontwerp**
- **Plaatsing (besluit, geen vraag aan Jan):** datum uitvoering bekend in 2026 → het `Overig`-blok
  van die maandtab; in 2027 → tab `2027`; geen datum → tab `Geen datum`. Wordt in de
  schaduwperiode met Jan gecontroleerd.
- **Schrijven in lege rijen, niet invoegen:** de Google Sheets-node van n8n kan geen rij midden in
  een tab invoegen. n8n leest de tab, zoekt het blok, schrijft in de eerste lege rij daaronder
  (G en J leeg) die nog binnen het SUM-bereik valt, en meldt het als er geen plek meer is.
- **Alleen de nieuwe indeling** (Jul–Dec) en `Geen datum`/`2027` hoeven ondersteund te worden;
  klussen in het verleden worden niet meer aangemaakt.
- **Naam**: vaak voor- en achternaam of bedrijf ("Stijn Eikenaar", "BAT Rijssen", "Autohandel
  Rensink"), soms met adres ("Jansen Eupe, verlengde oranjestraat 36"). **Telefoon** als `Tel: 06…`.
- **M (Plint/Trap/Mat)** in één cel, gescheiden door ` | ` of ` / ` ("120x12 RAL9010 | Entreemat
  Classic taupe 2 st", "70m1 70x12 plint en 2 trappen 26 treden P730").
- **n8n-credential Google:** n8n Cloud's beheerde Google-login werkt alleen in de Google Sheets-node,
  niet in de HTTP Request-node ("This credential is configured to prevent use within an HTTP
  Request"). Credential: `Google Sheets account` (jaspervdheide@gmail.com); later omzetten naar
  info@vloeruniq.nl.

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

## Gebouwd — endpoint `POST /api/planning` (2026-11-19)

`lib/planning-sheet.ts` (zuiver, getest in `tests/planning-sheet.test.ts`) + `app/api/planning/route.ts`.

**Invoer** (JSON): `naam`, `plaats`, `telefoon`, `datumUitvoering` (YYYY-MM-DD of leeg) en
`quotation` = de `data` van Teamleader `quotations.info` (of `lines` al plat). n8n haalt die op met
zijn eigen Teamleader-token; het endpoint praat nooit zelf met Teamleader en leest geen database.

**Uitvoer**: `target` `{ tab, block, layout }`, `rows` = per rij `{ kolomletter: waarde }`,
`overigWerk` (sleuven, vloerverwarming, fermacell, verwijderen — voor Opmerkingen, niet geschreven).

**Beveiliging**: `Authorization: Bearer <sleutel>`. Sleutel maken: `npm run planning:token` → sleutel
in `.env.local` (`PLANNING_API_SECRET`), alleen de sha256-hash in Supabase
(`app_settings.planning_api`), daar leest productie hem. Los van `CRON_SECRET`. `proxy.ts` laat
alleen dit pad zonder sessie door.

**Waarom de ruwe offerteregels** en niet de opgeslagen offerte: (1) plint staat vaak met €0 op de
offerte ("op nacalculatie") en de sync bewaart geen regels van €0; (2) de webhook komt op het moment
van akkoord, de sync pas later.

**Regels** (elk getoetst tegen Jans echte rijen):
- Eén rij per vloerregel, niet samengevoegd: offertes zetten dezelfde vloer per verdieping op een
  eigen regel (46 + 46 m²) en Jan maakt daar ook twee rijen van. Verdieping (K) blijft handwerk.
- Vloer zonder legservice → m² in K, J leeg (telt niet mee in het maandtotaal).
- Vloernaam = deel vóór de eerste `|`. Jan kort vaak in ("P420 Brown"); wij laten de volle naam staan.
- M = plint, trap, mat (`classifyExtra`), met aantal: `70m1 …`, `… (26 treden)`, `2x …`. Een plint
  van €0 naast dezelfde plint mét aantal telt één keer. Tapijt per m² krijgt een vloerrij.

**Vergelijking met Jans Sheet** (Jul–Dec 26 + 2027 + Geen datum; 177 rijen, per offerte de
volledigste rij; script in scratchpad, niet in de repo):
- 124 van 146 klussen gekoppeld aan een offerte op naam (de rest: projectklanten als "Chinees",
  "Klus via Avanta", fases zonder offerte).
- **81% van Jans m²-rijen** (115/142) komt binnen 1 m² terug. De rest is Jans eigen aanpassing
  (opgemeten, afgerond, andere versie van de offerte) of een offerte per kamer die Jan samenvoegt.
- **Kolom M**: Jan had iets en wij niets bij 3 van 69 klussen (was 33 vóór de €0-regels meetelden).
- Gevonden bug, apart op te pakken: regels die met **"Click PVC"** beginnen zonder P-nummer worden
  niet als vloer herkend (`FLOOR_TYPE_RE` kent alleen "klik"). Raakt ook m² en marge in het
  dashboard (o.a. offerte 1241, "Click PVC Tegels Basic Natural"); fixen met de margediff.

## n8n-flow — status 2026-11-19

Workflow **"Planning – offerte geaccepteerd → Sheet (TEST)"** (`buYLH9yMcyY3mZNn`), nog **inactief**:
Teamleader webhook (`quotation.accepted`) of handmatige test → quotations.info → deals.info →
contacts/companies.info → *Gegevens samenvoegen* (naam, plaats, mobiel, Datum uitvoering,
spreadsheetId) → `POST /api/planning` → tabs lezen → tab kiezen (op `tabKey`) → tab lezen
(grid A1:M400 met notities en formules) → `POST /api/planning/plaats` → als nog niet aanwezig:
`spreadsheets/{id}:batchUpdate`.

Credentials in n8n: `Teamleader - OAuth` (eigen integratie "n8n"), `Google - OAuth API` (eigen
Google-client, jaspervdheide@gmail.com), `Vloeruniq dashboard (planning)` (header auth).

Getest op de testkopie met offerte 1151 (Zonnebelt): rij 52 direct onder Overig in `Dec '26`,
maandtotaal schoof mee (1256,5), notitie met offerte-id; tweede run schreef niets (dubbel-check).

**Verplaatsen bij een gewijzigde Datum uitvoering** (besluit Jasper 2026-11-19, gebouwd zelfde dag):
`deal.updated` → geaccepteerde offerte van de deal → zelfde keten met `mode: wijziging`.
`placeJob` zoekt de klus in álle tabs op de notitie (`teamleader:<offerte>` of `deal:<deal>`; aantal
rijen uit `rijen:n`). Zelfde tab → niets. Andere tab → nieuwe rijen onder Overig van de nieuwe maand
(G–M vers uit Teamleader, Opmerkingen mee), oude rijen verwijderd, notitie "Verplaatst van …".
A–E van de oude maand gaan bewust niet mee. Niet gevonden bij een wijziging → niets (Jans eigen
klussen hebben geen notitie en worden nooit aangeraakt). Getest heen en terug (Dec ↔ Nov) met de
`testDatum` in de node *Testofferte*; `Nov '26` heeft geen Overig-blok → onderaan, binnen het totaal,
met waarschuwing.

Nog te doen vóór livegang:
1. Webhooks registreren in Teamleader (`quotation.accepted` en `deal.updated`, via de n8n-token) en workflow activeren.
2. Foutmelding als een run mislukt (bv. maandtab bestaat nog niet) → mail of Slack aan Jasper/Jan.
3. Schaduwperiode: twee weken op de testkopie, vergelijken met wat Jan zelf in het origineel typt.
4. Dan: spreadsheetId naar het origineel, Google-credential naar info@vloeruniq.nl (instructie hieronder).
Bewust niet in versie 1: vervallen klussen, overig werk in F.

## Google-koppeling — eigen OAuth-client (en later de instructie voor Jan)

**Waarom geen standaard Google-login van n8n Cloud.** Die werkt alleen in de Google Sheets-node, en
die schrijft op kolomKOP, niet op kolomletter. In Jans Sheet gaat dat mis: kolom K heeft geen kop,
de kop van M verschilt per maand ("Plinten/Trap/Mat" jul/aug, "Plint/Trap/Mat" daarna), en de node
kan geen rij invoegen (nodig om binnen het `SUM`-bereik van het maandtotaal te blijven). Met een
eigen OAuth-client gebruikt n8n een HTTP Request-node op de Sheets API: schrijven per celadres
(`values.batchUpdate`) en rijen invoegen (`batchUpdate` → `insertDimension`).

**Nu (test)**: opgezet door Jasper op jaspervdheide@gmail.com, schrijft in de testkopie.
**Bij livegang**: Jan doet dezelfde stappen op **info@vloeruniq.nl** (eigenaar van de Sheet), zodat
de koppeling niet afhangt van Jaspers account. De workflow blijft gelijk; alleen de credential in
de Sheets-nodes wordt vervangen.

Stappen (worden aangevuld terwijl Jasper ze doorloopt; dit wordt Jans instructie):
1. https://console.cloud.google.com, ingelogd met het Google-account dat de Sheet mag bewerken →
   projectkiezer → **Nieuw project** → naam `Vloeruniq n8n` → Maken.
2. Met dat project geselecteerd: ☰ → **APIs & Services → Library** → **Google Sheets API** →
   **Enable** (direct: https://console.cloud.google.com/apis/library/sheets.googleapis.com).
3. ☰ → **APIs & Services → OAuth consent screen** (heet nu **Google Auth Platform**) → **Get started**:
   App name `Vloeruniq n8n`, User support email = eigen adres, Audience **External**, Contact
   information = eigen adres → voorwaarden aanvinken → **Create**.
4. Eerst **Branding**: naast naam en e-mail zijn voor publiceren verplicht: Application home page
   `https://www.vloeruniq.nl/` en privacy policy `https://www.vloeruniq.nl/privacy-policy/`
   (bestaan allebei; gecontroleerd 2026-11-19). Zo nodig `vloeruniq.nl` bij Authorized domains.
   Logo en terms leeg laten. "Internal" kan niet: alleen voor Google Workspace, niet voor gmail.
   Dan Google Auth Platform → **Audience** → Publishing status **Testing** → **Publish app** → Confirm
   → **In production**. Nodig: in Testing verloopt de koppeling na 7 dagen. Verificatie door Google
   is niet nodig (alleen eigen gebruik); bij inloggen verschijnt "Google heeft deze app niet
   geverifieerd" → **Geavanceerd → Ga naar Vloeruniq n8n**.
5. Google Auth Platform → **Clients** → **Create client** → Application type **Web application**,
   naam `n8n`, Authorized redirect URI `https://oauth.n8n.cloud/oauth2/callback` → **Create**.
   Google toont het **Client secret maar één keer**: venster open laten of **Download JSON**.
   Niet mailen of in een chat plakken; direct in n8n invullen (volgende stap).
6. In n8n een **generieke OAuth2 API-credential** (zit niet in de credentiallijst; aanmaken vanuit
   een HTTP Request-node: Authentication *Generic Credential Type* → *OAuth2 API* → **Connect to**):
   naam `Google Sheets (…)`, Grant Type **Authorization Code**, Authorization URL
   `https://accounts.google.com/o/oauth2/v2/auth`, Access Token URL `https://oauth2.googleapis.com/token`,
   Client ID/Secret uit stap 5, Scope `https://www.googleapis.com/auth/spreadsheets`, Auth URI Query
   Parameters `access_type=offline&prompt=consent` (zonder deze twee geen blijvende koppeling),
   Authentication **Send Credentials in Body** → **Connect** → inloggen → bij "niet geverifieerd":
   Geavanceerd → Ga naar Vloeruniq n8n → Toestaan.
   Test: workflow "Google Sheets – verbinding testen" (Z8CI922wC9Z8qBXk) leest de tabnamen.

## Open vragen

Alleen gevraagd wat niet uit de Sheet of de data te halen is (2026-11-18):
- **Admin-rechten** in n8n en **toegang tot de Sheet** (voorwaarde).
- ~~Klus zonder datum: welke tab?~~ Beantwoord door de Sheet zelf: `Overig`-blok / tab `Geen datum`.

Zelf uit te zoeken zodra de Sheet gedeeld is: welke kolomindeling klopt, tabnamen, plint/trap/mat
in één of drie kolommen, welk adres als plaats (vergelijken met Teamleader). Bewust **niet in
versie 1** (dus nu niet gevraagd): doorschuiven bij een gewijzigde datum en vervallen klussen;
versie 1 maakt alleen rijen aan en raakt verder niets aan.

## Stappen

1. Jasper: in n8n een OAuth2 API-credential aanmaken (n8n Cloud redirect: https://oauth.n8n.cloud/oauth2/callback).
2. Jan of Jasper (met beheerrechten): een aparte Teamleader-integratie "n8n planning" aanmaken
   met die redirect URL.
3. Open vragen hierboven beantwoord + toegang tot de Sheet.
4. Endpoint in het dashboard dat per offerte de planningsrijen teruggeeft (lezen uit Supabase).
5. n8n-flow: webhook → endpoint → Sheet (upsert op offerte-id).
6. Webhooks registreren in Teamleader.

Later ook via n8n: werkbon/servicebon.
