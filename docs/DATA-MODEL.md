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
laborRule = "excluded" if  /\b(excl\.?|exclusief|zonder)\s*(het\s+)?leg(gen|service)?\b
                           |\balleen\s+(leveren|levering)\b/i
            "included" elif /\bleg(gen|service)\b|\bgelegd\b/i
            "unknown"  else
laborPerM2 = 0 if laborRule == "excluded" else LABOR_COST_PER_M2
laborCost += laborPerM2 * quantity
```

Measured on the 103 stored line descriptions: **94 included, 4 excluded, 5 silent**.
Median €/m² confirms the language — €51 installed vs €28 supply-only. The silent five
keep their labour but set `laborRule: 'unknown'`, which raises `needsReview` on the
quotation so it surfaces for a human instead of being guessed. Four of the five price
as supply-only; the fifth (€48,76/m²) does not — which is exactly why the rule flags
rather than assumes.

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

### Per-quotation manual corrections (overrides)

Feedback (2026-07-13) added two one-off, per-quotation corrections, stored in
`quotation_overrides` and applied at **read time** (`lib/overrides.ts`) so they
take effect **instantly and retroactively** — no re-sync, works on any stored
quotation regardless of age:

- **Special purchase price per floor line** (`prices[code] = €/m²`): overrides the
  matched purchase price for that one quotation only (e.g. the voetbalkantine
  800 m² special buy). Set per line code in the QuotationModal.
- **`no_labor` (los verkocht — geen legservice)**: drops the labour €/m² for a
  floor sold without installation.

Only quotations that have an override row are recomputed; every other quotation
keeps its synced margins untouched. Margins recompute from the per-line cost
components stored at sync time (`purchasePerM2` / `underlayPerM2` / `laborPerM2`);
rows synced before those existed fall back to the default constant rates + a
glued check on the line description (approximate until re-synced, exact after).

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
