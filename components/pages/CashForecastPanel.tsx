'use client';

import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CashForecast } from '@/lib/cash-forecast';
import { formatDays, formatEuro, formatPercent } from '@/lib/format';
import { AXIS_TICK, CHART } from '@/components/charts/theme';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { ChartLegend } from '@/components/charts/ChartLegend';
import { Card, cn } from '@/components/ui';
import CountUp from '@/components/CountUp';

const compactEuro = (v: number) => (Math.abs(v) >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`);

const KLEUR = { in: CHART.accepted, out: CHART.adsCost, saldo: CHART.open };

/**
 * "Kan ik die bus kopen?" Het laagste punt van de komende acht weken is het
 * getal dat telt, niet het eindsaldo: een tekort in week drie los je niet op
 * met geld dat in week zeven binnenkomt. Rood alleen als het saldo onder nul
 * zakt — dan betekent het echt iets.
 */
export default function CashForecastPanel({ forecast }: { forecast: CashForecast }) {
  const { weeks, lowest, startBalance, endBalance, assumptions, excluded } = forecast;
  const tekort = (lowest?.balance ?? 0) < 0;
  const data = weeks.map((w) => ({
    label: w.label,
    in: w.inInvoices + w.inPlanned,
    out: -(w.outPurchases + w.outMaterials + w.outFixed),
    saldo: w.balance,
  }));
  const totaal = (k: 'inInvoices' | 'inPlanned' | 'outPurchases' | 'outMaterials' | 'outFixed') => weeks.reduce((s, w) => s + w[k], 0);

  return (
    <Card>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr]">
        <div className="px-6 py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Laagste banksaldo, komende 8 weken</p>
          <p className={cn('mt-2 text-[48px] font-bold leading-none tracking-tight tabular-nums', tekort ? 'text-crit' : 'text-ink')}>
            <CountUp value={lowest?.balance ?? startBalance} format={(v) => formatEuro(v)} />
          </p>
          <p className="mt-2 text-[13px] text-ink-mute">
            in {lowest?.week ?? '—'} · nu {formatEuro(startBalance)} op de bank · over 8 weken {formatEuro(endBalance)}
          </p>

          <dl className="mt-5 space-y-1.5 text-[12.5px]">
            {[
              ['Openstaande facturen', totaal('inInvoices'), true],
              ['Gepland werk, nog te factureren', totaal('inPlanned'), true],
              ['Openstaande inkoopfacturen', totaal('outPurchases'), false],
              ['Inkoop voor gepland werk, nog niet gefactureerd', totaal('outMaterials'), false],
              ['Vaste lasten (gemiddeld)', totaal('outFixed'), false],
            ]
              .filter(([, v]) => Math.round(v as number) !== 0)
              .map(([label, v, plus]) => (
              <div key={label as string} className="flex items-baseline justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-ink-mute">
                  <i className="inline-block h-2 w-2 rounded-[2px]" style={{ background: plus ? KLEUR.in : KLEUR.out }} />
                  {label as string}
                </dt>
                <dd className="tabular-nums text-ink">
                  {plus ? '+' : '−'} {formatEuro(v as number)}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="border-t border-hair px-5 py-5 lg:border-l lg:border-t-0">
          <ChartLegend
            items={[
              { label: 'Komt binnen', color: KLEUR.in },
              { label: 'Gaat eruit', color: KLEUR.out },
              { label: 'Saldo eind van de week', color: KLEUR.saldo },
            ]}
          />
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }} stackOffset="sign">
              <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: CHART.grid }} tickLine={false} tickMargin={8} />
              <YAxis tickFormatter={compactEuro} tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} />
              <ReferenceLine y={0} stroke={CHART.axis} />
              <Tooltip
                cursor={{ fill: CHART.cursor }}
                content={<ChartTooltip format={(v) => formatEuro(v)} dotColors={{ in: KLEUR.in, out: KLEUR.out, saldo: KLEUR.saldo }} />}
              />
              <Bar dataKey="in" name="Komt binnen" stackId="s" fill="url(#gAccepted)" radius={[5, 5, 0, 0]} maxBarSize={28} animationDuration={800} />
              <Bar dataKey="out" name="Gaat eruit" stackId="s" fill="url(#gAdsCost)" radius={[0, 0, 5, 5]} maxBarSize={28} animationDuration={800} />
              <Line type="monotone" dataKey="saldo" name="Saldo" stroke={KLEUR.saldo} strokeWidth={2.6} dot={{ r: 3.5, fill: '#fff', stroke: KLEUR.saldo, strokeWidth: 2 }} activeDot={{ r: 5.5, fill: KLEUR.saldo, stroke: '#fff', strokeWidth: 2.5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="border-t border-hair px-6 py-3 text-[11.5px] leading-relaxed text-ink-faint">
        Aannames: het geld van een klus komt {formatDays(assumptions.daysToPay)} na de uitvoering binnen (factuur een week
        later, dan de mediane betaaltermijn); inkoop is {formatPercent(assumptions.materialRatio)} van de omzet (echte
        verhouding uit Moneybird), een week vóór de klus, en telt alleen voor zover die nog niet als inkoopfactuur openstaat;
        vaste lasten {formatEuro(assumptions.fixedPerWeek)} per week. Btw-afdracht en een eventuele aanbetaling zitten er
        niet in.
        {excluded.doubtfulReceivables.count > 0 &&
          ` Niet meegeteld: ${excluded.doubtfulReceivables.count} facturen van samen ${formatEuro(excluded.doubtfulReceivables.amount)} die al meer dan 60 dagen over de vervaldatum zijn.`}
        {excluded.stalePayables.count > 0 &&
          ` Ook niet: ${excluded.stalePayables.count} inkoopfacturen (${formatEuro(excluded.stalePayables.amount)}) die in Moneybird al langer dan een maand 'te laat' staan — vrijwel zeker betaald maar niet afgeletterd. Letter ze af in Moneybird, dan klopt deze prognose beter.`}
      </div>
    </Card>
  );
}
