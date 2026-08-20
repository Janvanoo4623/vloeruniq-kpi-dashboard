import { getAllQuotations, getOverrides, getAppSetting } from '@/lib/db';
import { applyOverrides } from '@/lib/overrides';
import { regionInsights } from '@/lib/insights';
import { DEFAULT_KPI_SETTINGS, parseKpiSettings } from '@/lib/kpi-settings';
import RegioView from '@/components/pages/RegioView';

export const dynamic = 'force-dynamic';

export default async function RegioPage() {
  const asOf = new Date().toISOString().split('T')[0];
  const [quotations, overrides, rawSettings] = await Promise.all([
    getAllQuotations(),
    getOverrides(),
    getAppSetting('kpi', DEFAULT_KPI_SETTINGS),
  ]);
  const settings = parseKpiSettings(rawSettings);
  const resolved = applyOverrides(quotations, overrides);
  return (
    <RegioView
      regions={regionInsights(resolved, asOf, settings)}
      minSample={settings.minSample}
    />
  );
}
