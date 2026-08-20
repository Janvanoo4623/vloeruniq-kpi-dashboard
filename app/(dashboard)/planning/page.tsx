import { getAllDeals, getAllQuotations } from '@/lib/db';
import { planningOverview } from '@/lib/insights';
import PlanningView from '@/components/pages/PlanningView';

export const dynamic = 'force-dynamic';

export default async function PlanningPage() {
  const asOf = new Date().toISOString().split('T')[0];
  const [deals, quotations] = await Promise.all([getAllDeals(), getAllQuotations()]);
  return <PlanningView planning={planningOverview(deals, quotations, asOf)} asOf={asOf} />;
}
