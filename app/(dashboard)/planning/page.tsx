import { getAllDeals, getAllQuotations, getAppSetting } from '@/lib/db';
import { planningOverview } from '@/lib/insights';
import PlanningView from '@/components/pages/PlanningView';

export const dynamic = 'force-dynamic';

export default async function PlanningPage() {
  const asOf = new Date().toISOString().split('T')[0];
  const [deals, quotations, capacity] = await Promise.all([
    getAllDeals(),
    getAllQuotations(),
    getAppSetting<{ m2PerWeek: number | null }>('capacity', { m2PerWeek: null }).catch(() => ({ m2PerWeek: null })),
  ]);
  return <PlanningView planning={planningOverview(deals, quotations, asOf)} asOf={asOf} capacityPerWeek={capacity.m2PerWeek} />;
}
