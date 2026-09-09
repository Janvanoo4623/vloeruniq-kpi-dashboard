import { getAllQuotations, getResolveInput, getAppSetting } from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';
import { computeLost } from '@/lib/lost';
import { DEFAULT_KPI_SETTINGS, parseKpiSettings } from '@/lib/kpi-settings';
import VerlorenView from '@/components/pages/VerlorenView';

export const dynamic = 'force-dynamic';

export default async function VerlorenPage() {
  const asOf = new Date().toISOString().split('T')[0];
  const [quotations, resolveInput, rawSettings] = await Promise.all([
    getAllQuotations(),
    getResolveInput(),
    getAppSetting('kpi', DEFAULT_KPI_SETTINGS),
  ]);
  const settings = parseKpiSettings(rawSettings);
  const resolved = resolveQuotations(quotations, resolveInput);

  // Afgeleid van asOf, niet van Date.now(): zo levert deze render altijd
  // hetzelfde op als de berekening eronder, en blijft de functie zuiver.
  const maturityCutoff = new Date(Date.parse(asOf) - settings.maturityDays * 86400000)
    .toISOString()
    .substring(0, 7);

  return (
    <VerlorenView
      data={computeLost(resolved, asOf, settings)}
      maturityDays={settings.maturityDays}
      maturityCutoff={maturityCutoff}
    />
  );
}
