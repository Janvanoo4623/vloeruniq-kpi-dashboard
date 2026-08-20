import { getAllQuotations, getOverrides } from '@/lib/db';
import { applyOverrides } from '@/lib/overrides';
import { installModeStats } from '@/lib/insights';
import MargeView from '@/components/pages/MargeView';

export const dynamic = 'force-dynamic';

export default async function MargePage() {
  const [quotations, overrides] = await Promise.all([getAllQuotations(), getOverrides()]);
  const { totals, byQuarter } = installModeStats(applyOverrides(quotations, overrides));
  return <MargeView installTotals={totals} installByQuarter={byQuarter} />;
}
