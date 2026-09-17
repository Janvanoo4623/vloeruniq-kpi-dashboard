import Link from 'next/link';
import {
  getAllDeals,
  getAllInvoices,
  getAllQuotations,
  getAppSetting,
  getExclusions,
  getInvoiceAdjustments,
  getMeta,
  getResolveInput,
} from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';
import { snapshotForRange } from '@/lib/range';
import { computeAging, summarizeInvoices } from '@/lib/teamleader/invoices';
import { computePipeline } from '@/lib/pipeline';
import { customerAnalysis } from '@/lib/customers';
import { computeLost } from '@/lib/lost';
import { perM2Stats, planningOverview } from '@/lib/insights';
import { DEFAULT_KPI_SETTINGS, parseKpiSettings } from '@/lib/kpi-settings';
import { buildAdsPayload, PLATFORMS } from '@/lib/ads-payload';
import { leadStats, PLATFORM_LABEL, PLATFORM_SOURCE_LABEL } from '@/lib/ads';
import { formatDateTime, formatEuro, formatNumber, formatPercent, formatProduct } from '@/lib/format';
import type { InvoicingSummary, QuotationRow } from '@/lib/types';
import { STATUS_LABEL } from '@/components/QuotationModal';
import PrintKnop from '@/components/PrintKnop';
import CsvKnop from '@/components/CsvKnop';

export const dynamic = 'force-dynamic';

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().split('T')[0];

function verschuifJaar(datum: string, jaren: number): string {
  const d = new Date(`${datum}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + jaren);
  return d.toISOString().split('T')[0];
}

const LEEG_FACTURATIE: InvoicingSummary = {
  invoicedExcl: 0,
  paidExcl: 0,
  outstandingIncl: 0,
  invoiceCount: 0,
  paidCount: 0,
  openCount: 0,
};

/**
 * Het hele dashboard als één afdrukbaar rapport, één pagina per tabblad.
 *
 * Waarom een aparte pagina en niet "print het dashboard": de app is een schil
 * met een zijbalk, een periodekiezer en knoppen, en die horen niet op papier.
 * Bovendien staat elk tabblad achter een eigen route, dus printen betekende
 * veertien keer printen. Hier staat alles onder elkaar, met een pagina-einde per
 * tabblad, en de vergelijkingsperiode ernaast als die aanstaat.
 *
 * De cijfers komen uit dezelfde functies als het dashboard zelf — niets wordt
 * hier opnieuw uitgerekend, anders zou het rapport op termijn iets anders zeggen
 * dan het scherm.
 */
export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const eersteWaarde = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const vandaag = new Date().toISOString().split('T')[0];
  const to = eersteWaarde(sp.to) || vandaag;
  const from = eersteWaarde(sp.from) || iso(Date.parse(to) - 29 * DAY);
  const compare = eersteWaarde(sp.compare) || 'none';

  const [meta, invoices, alleOffertes, deals, exclusions, resolveInput, adjustments, kpiRaw] =
    await Promise.all([
      getMeta(),
      getAllInvoices(),
      getAllQuotations(),
      getAllDeals(),
      getExclusions(),
      getResolveInput(),
      getInvoiceAdjustments(),
      getAppSetting('kpi', DEFAULT_KPI_SETTINGS),
    ]);

  const quotations = resolveQuotations(alleOffertes, resolveInput);
  const settings = parseKpiSettings(kpiRaw);
  const generatedAt = new Date().toISOString();
  const facturatieVoor = (a: string, b: string) =>
    summarizeInvoices(invoices.filter((i) => i.invoiceDate >= a && i.invoiceDate <= b));

  const snap = snapshotForRange(
    quotations,
    deals,
    from,
    to,
    exclusions,
    facturatieVoor(from, to),
    generatedAt,
  );

  // Vergelijkingsperiode, dezelfde regel als /api/data hanteert.
  let vorige: { from: string; to: string; snap: ReturnType<typeof snapshotForRange> } | null = null;
  if (compare === 'previous' || compare === 'year') {
    let vFrom: string;
    let vTo: string;
    if (compare === 'year') {
      vFrom = verschuifJaar(from, -1);
      vTo = verschuifJaar(to, -1);
    } else {
      const dagen = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
      vTo = iso(Date.parse(from) - DAY);
      vFrom = iso(Date.parse(vTo) - (dagen - 1) * DAY);
    }
    vorige = {
      from: vFrom,
      to: vTo,
      snap: snapshotForRange(quotations, deals, vFrom, vTo, exclusions, LEEG_FACTURATIE, generatedAt),
    };
  }

  const t = snap.revenue.totals;
  const v = vorige?.snap.revenue.totals ?? null;
  const perM2 = perM2Stats(snap.quotations);
  const perM2Vorig = vorige ? perM2Stats(vorige.snap.quotations) : null;
  const aging = computeAging(invoices, vandaag, quotations, adjustments);
  const pipeline = computePipeline(quotations, exclusions, vandaag);
  const klanten = customerAnalysis(invoices, quotations, from, to);
  const verloren = computeLost(quotations, vandaag, settings);
  const planning = planningOverview(deals, quotations, vandaag);

  // Marketing: advertentiekosten uit ads_daily, omzet en marge uit Teamleader
  // (leadbron per kanaal) — dezelfde functies als het tabblad Marketing.
  const ads = await buildAdsPayload(from, to, compare);
  const kanalen = PLATFORMS.filter((p) => ads.platforms[p].connected);
  const adsTot = ads.total.totals;
  const adsVorig = ads.total.prevTotals;

  const periode = `${from} t/m ${to}`;
  const inPeriode = [...snap.quotations].sort((a, b) => b.revenueExVat - a.revenueExVat);

  return (
    <div className="mx-auto max-w-[900px] bg-white px-4 py-6 text-ink sm:px-8 sm:py-8 print:px-0 print:py-0">
      <PrintKnop />

      {/* ── Voorblad ─────────────────────────────────────────────────── */}
      <header className="mb-8 border-b border-line pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Vloeruniq · KPI-rapport
        </p>
        <h1 className="mt-1 text-[26px] font-bold tracking-tight">{periode}</h1>
        <p className="mt-1 text-[13px] text-ink-mute">
          {vorige
            ? `Vergeleken met ${vorige.from} t/m ${vorige.to}.`
            : 'Zonder vergelijkingsperiode.'}{' '}
          Offertebedragen ex btw, openstaande facturen incl btw. Laatst gesynchroniseerd{' '}
          {formatDateTime(meta?.lastSyncAt)}.
        </p>
        <p className="no-print mt-3 text-[12px] text-ink-faint">
          <Link href="/" className="underline underline-offset-2">
            ← Terug naar het dashboard
          </Link>
        </p>
      </header>

      <Blad titel="Overzicht" ondertitel="De cijfers die er in deze periode toe doen">
        <Kpis
          rijen={[
            ['Omzet geaccepteerd', formatEuro(t.acceptedRevenue), v && formatEuro(v.acceptedRevenue)],
            ['Offertes geaccepteerd', formatNumber(t.acceptedCount), v && formatNumber(v.acceptedCount)],
            ['Totale marge', formatEuro(t.totalMargin), v && formatEuro(v.totalMargin)],
            ['Gemiddelde marge', formatPercent(t.avgMarginPct), v && formatPercent(v.avgMarginPct)],
            ['Omzet open', formatEuro(t.openRevenue), v && formatEuro(v.openRevenue)],
            ['Conversie', formatPercent(t.conversionPct), v && formatPercent(v.conversionPct)],
            ['M² verkocht', formatNumber(t.m2Sold), v && formatNumber(v.m2Sold)],
            [
              'Gem. doorlooptijd',
              `${formatNumber(snap.runTime.totals.avgRunTimeDays)} d`,
              vorige && `${formatNumber(vorige.snap.runTime.totals.avgRunTimeDays)} d`,
            ],
            ['Gefactureerd', formatEuro(snap.invoicing.invoicedExcl), null],
            ['Betaald', formatEuro(snap.invoicing.paidExcl), null],
          ]}
          vergelijking={vorige != null}
        />
      </Blad>

      <Blad titel="Marge" ondertitel="Per verkochte m², uit de vloerregels — ex btw">
        <Kpis
          rijen={[
            ['Omzet / m²', formatEuro(perM2.revenuePerM2, true), perM2Vorig && formatEuro(perM2Vorig.revenuePerM2, true)],
            ['Inkoop / m²', formatEuro(perM2.purchasePerM2, true), perM2Vorig && formatEuro(perM2Vorig.purchasePerM2, true)],
            ['Ondervloer / m²', formatEuro(perM2.underlayPerM2, true), perM2Vorig && formatEuro(perM2Vorig.underlayPerM2, true)],
            ['Arbeid / m²', formatEuro(perM2.laborPerM2, true), perM2Vorig && formatEuro(perM2Vorig.laborPerM2, true)],
            ['Kostprijs / m²', formatEuro(perM2.costPerM2, true), perM2Vorig && formatEuro(perM2Vorig.costPerM2, true)],
            ['Marge / m²', formatEuro(perM2.marginPerM2, true), perM2Vorig && formatEuro(perM2Vorig.marginPerM2, true)],
            ['Marge %', formatPercent(perM2.marginPct), perM2Vorig && formatPercent(perM2Vorig.marginPct)],
            [
              'Gerekend over',
              `${formatNumber(perM2.m2Priced)} van ${formatNumber(perM2.m2Total)} m²`,
              null,
            ],
          ]}
          vergelijking={vorige != null}
        />
        <Tabel
          titel="Per vloerproduct"
          actie={
            <CsvKnop
              naam={`vloeruniq-producten-${from}_${to}`}
              rijen={snap.topProducts.map((p) => ({
                product: formatProduct(p.code),
                offertes: p.count,
                m2: p.m2,
                omzet: p.revenue,
                marge: p.margin,
                margePct: p.marginPct,
              }))}
              kolommen={[
                { key: 'product', label: 'Product' },
                { key: 'offertes', label: 'Offertes' },
                { key: 'm2', label: 'm2' },
                { key: 'omzet', label: 'Omzet ex btw' },
                { key: 'marge', label: 'Marge' },
                { key: 'margePct', label: 'Marge %' },
              ]}
            />
          }
          kop={['Product', 'Offertes', 'm²', 'Omzet', 'Marge', 'Marge %']}
          rechts={[false, true, true, true, true, true]}
          rijen={snap.topProducts.slice(0, 20).map((p) => [
            formatProduct(p.code),
            formatNumber(p.count),
            formatNumber(p.m2),
            formatEuro(p.revenue),
            formatEuro(p.margin),
            formatPercent(p.marginPct),
          ])}
        />
      </Blad>

      <Blad titel="Cashflow" ondertitel="Huidige stand, bedragen incl btw">
        <Kpis
          rijen={[
            ['Totaal openstaand', formatEuro(aging.totalOutstanding), null],
            ['Over de vervaldatum', formatNumber(aging.overdue.length) + ' facturen', null],
          ]}
          vergelijking={false}
        />
        <Tabel
          titel="Ouderdom"
          kop={['Bucket', 'Facturen', 'Bedrag']}
          rechts={[false, true, true]}
          rijen={aging.buckets.map((b) => [b.label, formatNumber(b.count), formatEuro(b.amount)])}
        />
        <Tabel
          titel="Langst openstaand"
          kop={['Klant', 'Vervallen', 'Te laat', 'Bedrag']}
          rechts={[false, false, true, true]}
          rijen={aging.overdue.slice(0, 15).map((o) => [
            o.customerName,
            o.dueOn || o.invoiceDate,
            `${o.daysOverdue} d`,
            formatEuro(o.amount),
          ])}
        />
      </Blad>

      <Blad titel="Verloren omzet" ondertitel="Wat er niet doorging — over de hele historie">
        <Kpis
          rijen={[
            ['Niet doorgegaan', formatEuro(verloren.totalLostRevenue), null],
            ['Aantal offertes', formatNumber(verloren.totalLostCount), null],
            ['Waarvan verlopen', formatPercent(verloren.expiredShare), null],
            ['Laatste 90 dagen', formatEuro(verloren.recentRevenue), null],
            ['Mediane gemiste offerte', formatEuro(verloren.medianLost), null],
            ['Mediane gewonnen offerte', formatEuro(verloren.medianWon), null],
          ]}
          vergelijking={false}
        />
        <Tabel
          titel="Grootste gemiste offertes"
          kop={['Klant', 'Status', 'Datum', 'Bedrag']}
          rechts={[false, false, false, true]}
          rijen={verloren.biggest.slice(0, 15).map((q) => [
            q.customerName,
            q.reason === 'expired' ? STATUS_LABEL.expired : STATUS_LABEL.refused,
            q.date,
            formatEuro(q.revenueExVat),
          ])}
        />
      </Blad>

      <Blad titel="Pijplijn" ondertitel="Verwachte omzet uit offertes die nog open staan">
        <Kpis
          rijen={[
            ['Open waarde', formatEuro(pipeline.openValue), null],
            ['Winkans', formatPercent(pipeline.winRate), null],
            ['Verwachte omzet', formatEuro(pipeline.expectedValue), null],
          ]}
          vergelijking={false}
        />
        <Tabel
          titel="Naar ouderdom"
          kop={['Leeftijd', 'Offertes', 'Waarde']}
          rechts={[false, true, true]}
          rijen={pipeline.ageTiers.map((a) => [a.label, formatNumber(a.count), formatEuro(a.value)])}
        />
      </Blad>

      <Blad titel="Offertes" ondertitel={`Alle offertes in de periode (${inPeriode.length})`}>
        <Tabel
          actie={
            <CsvKnop
              naam={`vloeruniq-offertes-${from}_${to}`}
              rijen={inPeriode.map((q) => ({
                klant: q.customerName,
                offerte: q.name,
                status: STATUS_LABEL[q.status],
                datum: q.dateAccepted || q.dateCreated,
                plaats: q.city,
                omzetExBtw: q.revenueExVat,
                vloeromzet: q.omzetVloer,
                m2: q.totalM2,
                kostprijs: q.cost,
                marge: q.margin,
                margePct: q.marginPct,
                dekking: q.matchCoverage,
              }))}
              kolommen={[
                { key: 'klant', label: 'Klant' },
                { key: 'offerte', label: 'Offerte' },
                { key: 'status', label: 'Status' },
                { key: 'datum', label: 'Datum' },
                { key: 'plaats', label: 'Plaats' },
                { key: 'omzetExBtw', label: 'Offerte-omzet ex btw' },
                { key: 'vloeromzet', label: 'Vloeromzet ex btw' },
                { key: 'm2', label: 'm2' },
                { key: 'kostprijs', label: 'Kostprijs' },
                { key: 'marge', label: 'Marge' },
                { key: 'margePct', label: 'Marge %' },
                { key: 'dekking', label: 'Dekking %' },
              ]}
            />
          }
          kop={['Klant', 'Status', 'Datum', 'Offerte-omzet', 'm²', 'Marge', 'Marge %']}
          rechts={[false, false, false, true, true, true, true]}
          rijen={inPeriode.slice(0, 60).map((q: QuotationRow) => [
            q.customerName || '—',
            STATUS_LABEL[q.status],
            q.dateAccepted || q.dateCreated,
            formatEuro(q.revenueExVat),
            formatNumber(q.totalM2),
            formatEuro(q.margin),
            formatPercent(q.marginPct),
          ])}
          voetnoot={
            inPeriode.length > 60
              ? `Alleen de 60 grootste van ${inPeriode.length} offertes; de rest staat in de CSV.`
              : undefined
          }
        />
      </Blad>

      <Blad titel="Leadbronnen" ondertitel="Waar de omzet vandaan komt — ex btw">
        <Tabel
          kop={['Bron', 'Offertes', 'Omzet', 'Gem. deal', 'Marge %']}
          rechts={[false, true, true, true, true]}
          rijen={snap.leadSources.map((s) => [
            s.name,
            formatNumber(s.count),
            formatEuro(s.revenue),
            formatEuro(s.avgDealSize),
            formatPercent(s.marginPct),
          ])}
          voetnoot="Leadbron staat op de deal in Teamleader en is lang niet altijd ingevuld; lees dit als een deel van het beeld."
        />
      </Blad>

      {ads.available && kanalen.length > 0 && (
        <Blad titel="Marketing" ondertitel="Advertenties: wat ze kosten, wat ze opleveren en wat er van de marge overblijft">
          <Kpis
            rijen={[
              ['Totale marge', formatEuro(t.totalMargin), v && formatEuro(v.totalMargin)],
              ['Advertentiekosten', formatEuro(adsTot.cost), adsVorig && formatEuro(adsVorig.cost)],
              ...kanalen.map(
                (p) =>
                  [`  waarvan ${PLATFORM_LABEL[p]}`, formatEuro(ads.platforms[p].totals.cost), ads.platforms[p].prevTotals && formatEuro(ads.platforms[p].prevTotals!.cost)] as [string, string, string | null],
              ),
              ['Marge na marketing', formatEuro(t.totalMargin - adsTot.cost), v && adsVorig && formatEuro(v.totalMargin - adsVorig.cost)],
            ]}
            vergelijking={vorige != null}
          />
          <Tabel
            titel="Per kanaal"
            kop={['Kanaal', 'Kosten', 'Klikken', 'CTR', 'CPC', 'Conversies', 'Gewonnen', 'Omzet', 'Rendement']}
            rechts={[false, true, true, true, true, true, true, true, true]}
            rijen={kanalen.map((p) => {
              const k = ads.platforms[p].totals;
              const l = leadStats(snap.quotations, snap.runTimeRows, p);
              return [
                `${PLATFORM_LABEL[p]} (leadbron ${PLATFORM_SOURCE_LABEL[p]})`,
                formatEuro(k.cost),
                formatNumber(k.clicks),
                formatPercent(k.ctr),
                formatEuro(k.cpc, true),
                formatNumber(Math.round(k.conversions)),
                formatNumber(l.count),
                formatEuro(l.revenue),
                formatEuro(l.margin - k.cost),
              ];
            })}
            voetnoot="Rendement is de marge uit de leads van dat kanaal min de kosten. Conversies tellen per platform anders; omzet en marge komen uit Teamleader."
          />
          <Tabel
            titel="Per campagne"
            kop={['Campagne', 'Kanaal', 'Kosten', 'Klikken', 'CTR', 'CPC', 'Conversies']}
            rechts={[false, false, true, true, true, true, true]}
            rijen={kanalen
              .flatMap((p) => ads.platforms[p].byCampaign)
              .sort((a, b) => b.cost - a.cost)
              .map((c) => [
                c.name,
                PLATFORM_LABEL[c.platform],
                formatEuro(c.cost),
                formatNumber(c.clicks),
                formatPercent(c.ctr),
                formatEuro(c.cpc, true),
                formatNumber(Math.round(c.conversions * 10) / 10),
              ])}
          />
          {kanalen.map((p) => (
            <Tabel
              key={p}
              titel={`Maandbudget ${PLATFORM_LABEL[p]}`}
              kop={['Maand', 'Budget', 'Uitgegeven', 'Benut']}
              rechts={[false, true, true, true]}
              rijen={[...ads.platforms[p].budgets].reverse().map((m) => [
                m.label,
                m.budget != null ? formatEuro(m.budget) : '—',
                formatEuro(m.spent),
                formatPercent(m.pct),
              ])}
              voetnoot={`${PLATFORM_LABEL[p]}-cijfers t/m ${ads.platforms[p].sync?.toDate ?? '—'}.`}
            />
          ))}
        </Blad>
      )}

      <Blad titel="Klanten" ondertitel="Gefactureerd in deze periode, ex btw">
        <Kpis
          rijen={[
            ['Klanten', formatNumber(klanten.concentration.customers.length), null],
            ['Gefactureerd', formatEuro(klanten.concentration.totalRevenue), null],
            ['Aandeel top 10', formatPercent(klanten.concentration.top10Share), null],
            ['Klanten voor de helft', formatNumber(klanten.concentration.customersForHalf), null],
            ['Mediane betaaltermijn', `${formatNumber(klanten.payments.medianDays)} d`, null],
            ['Op tijd betaald', formatPercent(klanten.payments.onTimePct), null],
          ]}
          vergelijking={false}
        />
        <Tabel
          titel="Klanten op omzet"
          actie={
            <CsvKnop
              naam={`vloeruniq-klanten-${from}_${to}`}
              rijen={klanten.concentration.customers.map((c) => ({
                klant: c.name,
                facturen: c.invoices,
                omzet: c.revenue,
                gecrediteerd: c.credited,
                betaaltermijn: c.avgDaysToPay,
                opTijd: c.paidTotal > 0 ? `${c.paidOnTime}/${c.paidTotal}` : '',
                eerste: c.firstInvoice,
                laatste: c.lastInvoice,
              }))}
              kolommen={[
                { key: 'klant', label: 'Klant' },
                { key: 'facturen', label: 'Facturen' },
                { key: 'omzet', label: 'Omzet ex btw' },
                { key: 'gecrediteerd', label: 'Gecrediteerd' },
                { key: 'betaaltermijn', label: 'Gem. betaaltermijn (dagen)' },
                { key: 'opTijd', label: 'Op tijd betaald' },
                { key: 'eerste', label: 'Eerste factuur' },
                { key: 'laatste', label: 'Laatste factuur' },
              ]}
            />
          }
          kop={['Klant', 'Facturen', 'Betaaltermijn', 'Gecrediteerd', 'Omzet']}
          rechts={[false, true, true, true, true]}
          rijen={klanten.concentration.customers.slice(0, 25).map((c) => [
            c.name,
            formatNumber(c.invoices),
            c.avgDaysToPay == null ? '—' : `${formatNumber(c.avgDaysToPay)} d`,
            c.credited > 0 ? `− ${formatEuro(c.credited)}` : '—',
            formatEuro(c.revenue),
          ])}
        />
      </Blad>

      <Blad titel="Regio" ondertitel="Omzet per plaats — ex btw">
        <Tabel
          kop={['Plaats', 'Offertes', 'Omzet']}
          rechts={[false, true, true]}
          rijen={snap.regions.slice(0, 25).map((r) => [
            r.name || '—',
            formatNumber(r.count),
            formatEuro(r.revenue),
          ])}
        />
      </Blad>

      <Blad titel="Trends" ondertitel="Per week in de gekozen periode — ex btw">
        <Tabel
          kop={['Week', 'Geaccepteerd', 'Open', 'Marge', 'm²']}
          rechts={[false, true, true, true, true]}
          rijen={[...snap.weeks]
            .sort()
            .map((w) => {
              const r = snap.revenue.byWeek[w];
              if (!r) return null;
              return [
                w,
                formatEuro(r.acceptedRevenue),
                formatEuro(r.openRevenue),
                formatEuro(r.acceptedMargin),
                formatNumber(r.acceptedM2),
              ];
            })
            .filter((r): r is string[] => r !== null)}
        />
      </Blad>

      <Blad titel="Planning" ondertitel="Wat er is ingepland en nog uitgevoerd moet worden">
        <Kpis
          rijen={[
            ['Orderportefeuille', formatEuro(planning.backlogRevenue), null],
            ['Nog uit te voeren', `${formatNumber(planning.backlogJobs)} klussen`, null],
            ['M² ingepland', formatNumber(planning.backlogM2), null],
          ]}
          vergelijking={false}
        />
        <Tabel
          kop={['Maand', 'Klussen', 'm²', 'Omzet']}
          rechts={[false, true, true, true]}
          rijen={planning.months
            .filter((m) => !m.past)
            .map((m) => [m.month, formatNumber(m.jobs), formatNumber(m.m2), formatEuro(m.revenue)])}
        />
      </Blad>

      <footer className="mt-8 border-t border-line pt-4 text-[11px] text-ink-faint">
        Gemaakt op {formatDateTime(generatedAt)} · Vloeruniq KPI-dashboard
      </footer>
    </div>
  );
}

/** Eén tabblad, met een pagina-einde ervoor bij het afdrukken. */
function Blad({
  titel,
  ondertitel,
  children,
}: {
  titel: string;
  ondertitel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="print-blad mb-10">
      <h2 className="text-[17px] font-bold tracking-tight">{titel}</h2>
      {ondertitel && <p className="mt-0.5 text-[12.5px] text-ink-mute">{ondertitel}</p>}
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function Kpis({
  rijen,
  vergelijking,
}: {
  rijen: [string, string, string | null | false][];
  vergelijking: boolean;
}) {
  return (
    <table className="w-full border-collapse text-[12.5px]">
      <thead>
        <tr className="border-b border-line text-[10.5px] uppercase tracking-wide text-ink-faint">
          <th className="py-1.5 text-left font-semibold">Kengetal</th>
          <th className="py-1.5 text-right font-semibold">Deze periode</th>
          {vergelijking && <th className="py-1.5 text-right font-semibold">Vorige periode</th>}
        </tr>
      </thead>
      <tbody>
        {rijen.map(([label, waarde, vorig]) => (
          <tr key={label} className="border-b border-hair last:border-0">
            <td className="py-1.5 text-ink-soft">{label}</td>
            <td className="py-1.5 text-right font-semibold tabular-nums">{waarde}</td>
            {vergelijking && (
              <td className="py-1.5 text-right tabular-nums text-ink-mute">{vorig || '—'}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Tabel({
  titel,
  kop,
  rijen,
  rechts,
  voetnoot,
  actie,
}: {
  titel?: string;
  kop: string[];
  rijen: string[][];
  rechts: boolean[];
  voetnoot?: string;
  actie?: React.ReactNode;
}) {
  return (
    <div>
      {(titel || actie) && (
        <div className="mb-1 flex items-center justify-between gap-3">
          {titel ? (
            <h3 className="text-[13px] font-semibold text-ink-soft">{titel}</h3>
          ) : (
            <span />
          )}
          {actie}
        </div>
      )}
      {rijen.length === 0 ? (
        <p className="text-[12px] text-ink-faint">Geen rijen in deze periode.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[12px] print:min-w-0">
            <thead>
              <tr className="border-b border-line text-[10.5px] uppercase tracking-wide text-ink-faint">
                {kop.map((k, i) => (
                  <th
                    key={k}
                    className={`py-1.5 font-semibold ${rechts[i] ? 'text-right' : 'text-left'}`}
                  >
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rijen.map((r, i) => (
                <tr key={i} className="border-b border-hair last:border-0">
                  {r.map((c, j) => (
                    <td
                      key={j}
                      className={`py-1 ${rechts[j] ? 'text-right tabular-nums' : 'text-ink-soft'}`}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {voetnoot && <p className="mt-1 text-[11px] text-ink-faint">{voetnoot}</p>}
    </div>
  );
}
