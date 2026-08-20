'use client';

import { formatDays, formatEuro, formatPercent } from '@/lib/format';
import type { DecisionTime, WinRateBucket, WinRatePoint } from '@/lib/insights';
import {
  DecisionTimeChart,
  WinRateBySizeChart,
  WinRateTrendChart,
} from '@/components/charts/WinRateCharts';
import { useDashboard } from '@/components/layout/DashboardProvider';
import KpiCard from '@/components/KpiCard';
import ChartCard from '@/components/ChartCard';
import PipelineCard from '@/components/PipelineCard';
import CountsByWeekChart from '@/components/charts/CountsByWeekChart';
import EmptyState from '@/components/pages/EmptyState';
import { SectionLabel } from '@/components/ui';

/** Wat er nog binnen kán komen uit offertes die open staan. */
export default function PijplijnView({
  winRateSize,
  winRateTrend,
  decision,
  definition,
}: {
  winRateSize: WinRateBucket[];
  winRateTrend: WinRatePoint[];
  decision: DecisionTime;
  definition: string;
}) {
  const { snap, pipeline, pricedCodes, series } = useDashboard();
  if (!snap) return <EmptyState />;

  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>Open offertes — huidige stand</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Open waarde" value={formatEuro(pipeline.openValue)} sub={`${pipeline.openCount} offertes`} accent="warn" />
          <KpiCard
            label="Verwachte omzet"
            value={pipeline.expectedValue == null ? '—' : formatEuro(pipeline.expectedValue)}
            sub="open waarde × winkans"
            accent="accent"
          />
          <KpiCard
            label="Winkans"
            value={formatPercent(pipeline.winRate)}
            // De gekozen definitie hoort náást het getal, niet weggestopt in de
            // instellingen -- anders weet je over een half jaar niet wat je leest.
            sub={
              pipeline.maturedTotal > 0
                ? `${pipeline.maturedAccepted} van ${pipeline.maturedTotal} · ${definition}`
                : 'te weinig historie'
            }
            accent="good"
          />
          <KpiCard
            label="Langer dan 60 dagen open"
            value={formatEuro(pipeline.ageTiers.find((t) => t.label.includes('60'))?.value ?? 0)}
            sub="hoe ouder, hoe kleiner de kans"
            accent="crit"
            higherIsBetter={false}
          />
        </div>
      </section>

      <ChartCard
        title="Pijplijn"
        subtitle="Gewogen met de historische winkans, plus de oudste open offertes"
      >
        <PipelineCard pipeline={pipeline} pricedCodes={pricedCodes} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Winkans per ordergrootte"
          subtitle={`Van de uitgewerkte offertes — ${definition}`}
        >
          <WinRateBySizeChart data={winRateSize} />
        </ChartCard>
        <ChartCard
          title="Hoe lang doet een klant erover?"
          subtitle={`Mediaan ${formatDays(decision.medianDays)}, maar ${decision.after30} van de ${decision.sample} zeiden pas na 30 dagen ja`}
        >
          <DecisionTimeChart buckets={decision.buckets} />
        </ChartCard>
      </div>

      <ChartCard
        title="Winkans over tijd"
        subtitle="Staven zijn het aantal uitgewerkte offertes, de lijn de winkans"
      >
        <WinRateTrendChart data={winRateTrend} />
      </ChartCard>

      <ChartCard title="Offertes per week" subtitle="Aantal per status">
        <CountsByWeekChart data={series} />
      </ChartCard>
    </div>
  );
}
