'use client';

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { AdsPlatform, GoogleLeadStats } from '@/lib/ads';
import { PLATFORM_LABEL, PLATFORM_SOURCE_LABEL } from '@/lib/ads';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { CHART } from '@/components/charts/theme';
import { Card, cn } from './ui';

export const PLATFORM_COLOR: Record<AdsPlatform, string> = { google: CHART.adsCost, meta: CHART.metaCost };

export interface PlatformReturn {
  platform: AdsPlatform;
  cost: number;
  leads: GoogleLeadStats;
}

/**
 * Het ene getal waar het tabblad om draait: wat er van de marge overblijft
 * nadat de advertenties betaald zijn. De balk eronder laat zíen hoe groot de
 * hap is, per platform een eigen stuk.
 *
 * Rechts wat elk platform opleverde: marge uit de leads die via dat kanaal
 * binnenkwamen, min wat het kostte. Kleur alleen daar, want dát kan negatief.
 */
export default function AdsHero({
  totalMargin,
  platforms,
  prevNet,
  deltaLabel,
}: {
  totalMargin: number;
  /** Alleen gekoppelde platforms. */
  platforms: PlatformReturn[];
  prevNet: number | null;
  deltaLabel: string;
}) {
  const cost = platforms.reduce((s, p) => s + p.cost, 0);
  const net = Math.round((totalMargin - cost) * 100) / 100;
  const delta = prevNet != null && prevNet !== 0 ? Math.round(((net - prevNet) / Math.abs(prevNet)) * 1000) / 10 : null;
  const verlies = net < 0;
  const ref = Math.max(totalMargin, cost, 1);
  const share = totalMargin > 0 ? Math.round((cost / totalMargin) * 1000) / 10 : null;

  return (
    <Card>
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
        <div className="px-6 py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Marge na marketing</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className={cn('text-[48px] font-bold leading-none tracking-tight', verlies ? 'text-crit' : 'text-ink')}>
              {formatEuro(net)}
            </p>
            <Delta pct={delta} label={deltaLabel} />
          </div>
          <p className="mt-2 text-[13px] text-ink-mute">
            van {formatEuro(totalMargin)} marge in deze periode gaat{' '}
            <span className="font-semibold text-ink">{formatPercent(share)}</span> naar advertenties
          </p>

          {/* Eén balk: per platform een stuk, dan wat overblijft. 2px wit ertussen. */}
          <div
            className="mt-5 flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full bg-sunk"
            role="img"
            aria-label={`Advertenties ${formatEuro(cost)} van ${formatEuro(totalMargin)} marge`}
          >
            {platforms.map((p) => (
              <div
                key={p.platform}
                className="h-full first:rounded-l-full"
                style={{ width: `${Math.max(p.cost > 0 ? 1.2 : 0, (p.cost / ref) * 100)}%`, background: verlies ? CHART.refused : PLATFORM_COLOR[p.platform] }}
              />
            ))}
            {!verlies && <div className="h-full flex-1 rounded-r-full" style={{ background: CHART.accepted }} />}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px]">
            {platforms.map((p) => (
              <span key={p.platform} className="flex items-center gap-1.5 text-ink-mute">
                <i className="inline-block h-2 w-2 rounded-[2px]" style={{ background: PLATFORM_COLOR[p.platform] }} />
                {PLATFORM_LABEL[p.platform]} <span className="font-semibold text-ink tabular-nums">{formatEuro(p.cost)}</span>
              </span>
            ))}
            {!verlies && (
              <span className="ml-auto flex items-center gap-1.5 text-ink-mute">
                <i className="inline-block h-2 w-2 rounded-[2px]" style={{ background: CHART.accepted }} />
                Blijft over <span className="font-semibold text-ink tabular-nums">{formatEuro(net)}</span>
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-hair px-6 py-5 lg:border-l lg:border-t-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Rendement per kanaal</p>
          <p className="mt-1 text-[12px] text-ink-mute">marge uit de leads van dat kanaal, min wat het kostte</p>
          <div className="mt-3 space-y-2.5">
            {platforms.map((p) => {
              const rendement = Math.round((p.leads.margin - p.cost) * 100) / 100;
              const goed = rendement >= 0;
              const roas = p.cost > 0 ? Math.round((p.leads.revenue / p.cost) * 10) / 10 : null;
              return (
                <div
                  key={p.platform}
                  className={cn('rounded-xl px-3.5 py-3 ring-1 ring-inset', goed ? 'bg-good-soft/60 ring-good/20' : 'bg-crit-soft/60 ring-crit/20')}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft">
                      <i className="inline-block h-2 w-2 rounded-[2px]" style={{ background: PLATFORM_COLOR[p.platform] }} />
                      {PLATFORM_LABEL[p.platform]}
                    </span>
                    <span className={cn('text-[22px] font-bold leading-none tracking-tight', goed ? 'text-good' : 'text-crit')}>
                      {formatEuro(rendement)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-snug text-ink-mute">
                    {p.leads.count} gewonnen via “{PLATFORM_SOURCE_LABEL[p.platform]}” · {formatEuro(p.leads.revenue)} omzet ·{' '}
                    {formatEuro(p.leads.margin)} marge
                    {roas != null && <> · {formatNumber(roas)}× de inzet</>}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
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
