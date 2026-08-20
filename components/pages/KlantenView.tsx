'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Info } from 'lucide-react';
import type { CustomerConcentration, PaymentDistribution, UnquotedInvoicing } from '@/lib/customers';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { AXIS_TICK, CHART } from '@/components/charts/theme';
import { ChartDefs, grad } from '@/components/charts/Defs';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { ChartLegend } from '@/components/charts/ChartLegend';
import { Empty, Panel, SectionLabel, cn } from '@/components/ui';
import { Pagination } from '@/components/ui/Pagination';
import KpiCard from '@/components/KpiCard';

const PER_PAGE = 20;

/**
 * Wie zijn je klanten, hoe afhankelijk ben je van een paar, en wie laat je
 * wachten. Alles op de factuurkant: een offerte kan verlopen, een factuur is
 * echt geld.
 */
export default function KlantenView({
  concentration,
  payments,
  unquoted,
}: {
  concentration: CustomerConcentration;
  payments: PaymentDistribution;
  unquoted: UnquotedInvoicing;
}) {
  const [page, setPage] = useState(0);
  const { customers, totalRevenue, customersForHalf, top10Share, repeatCustomers } = concentration;

  if (customers.length === 0) {
    return (
      <Panel title="Klanten" subtitle="Concentratie en betaalgedrag">
        <Empty>Nog geen facturen om op te aggregeren.</Empty>
      </Panel>
    );
  }

  const pageCount = Math.ceil(customers.length / PER_PAGE);
  const zichtbaar = customers.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  // Pareto: elke klant een punt, x = hoeveelste klant, y = cumulatief aandeel.
  const pareto = customers.slice(0, 120).map((c, i) => ({
    rang: i + 1,
    aandeel: c.cumulativeShare,
    naam: c.name,
  }));

  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>Over alle facturen, ex. btw</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Klanten"
            value={formatNumber(customers.length)}
            sub={`${repeatCustomers} kwamen meer dan één keer terug`}
          />
          <KpiCard
            label="Gefactureerd"
            value={formatEuro(totalRevenue)}
            sub="over de hele historie"
          />
          <KpiCard
            label="Helft van de omzet"
            value={`${customersForHalf} klanten`}
            sub={`${formatPercent(Math.round((customersForHalf / customers.length) * 1000) / 10)} van je klantenbestand`}
          />
          <KpiCard
            label="Top 10"
            value={formatPercent(top10Share)}
            sub="aandeel van je tien grootste klanten"
            signal={top10Share >= 40 ? 'warn' : undefined}
          />
        </div>
      </section>

      <Panel
        title="Hoe afhankelijk ben je van een paar klanten?"
        subtitle="Klanten op omzet gesorteerd; de lijn toont hoeveel procent van de omzet je met de eerste zoveel klanten te pakken hebt"
      >
        <ChartLegend
          items={[{ label: 'Cumulatief aandeel van de omzet', color: CHART.accepted }]}
          right={
            <span className="text-[11px] text-ink-faint">
              {customersForHalf} klanten voor de eerste helft
            </span>
          }
        />
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={pareto} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
            <ChartDefs />
            <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
            <XAxis
              dataKey="rang"
              tick={AXIS_TICK}
              axisLine={{ stroke: CHART.grid }}
              tickLine={false}
              tickMargin={8}
              // Elke klant is een punt, maar niet elk punt hoeft een label:
              // 120 stuks naast elkaar is een grijze streep, geen as.
              interval={11}
              tickFormatter={(v) => `${v}e`}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
              content={
                <ChartTooltip
                  labelFormat={(l) => `Eerste ${l} klanten`}
                  format={(v) => formatPercent(v)}
                  dotColors={{ aandeel: CHART.accepted }}
                />
              }
            />
            <ReferenceLine y={50} stroke={CHART.axis} strokeDasharray="5 4" strokeWidth={1.4} />
            <Area
              type="monotone"
              dataKey="aandeel"
              name="Cumulatief aandeel"
              stroke={CHART.accepted}
              strokeWidth={2.4}
              fill={grad('aAccepted')}
              dot={false}
              activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <Panel
        title="Klanten op omzet"
        subtitle="Gefactureerd ex. btw, met gemiddelde betaaltermijn waar er genoeg facturen zijn"
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-hair text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-2.5 text-left font-semibold">Klant</th>
                <th className="px-5 py-2.5 text-right font-semibold">Facturen</th>
                <th className="px-5 py-2.5 text-right font-semibold">Betaaltermijn</th>
                <th className="px-5 py-2.5 text-right font-semibold">Op tijd</th>
                <th className="px-5 py-2.5 text-right font-semibold">Laatste factuur</th>
                <th className="px-5 py-2.5 text-right font-semibold">Omzet</th>
              </tr>
            </thead>
            <tbody>
              {zichtbaar.map((c, i) => (
                <tr key={c.id} className="border-b border-hair last:border-0 hover:bg-sunk/60">
                  <td className="px-5 py-2.5">
                    <span className="mr-2 text-[11px] tabular-nums text-ink-faint">
                      {page * PER_PAGE + i + 1}
                    </span>
                    <span className="font-medium text-ink">{c.name}</span>
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">{c.invoices}</td>
                  <td
                    className={cn(
                      'px-5 py-2.5 text-right tabular-nums',
                      c.avgDaysToPay != null && c.avgDaysToPay > 30 ? 'font-semibold text-warn' : 'text-ink-soft',
                    )}
                  >
                    {c.avgDaysToPay == null ? '—' : `${formatNumber(c.avgDaysToPay)} d`}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink-mute">
                    {c.paidTotal > 0 ? `${c.paidOnTime}/${c.paidTotal}` : '—'}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink-faint">{c.lastInvoice}</td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink">
                    {formatEuro(c.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageCount={pageCount}
          total={customers.length}
          perPage={PER_PAGE}
          onChange={setPage}
        />
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="Hoe snel wordt er betaald?"
          subtitle={`Mediaan ${payments.medianDays} dagen, maar slechts ${formatPercent(payments.onTimePct)} op of vóór de vervaldatum`}
        >
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-accent-line bg-accent-soft px-3.5 py-2.5">
            <Info size={14} strokeWidth={2.2} className="mt-0.5 shrink-0 text-accent" />
            <p className="text-[12px] leading-relaxed text-accent/90">
              Die twee cijfers spreken elkaar schijnbaar tegen. Dat komt doordat de verdeling
              tweetoppig is: particulieren rekenen vrijwel meteen af, zakelijke klanten laten het
              lopen. Eén gemiddelde verstopt dat — vandaar de verdeling erbij.
            </p>
          </div>
          <ResponsiveContainer width="100%" height={212}>
            <BarChart data={payments.buckets} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
              <ChartDefs />
              <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                axisLine={{ stroke: CHART.grid }}
                tickLine={false}
                tickMargin={8}
              />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: CHART.cursor, radius: 6 }}
                content={
                  <ChartTooltip
                    format={(v, k) => (k === 'share' ? formatPercent(v) : `${v} facturen`)}
                    dotColors={{ count: CHART.accepted }}
                  />
                }
              />
              <Bar dataKey="count" name="Facturen" fill={grad('gAccepted')} radius={[4, 4, 2, 2]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Wie laat je het langst wachten?"
          subtitle="Gemiddelde betaaltermijn, alleen klanten met minstens drie betaalde facturen"
          bodyClassName="p-0"
        >
          {payments.slowest.length === 0 ? (
            <Empty>Nog te weinig betaalde facturen per klant.</Empty>
          ) : (
            <ul className="divide-y divide-hair">
              {payments.slowest.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                    {c.name}
                  </span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-ink-faint">
                    {c.paidOnTime}/{c.paidTotal} op tijd
                  </span>
                  <span
                    className={cn(
                      'w-[62px] shrink-0 text-right text-[13px] font-bold tabular-nums',
                      (c.avgDaysToPay ?? 0) > 30 ? 'text-warn' : 'text-ink',
                    )}
                  >
                    {formatNumber(c.avgDaysToPay)} d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Facturatie zonder offerte"
        subtitle={`${unquoted.count} van ${unquoted.totalCount} facturen (${formatPercent(unquoted.share)} van de omzet) horen bij een klant die nergens in de offertes voorkomt`}
        bodyClassName="p-0"
      >
        <p className="border-b border-hair px-5 py-3 text-[12px] leading-relaxed text-ink-mute">
          Dit werk valt buiten élke marge-, conversie- en pijplijnberekening. Let op: er is geen
          verwijzing van factuur naar offerte, dus de koppeling gaat op klantnaam. Een deel hiervan
          is dus een naam die nét anders geschreven is, niet per se werk zonder offerte.{' '}
          <strong>Lees het als een bovengrens en een werklijst, niet als een exact bedrag.</strong>
        </p>
        {unquoted.customers.length === 0 ? (
          <Empty>Elke factuur hoort bij een klant die ook een offerte heeft.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[13px]">
              <thead>
                <tr className="border-b border-hair text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-2.5 text-left font-semibold">Klant</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Facturen</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Gefactureerd</th>
                </tr>
              </thead>
              <tbody>
                {unquoted.customers.map((c) => (
                  <tr key={c.name} className="border-b border-hair last:border-0 hover:bg-sunk/60">
                    <td className="px-5 py-2.5 font-medium text-ink">{c.name}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">{c.invoices}</td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink">
                      {formatEuro(c.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
