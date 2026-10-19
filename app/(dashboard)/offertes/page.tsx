'use client';

import { CircleCheck, CircleDashed, FileText, Gem, Percent, TimerOff } from 'lucide-react';
import { useDashboard } from '@/components/layout/DashboardProvider';
import ChartCard from '@/components/ChartCard';
import QuotationsTable from '@/components/QuotationsTable';
import WeekOverviewTable from '@/components/WeekOverviewTable';
import EmptyState from '@/components/pages/EmptyState';
import HeroCard, { MiniStat } from '@/components/page/HeroCard';
import HighlightChart, { kortEuro, laatsteWeekLoopt } from '@/components/page/HighlightChart';
import { DetailsLabel, InsightCard, StatTile, type Insight } from '@/components/overview/cards';
import { formatEuro, formatPercent, shortWeek } from '@/lib/format';

/**
 * Offertes in het sjabloon van elke pagina (2026-10-19): wat er in de periode
 * gewonnen is, hoe de stapel verdeeld is, en per week; de volledige lijst
 * staat eronder, want dat is waar je op deze pagina eigenlijk voor komt.
 */
export default function OffertesPage() {
  const { snap, pricedCodes, series, range } = useDashboard();
  if (!snap) return <EmptyState />;

  const t = snap.revenue.totals;
  const isLopend = (i: number) => laatsteWeekLoopt(range.to) && i === series.length - 1;
  const totaal = t.acceptedCount + t.openCount + t.refusedCount + t.expiredCount;
  const gewonnen = snap.quotations.filter((q) => q.status === 'accepted');
  const grootste = [...gewonnen].sort((a, b) => b.revenueExVat - a.revenueExVat)[0];
  const zonderMarge = gewonnen.filter((q) => q.margin == null).length;

  const inzichten: Insight[] = [
    {
      Icon: Percent,
      tone: 'neutral',
      text: `Van de beslisten werd **${formatPercent(t.conversionPct)}** gewonnen; ${t.expiredCount} offertes liepen af zonder antwoord.`,
    },
  ];
  if (grootste) {
    inzichten.push({
      Icon: Gem,
      tone: 'brand',
      text: `Grootste opdracht: **${grootste.customerName || grootste.name}**${grootste.city ? ` in ${grootste.city}` : ''}, **${formatEuro(grootste.revenueExVat)}**.`,
    });
  }
  if (zonderMarge > 0) {
    inzichten.push({
      Icon: CircleDashed,
      tone: 'warn',
      text: `**${zonderMarge} van de ${gewonnen.length}** gewonnen offertes hebben nog geen marge: er ontbreekt een inkoopprijs.`,
    });
  }

  return (
    <div className="space-y-5">
      {/* 1. Kerngetal en duiding */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
        <HeroCard
          label="Gewonnen in deze periode"
          status={`${t.acceptedCount} van ${totaal} offertes`}
          tone="good"
          value={t.acceptedRevenue}
          format={(v) => formatEuro(v)}
          sub={<>Gemiddeld {formatEuro(t.avgRevenuePerDeal)} per opdracht · ex btw</>}
          href="/pijplijn"
          hrefLabel="Naar de pijplijn"
        >
          <MiniStat label="Conversie" value={formatPercent(t.conversionPct)} sub="gewonnen van de beslisten" bar={t.conversionPct / 100} />
          <MiniStat label="Nog open" value={formatEuro(t.openRevenue)} sub={`${t.openCount} offertes`} />
        </HeroCard>
        <InsightCard items={inzichten} />
      </div>

      {/* 2. Tegels: de offertes naar status */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile Icon={FileText} label="Offertes" value={String(totaal)} sub="gemaakt of beslist in de periode" />
        <StatTile Icon={CircleCheck} label="Geaccepteerd" value={String(t.acceptedCount)} sub={formatEuro(t.acceptedRevenue)} />
        <StatTile Icon={CircleDashed} label="Open" value={String(t.openCount)} sub={formatEuro(t.openRevenue)} />
        <StatTile Icon={TimerOff} label="Verlopen of geweigerd" value={String(t.expiredCount + t.refusedCount)} sub={formatEuro(t.expiredRevenue + t.refusedRevenue)} />
      </div>

      {/* 3. Hoofdgrafiek */}
      <HighlightChart
        series={[
          {
            key: 'gewonnen',
            label: 'Gewonnen €',
            title: 'Gewonnen per week',
            fmt: (v) => formatEuro(v),
            axisFmt: kortEuro,
            points: series.map((w, i) => ({ label: shortWeek(w.week), value: w.acceptedRevenue, current: isLopend(i) })),
          },
          {
            key: 'aantal',
            label: 'Aantal',
            title: 'Gewonnen offertes per week',
            fmt: (v) => String(Math.round(v)),
            points: series.map((w, i) => ({ label: shortWeek(w.week), value: w.acceptedCount, current: isLopend(i) })),
          },
          {
            key: 'verlopen',
            label: 'Verlopen',
            title: 'Verlopen per week',
            fmt: (v) => formatEuro(v),
            axisFmt: kortEuro,
            points: series.map((w, i) => ({ label: shortWeek(w.week), value: w.expiredRevenue, current: isLopend(i) })),
          },
        ]}
      />

      {/* 4. De lijst */}
      <DetailsLabel>Alle offertes</DetailsLabel>
      <ChartCard title="Offertes" subtitle="Alle offertes in de periode — klik een rij voor details">
        <QuotationsTable rows={snap.quotations} pricedCodes={pricedCodes} />
      </ChartCard>

      <ChartCard title="Weekoverzicht" subtitle="KPI's per week — nieuwste eerst">
        <WeekOverviewTable snapshot={snap} />
      </ChartCard>
    </div>
  );
}
