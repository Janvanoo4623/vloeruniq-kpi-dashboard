import { getAllQuotations, getOverrides, getAppSetting } from '@/lib/db';
import { applyOverrides } from '@/lib/overrides';
import { regionInsights } from '@/lib/insights';
import { buildMarketShare } from '@/lib/market-share';
import { fetchAllMoves, fetchRegionNames } from '@/lib/cbs';
import { DEFAULT_KPI_SETTINGS, parseKpiSettings } from '@/lib/kpi-settings';
import RegioView from '@/components/pages/RegioView';

export const dynamic = 'force-dynamic';

/**
 * De CBS-cijfers worden een dag gecachet (zie lib/cbs.ts) en falen zacht: gaat de
 * open-databron plat, dan verdwijnt alleen het marktaandeel-paneel en blijft de
 * rest van de pagina staan. Een externe bron mag nooit een eigen pagina slopen.
 */
export default async function RegioPage() {
  const asOf = new Date().toISOString().split('T')[0];
  const [quotations, overrides, rawSettings, moves, namen] = await Promise.all([
    getAllQuotations(),
    getOverrides(),
    getAppSetting('kpi', DEFAULT_KPI_SETTINGS),
    fetchAllMoves(),
    fetchRegionNames(),
  ]);
  const settings = parseKpiSettings(rawSettings);
  const resolved = applyOverrides(quotations, overrides);

  return (
    <RegioView
      regions={regionInsights(resolved, asOf, settings)}
      minSample={settings.minSample}
      marketShare={buildMarketShare(resolved, moves, namen, asOf, settings)}
    />
  );
}
