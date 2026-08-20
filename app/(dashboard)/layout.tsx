import {
  getMeta,
  getAllInvoices,
  getAllQuotations,
  getCurrentPrices,
  getExclusions,
  getOverrides,
  getAllDeals,
} from '@/lib/db';
import { computeAging, summarizeInvoices } from '@/lib/teamleader/invoices';
import { snapshotForRange } from '@/lib/range';
import { DEFAULT_PRESET, presetRangeServer } from '@/lib/default-range';
import { computePipeline } from '@/lib/pipeline';
import { computePaymentStats } from '@/lib/payments';
import { applyOverrides } from '@/lib/overrides';
import DashboardProvider from '@/components/layout/DashboardProvider';
import AppShell from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';

/**
 * De data wordt hier één keer opgehaald voor élke pagina in de schil. Wisselen
 * van pagina kost daardoor geen nieuwe fetch, en de gekozen periode blijft staan.
 * Alle zware berekeningen blijven server-side; de client krijgt alleen resultaat.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [meta, invoices, quotations, prices, exclusions, overrides, deals] = await Promise.all([
    getMeta(),
    getAllInvoices(),
    getAllQuotations(),
    getCurrentPrices(),
    getExclusions(),
    getOverrides(),
    getAllDeals(),
  ]);

  const today = new Date().toISOString().split('T')[0];
  // Per-offerte correcties worden bij het lezen toegepast (direct + met
  // terugwerkende kracht) — zie lib/overrides.ts.
  const resolvedQuotations = applyOverrides(quotations, overrides);

  // De eerste weergave wordt hier voor de standaardperiode berekend in plaats van
  // uit de gecachete snapshot te komen. Die snapshot dekt altijd het vaste
  // 90-daagse sync-venster, dus zodra de standaard iets anders is (30 dagen)
  // zegt de kop iets anders dan de grafiek eronder toont. Rekenen is hier
  // goedkoop: alle offertes staan er toch al voor de cashflow en de pijplijn.
  const { from, to } = presetRangeServer(DEFAULT_PRESET);
  const resolvedSnapshot = snapshotForRange(
    resolvedQuotations,
    deals,
    from,
    to,
    exclusions,
    summarizeInvoices(invoices.filter((i) => i.invoiceDate >= from && i.invoiceDate <= to)),
    new Date().toISOString(),
  );

  const aging = computeAging(invoices, today, resolvedQuotations);
  const pipeline = computePipeline(resolvedQuotations, exclusions, today);
  const payments = computePaymentStats(invoices, today);
  const pricedCodes = prices.map((p) => p.code.toLowerCase());

  return (
    <DashboardProvider
      snapshot={resolvedSnapshot}
      meta={meta}
      aging={aging}
      pipeline={pipeline}
      payments={payments}
      pricedCodes={pricedCodes}
    >
      <AppShell>{children}</AppShell>
    </DashboardProvider>
  );
}
