'use client';

import { ChevronRight } from 'lucide-react';
import type { AdsPlatform, AdsTotals, AdsWeekPoint, GoogleLeadStats, GoogleWeekPoint } from '@/lib/ads';
import { deltaPct, PLATFORM_SOURCE_LABEL } from '@/lib/ads';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { CHART } from '@/components/charts/theme';
import Sparkline from '@/components/charts/Sparkline';
import { Card, cn } from './ui';
import { Delta, PLATFORM_COLOR } from './AdsHero';

/**
 * Van inzet tot gewonnen deal, in vier tegels die naar rechts lopen. Elke
 * tegel draagt zijn eigen weekverloop als sparkline, zodat je niet alleen
 * ziet hoeveel maar ook of het aantrekt of inzakt. De afgeleiden (per klik,
 * per conversie, per deal) staan klein onder het getal waar ze bij horen.
 */
export default function AdsFunnel({
  platform,
  ads,
  prev,
  leads,
  weeks,
  leadWeeks,
  deltaLabel,
}: {
  platform: AdsPlatform;
  ads: AdsTotals;
  prev: AdsTotals | null;
  leads: GoogleLeadStats;
  weeks: AdsWeekPoint[];
  leadWeeks: GoogleWeekPoint[];
  deltaLabel: string;
}) {
  const color = PLATFORM_COLOR[platform];
  const costPerWonDeal = leads.count > 0 ? ads.cost / leads.count : null;
  const tiles: Tile[] = [
    {
      label: 'Ingezet',
      value: formatEuro(ads.cost),
      delta: deltaPct(ads.cost, prev?.cost),
      higherIsBetter: false,
      spark: weeks.map((w) => w.cost),
      color,
      facts: [[formatNumber(ads.impressions), 'vertoningen'], [formatEuro(ads.cost / Math.max(1, ads.activeDays)), 'per dag']],
    },
    {
      label: 'Klikken',
      value: formatNumber(ads.clicks),
      delta: deltaPct(ads.clicks, prev?.clicks),
      spark: weeks.map((w) => w.clicks),
      color,
      facts: [[formatPercent(ads.ctr), 'CTR'], [formatEuro(ads.cpc, true), 'per klik']],
    },
    {
      label: platform === 'meta' ? 'Conversies' : 'Alle conversies',
      value: formatNumber(Math.round(ads.conversions)),
      delta: deltaPct(ads.conversions, prev?.conversions),
      spark: weeks.map((w) => w.conversions),
      color,
      facts: [
        [formatEuro(ads.cpa), 'per conversie'],
        [platform === 'meta' ? 'leads, berichten, contact' : 'alle conversieacties van Google', ''],
      ],
    },
    {
      label: 'Gewonnen',
      value: formatNumber(leads.count),
      spark: leadWeeks.map((w) => w.count),
      color: CHART.accepted,
      facts: [[formatEuro(costPerWonDeal), 'per deal'], [formatEuro(leads.revenue), `omzet · “${PLATFORM_SOURCE_LABEL[platform]}”`]],
      accent: true,
    },
  ];

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-4 px-5 pt-4">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight text-ink">Van inzet tot gewonnen deal</h3>
          <p className="mt-0.5 text-xs text-ink-mute">Per week in de lijntjes; het platform telt de conversie, Teamleader de gewonnen offerte</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:gap-2">
        {tiles.map((t, i) => (
          <div key={t.label} className="contents">
            <TileBlock {...t} deltaLabel={deltaLabel} />
            {i < tiles.length - 1 && (
              <div className="hidden items-center lg:flex" aria-hidden>
                <ChevronRight size={16} strokeWidth={2} className="text-ink-faint" />
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

interface Tile {
  label: string;
  value: string;
  delta?: number | null;
  higherIsBetter?: boolean;
  spark: number[];
  color: string;
  facts: [string, string][];
  accent?: boolean;
}

function TileBlock({ label, value, delta, higherIsBetter = true, spark, color, facts, accent, deltaLabel }: Tile & { deltaLabel: string }) {
  return (
    <div className={cn('min-w-0 rounded-xl border p-3.5', accent ? 'border-accent-line bg-accent-soft/40' : 'border-line bg-surface')}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-[24px] font-bold leading-none tracking-tight text-ink">{value}</p>
        <Delta pct={delta ?? null} label={deltaLabel} higherIsBetter={higherIsBetter} />
      </div>
      <Sparkline values={spark} color={color} height={34} className="mt-2" />
      <div className="mt-1.5 space-y-0.5">
        {facts.map(([v, l]) => (
          <p key={v + l} className="truncate text-[11.5px] leading-tight text-ink-mute">
            {l ? <><span className="font-medium text-ink-soft tabular-nums">{v}</span> {l}</> : v}
          </p>
        ))}
      </div>
    </div>
  );
}
