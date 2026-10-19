'use client';

import {
  Bar,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Archive, CircleCheck, Phone, PieChart, Scale, TimerOff, TrendingDown } from 'lucide-react';
import type { LostOverview } from '@/lib/lost';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { AXIS_TICK, CHART } from '@/components/charts/theme';
import { ChartDefs, grad } from '@/components/charts/Defs';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { ChartLegend } from '@/components/charts/ChartLegend';
import { Badge, Empty, Panel, cn } from '@/components/ui';
import { Pagination, usePaged } from '@/components/ui/Pagination';
import HeroCard, { MiniStat } from '@/components/page/HeroCard';
import HighlightChart, { kortEuro } from '@/components/page/HighlightChart';
import { DetailsLabel, InsightCard, StatTile, type Insight } from '@/components/overview/cards';

const maandLabel = (m: string) => {
  const [j, mm] = m.split('-');
  return `${['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][Number(mm) - 1]} ’${j.slice(2)}`;
};
const compactEuro = (v: number) => (Math.abs(v) >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`);

/**
 * Wat er niet doorging. Bestaat omdat vandaag bleek dat 427 offertes ter waarde
 * van EUR 1,84 mln nooit in beeld waren — ze verliepen, en die status werd niet
 * opgehaald. De vraag is nu niet "hoeveel verliezen we" maar "wát, en valt daar
 * nog iets aan te doen".
 */
export default function VerlorenView({
  data,
  maturityDays,
  maturityCutoff,
}: {
  data: LostOverview;
  maturityDays: number;
  /**
   * Laatste maand die als uitgehard geldt, server-side bepaald. Date.now() in de
   * render maakt het component onzuiver — bij elke render een andere uitkomst.
   */
  maturityCutoff: string;
}) {
  const {
    months,
    biggest,
    totalLostRevenue,
    totalLostCount,
    medianWon,
    medianLost,
    recentCount,
    recentRevenue,
    expiredShare,
  } = data;

  const gepagineerd = usePaged(biggest);

  // De laatste maanden zijn nog niet uitgehard: een offerte van vorige week kan
  // simpelweg nog niet verlopen zijn. Die maanden lijken daardoor kunstmatig goed.
  const rijp = months.filter((m) => m.month < maturityCutoff);
  const groterVerlies = medianLost != null && medianWon != null && medianLost > medianWon;

  const laatste = rijp.slice(-12);
  const verloren12 = laatste.reduce((t, m) => t + m.lostRevenue, 0);
  const gewonnen12 = laatste.reduce((t, m) => t + m.wonRevenue, 0);
  const aandeel12 = verloren12 + gewonnen12 > 0 ? (verloren12 / (verloren12 + gewonnen12)) * 100 : null;
  const top = biggest.find((q) => q.daysAgo <= 90) ?? biggest[0];
  const kort = (m: string) => maandLabel(m).split(' ')[0];

  const inzichten: Insight[] = [];
  if (groterVerlies) {
    inzichten.push({
      Icon: Scale,
      tone: 'warn',
      text: `De offertes die je misloopt zijn **gróter** dan die je wint: mediaan **${formatEuro(medianLost)}** tegen ${formatEuro(medianWon)}.`,
    });
  }
  inzichten.push({
    Icon: TimerOff,
    tone: 'neutral',
    text: `**${formatPercent(expiredShare)}** is niet afgewezen maar simpelweg verlopen. Geen prijsprobleem, een opvolgprobleem: er is nooit een tweede gesprek geweest.`,
  });
  if (top) {
    inzichten.push({
      Icon: Phone,
      tone: 'brand',
      text: `Grootste die nog warm is: **${top.customerName || top.name}**${top.city ? ` in ${top.city}` : ''}, **${formatEuro(top.revenueExVat)}**, ${top.daysAgo} dagen geleden.`,
    });
  }

  return (
    <div className="space-y-5">
      {/* 1. Kerngetal en duiding */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
        <HeroCard
          label="Nog te bellen"
          status={`${recentCount} offertes, laatste 90 dagen`}
          tone={recentCount > 0 ? 'warn' : 'neutral'}
          value={recentRevenue}
          format={(v) => formatEuro(v)}
          sub="Verlopen of geweigerd, maar recent genoeg om nog te kantelen · ex btw"
          href="/pijplijn#belijst"
          hrefLabel="Naar de belijst"
        >
          <MiniStat label="Mediane gemiste offerte" value={formatEuro(medianLost)} sub={`gewonnen: ${formatEuro(medianWon)}`} />
          <MiniStat label="Stilletjes verlopen" value={formatPercent(expiredShare)} sub="de rest is actief geweigerd" bar={expiredShare / 100} barTone="neutral" />
        </HeroCard>
        <InsightCard items={inzichten} />
      </div>

      {/* 2. Tegels */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile Icon={TrendingDown} label="Verloren, 12 maanden" value={formatEuro(verloren12)} sub="uitgeharde maanden" bars={laatste.map((m) => m.lostRevenue)} />
        <StatTile Icon={CircleCheck} label="Gewonnen, 12 maanden" value={formatEuro(gewonnen12)} sub="dezelfde maanden" bars={laatste.map((m) => m.wonRevenue)} />
        <StatTile Icon={PieChart} label="Aandeel verloren" value={formatPercent(aandeel12)} sub="van alle beslist offertebedrag" />
        <StatTile Icon={Archive} label="Niet doorgegaan, totaal" value={formatEuro(totalLostRevenue)} sub={`${formatNumber(totalLostCount)} offertes sinds het begin`} />
      </div>

      {/* 3. Hoofdgrafiek */}
      <HighlightChart
        series={[
          {
            key: 'verloren',
            label: 'Verloren €',
            title: 'Verloren per maand',
            fmt: (v) => formatEuro(v),
            axisFmt: kortEuro,
            points: laatste.map((m) => ({ label: kort(m.month), value: m.lostRevenue })),
          },
          {
            key: 'aandeel',
            label: 'Aandeel',
            title: 'Aandeel verloren per maand',
            fmt: (v) => formatPercent(v),
            axisFmt: (v) => `${Math.round(v)}%`,
            total: aandeel12 ?? 0,
            sub: 'over de laatste 12 uitgeharde maanden',
            points: laatste.map((m) => ({ label: kort(m.month), value: m.lostShare ?? 0 })),
          },
        ]}
        footnote={`De laatste ${maturityDays} dagen staan er niet in: daar kan een offerte nog verlopen`}
      />

      {/* 4. Verdieping */}
      <DetailsLabel />

      <Panel
        title="Gewonnen tegenover verloren, per maand"
        subtitle="Geaccepteerde offertewaarde naast wat er niet doorging"
      >
        <ChartLegend
          items={[
            { label: 'Gewonnen', color: CHART.accepted },
            { label: 'Verloren', color: CHART.expired },
            { label: 'Aandeel verloren', color: CHART.refused, dashed: true },
          ]}
          right={
            <span className="text-[11px] text-ink-faint">
              laatste {maturityDays} dagen nog niet uitgehard
            </span>
          }
        />
        <ResponsiveContainer width="100%" height={276}>
          <ComposedChart data={months} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
            <ChartDefs />
            <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={maandLabel}
              tick={AXIS_TICK}
              axisLine={{ stroke: CHART.grid }}
              tickLine={false}
              tickMargin={8}
              minTickGap={16}
            />
            <YAxis
              tickFormatter={compactEuro}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ fill: CHART.cursor, radius: 6 }}
              content={
                <ChartTooltip
                  labelFormat={maandLabel}
                  format={(v, k) => (k === 'lostShare' ? formatPercent(v) : formatEuro(v))}
                  dotColors={{
                    wonRevenue: CHART.accepted,
                    lostRevenue: CHART.expired,
                    lostShare: CHART.refused,
                  }}
                />
              }
            />
            <Bar dataKey="wonRevenue" name="Gewonnen" stackId="a" fill={grad('gAccepted')} maxBarSize={30} />
            <Bar
              dataKey="lostRevenue"
              name="Verloren"
              stackId="a"
              fill={grad('gExpired')}
              radius={[4, 4, 0, 0]}
              maxBarSize={30}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="lostShare"
              name="Aandeel verloren"
              stroke={CHART.refused}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
        {rijp.length > 2 && (
          <p className="mt-3 border-t border-hair pt-3 text-[11.5px] leading-relaxed text-ink-faint">
            Lees de laatste twee maanden met terughoudendheid: een offerte van vorige week kán nog
            niet verlopen zijn, dus die maanden zien er altijd beter uit dan ze worden.
          </p>
        )}
      </Panel>

      <Panel
        title="De grootste gemiste offertes"
        subtitle="Grootste bedrag eerst — een belijst, geen archief"
        right={
          <span className="flex items-center gap-1.5 text-[11.5px] text-ink-faint">
            <Phone size={12} strokeWidth={2.2} />
            recent = nog warm
          </span>
        }
        bodyClassName="p-0"
      >
        {biggest.length === 0 ? (
          <Empty>Niets misgelopen.</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="border-b border-hair text-[10.5px] uppercase tracking-wide text-ink-faint">
                    <th className="px-5 py-2 text-left font-semibold">Klant</th>
                    <th className="px-5 py-2 text-left font-semibold">Plaats</th>
                    <th className="px-5 py-2 text-right font-semibold">m²</th>
                    <th className="px-5 py-2 text-right font-semibold">Bedrag</th>
                    <th className="px-5 py-2 text-right font-semibold">Hoe lang geleden</th>
                    <th className="px-5 py-2 text-left font-semibold">Reden</th>
                  </tr>
                </thead>
                <tbody>
                  {gepagineerd.visible.map((q) => {
                    const warm = q.daysAgo <= 90;
                    return (
                      <tr key={q.id} className="border-b border-hair last:border-0 hover:bg-sunk/60">
                        <td className="px-5 py-2.5 font-medium text-ink">
                          {q.customerName || q.name || 'Offerte'}
                        </td>
                        <td className="px-5 py-2.5 text-ink-mute">{q.city || '—'}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">
                          {q.totalM2 > 0 ? formatNumber(q.totalM2) : '—'}
                        </td>
                        <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink">
                          {formatEuro(q.revenueExVat)}
                        </td>
                        <td
                          className={cn(
                            'px-5 py-2.5 text-right tabular-nums',
                            warm ? 'font-semibold text-warn' : 'text-ink-faint',
                          )}
                        >
                          {q.daysAgo} d
                        </td>
                        <td className="px-5 py-2.5">
                          <Badge tone={q.reason === 'refused' ? 'crit' : 'neutral'}>
                            {q.reason === 'refused' ? 'geweigerd' : 'verlopen'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination {...gepagineerd.props} />
            <p className="border-t border-hair px-5 py-3 text-[11.5px] leading-relaxed text-ink-faint">
              &ldquo;Verlopen&rdquo; is een vervaldatum in Teamleader, geen klantbeslissing. Een deel
              van deze mensen heeft de vloer elders gekocht, een deel heeft het uitgesteld en een
              deel wacht nog. Dat laatste deel is precies waarom deze lijst bestaat.
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}
