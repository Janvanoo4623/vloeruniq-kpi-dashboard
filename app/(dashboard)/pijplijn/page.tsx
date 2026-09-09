import { getAllQuotations, getResolveInput, getAppSetting } from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';
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
  const [quotations, resolveInput, rawSettings] = await Promise.all([
    getAllQuotations(),
    getResolveInput(),
    getAppSetting('kpi', DEFAULT_KPI_SETTINGS),
  ]);
  const settings = parseKpiSettings(rawSettings);
  const resolved = resolveQuotations(quotations, resolveInput);

  return (
    <PijplijnView
      winRateSize={winRateBySize(resolved, asOf, settings)}
      winRateTrend={winRateByMonth(resolved, asOf, settings)}
      decision={decisionTimes(resolved)}
      definition={definitionLabel(settings)}
    />
  );
}
