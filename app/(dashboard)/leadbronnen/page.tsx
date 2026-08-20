import { getAllQuotations, getAllDeals, getOverrides } from '@/lib/db';
import { applyOverrides } from '@/lib/overrides';
import { leadSourceTrend } from '@/lib/insights';
import LeadbronnenView from '@/components/pages/LeadbronnenView';

export const dynamic = 'force-dynamic';

/**
 * Het verloop gaat over álle offertes, niet over de gekozen periode — anders zie
 * je geen verschuiving maar alleen het laatste kwartaal.
 */
export default async function LeadbronnenPage() {
  const [quotations, deals, overrides] = await Promise.all([
    getAllQuotations(),
    getAllDeals(),
    getOverrides(),
  ]);
  const resolved = applyOverrides(quotations, overrides);
  return <LeadbronnenView trend={leadSourceTrend(resolved, deals)} />;
}
