'use client';

import { Clock, Gauge, HelpCircle, Megaphone, Percent, Users } from 'lucide-react';
import { useDashboard } from '@/components/layout/DashboardProvider';
import ChartCard from '@/components/ChartCard';
import LeadSourceDonut from '@/components/charts/LeadSourceDonut';
import LeadSourceTable from '@/components/LeadSourceTable';
import RunTimeTrendChart from '@/components/charts/RunTimeTrendChart';
import EmptyState from '@/components/pages/EmptyState';
import LeadSourceTrendChart from '@/components/charts/LeadSourceTrendChart';
import type { LeadSourceTrend } from '@/lib/insights';
import { Empty } from '@/components/ui';
import HeroCard, { MiniStat } from '@/components/page/HeroCard';
import { DetailsLabel, InsightCard, StatTile, type Insight } from '@/components/overview/cards';
import { formatDays, formatEuro, formatPercent } from '@/lib/format';

const isOnbekend = (n: string) => /onbekend/i.test(n);
const opdrachten = (n: number) => `${n} ${n === 1 ? 'opdracht' : 'opdrachten'}`;

/**
 * Leadbronnen in het sjabloon van elke pagina (2026-10-19): de grootste bron
 * als kerngetal, wat de bronnen onderscheidt in "In het kort", een tegel per
 * bron, en het verloop van de mix als hoofdgrafiek.
 *
 * "Onbekend" is geen bron maar een gat in de data — daarom telt die nooit als
 * grootste bron en staat het aandeel apart.
 */
export default function LeadbronnenView({ trend }: { trend: LeadSourceTrend }) {
  const { snap, series } = useDashboard();
  if (!snap) return <EmptyState />;

  const bronnen = snap.leadSources;
  const totaal = bronnen.reduce((t, b) => t + b.revenue, 0);
  const bekend = bronnen.filter((b) => !isOnbekend(b.name));
  const top = bekend[0];
  const onbekend = bronnen.find((b) => isOnbekend(b.name));
  const onbekendAandeel = totaal > 0 && onbekend ? (onbekend.revenue / totaal) * 100 : 0;

  const metMarge = bekend.filter((b) => b.marginPct != null && b.count >= 2);
  const besteMarge = [...metMarge].sort((a, b) => (b.marginPct ?? 0) - (a.marginPct ?? 0))[0];
  const metTijd = bekend.filter((b) => b.avgRunTimeDays != null && b.count >= 2);
  const snelst = [...metTijd].sort((a, b) => (a.avgRunTimeDays ?? 0) - (b.avgRunTimeDays ?? 0))[0];

  const inzichten: Insight[] = [];
  if (besteMarge) {
    inzichten.push({
      Icon: Percent,
      tone: 'brand',
      text: `Beste marge: **${besteMarge.name}** met **${formatPercent(besteMarge.marginPct)}** over ${opdrachten(besteMarge.count)}.`,
    });
  }
  if (snelst) {
    inzichten.push({
      Icon: Clock,
      tone: 'neutral',
      text: `Snelst van akkoord naar uitvoering: **${snelst.name}**, gemiddeld ${formatDays(snelst.avgRunTimeDays)}.`,
    });
  }
  if (onbekendAandeel > 0) {
    inzichten.push({
      Icon: HelpCircle,
      tone: onbekendAandeel > 20 ? 'warn' : 'neutral',
      text: `Bij **${formatPercent(Math.round(onbekendAandeel))}** van de omzet is de leadbron onbekend. Vul die in op de deal in Teamleader, anders weet je niet wat werkt.`,
    });
  }

  return (
    <div className="space-y-5">
      {/* 1. Kerngetal en duiding */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
        <HeroCard
          label={top ? `Grootste leadbron: ${top.name}` : 'Leadbronnen'}
          status={top && totaal > 0 ? `${formatPercent(Math.round((top.revenue / totaal) * 100))} van de omzet` : undefined}
          tone="good"
          value={top?.revenue ?? 0}
          format={(v) => formatEuro(v)}
          sub={top ? <>{opdrachten(top.count)} · gemiddeld {formatEuro(top.avgDealSize)} · geaccepteerd in de periode, ex btw</> : 'Nog geen leadbronnen in deze periode'}
          href="/marketing"
          hrefLabel="Naar marketing"
        >
          <MiniStat label="Bronnen" value={String(bekend.length)} sub="met omzet in de periode" />
          <MiniStat
            label="Leadbron onbekend"
            value={formatPercent(Math.round(onbekendAandeel))}
            sub={onbekend ? `${formatEuro(onbekend.revenue)} omzet` : 'alles ingevuld'}
            bar={onbekendAandeel / 100}
            barTone="neutral"
          />
        </HeroCard>
        <InsightCard items={inzichten} />
      </div>

      {/* 2. Een tegel per bron */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {bekend.slice(0, 4).map((b, i) => (
          <StatTile
            key={b.name}
            Icon={[Megaphone, Users, Gauge, Percent][i] ?? Users}
            label={b.name}
            value={formatEuro(b.revenue)}
            sub={`${opdrachten(b.count)}${b.marginPct != null ? ` · marge ${formatPercent(b.marginPct)}` : ''}`}
          />
        ))}
      </div>

      {/* 3. Hoofdgrafiek: de mix over tijd */}
      <ChartCard title="Verloop per leadbron" subtitle="Geaccepteerde omzet per maand — verschuift de mix, of groeit alles mee?">
        <LeadSourceTrendChart data={trend} />
      </ChartCard>

      {/* 4. Verdieping */}
      <DetailsLabel />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <ChartCard title="Omzet per leadbron" subtitle="Geaccepteerde offertes, ex btw">
          {bronnen.length > 0 ? <LeadSourceDonut data={bronnen} /> : <Empty>Geen data</Empty>}
        </ChartCard>
        <ChartCard title="Doorlooptijd per week" subtitle="Gemiddelde looptijd van geaccepteerd tot uitvoering, in dagen" className="xl:col-span-2">
          <RunTimeTrendChart data={series} />
        </ChartCard>
      </div>
      <ChartCard title="Leadbron-kwaliteit" subtitle="Omzet, dealgrootte, marge en doorlooptijd per bron — bedragen ex btw">
        <LeadSourceTable data={bronnen} />
      </ChartCard>
    </div>
  );
}
