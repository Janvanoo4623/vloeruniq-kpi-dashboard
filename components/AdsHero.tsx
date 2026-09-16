'use client';

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { AdsTotals, GoogleLeadStats, MarginAfterAds } from '@/lib/ads';
import { deltaPct } from '@/lib/ads';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { CHART } from '@/components/charts/theme';
import { Card, cn } from './ui';

/**
 * Het ene getal waar deze pagina om draait: wat er van de marge overblijft
 * nadat Google Ads betaald is. Groot, en met de balk eronder die laat zíen
 * hoe groot de hap is — 11,8% lees je, maar een smal grijs stuk aan het begin
 * van een lange petrol balk voel je.
 *
 * Rechts wat de advertenties opleverden. Dat is een ander getal dan links:
 * links gaat over het hele bedrijf, rechts alleen over de leads die via
 * Google binnenkwamen. Kleur alleen daar, want dát cijfer kan negatief zijn.
 */
export default function AdsHero({
  ads,
  google,
  som,
  totalMargin,
  prevNet,
  deltaLabel,
}: {
  ads: AdsTotals;
  google: GoogleLeadStats;
  som: MarginAfterAds;
  totalMargin: number;
  prevNet: number | null;
  deltaLabel: string;
}) {
  const positief = som.googleNet >= 0;
  const delta = prevNet != null ? deltaPct(som.net, prevNet) : null;
  // Aandeel van de kosten in de marge, begrensd zodat de balk bij verlies vol loopt.
  const share = totalMargin > 0 ? Math.min(1, ads.cost / totalMargin) : 1;
  const verlies = som.net < 0;

  return (
    <Card>
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
        <div className="px-6 py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Marge na Google Ads</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className={cn('text-[48px] font-bold leading-none tracking-tight', verlies ? 'text-crit' : 'text-ink')}>
              {formatEuro(som.net)}
            </p>
            <Delta pct={delta} label={deltaLabel} />
          </div>
          <p className="mt-2 text-[13px] text-ink-mute">
            van {formatEuro(totalMargin)} marge in deze periode gaat{' '}
            <span className="font-semibold text-ink">{formatPercent(som.costShareOfMargin)}</span> naar Google Ads
          </p>

          {/* De balk: één rij, twee delen, 2px wit ertussen. */}
          <div className="mt-5 flex h-3.5 w-full overflow-hidden rounded-full bg-sunk" role="img" aria-label={`Google Ads ${formatEuro(ads.cost)} van ${formatEuro(totalMargin)} marge`}>
            <div
              className="h-full rounded-l-full"
              style={{ width: `${Math.max(1.5, share * 100)}%`, background: verlies ? CHART.refused : CHART.adsCost }}
            />
            {!verlies && <div className="h-full flex-1 border-l-2 border-white" style={{ background: CHART.accepted }} />}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12px]">
            <span className="flex items-center gap-1.5 text-ink-mute">
              <i className="inline-block h-2 w-2 rounded-[2px]" style={{ background: verlies ? CHART.refused : CHART.adsCost }} />
              Google Ads <span className="font-semibold text-ink tabular-nums">{formatEuro(ads.cost)}</span>
            </span>
            {!verlies && (
              <span className="flex items-center gap-1.5 text-ink-mute">
                <i className="inline-block h-2 w-2 rounded-[2px]" style={{ background: CHART.accepted }} />
                Blijft over <span className="font-semibold text-ink tabular-nums">{formatEuro(som.net)}</span>
              </span>
            )}
          </div>
        </div>

        <div className={cn('flex flex-col justify-center border-t border-hair px-6 py-5 lg:border-l lg:border-t-0', positief ? 'bg-good-soft/60' : 'bg-crit-soft/60')}>
          <p className={cn('text-[11px] font-semibold uppercase tracking-[0.1em]', positief ? 'text-good' : 'text-crit')}>
            Rendement Google Ads
          </p>
          <p className={cn('mt-1.5 text-[30px] font-bold leading-none tracking-tight', positief ? 'text-good' : 'text-crit')}>
            {formatEuro(som.googleNet)}
          </p>
          <p className="mt-1.5 text-[12px] text-ink-mute">marge uit Google-leads min wat de advertenties kostten</p>
          <dl className="mt-4 space-y-1.5 text-[12.5px]">
            <Feit label="Omzet uit Google-leads" value={formatEuro(google.revenue)} hint={`${google.count} gewonnen · ${som.roas != null ? `${formatNumber(Math.round(som.roas * 10) / 10)}× de inzet` : '—'}`} />
            <Feit label="Marge daarvan" value={formatEuro(google.margin)} hint={google.marginRevenue > 0 ? formatPercent((google.margin / google.marginRevenue) * 100) : '—'} />
            <Feit label="Inzet" value={formatEuro(ads.cost)} hint={som.costPerWonDeal != null ? `${formatEuro(som.costPerWonDeal)} per gewonnen deal` : '—'} />
          </dl>
        </div>
      </div>
    </Card>
  );
}

function Feit({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-ink-mute">{label}</dt>
      <dd className="text-right">
        <div className="font-semibold text-ink tabular-nums">{value}</div>
        <div className="text-[11px] leading-tight text-ink-faint">{hint}</div>
      </dd>
    </div>
  );
}

export function Delta({ pct, label, higherIsBetter = true }: { pct: number | null; label: string; higherIsBetter?: boolean }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const flat = Math.abs(pct) < 0.05;
  const up = pct >= 0;
  const good = higherIsBetter ? up : !up;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span
      title={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset',
        flat ? 'bg-sunk text-ink-mute ring-ink-faint/20' : good ? 'bg-good-soft text-good ring-good/20' : 'bg-crit-soft text-crit ring-crit/20',
      )}
    >
      <Icon size={11} strokeWidth={2.6} />
      {Math.abs(pct).toFixed(1).replace('.', ',')}%
      <span className="hidden font-medium text-ink-faint sm:inline">{label}</span>
    </span>
  );
}
