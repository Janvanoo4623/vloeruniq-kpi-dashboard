# Roadmap & build status

Phased build. Status updated as we go.

## Phase 0 — Foundation & docs ✅
- [x] Scaffold Next.js 16 + TS + Tailwind 4.
- [x] Documentation (this `docs/` set + `CLAUDE.md`, `README.md`).
- [x] `.env.example`, gitignore for `.env.local` and `.data/`.

## Phase 1 — Teamleader data layer (`lib/`)  ⏳
- [ ] `lib/store.ts` — pluggable datastore (file | Upstash) for token / snapshot / meta / config.
- [ ] `lib/teamleader/auth.ts` — token refresh with rotation + persistence.
- [ ] `lib/teamleader/client.ts` — POST JSON client, pagination, 429 backoff, bounded concurrency.
- [ ] `lib/teamleader/price-map.ts` — default price map (ported `DEFAULT_PRICE_MAP`).
- [ ] `lib/teamleader/matching.ts` — floor-line detection, P-number/name match, margin.
- [ ] `lib/teamleader/quotations.ts` — fetch + parse quotations.
- [ ] `lib/teamleader/deals.ts` — customer lookup, won deals, run-time, write-back.
- [ ] `lib/teamleader/aggregate.ts` — weekly KPIs + lead sources → snapshot.
- [ ] `lib/teamleader/sync.ts` — orchestrates the whole pipeline.
- [ ] `lib/types.ts` — shared types (Snapshot, Quotation row, etc.).

## Phase 2 — API routes + sync job
- [ ] `scripts/sync.ts` + `npm run sync` (local, no timeout).
- [ ] `app/api/sync/route.ts` (cron + manual, `maxDuration`, lock, `CRON_SECRET`).
- [ ] `app/api/snapshot/route.ts`, `app/api/refresh/route.ts`.
- [ ] `app/api/login` + `app/api/logout`, `proxy.ts` password gate, `app/login/page.tsx`.
- [ ] `vercel.json` cron.

## Phase 3 — Dashboard UI
- [ ] KPI cards (revenue accepted/open, conversion, m², margin, avg run time, deals tracked).
- [ ] Weekly revenue bar chart (accepted vs open).
- [ ] Conversion + counts panel.
- [ ] Margin trend (€ and %) line/area.
- [ ] Lead-source donut.
- [ ] Run-time trend.
- [ ] Quotations table (sortable, status + verified badges, margin coverage).
- [ ] Refresh button + "last updated" indicator; loading/empty states; dark mode.

## Phase 4 — Verify & deploy
- [ ] Seed token; run a real sync; cross-check totals vs `DATA-MODEL.md` reference values.
- [ ] `npm run build` clean.
- [ ] Vercel project + Upstash + env + cron; client opens URL behind password.
- [ ] Regenerate `TEAMLEADER_CLIENT_SECRET`.

## Later / nice-to-have
- [ ] In-app price-map editor (Config-tab equivalent).
- [ ] Month/quarter views (data already carries month/quarter/year).
- [ ] Per-quotation drill-down (line items + which lines matched).
- [ ] Sync history / error log surfaced in the UI.
- [ ] CSV export.

## Marketing (Google Ads) — 2026-09-16
- [x] `ads_daily` + `ads_sync_meta` in `supabase/schema.sql`; `npm run sync:ads` (TrueClicks MCP of `--from-json`).
- [x] Tabblad Marketing: kosten/klikken/CTR/CPC/conversies met periodefilter en vergelijking, per week, per campagne, maandbudget, marge na Google Ads. Ook in het exportrapport.
- [x] Migratie gedraaid en historie geïmporteerd (2024-11-01 t/m 2026-09-15, 3.001 rijen).
- [x] Vernieuwen-knop en cron verversen Google Ads mee (GAQL.app REST, `lib/ads-sync.ts`).
- [x] `GAQL_TOKEN` lokaal (de MCP-URL van GAQL.app); 3-daagse test geslaagd op 2026-09-16.
- [x] Koppeling in Supabase gezet met `npm run ads:token` (geen Vercel-rechten nodig).
- [ ] Vernieuwen op productie proberen en `ads_sync_meta` controleren.
- [ ] Later: andere marketingkosten (social, drukwerk) als handmatige maandpost naast Google Ads.

## Feedback 17 september 2026
- [x] Overzicht: pijltjes met % verschil tegenover de even lange periode ervoor, altijd aan.
- [x] Overzicht: verloop-grafiek met aan/uit te zetten KPI's, eigen as per eenheid, week/maand.
- [x] Trends: openstaande stapel per week (€, aantal, gemiddelde leeftijd, ouder dan 60 d).
- [x] Meta Ads voorbereid: uitlezing, opslag per platform, Vernieuwen/cron, tabblad per kanaal, kaarten op Overzicht, export.
- [x] Migratie gedraaid.
- [x] Meta gekoppeld 2026-09-17: account 1133369954486650 (Business Manager 191283362264924), systeemgebruiker "Vloeruniq dash" op app "Dashboard", alleen `ads_read`. 164 dagregels, eerste campagne 2026-04-08. Totalen cent-gelijk aan Meta.
- [x] Action-types gecontroleerd: `lead` (23) = pixel-lead (19) + lead_grouped (4), dus één keer tellen klopt.
- [ ] Met Jan checken of leadbron "Social media" alleen betaalde Meta-leads zijn of ook organisch.
- [x] Moneybird-koppeling (2026-10-15): pagina Resultaat, kosten per grootboekrekening uit de W&V, omzet uit Teamleader.


## Idee: conversies terugkoppelen naar Google en Meta (click-ID tracking)
Doel: Google Ads en Meta niet alleen op "formulier ingevuld" laten sturen, maar op wat er
daarna gebeurt — offerte gewonnen, gefactureerd, marge. En in het dashboard per campagne
kunnen zien wat er écht uit komt, in plaats van via de grove leadbron in Teamleader.

- [ ] Website: bij een aanvraag `gclid` (Google, ook `gbraid`/`wbraid`) en `fbclid` + de
      `_fbc`/`_fbp`-cookies (Meta) uitlezen en als verborgen velden meesturen met het formulier.
      Ook `utm_campaign` meenemen. Uitzoeken wie de website/formulieren beheert.
- [ ] Teamleader: eigen velden op de deal (of contact) voor click-ID, cookies, campagne en
      aanvraagdatum; het formulier moet die vullen. Sync leest ze mee (`deals.info` custom fields).
- [ ] Dashboard: deal ↔ campagne koppelen via de click-ID → omzet en marge per campagne,
      tijd van klik tot akkoord tot factuur. Vervangt de leadbron-aanname "Social media = Meta".
- [ ] Google: offline conversies terugsturen (Offline Conversion Import of Enhanced Conversions
      for Leads) bij "offerte gewonnen" met de omzet of marge als waarde. Klik-ID's verlopen na
      90 dagen, dus binnen die termijn uploaden; consent mode/AVG checken.
- [ ] Meta: Conversions API-events (bijv. `Purchase` of een eigen "offerte gewonnen") met
      `fbc`/`fbp` + gehashte e-mail/telefoon. Kan pas als de Meta-koppeling weer werkt
      (sinds 2026-09-18 "API access blocked") en vraagt extra rechten naast `ads_read`.
- [ ] Daarna in Google/Meta optimaliseren op deze conversies (waarde-gebaseerd bieden) i.p.v. op formulierleads.

Afhankelijk van: toegang tot de website-formulieren, eigen velden in Teamleader, Meta weer
ontgrendeld. Werkt pas vooruit: historische deals hebben geen click-ID.

## Moneybird — vervolg
- [ ] Loonkosten: waar worden die geboekt? (staan niet in Moneybird)
- [ ] Google/Meta-afschrijvingen boeken op reclamekosten, anders is het resultaat te rooskleurig.
- [ ] Startmaand bijstellen zodra de boekhouding vanaf eerder compleet is.
- [ ] Resultaat ook in het exportrapport (`/export`).

## Premiumronde — 2026-10-16
- [x] Overzicht: briefing, belijst, maanddoel, tegels met sparklines, rustige pijltjes, presets in de verloopgrafiek.
- [x] Belijst op Pijplijn, break-even op Resultaat, cashprognose op Cashflow, capaciteit op Planning, prijsgevoeligheid op Marge.
- [x] Markt op Trends (CBS consumentenvertrouwen en invoerprijzen).
- [x] Merk: logo, favicon, loginpagina met eigen vloer. Laadbalk en optellende hoofdgetallen.
- [ ] Google-reviews (eigen + concurrenten) — vraagt een Google Places API-sleutel.
- [ ] Wekelijkse samenvatting per mail/WhatsApp aan Jan.
- [ ] Maanddoelen invullen (Jan), capaciteit in m²/week invullen (Jan).
- [ ] Inkoopfacturen in Moneybird afletteren — 12 stuks (€61k) staan nog 'te laat', vertekent de cashprognose.

## Restyle "Vloeruniq zwart + groen" — 2026-10-19
- [x] Overzicht: begroeting, zwarte statement-kaart, bento-kaarten, pilstaafjes, hoofdgrafiek met gemarkeerde staaf.
- [x] Navigatie 15 → 9 onderdelen (`SIDEBAR` in `lib/nav.ts`), met pilschakelaar (`SubNav`) tussen de pagina's van een onderdeel. Oude adressen blijven werken.
- [x] Hele app: accent = zwart, grafieken = merkgroen, kaarten = bento, knoppen en schakelaars = pillen, grotere KPI-getallen.
- [ ] Periodekiezer en Instellingen-kaarten nog in de oude vorm.
- [ ] Per pagina één zwarte statement-kaart voor het kerngetal (Resultaat, Marketing, Cashflow)?

## Elke pagina in het sjabloon — 2026-10-19/20
Elke pagina: (1) zwarte statement-kaart met het kerngetal (`components/page/HeroCard`) naast "In het kort"
(`InsightCard`) of een actielijst; (2) hooguit vier tegels (`StatTile`); (3) één hoofdgrafiek
(`components/page/HighlightChart`: rechte staven, ronde bovenhoeken, effen grijs, raster, nullijn,
gemarkeerde staaf met ballon); (4) "Verdieping" (`DetailsLabel`) met de bestaande tabellen en grafieken.
- [x] Overzicht, Financieel (Resultaat, Marge, Cashflow), Planning, Verkoop (Pijplijn, Offertes, Verloren),
      Controleren (Te doen, Uitzonderingen), Marketing (Kanalen, Leadbronnen), Klanten (Klanten, Regio), Trends.
- [x] Planning: weken werk, agenda 3 weken, gewonnen-niet-ingepland (`lib/planning.ts`).
- [x] Zwart = bediening (knoppen, navigatie), merkgroen = data (balken, gemarkeerde staaf).
- [ ] Instellingen heeft geen statement-kaart (werkpagina); alleen restyle.
- [ ] Offertes toont "conversie" over de periode (gewonnen/beslist), Pijplijn "winkans" over de
      uitgeharde historie — twee definities naast elkaar; eventueel één naam/uitleg kiezen.
