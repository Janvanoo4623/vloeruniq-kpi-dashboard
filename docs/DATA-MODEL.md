# Data model & business logic

This is the faithful port of the Apps Script's computation. **When numbers must be verified,
they must match the Google Sheet `Overview` tab** (reference values at the bottom).

All terms are kept in the original Dutch where they are domain terms (`omzet` = revenue,
`vloer` = floor, `marge` = margin, `doorlooptijd` = run time, `leadbron` = lead source).

---

## Constants

```
LABOR_COST_PER_M2    = 17.00   # fixed labour cost per m²
PRIMER_COST_PER_M2   = 0.75    # primer for glued PVC
GLUE_COST_PER_M2     = 1.36    # Uzin KS2000 glue
LEVELING_COST_PER_M2 = 2.99    # Egaline C Cotap leveling cement
DAYS_LOOKBACK        = 90      # window for quotations + won deals
```

## Price map (the `Config` tab equivalent)

A list of `match → purchase price ex VAT per m²` entries, of two kinds:

- **P-numbers**: keys matching `^P\d{3}$` (e.g. `P620 → 11.85`). Matched against the regex
  `P\d{3}` found anywhere in a line-item description.
- **Name matches**: free-text keys (e.g. `VT Wonen Herringbone Klik → 24.98`). Matched
  case-insensitively as a substring. **Sorted longest-first** so the most specific name wins
  (`VT Wonen Herringbone Klik` before `VT Wonen Herringbone`).

The full default map is in `lib/teamleader/price-map.ts` (ported from `DEFAULT_PRICE_MAP`).
It is editable at runtime via the stored config (see `lib/store.ts` → `getConfig/setConfig`).

---

## Revenue & margin (per quotation)

Quotations are fetched for three statuses over the lookback window:

| Status | Date filter | Date used for "relevant date" |
| --- | --- | --- |
| `accepted` | `updated_at >= cutoff` | `updated_at` (date accepted) |
| `open` | `created_at >= cutoff` | `created_at` |
| `refused` | `updated_at >= cutoff` | `updated_at` (date refused) |

`cutoff = today − 90 days`. For each quotation we pull `quotations.info` and walk every
`grouped_lines[].line_items[]`.

### Which line items count as "floor" (`vloer`)

A line item is included in floor revenue/m² if:

```
description does NOT contain "trap"          # exclude stair renovation (traprenovatie)
AND NOT ( description matches /kitt/i         # exclude "kitten langs wand" finishing lines,
          AND description has NO P-number )   #   but never a priced floor line
AND ( description matches /P\d{3}/i           # has a P-number
      OR description starts with one of:      # ^(pvc|visgraat|stroken|tegels|hongaarse|
         pvc, visgraat, stroken, tegels,      #   weense|klik|vt wonen)
         hongaarse, weense, klik, vt wonen )
```

> The finishing-line exclusion (`FINISHING_RE = /kitt/i` in `matching.ts`) was added
> after feedback (2026-07-13): offerte 1003 billed 254 m² = 159 m² vloer
> ("PVC Stroken P410 … incl. 6% snijverlies … lijmen en leggen") + 95 m²
> ("PVC vloer snijden en kitten langs wand"). The finishing line starts with a floor
> type and so was wrongly counted as extra floor. **Match `kitten` only — never
> `snij`:** every real floor line carries "incl. X% snijverlies", so a `/snij/`
> match zeroed all floor (fixed 2026-07-15). The P-number guard guarantees a priced
> floor line is never dropped even if its text mentions kit.

For each matched line item:
- `totalM2 += quantity`
- `omzetVloer += line.total.tax_exclusive.amount`

### Price match (for cost)

For each matched floor line, find a purchase price:
1. **P-number first**: take the first `/P\d{3}/` in the (uppercased) description; if it exists in
   the price map's P-numbers, use that price.
2. **Else name match**: first name entry (longest-first) whose text is a substring of the
   lowercased description.

If a price is found, compute material cost per m². The **install mode** decides the
underlay surcharge — a line gets exactly one of the three, never two:

```
installMode = "selfadhesive" if description matches /zelfklev/i    # 5.92
              "glued"        elif description matches /lijm/i      # 0.75 + 1.36 + 2.99
              "click"        else                                  # 0 — underlay is in the plank

materialCostPerM2 = matchedPrice + underlaySurcharge(installMode)
totalCost   += materialCostPerM2 * quantity
m2WithMatch += quantity
hasMatch     = true
```

> **Match `zelfklev`, never `ondervloer`** (added 2026-08-20). The only self-adhesive
> line in production spells it wrong — "Incl. zelfklevende **onvervloer**, en leggen" —
> so an `ondervloer` rule misses it, while hitting the six klik-PVC lines that read
> "met geïntegreerde 10db ondervloer", where the underlay is part of the plank and must
> **not** be charged. Wrong in both directions. `zelfklev` occurs nowhere else in the
> 103 real line descriptions. Same discipline as the `/snij/` lesson above.

### Labour (legservice)

Labour is **per line**, not a flat rate over all matched m² — a floor sold without
installation carries none. The exclusion is tested **before** the word "leggen"
itself, because `"excl. leggen klik pvc"` contains "leggen":

```
laborRule = "excluded" if  /\b(excl\.?|exclusief|ex\.?|zonder)\s*(het\s+)?leg(gen|service)?\b
                           |\balleen\s+(leveren|levering)\b/i
            "included" elif /\bleg(gen|service)\b|\bgelegd\b|\bmont(age|eren)\b/i
            "unknown"  else
laborPerM2 = 0 if laborRule == "excluded" else LABOR_COST_PER_M2
laborCost += laborPerM2 * quantity
```

Derived from **all 28 distinct "leggen/leveren" phrasings** in the 315 stored line
descriptions — not from a guess at what the text might say. Result: **279 included,
11 excluded, 25 silent**. Median €/m² confirms the language: ~€51 installed vs ~€28
supply-only.

> Note the bare **"Ex legservice"** (no "cl"). A pattern built on `excl` alone read it
> as installed and quietly charged €17/m² over 51 m². It was found by diffing margins
> before and after the first backfill and chasing the one change the rules did not
> explain — which is why that diff is part of the procedure, not an optional check.

The silent ones keep their labour but set `laborRule: 'unknown'`, which raises
`needsReview` on the quotation so it surfaces for a human instead of being guessed.
Most price as supply-only; at least one does not (€48,76/m²) — which is exactly why
the rule flags rather than assumes.

### Per-quotation margin

```
if hasMatch and m2WithMatch > 0:
    finalCost  = totalCost + laborCost
    cost       = round2(finalCost)
    margin     = round2(omzetVloer - finalCost)         # margin is on FLOOR revenue only
    marginPct  = round1(margin / omzetVloer * 100)
    matchCoverage = round1(m2WithMatch / totalM2 * 100)
    verified   = (matchCoverage == 100 and margin present)
prijsPerM2 = omzetVloer / totalM2
```

> **Important:** margin is computed against `omzetVloer` (floor revenue), **not** the full
> quotation total. Skirting boards, assembly, etc. are excluded from both cost and the revenue
> margin is measured against.

### Per-quotation row (for the table)

`[ id, name, dealId, customerName, status, dateCreated, dateAccepted, month, quarter, year,
   revenueExVat, revenueInclVat, omzetVloer, totalM2, prijsPerM2, cost, margin, marginPct,
   matchCoverage, verified ]`

`customerName` comes from the **customer lookup**: `deals.list` (won/open/lost) with
`include: lead.customer`, building `dealId → contact "first last"` or `company name`.

---

### Margins are computed at READ time (2026-09-09)

`lib/resolve.ts` recomputes every quotation's margin on each render, from the
price list and cost settings **as they applied on the quotation's date**. What
the sync stores is what was *sold* — description, m², revenue, install mode,
whether installation was included — not what it cost.

Before this, `matching.ts` froze purchase price, underlay and labour into each
line at sync time. A price you changed afterwards did nothing except for the
quotations the 90-day window happened to refetch. Jan lowered the labour rate
from €17 to €11 on 2026-08-25 and it reached 53 of 18,060 priced m².

Consequences:

- A price or cost edit is visible **immediately**, no sync and no backfill.
- `effective_from` decides how far back it reaches: Instellingen offers *vanaf
  vandaag*, *met terugwerkende kracht* (2000-01-01) or a date you pick.
- Two rows with the same `effective_from`: the **last inserted** wins
  (`getPriceRows`/`getCostRows` order by effective_from, then id).
- The stored per-line components remain the floor: if no price row matches, the
  synced value still applies, so an empty price list can never silently zero
  every margin.

Verified against production on 2026-09-09: the resolver reproduced all 843
stored margins to the cent before the labour rate was backdated.

### Per-quotation manual corrections (overrides)

Feedback (2026-07-13) added two one-off, per-quotation corrections, stored in
`quotation_overrides` and applied at **read time** (now in `lib/resolve.ts`) so
they take effect **instantly and retroactively** — no re-sync, works on any
stored quotation regardless of age:

- **Special purchase price per floor line** (`prices[code] = €/m²`): overrides the
  matched purchase price for that one quotation only (e.g. the voetbalkantine
  800 m² special buy). Set per line code in the QuotationModal.
- **`no_labor` (los verkocht — geen legservice)**: drops the labour €/m² for a
  floor sold without installation.

Since 2026-09-09 a third kind exists: **free-field corrections** (`fields` jsonb
on the offerte-level row). Per quotation: revenue ex VAT, floor revenue, status,
created and decision date. Per floor line (keyed by position): product, m²,
revenue, underlay €/m², labour €/m². Empty means "take what Teamleader says".
Line corrections are ignored once the line count changes — the quotation was
revised in Teamleader and they no longer refer to the same rows.

Customer name, city and postcode are deliberately **not** editable: the customer
and region analyses key on them, and a hand-typed name would silently drift from
Teamleader.

Requires one manual migration: `alter table quotation_overrides add column if not
exists fields jsonb;`. Until it runs, everything keeps working and saving a field
correction returns a readable message instead of a database error.

## Run time (`doorlooptijd`)

From won deals (`deals.list` `status: won`, `updated_since: cutoff`), then `deals.info` each:

```
datumUitvoering = custom_field[CF_DATUM_UITVOERING]
doorlooptijd    = custom_field[CF_DOORLOOPTIJD]        # existing value, if any
leadbron[]      = custom_field[CF_LEADBRON]            # array, joined with ", "

skip if no datumUitvoering or no closed_at
runTimeDays = round((datumUitvoering − closed_at) / 1 day) + 1
skip if runTimeDays <= 0
```

Row: `[ dealId, title, dateAccepted(closed_at), dateExecution, runTimeDays, leadSource,
        month, quarter, year ]`

### Write-back to Teamleader

Mirroring the script, we `deals.update` the `doorlooptijd` (+ execution date + lead source)
back into Teamleader when:
- the deal is **new** to our tracking and `doorlooptijd` was empty, **or**
- the execution date **changed** since last sync (run time recomputed).

This keeps Teamleader's own reports consistent. Write-back is the only mutation this app makes.

---

## Weekly aggregation (the `Overview` tab)

Weeks use **ISO week** labels `YYYY-Www` (e.g. `2026-W25`), sorted **descending**.
The "relevant date" for a quotation is its accepted/refused date if set, else created date.

Per week, from accepted/open/refused quotations:
- `acceptedRevenue`, `openRevenue`, `refusedRevenue`
- `acceptedCount`, `openCount`, `refusedCount`
- `acceptedM2`
- `acceptedMargin`, `acceptedMarginRev` (only quotations that have a margin contribute)

Per week, from run-time rows (keyed by accepted date / `closed_at`):
- `totalDays`, `count`

Derived KPIs (per week and as grand totals):
```
conversionPct     = acceptedCount / (acceptedCount + refusedCount) * 100
avgRevenuePerDeal = acceptedRevenue / acceptedCount
avgMarginPct      = acceptedMargin / acceptedMarginRev * 100
avgRunTimeDays    = totalDays / count
```

### Revenue per lead source

Accepted quotations only. Join each quotation's `dealId` to the lead source captured in the
run-time data (`dealId → leadSource`); unknown → `Onbekend`. A deal can list multiple sources
(comma-separated); revenue is counted once **per listed source**. Sorted by revenue desc.

---

## Marketing (Google Ads) — sinds 2026-09-16

Drie bronnen, bewust uit elkaar gehouden:

| Wat | Bron | Waar |
| --- | --- | --- |
| Kosten, klikken, vertoningen, **alle conversies** (`metrics.all_conversions`, op verzoek van Jan 2026-09-16: niet de hoofdkolom 'Conversies' maar alle conversieacties, ~5× zoveel) | Google Ads, per dag per campagne | tabel `ads_daily` (kolom `conversions`) |
| Omzet en marge "uit Google" | Teamleader: geaccepteerde offertes waarvan de deal leadbron **Google** heeft | `snapshot.quotations` + `runTimeRows`, `lib/ads.ts` `googleLeadStats` |
| Maandbudget | handmatig, tabblad Marketing | `app_settings.ads_budgets` (`{ default, 'YYYY-MM' }`) |

**Hoe de cijfers binnenkomen.** `lib/ads-sync.ts` haalt een GAQL-rapport op bij **GAQL.app**
(TrueClicks) en upsert dat in `ads_daily`. `GAQL_TOKEN` is óf de volledige URL van hun gehoste
MCP (`https://mcp.gaql.app/mcp/google-ads/<token>`, JSON-RPC over streamable HTTP — dit is wat
Jasper heeft, via het Loavies-account met het Vloeruniq-klantnummer) óf een los gptToken voor de
REST-API (`api.gaql.app`, wat hun npm-pakket onder water doet). Het rapport wordt geüpsert (`FROM campaign`, per `segments.date`, alleen
rijen met vertoningen). Dat gebeurt bij **Vernieuwen** (`/api/refresh`) en bij de **cron**
(`/api/sync`), parallel aan de Teamleader-sync: eigen bron, eigen tabel, géén Teamleader-lock.
Een Ads-fout staat in `ads_sync_meta.error` en in het antwoord, maar houdt Teamleader niet tegen.
Standaard de laatste 90 dagen t/m gisteren, want Google corrigeert achteraf (ongeldige klikken,
late conversies); rijen in het venster die de run niet opnieuw aanleverde worden verwijderd.
`npm run sync:ads` doet hetzelfde met de hand, verder terug (`--days`) of uit een opgeslagen
rapport (`--from-json`); zo is de historie vanaf 2024-11-01 geladen. Let op: het token geeft
toegang tot álle Google Ads-accounts van die TrueClicks-gebruiker; de app vraagt alleen
`GOOGLE_ADS_CUSTOMER_ID` op.

**Kosten** = `cost_micros / 1e6`, onafgerond opgeslagen; afronden gebeurt bij het optellen.
Gecontroleerd op 2026-09-16: de maandtotalen uit `ads_daily` zijn cent-gelijk aan het
klantniveau-rapport van Google voor alle 23 maanden.

**Kengetallen.** CTR = klikken / vertoningen; CPC = kosten / klikken; kosten per conversie =
kosten / alle conversies (`metrics.cost_per_all_conversions` in Google).

**Wat het oplevert.** Dezelfde koppeling als de leadbron-tabel: offerte → deal → leadbron.
Een deal met "Google, Mond op mond reclame" telt mee. Marge = som van de offertemarges (alleen
offertes mét marge; het aantal zonder inkoopprijs staat ernaast). Kosten per gewonnen deal =
Ads-kosten / gewonnen Google-offertes. **Rendement Google Ads** = marge uit Google-leads − kosten.

**Marge na marketing** = totale marge van de periode − Google Ads-kosten van dezelfde periode.
Google telt een conversie op de dag van het contact, Teamleader een gewonnen offerte op de
beslisdatum; die vallen zelden in dezelfde periode, dus over korte periodes is dit een indicatie.

**Budget.** Per maand, met een standaard voor maanden zonder eigen bedrag. Voor de lopende
maand wordt het tempo doorgetrokken (uitgegeven / dagen verstreken × dagen in de maand);
signaal: >110% van budget = boven budget, >100% = net erboven, anders binnen budget.

---

## Reference values (must match — from the current Sheet `Overview`)

Use these to validate `npm run sync` output. (They reflect a 90-day window as of mid-June 2026
and will change as data changes — treat the **method** as the contract, these as a snapshot.)

| KPI | Value |
| --- | --- |
| Revenue Accepted (total) | € 298 931,82 |
| Revenue Open (total) | € 105 253,39 |
| # Quotations Accepted | 68 |
| # Quotations Open | 22 |
| # Quotations Refused | 0 |
| Conversion Rate | 100,0 % |
| Avg Revenue per Deal | € 4 396,06 |
| M² Sold | 5 166 |
| Total Margin | € 55 922,26 |
| Avg Margin | 28,4 % |
| Avg Run Time | 66,8 days |
| # Deals Tracked | 43 |

Revenue per lead source:

| Lead source | Revenue (ex VAT) | # Deals |
| --- | --- | --- |
| Onbekend | € 136 144,28 | 26 |
| Google | € 87 195,28 | 21 |
| Mond op mond reclame | € 60 944,40 | 16 |
| Netwerk | € 17 981,73 | 5 |
| Social media | € 5 963,64 | 1 |
