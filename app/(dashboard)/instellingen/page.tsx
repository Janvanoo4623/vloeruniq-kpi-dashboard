import { getCurrentPrices, getCurrentCosts, listExclusions, getAppSetting } from '@/lib/db';
import { DEFAULT_KPI_SETTINGS, parseKpiSettings } from '@/lib/kpi-settings';
import Settings from '@/components/Settings';

export const dynamic = 'force-dynamic';

export default async function InstellingenPage() {
  const [prices, costs, exclusions, kpiRaw] = await Promise.all([
    getCurrentPrices(),
    getCurrentCosts(),
    listExclusions(),
    getAppSetting('kpi', DEFAULT_KPI_SETTINGS),
  ]);
  return (
    <Settings initial={{ prices, costs, exclusions, kpi: parseKpiSettings(kpiRaw) }} />
  );
}
