'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Layers, Megaphone, Percent, Phone, Target, Wallet } from 'lucide-react';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { useDashboard } from '@/components/layout/DashboardProvider';
import EmptyState from '@/components/pages/EmptyState';
import { deltaPct } from '@/lib/signal';
import { buildBriefing } from '@/lib/briefing';
import StatementCard from '@/components/overview/StatementCard';
import GoalModal from '@/components/overview/GoalModal';
import HighlightBars from '@/components/overview/HighlightBars';
import { BriefCard, CallCard, StatTile } from '@/components/overview/cards';
import { CalmDelta } from '@/components/overview/parts';

const DAG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MAAND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/**
 * Goedemorgen/-middag/-avond op de klok van wie kijkt. De server kent die klok
 * niet; useSyncExternalStore geeft daar een neutrale groet, zonder hydratiefout.
 */
const geenAbonnement = () => () => {};
function useGroet(): string {
  return useSyncExternalStore(
    geenAbonnement,
    () => {
      const uur = new Date().getHours();
      return uur < 6 ? 'Goedenacht' : uur < 12 ? 'Goedemorgen' : uur < 18 ? 'Goedemiddag' : 'Goedenavond';
    },
    () => 'Goedendag',
  );
}

/**
 * Overzicht, restyle 2026-10-19 (Vloeruniq zwart + groen, bento-kaarten).
 *
 * Van boven naar beneden:
 *  1. een grote begroeting met de twee acties die ertoe doen;
 *  2. de bento-rij: de maand als zwarte statement-kaart, "in het kort", en wie je belt;
 *  3. vier tegels over de gekozen periode;
 *  4. het ritme van de laatste twaalf weken of maanden.
 * De grafiek met meerdere KPI's tegelijk staat sindsdien op Trends.
 */
export default function OverzichtPage() {
  const { snap, comparison, previous, range, aging, adsDaily, today, pricedCodes, meta } = useDashboard();
  const [doelOpen, setDoelOpen] = useState(false);
  const groet = useGroet();
  const totals = snap?.revenue.totals;
  if (!snap || !totals) return <EmptyState />;

  const ref = range.compare === 'year' ? comparison : (previous ?? comparison);
  const cmp = ref?.revenue;
  const vergelijk = range.compare === 'year' ? 'vs vorig jaar' : 'vs periode ervoor';
  const sample = Math.min(totals.acceptedCount, cmp?.acceptedCount ?? 0);

  const marketingCost = adsDaily.reduce((t, d) => t + d.cost + (d.metaCost ?? 0), 0);
  const prevMarketingCost = ref?.adsCost ? ref.adsCost.google + ref.adsCost.meta : null;
  const showMarketing = marketingCost > 0 || (prevMarketingCost ?? 0) > 0;
  // Alleen volle weken in de tegels: de lopende week is bijna leeg en leest als een dip.
  const wk = today.bars.weeks.filter((p) => !p.current);

  const overdueAmount = aging.overdue.reduce((s, o) => s + o.amount, 0);
  const zinnen = buildBriefing({
    month: today.month,
    breakEven: today.breakEven,
    marginPct: totals.avgMarginPct,
    prevMarginPct: cmp?.avgMarginPct ?? null,
    overdue: { amount: overdueAmount, count: aging.overdue.length, outstanding: aging.totalOutstanding },
  }).filter((z) => !['up', 'down', 'flat', 'goal'].includes(z.kind));

  const d = new Date(`${today.month.month}-${String(today.month.day).padStart(2, '0')}T12:00:00Z`);
  const datum = `${DAG[d.getUTCDay()]} ${d.getUTCDate()} ${MAAND[d.getUTCMonth()]}`;
  const bijgewerkt = meta?.lastSyncAt
    ? new Date(meta.lastSyncAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
    : null;

  return (
    <div className="space-y-5">
      {/* 1. Begroeting */}
      <header className="flex flex-wrap items-end justify-between gap-4 pt-1">
        <div>
          <h1 className="text-[40px] font-semibold leading-tight tracking-[-0.03em] text-ink">{groet}</h1>
          <p className="mt-1 text-[14px] text-ink-mute">
            {datum.charAt(0).toUpperCase() + datum.slice(1)}
            {bijgewerkt && <> · cijfers bijgewerkt om {bijgewerkt}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDoelOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-surface px-5 py-2.5 text-[13.5px] font-medium text-ink shadow-[0_1px_2px_rgba(19,19,19,0.06)] ring-1 ring-line transition hover:ring-ink/20"
          >
            <Target size={15} /> {today.month.goals.revenue ? 'Doelen' : 'Doel instellen'}
          </button>
          <Link
            href="/pijplijn#belijst"
            className="inline-flex items-center gap-2 rounded-full bg-night px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(19,19,19,0.6)] transition hover:bg-night/90"
          >
            <Phone size={15} /> Belijst openen
          </Link>
        </div>
      </header>

      {/* 2. Bento */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr]">
        <div className="lg:col-span-2 xl:col-span-1">
          <StatementCard month={today.month} onGoal={() => setDoelOpen(true)} />
        </div>
        <BriefCard zinnen={zinnen} />
        <CallCard callList={today.callList} pricedCodes={pricedCodes} />
      </div>

      {/* 3. De gekozen periode */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          Icon={Wallet}
          label="Omzet geaccepteerd"
          href="/offertes"
          value={formatEuro(totals.acceptedRevenue)}
          delta={<CalmDelta pct={deltaPct(totals.acceptedRevenue, cmp?.acceptedRevenue)} label={vergelijk} sample={sample} />}
          deltaLabel={`${totals.acceptedCount} offertes · ${vergelijk}`}
          bars={wk.map((p) => p.revenue)}
        />
        <StatTile
          Icon={Percent}
          label="Marge"
          href="/marge"
          value={formatEuro(totals.totalMargin)}
          delta={<CalmDelta pct={deltaPct(totals.totalMargin, cmp?.totalMargin)} label={vergelijk} sample={sample} />}
          deltaLabel={`${formatPercent(totals.avgMarginPct)} van de omzet`}
          bars={wk.map((p) => p.margin)}
        />
        <StatTile
          Icon={Layers}
          label="Verkochte m²"
          href="/planning"
          value={formatNumber(totals.m2Sold)}
          delta={<CalmDelta pct={deltaPct(totals.m2Sold, cmp?.m2Sold)} label={vergelijk} sample={sample} />}
          deltaLabel={vergelijk}
          bars={wk.map((p) => p.m2)}
        />
        {showMarketing ? (
          <StatTile
            Icon={Megaphone}
            label="Marge na marketing"
            href="/marketing"
            value={formatEuro(totals.totalMargin - marketingCost)}
            delta={
              <CalmDelta
                pct={cmp && prevMarketingCost != null ? deltaPct(totals.totalMargin - marketingCost, cmp.totalMargin - prevMarketingCost) : null}
                label={vergelijk}
                sample={sample}
              />
            }
            deltaLabel={`${formatEuro(marketingCost)} aan advertenties`}
            bars={today.trends.marginAfterAds.slice(-12)}
          />
        ) : (
          <StatTile
            Icon={Percent}
            label="Conversie"
            href="/pijplijn"
            value={formatPercent(totals.conversionPct)}
            delta={<CalmDelta pct={deltaPct(totals.conversionPct, cmp?.conversionPct)} label={vergelijk} sample={sample} />}
            deltaLabel={vergelijk}
            bars={wk.map((p) => p.count)}
          />
        )}
      </div>

      {/* 4. Het ritme */}
      <HighlightBars bars={today.bars} />

      {doelOpen && <GoalModal goals={today.month.goals} onClose={() => setDoelOpen(false)} />}
    </div>
  );
}
