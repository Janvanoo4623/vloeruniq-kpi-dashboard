import { getAllQuotations, getOverrides } from '@/lib/db';
import { applyOverrides } from '@/lib/overrides';
import { installModeStats, productSpread } from '@/lib/insights';
import MargeView from '@/components/pages/MargeView';

export const dynamic = 'force-dynamic';

export default async function MargePage() {
  const [quotations, overrides] = await Promise.all([getAllQuotations(), getOverrides()]);
  const resolved = applyOverrides(quotations, overrides);
  const { totals, byQuarter } = installModeStats(resolved);

  return (
    <MargeView
      installTotals={totals}
      installByQuarter={byQuarter}
      spread={productSpread(resolved)}
    />
  );
}
