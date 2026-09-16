'use client';

import type { ReactNode } from 'react';
import { ChevronRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { AdsTotals, GoogleLeadStats, MarginAfterAds } from '@/lib/ads';
import { deltaPct } from '@/lib/ads';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { Card, cn } from './ui';

/**
 * Van advertentie tot marge, als één lijn. Eerder stonden hier dertien losse
 * kaarten in drie rijen; je las dertien getallen en moest het verhaal er zelf
 * bij verzinnen. Nu loopt het van links naar rechts: wat erin ging, wat dat
 * kocht, wat ervan terugkwam, en rechts wat er netto overblijft. De
 * verhoudingen (per klik, per conversie, per deal) staan klein onder de stap
 * waar ze bij horen, want dat zijn afgeleiden, geen eigen cijfers.
 *
 * Kleur alleen op het slot: het rendement is groen of rood, de rest niet.
 */
export default function AdsFunnel({
  ads,
  prev,
  google,
  som,
  totalMargin,
  avgMarginPct,
  prevNet,
}: {
  ads: AdsTotals;
  prev: AdsTotals | null;
  google: GoogleLeadStats;
  som: MarginAfterAds;
  totalMargin: number;
  avgMarginPct: number;
  /** Marge na Ads in de vergelijkingsperiode, als vergelijken aanstaat. */
  prevNet: number | null;
}) {
  const positief = som.googleNet >= 0;
  const steps: Step[] = [
    {
      label: 'Ingezet',
      value: formatEuro(ads.cost),
      sub: [`${formatNumber(ads.impressions)} vertoningen`],
      delta: deltaPct(ads.cost, prev?.cost),
      higherIsBetter: false,
    },
    {
      label: 'Klikken',
      value: formatNumber(ads.clicks),
      sub: [`${formatPercent(ads.ctr)} CTR`, `${formatEuro(ads.cpc, true)} per klik`],
      delta: deltaPct(ads.clicks, prev?.clicks),
    },
    {
      label: 'Conversies',
      value: formatNumber(Math.round(ads.conversions)),
      sub: [`${formatEuro(ads.cpa)} per conversie`, 'formulier of telefoontje'],
      delta: deltaPct(ads.conversions, prev?.conversions),
    },
    {
      label: 'Gewonnen',
      value: formatNumber(google.count),
      sub: [`${formatEuro(som.costPerWonDeal)} per deal`, 'leadbron Google'],
    },
    {
      label: 'Omzet',
      value: formatEuro(google.revenue),
      sub: [
        som.roas != null ? `${formatNumber(Math.round(som.roas * 10) / 10)}× de inzet` : '—',
        `${formatEuro(google.margin)} marge` +
          (google.marginRevenue > 0 ? ` (${formatPercent((google.margin / google.marginRevenue) * 100)})` : ''),
      ],
    },
  ];

  return (
    <Card>
      <div className="px-5 pt-4">
        <h3 className="text-[13px] font-semibold tracking-tight text-ink">Van advertentie tot marge</h3>
        <p className="mt-0.5 text-xs text-ink-mute">
          Kosten en klikken van Google; gewonnen offertes, omzet en marge uit Teamleader op leadbron “Google”
        </p>
      </div>

      {/* De trechter: vijf stappen, rechts het slot. Onder lg twee kolommen. */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-4 px-5 py-5 sm:grid-cols-3 lg:flex lg:items-stretch lg:gap-0">
        {steps.map((s, i) => (
          <div key={s.label} className="flex min-w-0 lg:flex-1 lg:items-start">
            <StepBlock {...s} />
            {i < steps.length - 1 && (
              <ChevronRight size={16} strokeWidth={2} className="mx-1 mt-7 hidden shrink-0 text-ink-faint lg:block" aria-hidden />
            )}
          </div>
        ))}

        <div
          className={cn(
            'col-span-2 flex flex-col justify-center rounded-xl px-4 py-3 ring-1 ring-inset sm:col-span-3 lg:ml-3 lg:w-[220px] lg:shrink-0',
            positief ? 'bg-good-soft ring-good/25' : 'bg-crit-soft ring-crit/25',
          )}
        >
          <p className={cn('text-[11.5px] font-semibold', positief ? 'text-good' : 'text-crit')}>Rendement Google Ads</p>
          <p className={cn('mt-1 text-[26px] font-bold leading-none tracking-tight tabular-nums', positief ? 'text-good' : 'text-crit')}>
            {formatEuro(som.googleNet)}
          </p>
          <p className="mt-1.5 text-[11.5px] leading-tight text-ink-mute">marge uit Google-leads min de inzet</p>
        </div>
      </div>

      {/* De rekensom: wat er van de hele marge overblijft. */}
      <div className="border-t border-hair bg-sunk/40 px-5 py-4">
        <div className="flex flex-col gap-y-1 text-[13px] text-ink-soft sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
          <Term label="Totale marge" value={formatEuro(totalMargin)} hint={`${formatPercent(avgMarginPct)} gemiddeld`} />
          <Term
            op="−"
            label="Google Ads"
            value={formatEuro(ads.cost)}
            hint={som.costShareOfMargin != null ? `${formatPercent(som.costShareOfMargin)} van de marge` : undefined}
          />
          <Term
            op="="
            label="Marge na Google Ads"
            value={formatEuro(som.net)}
            strong
            hint={prevNet != null ? `vorige periode ${formatEuro(prevNet)}` : undefined}
            delta={prevNet != null ? deltaPct(som.net, prevNet) : null}
          />
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
          Google telt een conversie op de dag van het contact, Teamleader een gewonnen offerte op de beslisdatum; die vallen
          zelden in dezelfde periode. Marge zoals op Marge; alleen Google Ads, geen andere marketingkosten.
          {google.unpricedCount > 0 && ` ${google.unpricedCount} gewonnen Google-offerte${google.unpricedCount === 1 ? '' : 's'} zonder inkoopprijs telt niet mee in de marge.`}
        </p>
      </div>
    </Card>
  );
}

interface Step {
  label: string;
  value: string;
  sub: string[];
  delta?: number | null;
  higherIsBetter?: boolean;
}

function StepBlock({ label, value, sub, delta, higherIsBetter = true }: Step) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{label}</p>
        <Delta pct={delta} higherIsBetter={higherIsBetter} />
      </div>
      <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-ink tabular-nums">{value}</p>
      {sub.map((t) => (
        <p key={t} className="mt-1 truncate text-[11.5px] leading-tight text-ink-mute" title={t}>
          {t}
        </p>
      ))}
    </div>
  );
}

function Term({
  op,
  label,
  value,
  hint,
  strong,
  delta,
}: {
  /** Het teken vóór deze term (− of =); op een telefoon staat elke term op een eigen regel. */
  op?: string;
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  delta?: number | null;
}) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      {op && <span className="w-3 text-ink-faint">{op}</span>}
      <span className="text-ink-mute">{label}</span>
      <span className={cn('tabular-nums', strong ? 'text-[17px] font-bold text-ink' : 'font-semibold text-ink')}>{value}</span>
      {hint && <span className="text-[11.5px] text-ink-faint">{hint}</span>}
      <Delta pct={delta} higherIsBetter />
    </span>
  );
}

/** Dezelfde pil als op KpiCard, zodat een delta er overal hetzelfde uitziet. */
function Delta({ pct, higherIsBetter }: { pct?: number | null; higherIsBetter: boolean }): ReactNode {
  if (pct == null || !Number.isFinite(pct)) return null;
  const flat = Math.abs(pct) < 0.05;
  const up = pct >= 0;
  const good = higherIsBetter ? up : !up;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span
      title="vs vorige periode"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums ring-1 ring-inset',
        flat ? 'bg-sunk text-ink-mute ring-ink-faint/20' : good ? 'bg-good-soft text-good ring-good/20' : 'bg-crit-soft text-crit ring-crit/20',
      )}
    >
      <Icon size={10} strokeWidth={2.6} />
      {Math.abs(pct).toFixed(1).replace('.', ',')}%
    </span>
  );
}
