'use client';

import { useMemo, useState } from 'react';
import { useDashboard } from '@/components/layout/DashboardProvider';
import TrendsView from '@/components/TrendsView';
import EmptyState from '@/components/pages/EmptyState';
import MarketPanel from '@/components/pages/MarketPanel';
import ChartCard from '@/components/ChartCard';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import { buildKpiSeries } from '@/lib/kpi-series';
import type { Granularity } from '@/lib/series';
import type { MarketData } from '@/lib/market';
import { cn } from '@/components/ui';
import { Factory, ShoppingBag, TrendingDown, TrendingUp } from 'lucide-react';
import HeroCard, { MiniStat } from '@/components/page/HeroCard';
import HighlightChart, { kortEuro } from '@/components/page/HighlightChart';
import { DetailsLabel, InsightCard, type Insight } from '@/components/overview/cards';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';

/**
 * De lange lijn: hoe de cijfers zich over weken en maanden bewegen, en de markt
 * eromheen. Sinds 2026-10-19 staat hier ook de grafiek waarin je zelf KPI's
 * aanvinkt — hij stond op Overzicht, maar daar is nu één rustige grafiek.
 */
export default function TrendsPage({ market }: { market: MarketData }) {
  const { snap, openStock, adsDaily, today } = useDashboard();
  const [gran, setGran] = useState<Granularity | null>(null);
  const granularity: Granularity = gran ?? ((snap?.weeks.length ?? 0) > 16 ? 'month' : 'week');
  const kpiSeries = useMemo(() => (snap ? buildKpiSeries(snap, adsDaily, granularity) : []), [snap, adsDaily, granularity]);
  if (!snap) return <EmptyState />;

  // Twaalf maanden geaccepteerde omzet, los van de periodekiezer: Trends gaat
  // over de lange lijn.
  const maanden = today.bars.months;
  const vol = maanden.filter((m) => !m.current);
  const omzet12 = maanden.reduce((t, m) => t + m.revenue, 0);
  const marge12 = maanden.reduce((t, m) => t + m.margin, 0);
  const m2_12 = maanden.reduce((t, m) => t + m.m2, 0);
  const besteMaand = [...vol].sort((a, b) => b.revenue - a.revenue)[0];
  const helft = Math.floor(vol.length / 2);
  const eerste = vol.slice(0, helft).reduce((t, m) => t + m.revenue, 0);
  const tweede = vol.slice(helft).reduce((t, m) => t + m.revenue, 0);
  const groei = eerste > 0 ? Math.round(((tweede - eerste) / eerste) * 1000) / 10 : null;

  const koop = [...market.confidence].reverse().find((c) => c.bigPurchases != null);
  const koopIndex = koop ? market.confidence.indexOf(koop) : -1;
  const koopEerder = koopIndex >= 3 ? market.confidence[koopIndex - 3] : undefined;
  const pvc = [...market.prices].reverse().find((p) => p.pvc != null);
  const pvcJaar = pvc ? market.prices.find((p) => p.month === `${Number(pvc.month.slice(0, 4)) - 1}${pvc.month.slice(4)}`) : undefined;
  const pvcDelta = pvc?.pvc != null && pvcJaar?.pvc ? Math.round(((pvc.pvc - pvcJaar.pvc) / pvcJaar.pvc) * 1000) / 10 : null;

  const inzichten: Insight[] = [];
  if (groei != null) {
    inzichten.push({
      Icon: groei >= 0 ? TrendingUp : TrendingDown,
      tone: groei >= 0 ? 'brand' : 'warn',
      text: `De laatste ${vol.length - helft} maanden brachten **${groei >= 0 ? '+' : ''}${String(groei).replace('.', ',')}%** omzet ten opzichte van de ${helft} daarvoor.`,
    });
  }
  if (koop?.bigPurchases != null) {
    inzichten.push({
      Icon: ShoppingBag,
      tone: 'neutral',
      text: `Koopstemming (CBS, "grote aankopen"): **${koop.bigPurchases}**${koopEerder?.bigPurchases != null ? `, ${koop.bigPurchases > koopEerder.bigPurchases ? 'beter' : koop.bigPurchases < koopEerder.bigPurchases ? 'slechter' : 'gelijk'} dan drie maanden eerder (${koopEerder.bigPurchases})` : ''}.`,
    });
  }
  if (pvcDelta != null) {
    inzichten.push({
      Icon: Factory,
      tone: pvcDelta > 2 ? 'warn' : 'neutral',
      text: `Invoerprijs PVC-vloeren **${pvcDelta >= 0 ? '+' : ''}${String(pvcDelta).replace('.', ',')}%** op jaarbasis — ${pvcDelta > 2 ? 'houd de inkoopprijzen in de gaten.' : 'stabiel.'}`,
    });
  }

  return (
    <div className="space-y-5">
      {/* 1. Kerngetal en duiding */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
        <HeroCard
          label="Omzet, laatste 12 maanden"
          status={besteMaand ? `beste maand: ${besteMaand.label}` : undefined}
          tone="good"
          value={omzet12}
          format={(v) => formatEuro(v)}
          sub="Geaccepteerde offertes, ex btw, inclusief de lopende maand"
        >
          <MiniStat label="Marge" value={formatEuro(marge12)} sub={omzet12 > 0 ? `${formatPercent(Math.round((marge12 / omzet12) * 1000) / 10)} van de omzet` : undefined} />
          <MiniStat label="Verkochte m²" value={`${formatNumber(m2_12)} m²`} sub={`${formatNumber(Math.round(m2_12 / 12))} m² per maand`} />
        </HeroCard>
        <InsightCard items={inzichten} />
      </div>

      {/* 2. Hoofdgrafiek */}
      <HighlightChart
        series={[
          { key: 'omzet', label: 'Omzet', title: 'Omzet per maand', fmt: (v) => formatEuro(v), axisFmt: kortEuro, points: maanden.map((m) => ({ label: m.label, value: m.revenue, current: m.current })) },
          { key: 'marge', label: 'Marge', title: 'Marge per maand', fmt: (v) => formatEuro(v), axisFmt: kortEuro, points: maanden.map((m) => ({ label: m.label, value: m.margin, current: m.current })) },
          { key: 'm2', label: 'M²', title: 'Verkochte m² per maand', fmt: (v) => `${formatNumber(v)} m²`, points: maanden.map((m) => ({ label: m.label, value: m.m2, current: m.current })) },
        ]}
        footnote="De lopende maand staat lichter: die is nog niet af"
      />

      {/* 3. Verdieping */}
      <DetailsLabel />
      <ChartCard
        title="KPI's naast elkaar"
        subtitle="Kies een vraag of stel zelf samen; euro's links, aantallen en procenten rechts"
        action={
          <div className="flex rounded-full bg-sunk p-1 text-[11.5px]">
            {(['week', 'month'] as Granularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGran(g)}
                className={cn('rounded-full px-2.5 py-1 font-medium transition', granularity === g ? 'bg-night text-white shadow-sm' : 'text-ink-mute hover:text-ink')}
              >
                {g === 'week' ? 'Week' : 'Maand'}
              </button>
            ))}
          </div>
        }
      >
        <KpiTrendChart data={kpiSeries} />
      </ChartCard>
      <TrendsView snapshot={snap} openStock={openStock} />
      <MarketPanel data={market} />
    </div>
  );
}
