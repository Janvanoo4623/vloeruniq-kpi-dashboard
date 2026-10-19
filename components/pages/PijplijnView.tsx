'use client';

import { formatDays, formatEuro, formatPercent } from '@/lib/format';
import type { DecisionTime, WinRateBucket, WinRatePoint } from '@/lib/insights';
import {
  DecisionTimeChart,
  WinRateBySizeChart,
  WinRateTrendChart,
} from '@/components/charts/WinRateCharts';
import { useDashboard } from '@/components/layout/DashboardProvider';
import ChartCard from '@/components/ChartCard';
import PipelineCard from '@/components/PipelineCard';
import CountsByWeekChart from '@/components/charts/CountsByWeekChart';
import EmptyState from '@/components/pages/EmptyState';
import { FileText, Hourglass, Snowflake, Sparkles } from 'lucide-react';
import HeroCard, { MiniStat } from '@/components/page/HeroCard';
import HighlightChart from '@/components/page/HighlightChart';
import { CallCard, DetailsLabel, StatTile } from '@/components/overview/cards';
import CallListPanel from '@/components/pages/CallListPanel';

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
  const { snap, pipeline, pricedCodes, series, today } = useDashboard();
  if (!snap) return <EmptyState />;

  const tier = (i: number) => pipeline.ageTiers[i] ?? { label: '', count: 0, value: 0 };
  const maand = (m: string) => ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][Number(m.slice(5, 7)) - 1];
  const trend = winRateTrend.slice(-12);

  return (
    <div className="space-y-5">
      {/* 1. Kerngetal en de belijst */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
        <HeroCard
          label="Verwachte omzet uit open offertes"
          status={pipeline.winRate != null ? `winkans ${formatPercent(pipeline.winRate)}` : undefined}
          tone="neutral"
          value={pipeline.expectedValue ?? 0}
          format={(v) => formatEuro(v)}
          sub={<>{formatEuro(pipeline.openValue)} open in {pipeline.openCount} offertes × de historische winkans</>}
          href="/offertes"
          hrefLabel="Naar alle offertes"
        >
          <MiniStat label="Open waarde" value={formatEuro(pipeline.openValue)} sub={`${pipeline.openCount} offertes, ex btw`} />
          <MiniStat
            label="Waarvan vers (0–30 dagen)"
            value={formatEuro(tier(0).value)}
            sub="hoe jonger, hoe groter de kans"
            bar={pipeline.openValue > 0 ? tier(0).value / pipeline.openValue : null}
          />
        </HeroCard>
        <CallCard callList={today.callList} pricedCodes={pricedCodes} />
      </div>

      {/* 2. Tegels: de stapel naar leeftijd */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile Icon={FileText} label="Open offertes" value={String(pipeline.openCount)} sub={`${formatEuro(pipeline.openValue)} samen`} />
        <StatTile Icon={Sparkles} label="Vers, 0–30 dagen" value={formatEuro(tier(0).value)} sub={`${tier(0).count} offertes — hier zit de kans`} />
        <StatTile Icon={Hourglass} label="31–60 dagen" value={formatEuro(tier(1).value)} sub={`${tier(1).count} offertes — nu nabellen`} />
        <StatTile Icon={Snowflake} label="Ouder dan 60 dagen" value={formatEuro(tier(2).value)} sub={`${tier(2).count} offertes — waarschijnlijk verloren`} />
      </div>

      {/* 3. Hoofdgrafiek */}
      <HighlightChart
        series={[
          {
            key: 'winkans',
            label: 'Winkans',
            title: 'Winkans per maand',
            fmt: (v) => formatPercent(v),
            axisFmt: (v) => `${Math.round(v)}%`,
            total: pipeline.winRate ?? 0,
            sub: `over alle uitgewerkte offertes · ${definition}`,
            points: trend.map((p) => ({ label: maand(p.month), value: p.winRate ?? 0, muted: p.provisional })),
          },
          {
            key: 'besluit',
            label: 'Beslist',
            title: 'Uitgewerkte offertes per maand',
            fmt: (v) => String(Math.round(v)),
            sub: 'gewonnen en verloren samen',
            points: trend.map((p) => ({ label: maand(p.month), value: p.decided, muted: p.provisional })),
          },
        ]}
        footnote="De laatste maanden staan lichter: daar kunnen offertes nog kantelen"
      />

      {/* 4. Verdieping */}
      <DetailsLabel />

      <CallListPanel callList={today.callList} pricedCodes={pricedCodes} />

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
