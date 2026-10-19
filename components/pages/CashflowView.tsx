'use client';

import { AlertTriangle, CalendarClock, CircleCheck, Clock, FileWarning, Hourglass, Wallet } from 'lucide-react';
import { formatDays, formatEuro, formatPercent } from '@/lib/format';
import { useDashboard } from '@/components/layout/DashboardProvider';
import ChartCard from '@/components/ChartCard';
import CashflowCard from '@/components/CashflowCard';
import PaymentsCard from '@/components/PaymentsCard';
import EmptyState from '@/components/pages/EmptyState';
import QuotedVsInvoicedPanel from '@/components/pages/QuotedVsInvoicedPanel';
import type { QuotedVsInvoiced } from '@/lib/customers';
import type { CashForecast } from '@/lib/cash-forecast';
import HeroCard, { MiniStat } from '@/components/page/HeroCard';
import HighlightChart, { kortEuro } from '@/components/page/HighlightChart';
import { BENTO, DetailsLabel, InsightCard, StatTile, type Insight } from '@/components/overview/cards';
import { cn } from '@/components/ui';

/**
 * Cashflow, in het sjabloon van elke pagina (2026-10-19):
 *  1. het laagste banksaldo van de komende acht weken in de zwarte kaart, met
 *     wat er te laat is en wat er in Moneybird op te ruimen valt ernaast;
 *  2. vier tegels over openstaand geld en betaalgedrag;
 *  3. de hoofdgrafiek: saldo of netto per week, met tekorten onder de nullijn;
 *  4. verdieping: hoe de prognose is opgebouwd, ouderdom, betaalgedrag.
 */
export default function CashflowView({
  quotedVsInvoiced,
  forecast,
}: {
  quotedVsInvoiced: QuotedVsInvoiced;
  forecast: CashForecast;
}) {
  const { snap, aging, payments, pricedCodes } = useDashboard();
  if (!snap) return <EmptyState />;

  const overdueAmount = aging.overdue.reduce((s, o) => s + o.amount, 0);
  const som = (k: 'inInvoices' | 'inPlanned' | 'outPurchases' | 'outMaterials' | 'outFixed') => forecast.weeks.reduce((s, w) => s + w[k], 0);
  const binnen = som('inInvoices') + som('inPlanned');
  const eruit = som('outPurchases') + som('outMaterials') + som('outFixed');
  const laagste = forecast.lowest?.balance ?? forecast.startBalance;
  const tekort = laagste < 0;

  const inzichten: Insight[] = [];
  if (aging.overdue.length > 0) {
    inzichten.push({
      Icon: AlertTriangle,
      tone: 'crit',
      text: `**${formatEuro(overdueAmount)}** staat over de vervaldatum bij **${aging.overdue.length} ${aging.overdue.length === 1 ? 'factuur' : 'facturen'}**. Dat is de snelste weg naar een beter saldo.`,
    });
  } else {
    inzichten.push({ Icon: CircleCheck, tone: 'brand', text: 'Er staat **niets over de vervaldatum**.' });
  }
  if (forecast.excluded.stalePayables.count > 0) {
    inzichten.push({
      Icon: FileWarning,
      tone: 'warn',
      text: `${forecast.excluded.stalePayables.count} inkoopfacturen (**${formatEuro(forecast.excluded.stalePayables.amount)}**) staan in Moneybird al lang op "te laat". Vrijwel zeker betaald maar niet afgeletterd; ze tellen niet mee in de prognose.`,
    });
  }
  inzichten.push({
    Icon: Clock,
    tone: 'neutral',
    text: `Klanten betalen gemiddeld na **${formatDays(payments.avgDaysToPay)}**; ${formatPercent(payments.onTimePct)} betaalt op tijd.`,
  });

  return (
    <div className="space-y-5">
      {/* 1. Kerngetal en duiding */}
      {forecast.available ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
          <HeroCard
            label="Laagste banksaldo, komende 8 weken"
            status={forecast.lowest ? `in ${forecast.lowest.week}` : undefined}
            tone={tekort ? 'crit' : 'good'}
            value={laagste}
            format={(v) => formatEuro(v)}
            valueTone={tekort ? 'crit' : undefined}
            sub={
              <>
                Nu {formatEuro(forecast.startBalance)} op de bank · over 8 weken {formatEuro(forecast.endBalance)}
              </>
            }
          >
            <MiniStat label="Komt binnen" value={formatEuro(binnen)} sub="facturen en gepland werk" />
            <MiniStat label="Gaat eruit" value={formatEuro(eruit)} sub="inkoop en vaste lasten" />
          </HeroCard>
          <InsightCard items={inzichten} />
        </div>
      ) : (
        <InsightCard items={inzichten} />
      )}

      {/* 2. Tegels */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile Icon={Wallet} label="Openstaand" value={formatEuro(aging.totalOutstanding)} sub={`${payments.outstandingCount} onbetaalde facturen · incl. btw`} />
        <StatTile Icon={AlertTriangle} label="Over de vervaldatum" value={formatEuro(overdueAmount)} sub={`${aging.overdue.length} facturen`} />
        <StatTile
          Icon={Hourglass}
          label="Betaaltermijn"
          value={formatDays(payments.avgDaysToPay)}
          sub={payments.sampleCount > 0 ? `gemiddeld over ${payments.sampleCount} betaalde facturen` : 'nog geen betaaldata'}
        />
        <StatTile Icon={CalendarClock} label="Op tijd betaald" value={formatPercent(payments.onTimePct)} sub="op of vóór de vervaldatum" />
      </div>

      {/* 3. Hoofdgrafiek */}
      {forecast.available && (
        <HighlightChart
          series={[
            {
              key: 'saldo',
              label: 'Saldo',
              title: 'Banksaldo aan het eind van de week',
              fmt: (v) => formatEuro(v),
            axisFmt: kortEuro,
              total: forecast.endBalance,
              sub: 'over 8 weken — onder de streep is een tekort',
              points: forecast.weeks.map((w) => ({ label: w.label, value: w.balance })),
              // Het laagste punt is het moment waar het om gaat.
              highlight: forecast.weeks.reduce((iMin, w, i, arr) => (w.balance < arr[iMin].balance ? i : iMin), 0),
            },
            {
              key: 'netto',
              label: 'Netto per week',
              title: 'Wat er per week bij- of afgaat',
              fmt: (v) => formatEuro(v),
            axisFmt: kortEuro,
              total: forecast.endBalance - forecast.startBalance,
              sub: 'samen over 8 weken',
              points: forecast.weeks.map((w) => ({ label: w.label, value: w.net })),
            },
          ]}
        />
      )}

      {/* 4. Verdieping */}
      <DetailsLabel />
      {forecast.available && <PrognoseOpbouw forecast={forecast} />}

      <QuotedVsInvoicedPanel data={quotedVsInvoiced} />

      <ChartCard title="Openstaand naar ouderdom" subtitle="Onbetaalde facturen ten opzichte van hun vervaldatum">
        <CashflowCard buckets={aging.buckets} overdue={aging.overdue} totalOutstanding={aging.totalOutstanding} pricedCodes={pricedCodes} />
      </ChartCard>

      <ChartCard title="Betaalgedrag" subtitle="Hoe snel klanten betalen, op basis van de betaaldatum">
        <PaymentsCard payments={payments} />
      </ChartCard>
    </div>
  );
}

/** Hoe de prognose is opgebouwd: de vijf posten en de aannames eronder. */
function PrognoseOpbouw({ forecast }: { forecast: CashForecast }) {
  const som = (k: 'inInvoices' | 'inPlanned' | 'outPurchases' | 'outMaterials' | 'outFixed') => forecast.weeks.reduce((s, w) => s + w[k], 0);
  const posten = [
    { label: 'Openstaande facturen', v: som('inInvoices'), plus: true },
    { label: 'Gepland werk, nog te factureren', v: som('inPlanned'), plus: true },
    { label: 'Openstaande inkoopfacturen', v: som('outPurchases'), plus: false },
    { label: 'Inkoop voor gepland werk, nog niet gefactureerd', v: som('outMaterials'), plus: false },
    { label: 'Vaste lasten (gemiddeld)', v: som('outFixed'), plus: false },
  ].filter((p) => Math.round(p.v) !== 0);
  const { assumptions: a, excluded: x } = forecast;
  return (
    <div className={cn(BENTO, 'p-6')}>
      <h3 className="text-[16px] font-semibold tracking-tight text-ink">Hoe de prognose is opgebouwd</h3>
      <dl className="mt-4 divide-y divide-hair">
        <div className="flex items-baseline justify-between gap-3 py-2.5 text-[13.5px]">
          <dt className="text-ink-mute">Nu op de bank</dt>
          <dd className="font-semibold tabular-nums text-ink">{formatEuro(forecast.startBalance)}</dd>
        </div>
        {posten.map((p) => (
          <div key={p.label} className="flex items-baseline justify-between gap-3 py-2.5 text-[13.5px]">
            <dt className="flex items-center gap-2 text-ink-mute">
              <span className={cn('inline-block h-2 w-2 rounded-full', p.plus ? 'bg-brand' : 'bg-ink-faint')} />
              {p.label}
            </dt>
            <dd className="tabular-nums text-ink">
              {p.plus ? '+' : '−'} {formatEuro(p.v)}
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 py-2.5 text-[13.5px]">
          <dt className="font-medium text-ink">Over 8 weken</dt>
          <dd className="font-semibold tabular-nums text-ink">{formatEuro(forecast.endBalance)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">
        Aannames: het geld van een klus komt {formatDays(a.daysToPay)} na de uitvoering binnen; inkoop is {formatPercent(a.materialRatio)} van de
        omzet (uit Moneybird), een week vóór de klus, en telt alleen voor zover die nog niet als inkoopfactuur openstaat; vaste lasten{' '}
        {formatEuro(a.fixedPerWeek)} per week. Btw-afdracht en aanbetalingen zitten er niet in.
        {x.doubtfulReceivables.count > 0 &&
          ` Niet meegeteld: ${x.doubtfulReceivables.count} facturen (${formatEuro(x.doubtfulReceivables.amount)}) die al meer dan 60 dagen over de vervaldatum zijn.`}
      </p>
    </div>
  );
}
