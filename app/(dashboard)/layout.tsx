import {
  getSnapshot,
  getMeta,
  getAllInvoices,
  getAllQuotations,
  getCurrentPrices,
  getExclusions,
  getOverrides,
} from '@/lib/db';
import { computeAging } from '@/lib/teamleader/invoices';
import { computePipeline } from '@/lib/pipeline';
import { computePaymentStats } from '@/lib/payments';
import { applyOverrides, applyOverridesToSnapshot } from '@/lib/overrides';
import DashboardProvider from '@/components/layout/DashboardProvider';
import AppShell from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';

/**
 * De data wordt hier één keer opgehaald voor élke pagina in de schil. Wisselen
 * van pagina kost daardoor geen nieuwe fetch, en de gekozen periode blijft staan.
 * Alle zware berekeningen blijven server-side; de client krijgt alleen resultaat.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [snapshot, meta, invoices, quotations, prices, exclusions, overrides] = await Promise.all([
    getSnapshot(),
    getMeta(),
    getAllInvoices(),
    getAllQuotations(),
    getCurrentPrices(),
    getExclusions(),
    getOverrides(),
  ]);

  const today = new Date().toISOString().split('T')[0];
  // Per-offerte correcties worden bij het lezen toegepast (direct + met
  // terugwerkende kracht) — zie lib/overrides.ts.
  const resolvedQuotations = applyOverrides(quotations, overrides);
  const resolvedSnapshot = snapshot ? applyOverridesToSnapshot(snapshot, overrides) : null;

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
