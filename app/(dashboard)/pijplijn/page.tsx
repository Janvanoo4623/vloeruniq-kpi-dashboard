import { getAllQuotations, getOverrides, getAppSetting } from '@/lib/db';
import { applyOverrides } from '@/lib/overrides';
import { decisionTimes, winRateBySize, winRateByMonth } from '@/lib/insights';
import { DEFAULT_KPI_SETTINGS, definitionLabel, parseKpiSettings } from '@/lib/kpi-settings';
import PijplijnView from '@/components/pages/PijplijnView';

export const dynamic = 'force-dynamic';

/**
 * Winkans gaat over álle offertes, niet over de gekozen periode — daarom wordt
 * dat deel hier server-side berekend en niet uit de periode-snapshot gehaald.
 */
export default async function PijplijnPage() {
  const asOf = new Date().toISOString().split('T')[0];
  const [quotations, overrides, rawSettings] = await Promise.all([
    getAllQuotations(),
    getOverrides(),
    getAppSetting('kpi', DEFAULT_KPI_SETTINGS),
  ]);
  const settings = parseKpiSettings(rawSettings);
  const resolved = applyOverrides(quotations, overrides);

  return (
    <PijplijnView
      winRateSize={winRateBySize(resolved, asOf, settings)}
      winRateTrend={winRateByMonth(resolved, asOf, settings)}
      decision={decisionTimes(resolved)}
      definition={definitionLabel(settings)}
    />
  );
}
