import { getAllQuotations, getExclusions, getResolveInput } from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';
import { installModeStats, productSpread } from '@/lib/insights';
import { priceSensitivity } from '@/lib/price-sensitivity';
import MargeView from '@/components/pages/MargeView';

export const dynamic = 'force-dynamic';

export default async function MargePage() {
  const asOf = new Date().toISOString().slice(0, 10);
  const [quotations, resolveInput, exclusions] = await Promise.all([getAllQuotations(), getResolveInput(), getExclusions()]);
  const resolved = resolveQuotations(quotations, resolveInput);
  const { totals, byQuarter } = installModeStats(resolved);

  return (
    <MargeView
      installTotals={totals}
      installByQuarter={byQuarter}
      spread={productSpread(resolved)}
      sensitivity={priceSensitivity(resolved, exclusions, asOf)}
    />
  );
}
