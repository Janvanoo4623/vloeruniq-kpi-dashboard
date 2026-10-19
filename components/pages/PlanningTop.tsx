'use client';

import { CalendarCheck, CalendarX2, Clock3, Hammer, Inbox, Layers, Ruler } from 'lucide-react';
import type { Job, PlanningData } from '@/lib/planning';
import { formatEuro, formatNumber } from '@/lib/format';
import { useDashboard } from '@/components/layout/DashboardProvider';
import HeroCard, { MiniStat } from '@/components/page/HeroCard';
import HighlightChart from '@/components/page/HighlightChart';
import { BENTO, InsightCard, StatTile, type Insight } from '@/components/overview/cards';
import { useQuotationOpener } from '@/components/overview/parts';
import { Pagination, usePaged } from '@/components/ui/Pagination';
import { cn } from '@/components/ui';

const DAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const datumKort = (d: string) => {
  const t = new Date(d + 'T12:00:00Z');
  return { dag: DAG[t.getUTCDay()], nr: t.getUTCDate(), maand: MAAND[t.getUTCMonth()] };
};
const DAY = 86400000;

/**
 * Het bovenste deel van Planning (2026-10-19): hoeveel weken werk er staat, wat
 * er de komende drie weken gebeurt, en wat er gewonnen is maar nog nergens
 * staat. Die laatste lijst was het grote gat: 29 offertes, meer omzet dan de
 * hele ingeplande portefeuille, en nergens zichtbaar.
 */
export default function PlanningTop({ plan }: { plan: PlanningData }) {
  const { pricedCodes } = useDashboard();
  const { open, laden, modal } = useQuotationOpener(pricedCodes);

  const tempo = plan.capacityPerWeek ?? plan.laidPerWeek;
  const drieWeken = new Date(Date.parse(plan.asOf) + 21 * DAY).toISOString().slice(0, 10);
  const agenda = plan.upcoming.filter((j) => j.date < drieWeken);
  const eerste = plan.upcoming[0];
  const dezeWeek = plan.weeks.find((w) => w.current);
  const volgende = plan.weeks[plan.weeks.findIndex((w) => w.current) + 1];
  // Standaard gemarkeerd: de eerste week vanaf nu waarin iets gebeurt.
  const huidig = plan.weeks.findIndex((w) => w.current);
  const metWerk = plan.weeks.findIndex((w, i) => i >= huidig && w.jobs > 0);
  const eersteMetWerk = metWerk >= 0 ? metWerk : huidig;

  const inzichten: Insight[] = [];
  if (plan.emptyWeeks.length > 0) {
    inzichten.push({
      Icon: CalendarX2,
      tone: 'warn',
      text: `In **${plan.emptyWeeks.join(', ')}** staat nog **geen enkele klus** ingepland.`,
    });
  }
  if (eerste) {
    inzichten.push({
      Icon: CalendarCheck,
      tone: 'neutral',
      text: `Eerstvolgende klus: **${eerste.customer}**${eerste.city ? ` in ${eerste.city}` : ''}, ${datumKort(eerste.date).dag} ${datumKort(eerste.date).nr} ${datumKort(eerste.date).maand}${eerste.m2 ? ` (${formatNumber(eerste.m2)} m²)` : ''}.`,
    });
  }
  if (plan.unplanned.length > 0) {
    inzichten.push({
      Icon: Inbox,
      tone: 'crit',
      text: `**${plan.unplanned.length} gewonnen offertes** (${formatEuro(plan.unplannedRevenue)}, ${formatNumber(plan.unplannedM2)} m²) hebben nog geen uitvoerdatum. Plan ze in, of vul de datum in Teamleader in.`,
    });
  }

  return (
    <div className="space-y-5">
      {/* 1. Kerngetal en duiding */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
        <HeroCard
          label="Werk in de planning"
          status={plan.capacityPerWeek ? `bij ${formatNumber(plan.capacityPerWeek)} m² per week` : `bij ${formatNumber(plan.laidPerWeek)} m² per week (gemiddeld gelegd)`}
          tone="neutral"
          value={plan.weeksOfWork ?? 0}
          format={(v) => `${formatNumber(Math.round(v * 10) / 10)} weken`}
          sub={<>{formatNumber(plan.plannedM2)} m² ingepland over {plan.upcoming.length} klussen</>}
        >
          <MiniStat label="Orderportefeuille" value={formatEuro(plan.plannedRevenue)} sub="ingepland, ex btw" />
          <MiniStat
            label="Nog in te plannen"
            value={formatEuro(plan.unplannedRevenue)}
            sub={`${plan.unplanned.length} gewonnen offertes zonder datum`}
            bar={plan.plannedRevenue + plan.unplannedRevenue > 0 ? plan.unplannedRevenue / (plan.plannedRevenue + plan.unplannedRevenue) : null}
          />
        </HeroCard>
        <InsightCard items={inzichten} />
      </div>

      {/* 2. Tegels */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile Icon={Hammer} label="Deze week" value={`${formatNumber(dezeWeek?.m2 ?? 0)} m²`} sub={`${dezeWeek?.jobs ?? 0} klussen`} />
        <StatTile Icon={Clock3} label="Volgende week" value={`${formatNumber(volgende?.m2 ?? 0)} m²`} sub={`${volgende?.jobs ?? 0} klussen`} />
        <StatTile
          Icon={Ruler}
          label="Gemiddeld gelegd"
          value={`${formatNumber(plan.laidPerWeek)} m²`}
          sub="per week, laatste 12 weken"
          bars={plan.weeks.filter((w) => w.past).map((w) => w.m2)}
        />
        <StatTile Icon={Layers} label="Nog in te plannen" value={`${formatNumber(plan.unplannedM2)} m²`} sub={`${plan.unplanned.length} offertes · ${formatEuro(plan.unplannedRevenue)}`} />
      </div>

      {/* 3. Hoofdgrafiek */}
      <HighlightChart
        series={[
          {
            key: 'm2',
            label: 'm²',
            title: 'm² per week · gelegd en gepland',
            fmt: (v) => `${formatNumber(v)} m²`,
            total: plan.plannedM2,
            sub: 'nog te leggen, over alle ingeplande klussen',
            points: plan.weeks.map((w) => ({ label: w.label, value: w.m2, muted: w.past })),
            highlight: eersteMetWerk,
            reference: tempo > 0 ? { value: tempo, label: plan.capacityPerWeek ? 'capaciteit' : 'gemiddeld gelegd' } : undefined,
          },
          {
            key: 'jobs',
            label: 'Klussen',
            title: 'Klussen per week',
            fmt: (v) => formatNumber(v),
            total: plan.upcoming.length,
            sub: 'ingepland vanaf vandaag',
            points: plan.weeks.map((w) => ({ label: w.label, value: w.jobs, muted: w.past })),
            highlight: eersteMetWerk,
          },
        ]}
        footnote="Verleden weken staan lichter; de gestippelde lijn is wat er per week gelegd kan worden"
      />

      {/* 4. Wat er staat, en wat er nog bij moet */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Agenda jobs={agenda} onOpen={open} laden={laden} />
        <NogInTePlannen plan={plan} onOpen={open} laden={laden} />
      </div>
      {modal}
    </div>
  );
}

function Agenda({ jobs, onOpen, laden }: { jobs: Job[]; onOpen: (id: string) => void; laden: string | null }) {
  return (
    <div className={cn(BENTO, 'flex flex-col p-6')}>
      <h3 className="text-[16px] font-semibold tracking-tight text-ink">Komende drie weken</h3>
      {jobs.length === 0 ? (
        <p className="mt-5 text-[13px] text-ink-faint">Niets ingepland in de komende drie weken.</p>
      ) : (
        <ul className="mt-4 space-y-1">
          {jobs.slice(0, 8).map((j) => {
            const d = datumKort(j.date);
            return (
              <li key={j.dealId}>
                <button
                  type="button"
                  disabled={!j.quotationId}
                  onClick={() => j.quotationId && onOpen(j.quotationId)}
                  className={cn(
                    '-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2 text-left transition',
                    j.quotationId && 'hover:bg-sunk',
                    laden === j.quotationId && 'opacity-60',
                  )}
                >
                  <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-sunk leading-none">
                    <span className="text-[10px] font-medium uppercase text-ink-faint">{d.dag}</span>
                    <span className="mt-0.5 text-[15px] font-semibold text-ink">{d.nr}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{j.customer}</span>
                    <span className="block truncate text-[11.5px] text-ink-faint">
                      {[j.city, j.floor].filter(Boolean).join(' · ') || d.maand}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13.5px] font-semibold tabular-nums text-ink">{j.m2 ? `${formatNumber(j.m2)} m²` : '—'}</span>
                    <span className="block text-[11px] tabular-nums text-ink-faint">{j.revenue ? formatEuro(j.revenue) : ''}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {jobs.length > 8 && <p className="mt-auto pt-3 text-[11.5px] text-ink-faint">en nog {jobs.length - 8} klussen</p>}
    </div>
  );
}

function NogInTePlannen({ plan, onOpen, laden }: { plan: PlanningData; onOpen: (id: string) => void; laden: string | null }) {
  const { visible, props } = usePaged(plan.unplanned, 7);
  return (
    <div className={cn(BENTO, 'flex flex-col overflow-hidden')}>
      <div className="px-6 pt-6">
        <h3 className="text-[16px] font-semibold tracking-tight text-ink">Gewonnen, nog niet ingepland</h3>
        <p className="mt-1 text-[12.5px] text-ink-mute">Laatste 120 dagen, zonder uitvoerdatum in Teamleader. Oudste eerst.</p>
      </div>
      {plan.unplanned.length === 0 ? (
        <p className="px-6 py-5 text-[13px] text-ink-faint">Alles wat gewonnen is, staat ingepland.</p>
      ) : (
        <ul className="mt-3 space-y-1 px-6 pb-3">
          {visible.map((u) => (
            <li key={u.quotationId}>
              <button
                type="button"
                onClick={() => onOpen(u.quotationId)}
                className={cn(
                  '-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-sunk',
                  laden === u.quotationId && 'opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl leading-none',
                    u.daysSince > 60 ? 'bg-crit-soft text-crit' : u.daysSince > 30 ? 'bg-warn-soft text-warn' : 'bg-sunk text-ink',
                  )}
                  title="Dagen sinds akkoord"
                >
                  <span className="text-[15px] font-semibold">{u.daysSince}</span>
                  <span className="mt-0.5 text-[9.5px] font-medium uppercase opacity-70">dagen</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{u.customer}</span>
                  <span className="block truncate text-[11.5px] text-ink-faint">{[u.city, u.floor].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[13.5px] font-semibold tabular-nums text-ink">{u.m2 ? `${formatNumber(u.m2)} m²` : '—'}</span>
                  <span className="block text-[11px] tabular-nums text-ink-faint">{formatEuro(u.revenue)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto">
        <Pagination {...props} />
      </div>
    </div>
  );
}
