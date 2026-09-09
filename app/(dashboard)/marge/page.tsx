import { getAllQuotations, getResolveInput } from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';
import { installModeStats, productSpread } from '@/lib/insights';
import MargeView from '@/components/pages/MargeView';

export const dynamic = 'force-dynamic';

export default async function MargePage() {
  const [quotations, resolveInput] = await Promise.all([getAllQuotations(), getResolveInput()]);
  const resolved = resolveQuotations(quotations, resolveInput);
  const { totals, byQuarter } = installModeStats(resolved);

  return (
    <MargeView
      installTotals={totals}
      installByQuarter={byQuarter}
      spread={productSpread(resolved)}
    />
  );
}
