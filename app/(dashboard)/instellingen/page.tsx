import {
  getCurrentPrices,
  getCurrentCosts,
  listExclusions,
  getAppSetting,
  getAllQuotations,
  getAllDeals,
  getAllInvoices,
  getPriceRows,
  getOverrides,
} from '@/lib/db';
import { DEFAULT_KPI_SETTINGS, parseKpiSettings } from '@/lib/kpi-settings';
import { applyOverrides } from '@/lib/overrides';
import { computeQuality, type QualitySnapshot } from '@/lib/data-quality';
import Settings from '@/components/Settings';

export const dynamic = 'force-dynamic';

export default async function InstellingenPage() {
  const today = new Date().toISOString().split('T')[0];
  const [prices, costs, exclusions, kpiRaw, quotations, deals, invoices, priceRows, overrides, history] =
    await Promise.all([
      getCurrentPrices(),
      getCurrentCosts(),
      listExclusions(),
      getAppSetting('kpi', DEFAULT_KPI_SETTINGS),
      getAllQuotations(),
      getAllDeals(),
      getAllInvoices(),
      getPriceRows(),
      getOverrides(),
      getAppSetting<QualitySnapshot[]>('quality_history', []),
    ]);

  const resolved = applyOverrides(quotations, overrides);
  const pricedCodes = new Set(prices.map((p) => p.code.toLowerCase()));
  const quality = computeQuality(resolved, deals, invoices, priceRows, pricedCodes, today);

  return (
    <Settings
      initial={{
        prices,
        costs,
        exclusions,
        kpi: parseKpiSettings(kpiRaw),
        quality: { ...quality, history },
      }}
    />
  );
}
